import { compressWithMainThread } from "./canvas";
import { extractMetadataSegments, spliceMetadataIntoBlob } from "./jpeg";
import type { CompressionResult, CompressOptions } from "./types";
import { compressWithWorker } from "./worker";

export { compressWithMainThread } from "./canvas";
export {
  extractMetadataSegments,
  normalizeExifOrientation,
  spliceMetadataIntoBlob,
} from "./jpeg";
export { compressWithWorker } from "./worker";
export type { CompressionResult, CompressOptions };

/**
 * Compresses an image file or blob client-side.
 * Runs off the main thread in a Web Worker by default, preserving EXIF metadata and ICC color profiles for JPEGs.
 */
export async function compressImage(
  fileOrBlob: File | Blob,
  options: CompressOptions = {},
): Promise<File | Blob> {
  // If running in SSR / Node environment without DOM/Worker APIs, pass through unchanged
  if (typeof window === "undefined" && typeof self === "undefined") {
    return fileOrBlob;
  }

  const {
    maxSizeMB = Number.POSITIVE_INFINITY,
    maxWidth,
    maxHeight,
    quality = 0.85,
    mimeType = (fileOrBlob.type as CompressOptions["mimeType"]) || "image/jpeg",
    preserveMetadata = true,
    backgroundColor = "#ffffff",
    useWebWorker = true,
    signal,
    onProgress,
  } = options;

  if (signal?.aborted) {
    throw new DOMException("Compression aborted", "AbortError");
  }

  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  const isAlreadyWithinBounds =
    fileOrBlob.size <= maxSizeBytes &&
    !maxWidth &&
    !maxHeight &&
    (!fileOrBlob.type || fileOrBlob.type === mimeType);

  if (isAlreadyWithinBounds) {
    return fileOrBlob;
  }

  onProgress?.(10, "Extracting metadata");

  // 1. Extract metadata segments if JPEG
  let metadataSegments: Uint8Array[] = [];
  const isJpeg =
    fileOrBlob.type === "image/jpeg" ||
    (fileOrBlob instanceof File && /\.(jpe?g)$/i.test(fileOrBlob.name));

  if (preserveMetadata && isJpeg && mimeType === "image/jpeg") {
    try {
      metadataSegments = await extractMetadataSegments(fileOrBlob);
    } catch {
      // Continue even if metadata extraction fails
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
    backgroundColor,
    signal,
  );

  // 3. Adaptive second pass if output still exceeds maxSizeBytes
  if (result.blob.size > maxSizeBytes) {
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
      backgroundColor,
      signal,
    );
  }

  if (signal?.aborted)
    throw new DOMException("Compression aborted", "AbortError");

  onProgress?.(85, "Preserving metadata");

  // 4. Splice original EXIF & ICC segments into output JPEG
  let finalBlob = result.blob;
  if (metadataSegments.length > 0 && mimeType === "image/jpeg") {
    finalBlob = await spliceMetadataIntoBlob(finalBlob, metadataSegments);
  }

  onProgress?.(100, "Complete");

  // 5. If input was a File, preserve name and lastModified
  if (fileOrBlob instanceof File) {
    const ext =
      mimeType === "image/webp"
        ? "webp"
        : mimeType === "image/png"
          ? "png"
          : "jpg";
    const baseName = fileOrBlob.name.replace(/\.[^/.]+$/, "") || "photo";
    return new File([finalBlob], `${baseName}.${ext}`, {
      type: mimeType,
      lastModified: fileOrBlob.lastModified,
    });
  }

  return finalBlob;
}

export default compressImage;
