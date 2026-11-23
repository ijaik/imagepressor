export type InputMime = "image/jpeg" | "image/webp" | "image/png";
/**
 * Detects the input MIME type from the blob type, falling back to the file name.
 * This is the single rule used by the library and the demo.
 */
export function detectInputMime(
  fileOrBlob: File | Blob,
  fileName?: string,
): InputMime | undefined {
  const type = fileOrBlob.type;
  if (type === "image/jpeg" || type === "image/webp" || type === "image/png")
    return type;
  const name = fileName ?? (fileOrBlob instanceof File ? fileOrBlob.name : "");
  if (/\.(jpe?g)$/i.test(name)) return "image/jpeg";
  if (/\.webp$/i.test(name)) return "image/webp";
  if (/\.png$/i.test(name)) return "image/png";
  return undefined;
}
/**
 * Sniffs the first bytes of a blob to decide whether it is a JPEG or WebP
 * container. Returns null for anything else, so non-image blobs are never
 * walked or reported as "missing EXIF".
 */
export async function detectImageContainer(
  fileOrBlob: Blob,
): Promise<"jpeg" | "webp" | null> {
  if (fileOrBlob.size < 4) return null;
  const buffer = await fileOrBlob.slice(0, 12).arrayBuffer();
  const view = new DataView(buffer);
  if (view.byteLength >= 2 && view.getUint16(0) === 0xffd8) return "jpeg";
  if (
    view.byteLength >= 12 &&
    view.getUint32(0, false) === 0x52494646 &&
    view.getUint32(8, false) === 0x57454250
  )
    return "webp";
  return null;
}
/**
 * Proportional downscale that honours both maxWidth and maxHeight.
 * Shared by the OffscreenCanvas and HTMLCanvasElement paths.
 */
export function computeTargetSize(
  width: number,
  height: number,
  maxWidth?: number,
  maxHeight?: number,
): { width: number; height: number } {
  if (maxWidth && width > maxWidth) {
    height = Math.round((height * maxWidth) / width);
    width = maxWidth;
  }
  if (maxHeight && height > maxHeight) {
    width = Math.round((width * maxHeight) / height);
    height = maxHeight;
  }
  return { width, height };
}
/**
 * Throws the signal's abort reason when the signal has already been aborted.
 * `AbortSignal.throwIfAborted` is available in every runtime in the support
 * matrix (Chrome 100+, Firefox 97+, Safari 15.4+, Bun 1.0+, Deno 1.17+).
 */
export function assertNotAborted(signal?: AbortSignal): void {
  signal?.throwIfAborted();
}
