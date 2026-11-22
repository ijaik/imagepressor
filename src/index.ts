import { compressWithMainThread } from "./canvas";
import {
  extractMetadataSegments,
  spliceMetadataIntoBlob,
} from "./jpeg";
import { spliceWebpMetadata } from "./webp";
import type { CompressionResult, CompressOptions, ImageMetadata, JpegMetadata } from "./types";
import { compressWithWorker } from "./worker";

export { compressWithMainThread } from "./canvas";
export {
  extractMetadataSegments,
  getImageMetadata,
  getJpegMetadata,
  normalizeExifOrientation,
  spliceMetadataIntoBlob,
} from "./jpeg";
export { insertWebPExif, spliceWebpMetadata } from "./webp";
export { compressWithWorker } from "./worker";
export type { CompressionResult, CompressOptions, ImageMetadata, JpegMetadata };

/**
 * Compresses an image file or blob client-side.
 * Runs off the main thread in a Web Worker by default, preserving EXIF metadata and ICC color profiles for JPEGs & WebP.
 */
export async function compressImage(
  fileOrBlob: File | Blob,
  options: CompressOptions = {},
): Promise<File | Blob> {
  // If running in SSR / Node environment without DOM/Worker APIs, pass through unchanged
  if (typeof window === "undefined" && typeof self === "undefined") {
    return fileOrBlob;
  }

  const defaultMime: CompressOptions["mimeType"] =
    fileOrBlob.type === "image/webp" ||
    fileOrBlob.type === "image/png" ||
    (fileOrBlob instanceof File && /\.(png|webp)$/i.test(fileOrBlob.name))
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

  if (signal?.aborted) {
    throw new DOMException("Compression aborted", "AbortError");
  }

  const inputMime =
    fileOrBlob.type ||
    (fileOrBlob instanceof File && /\.(jpe?g)$/i.test(fileOrBlob.name)
      ? "image/jpeg"
      : fileOrBlob instanceof File && /\.webp$/i.test(fileOrBlob.name)
        ? "image/webp"
        : undefined);
  const isSameFormat = !inputMime || inputMime === mimeType;

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  // Short-circuit: When quality is 1.0 (100%) with no maxSizeMB ceiling and no resize requested:
  // - For WebP: Prevents browser canvas lossless mode (VP8L) inflating file sizes (+40% to +100%).
  // - For JPEG: Prevents pointless re-compression cycles and lossy generation degradation.
  // Both return the original image and warn developer to preserve fidelity and avoid wasted CPU.
  const isFullQualityWithoutCeiling =
    quality >= 1 &&
    (!maxSizeMB || !Number.isFinite(maxSizeBytes)) &&
    !maxWidth &&
    !maxHeight;

  if (isFullQualityWithoutCeiling) {
    if (mimeType === "image/webp") {
      console.warn(
        "[imagepressor] Warning: WebP quality is set to 1.0 (100%) without a maxSizeMB ceiling. In browsers, WebP quality 1.0 triggers lossless mode (VP8L), which can significantly inflate photographic image file sizes (+45% or more). Returning original image to prevent file size increase.",
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
  }

  // Only skip if a finite size ceiling was given, file is already under it, and quality is 1 without resizing
  const isAlreadyWithinBounds =
    Number.isFinite(maxSizeBytes) &&
    fileOrBlob.size <= maxSizeBytes &&
    !maxWidth &&
    !maxHeight &&
    (!fileOrBlob.type || fileOrBlob.type === mimeType) &&
    quality >= 1;

  if (isAlreadyWithinBounds) {
    return fileOrBlob;
  }

  onProgress?.(10, "Extracting metadata");

  // 1. Extract metadata segments if JPEG or WebP
  let metadataSegments: Uint8Array[] = [];
  const hasMetadataContainer =
    fileOrBlob.type === "image/jpeg" ||
    fileOrBlob.type === "image/webp" ||
    (fileOrBlob instanceof File && /\.(jpe?g|webp)$/i.test(fileOrBlob.name)) ||
    !fileOrBlob.type;

  if (preserveMetadata && hasMetadataContainer) {
    try {
      metadataSegments = await extractMetadataSegments(fileOrBlob);
    } catch {
      // Continue even if metadata extraction fails
    }

    if (metadataSegments.length === 0) {
      console.warn(
        "[imagepressor] Warning: Image does not contain EXIF metadata or Display P3 ICC profile to preserve.",
      );
    }
  }

  if (signal?.aborted)
    throw new DOMException("Compression aborted", "AbortError");

  onProgress?.(30, "Compressing pixels");

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
    onProgress?.(65, "Optimizing file size");
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

  if (signal?.aborted)
    throw new DOMException("Compression aborted", "AbortError");

  onProgress?.(85, "Preserving metadata");

  // 4. Splice original EXIF & ICC segments into output JPEG or WebP
  let finalBlob = result.blob;
  if (metadataSegments.length > 0) {
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
  }

  // 5. Anti-expansion guard: If output ended up larger than original and no dimension resizing was requested:
  // - When same format: ALWAYS return original to prevent re-compression size inflation.
  // - When converting format (e.g. WebP -> JPEG): return original if strict mode is active.
  const shouldPreventExpansion = strict !== undefined ? strict : isSameFormat;
  if (
    finalBlob.size >= fileOrBlob.size &&
    shouldPreventExpansion &&
    !maxWidth &&
    !maxHeight &&
    (!Number.isFinite(maxSizeBytes) || maxSizeBytes >= fileOrBlob.size / (1024 * 1024))
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
  ) {
    console.warn(
      `[imagepressor] Notice: Format conversion from ${inputMime || "original"} to ${mimeType} increased file size from ${(fileOrBlob.size / (1024 * 1024)).toFixed(2)} MB to ${(finalBlob.size / (1024 * 1024)).toFixed(2)} MB. Modern formats like WebP are ~30% more efficient than legacy JPEG. To prevent expansion, set strict: true or specify maxSizeMB.`,
    );
  }

  onProgress?.(100, "Complete");

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
