import type { CompressionResult } from "./types";
import { assertNotAborted, computeTargetSize } from "./utils";
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
  signal?: AbortSignal,
): Promise<CompressionResult> {
  assertNotAborted(signal);
  // Fast path: use OffscreenCanvas on main thread if supported
  if (
    typeof OffscreenCanvas !== "undefined" &&
    typeof createImageBitmap !== "undefined"
  ) {
    // `imageOrientation` already defaults to "from-image" per WHATWG HTML,
    // so a single no-options call is equivalent for every supported browser.
    const bitmap = await createImageBitmap(blob);
    const { width, height } = computeTargetSize(
      bitmap.width,
      bitmap.height,
      maxWidth,
      maxHeight,
    );
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("OffscreenCanvas 2D context unavailable");
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
    let settled = false;
    const onAbort = () => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      reject(new DOMException("Compression aborted", "AbortError"));
    };
    const settle = (action: () => void) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", onAbort);
      action();
    };
    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }
    img.onload = () => {
      if (settled) return;
      URL.revokeObjectURL(url);
      const { width, height } = computeTargetSize(
        img.naturalWidth,
        img.naturalHeight,
        maxWidth,
        maxHeight,
      );
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        settle(() => reject(new Error("Canvas 2D context unavailable")));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (resBlob) => {
          if (resBlob) settle(() => resolve({ blob: resBlob, width, height }));
          else
            settle(() =>
              reject(new Error("Canvas compression failed to produce blob")),
            );
        },
        mimeType,
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      settle(() => reject(new Error("Failed to load image for compression")));
    };
    img.src = url;
  });
}
