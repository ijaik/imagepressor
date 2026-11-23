import { compressWithMainThread } from "./canvas";
import { extractMetadataSegments, spliceMetadataIntoBlob } from "./jpeg";
import type { CompressOptions } from "./types";
import {
  assertNotAborted,
  detectImageContainer,
  detectInputMime,
} from "./utils";
import { spliceWebpMetadata } from "./webp";
import { compressWithWorker } from "./worker";
export { compressWithMainThread } from "./canvas";
export {
  extractMetadataSegments,
  getImageMetadata,
  getJpegMetadata,
  normalizeExifOrientation,
  spliceMetadataIntoBlob,
} from "./jpeg";
export { detectInputMime } from "./utils";
export { insertWebPExif, spliceWebpMetadata } from "./webp";
export { compressWithWorker } from "./worker";
export type {
  CompressOptions,
  CompressionResult,
  ImageMetadata,
  JpegMetadata,
} from "./types";
const STAGES = {
  extract: { progress: 10, stage: "Extracting metadata" },
  compress: { progress: 30, stage: "Compressing pixels" },
  optimize: { progress: 65, stage: "Optimizing file size" },
  preserve: { progress: 85, stage: "Preserving metadata" },
  complete: { progress: 100, stage: "Complete" },
} as const;
type StageName = keyof typeof STAGES;
/**
 * Short-circuit for quality 1.0 with no size ceiling and no resize request:
 * - WebP: avoids canvas lossless mode (VP8L) inflating photographic file sizes.
 * - JPEG: avoids pointless re-compression generation loss.
 */
function fullQualityOriginal(
  fileOrBlob: File | Blob,
  mimeType: CompressOptions["mimeType"],
  onProgress: CompressOptions["onProgress"],
): File | Blob | null {
  if (mimeType === "image/webp") {
    console.warn(
      "[imagepressor] Warning: WebP quality is set to 1.0 (100%) without a maxSizeMB ceiling. Browsers may encode WebP at quality 1.0 losslessly (VP8L), which can significantly inflate photographic image file sizes (+45% or more). Returning original image to prevent file size increase.",
    );
    onProgress?.(
      100,
      "Completed (original image preserved to prevent WebP 100% inflation)",
    );
    return fileOrBlob;
  }
  if (mimeType === "image/jpeg") {
    console.warn(
      "[imagepressor] Warning: JPEG quality is set to 1.0 (100%) without a maxSizeMB ceiling or resizing. Returning original image to preserve full fidelity and prevent re-compression generation loss.",
    );
    onProgress?.(
      100,
      "Completed (original image preserved to prevent JPEG re-compression)",
    );
    return fileOrBlob;
  }
  return null;
}
/**
 * Compresses an image file or blob client-side.
 * Runs off the main thread in a Web Worker by default, preserving EXIF metadata and ICC color profiles for JPEGs & WebP.
 */
