import type { CompressionResult } from "./types";

/**
 * Main-thread image compressor fallback.
 * Uses OffscreenCanvas if available, otherwise falls back to HTMLCanvasElement.
 */
export async function compressWithMainThread(
  blob: Blob,
  maxWidth: number | undefined,
  maxHeight: number | undefined,
  quality: number,
  mimeType: string,
  backgroundColor: string,
  signal?: AbortSignal,
): Promise<CompressionResult> {
  if (signal?.aborted) {
    throw new DOMException("Compression aborted", "AbortError");
  }

  // Fast path: use OffscreenCanvas on main thread if supported
  if (
    typeof OffscreenCanvas !== "undefined" &&
    typeof createImageBitmap !== "undefined"
  ) {
    let bitmap: ImageBitmap;
    try {
      bitmap = await createImageBitmap(blob, {
        imageOrientation: "from-image",
      });
    } catch {
      bitmap = await createImageBitmap(blob);
    }

    let width = bitmap.width;
    let height = bitmap.height;

    if (maxWidth && width > maxWidth) {
      height = Math.round((height * maxWidth) / width);
      width = maxWidth;
    }
    if (maxHeight && height > maxHeight) {
      width = Math.round((width * maxHeight) / height);
      height = maxHeight;
    }

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("OffscreenCanvas 2D context unavailable");

    if (mimeType === "image/jpeg" && backgroundColor) {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);
    }

    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const outputBlob = await canvas.convertToBlob({ type: mimeType, quality });
    return { blob: outputBlob, width, height };
  }

  // Fallback: standard DOM HTMLCanvasElement
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      resolve({ blob, width: 0, height: 0 });
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(blob);

    const onAbort = () => {
      URL.revokeObjectURL(url);
      reject(new DOMException("Compression aborted", "AbortError"));
    };

    if (signal) {
      if (signal.aborted) return onAbort();
      signal.addEventListener("abort", onAbort, { once: true });
    }

    img.onload = () => {
      URL.revokeObjectURL(url);
      let width = img.naturalWidth;
      let height = img.naturalHeight;

      if (maxWidth && width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
      if (maxHeight && height > maxHeight) {
        width = Math.round((width * maxHeight) / height);
        height = maxHeight;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas 2D context unavailable"));
        return;
      }

      if (mimeType === "image/jpeg" && backgroundColor) {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (resBlob) => {
          if (resBlob) resolve({ blob: resBlob, width, height });
          else reject(new Error("Canvas compression failed to produce blob"));
        },
        mimeType,
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image for compression"));
    };

    img.src = url;
  });
}
