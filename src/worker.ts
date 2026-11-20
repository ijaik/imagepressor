import { compressWithMainThread } from "./canvas";
import type { CompressionResult } from "./types";

const WORKER_SCRIPT = `
self.onmessage = async (e) => {
  const { id, blob, maxWidth, maxHeight, quality, mimeType, backgroundColor } = e.data;
  try {
    let bitmap;
    try {
      bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" });
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
    self.postMessage({ id, success: true, blob: outputBlob, width, height });
  } catch (err) {
    self.postMessage({ id, success: false, error: err?.message || String(err) });
  }
};
`;

/**
 * Runs image compression off the main thread in a Web Worker using createImageBitmap + OffscreenCanvas.
 * If Web Workers or OffscreenCanvas are blocked or unavailable, automatically falls back to main-thread processing.
 */
export async function compressWithWorker(
  blob: Blob,
  maxWidth: number | undefined,
  maxHeight: number | undefined,
  quality: number,
  mimeType: string,
  backgroundColor: string,
  signal?: AbortSignal,
): Promise<CompressionResult> {
  // Graceful fallback if Web Worker or OffscreenCanvas is unavailable (e.g. older browser or strict environment)
  if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined") {
    return compressWithMainThread(
      blob,
      maxWidth,
      maxHeight,
      quality,
      mimeType,
      backgroundColor,
      signal,
    );
  }

  let workerBlobUrl: string | null = null;

  try {
    const workerBlob = new Blob([WORKER_SCRIPT], {
      type: "application/javascript",
    });
    workerBlobUrl = URL.createObjectURL(workerBlob);
    const activeWorker = new Worker(workerBlobUrl);
    let workerRef: Worker | null = activeWorker;

    return await new Promise<CompressionResult>((resolve, reject) => {
      const id = Math.random().toString(36).slice(2);

      const cleanup = () => {
        if (workerRef) {
          workerRef.terminate();
          workerRef = null;
        }
        if (workerBlobUrl) {
          URL.revokeObjectURL(workerBlobUrl);
          workerBlobUrl = null;
        }
      };

      if (signal) {
        if (signal.aborted) {
          cleanup();
          reject(new DOMException("Compression aborted", "AbortError"));
          return;
        }
        signal.addEventListener(
          "abort",
          () => {
            cleanup();
            reject(new DOMException("Compression aborted", "AbortError"));
          },
          { once: true },
        );
      }

      activeWorker.onmessage = (e) => {
        if (e.data.id !== id) return;
        cleanup();
        if (e.data.success) {
          resolve({
            blob: e.data.blob,
            width: e.data.width,
            height: e.data.height,
          });
        } else {
          reject(new Error(e.data.error || "Worker compression failed"));
        }
      };

      activeWorker.onerror = (err) => {
        cleanup();
        reject(new Error(err.message || "Worker execution failed"));
      };

      activeWorker.postMessage({
        id,
        blob,
        maxWidth,
        maxHeight,
        quality,
        mimeType,
        backgroundColor,
      });
    });
  } catch {
    // If CSP blocks blob: workers or Worker throws, fallback to main thread
    return compressWithMainThread(
      blob,
      maxWidth,
      maxHeight,
      quality,
      mimeType,
      backgroundColor,
      signal,
    );
  }
}