export async function compressImage(
  fileOrBlob: File | Blob,
  options: CompressOptions = {},
): Promise<File | Blob> {
  // If neither rendering path's capabilities are available (Node.js / SSR, and
  // some Bun/Deno builds), pass the input through unchanged. `self` is not used
  // as the test because Bun and Deno also define it.
  const canUseOffscreen =
    typeof OffscreenCanvas !== "undefined" &&
    typeof createImageBitmap !== "undefined";
  const canUseDomCanvas =
    typeof document !== "undefined" && typeof Image !== "undefined";
  if (!canUseOffscreen && !canUseDomCanvas) return fileOrBlob;
  const inputMime = detectInputMime(fileOrBlob);
  const defaultMime: NonNullable<CompressOptions["mimeType"]> =
    inputMime === "image/webp" || inputMime === "image/png"
      ? "image/webp"
      : "image/jpeg";
  const {
    maxSizeMB = Number.POSITIVE_INFINITY,
    maxWidth,
    maxHeight,
    quality = 0.85,
    mimeType = defaultMime,
    preserveMetadata = true,
    useWebWorker = true,
    strict,
    signal,
    onProgress,
  } = options;
  const report = (stage: StageName) =>
    onProgress?.(STAGES[stage].progress, STAGES[stage].stage);
  assertNotAborted(signal);
  const isSameFormat = !inputMime || inputMime === mimeType;
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  const isFullQualityWithoutCeiling =
    quality >= 1 &&
    (!maxSizeMB || !Number.isFinite(maxSizeBytes)) &&
    !maxWidth &&
    !maxHeight;
  if (isFullQualityWithoutCeiling) {
    const original = fullQualityOriginal(fileOrBlob, mimeType, onProgress);
    if (original) return original;
  }
  // Only skip if a finite size ceiling was given, file is already under it, and quality is 1 without resizing
  const isAlreadyWithinBounds =
    Number.isFinite(maxSizeBytes) &&
    fileOrBlob.size <= maxSizeBytes &&
    !maxWidth &&
    !maxHeight &&
    (!inputMime || inputMime === mimeType) &&
    quality >= 1;
  if (isAlreadyWithinBounds) return fileOrBlob;
  report("extract");
  // 1. Extract metadata segments if the bytes actually are a JPEG or WebP container
  let metadataSegments: Uint8Array[] = [];
  const container = await detectImageContainer(fileOrBlob);
  if (preserveMetadata && container) {
    try {
      metadataSegments = await extractMetadataSegments(fileOrBlob);
    } catch {
      // Continue even if metadata extraction fails
    }
    if (metadataSegments.length === 0)
      console.warn(
        "[imagepressor] Warning: Image does not contain EXIF metadata or an ICC color profile to preserve.",
      );
  }
  assertNotAborted(signal);
  report("compress");
  // 2. Perform compression pass (Worker or Main Thread)
  const runner = useWebWorker ? compressWithWorker : compressWithMainThread;
  let result = await runner(
    fileOrBlob,
    maxWidth,
    maxHeight,
    quality,
    mimeType,
    signal,
  );
  // 3. Adaptive second pass if output still exceeds maxSizeBytes
  if (Number.isFinite(maxSizeBytes) && result.blob.size > maxSizeBytes) {
    report("optimize");
    const scaleRatio = Math.sqrt(maxSizeBytes / result.blob.size) * 0.95;
    const nextW = Math.max(
      800,
      Math.round(result.width * Math.min(0.85, scaleRatio)),
    );
    const nextQ = Math.max(0.65, quality * 0.85);
    result = await runner(
      result.blob,
      nextW,
      undefined,
      nextQ,
      mimeType,
      signal,
    );
  }
  assertNotAborted(signal);
  report("preserve");
  // 4. Splice original EXIF & ICC segments into output JPEG or WebP.
  // Metadata is best-effort: a corrupt segment must never fail the compression.
  let finalBlob = result.blob;
  if (metadataSegments.length > 0) {
    try {
      if (mimeType === "image/jpeg") {
        finalBlob = await spliceMetadataIntoBlob(finalBlob, metadataSegments);
      } else if (mimeType === "image/webp") {
        finalBlob = await spliceWebpMetadata(
          finalBlob,
          metadataSegments,
          result.width,
          result.height,
        );
      }
    } catch (err) {
      console.warn(
        "[imagepressor] Warning: Could not preserve metadata on the compressed image; returning pixels without metadata.",
        err,
      );
    }
  }
  // 5. Anti-expansion guard: If output ended up larger than original and no dimension resizing was requested:
  // - When same format: ALWAYS return original to prevent re-compression size inflation.
  // - When converting format (e.g. WebP -> JPEG): return original if strict mode is active.
  // When a size ceiling was requested, return the smallest attempt instead: the
  // caller asked for a target, so silently substituting the larger original would
  // defeat the request.
  const shouldPreventExpansion = strict !== undefined ? strict : isSameFormat;
  const hasSizeCeiling = Number.isFinite(maxSizeBytes);
  if (
    finalBlob.size >= fileOrBlob.size &&
    shouldPreventExpansion &&
    !maxWidth &&
    !maxHeight &&
    !hasSizeCeiling
  ) {
    console.warn(
      `[imagepressor] Notice: Compression to ${mimeType} resulted in a larger file (${(finalBlob.size / (1024 * 1024)).toFixed(2)} MB vs original ${(fileOrBlob.size / (1024 * 1024)).toFixed(2)} MB). Returning original file to prevent file size expansion.`,
    );
    return fileOrBlob;
  }
  if (
    finalBlob.size >= fileOrBlob.size &&
    !maxWidth &&
    !maxHeight &&
    !isSameFormat
  )
    console.warn(
      `[imagepressor] Notice: Format conversion from ${inputMime || "original"} to ${mimeType} increased file size from ${(fileOrBlob.size / (1024 * 1024)).toFixed(2)} MB to ${(finalBlob.size / (1024 * 1024)).toFixed(2)} MB. Modern formats like WebP are ~30% more efficient than legacy JPEG. To prevent expansion, set strict: true or specify maxSizeMB.`,
    );
  report("complete");
  // 6. If input was a File, preserve name and lastModified
  if (fileOrBlob instanceof File) {
    const ext = mimeType === "image/webp" ? "webp" : "jpg";
    const baseName = fileOrBlob.name.replace(/\.[^/.]+$/, "") || "photo";
    return new File([finalBlob], `${baseName}.${ext}`, {
      type: mimeType,
      lastModified: fileOrBlob.lastModified,
    });
  }
  return finalBlob;
}
export default compressImage;
