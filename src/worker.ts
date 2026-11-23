import { compressWithMainThread } from "./canvas";
import type { CompressionResult } from "./types";
import { assertNotAborted } from "./utils";
const WORKER_SCRIPT = `
function computeTargetSize(width, height, maxWidth, maxHeight) {
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
self.onmessage = async (e) => {
  const { blob, maxWidth, maxHeight, quality, mimeType } = e.data;
  try {
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
    self.postMessage({ success: true, blob: outputBlob, width, height });
  } catch (err) {
    self.postMessage({ success: false, error: err?.message || String(err) });
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
  signal?: AbortSignal,
): Promise<CompressionResult> {
  assertNotAborted(signal);
  // Graceful fallback if Web Worker or OffscreenCanvas is unavailable (e.g. older browser or strict environment)
  if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined")
    return compressWithMainThread(
      blob,
      maxWidth,
      maxHeight,
      quality,
      mimeType,
      signal,
    );
  let workerBlobUrl: string | null = null;
  try {
    const workerBlob = new Blob([WORKER_SCRIPT], {
      type: "application/javascript",
    });
    workerBlobUrl = URL.createObjectURL(workerBlob);
  } catch {
    return compressWithMainThread(
      blob,
      maxWidth,
      maxHeight,
      quality,
      mimeType,
      signal,
    );
  }
  let activeWorker: Worker;
  try {
    activeWorker = new Worker(workerBlobUrl);
  } catch {
    // CSP blocked blob: workers, or Worker construction failed.
    URL.revokeObjectURL(workerBlobUrl);
    workerBlobUrl = null;
    return compressWithMainThread(
      blob,
      maxWidth,
      maxHeight,
      quality,
      mimeType,
      signal,
    );
  }
  return new Promise<CompressionResult>((resolve, reject) => {
    function cleanup() {
      activeWorker.terminate();
      signal?.removeEventListener("abort", onAbort);
      if (workerBlobUrl) {
        URL.revokeObjectURL(workerBlobUrl);
        workerBlobUrl = null;
      }
    }
    const onAbort = () => {
      cleanup();
      reject(new DOMException("Compression aborted", "AbortError"));
    };
    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener("abort", onAbort, { once: true });
    }
    activeWorker.onmessage = (e) => {
      cleanup();
      if (e.data.success)
        resolve({
          blob: e.data.blob,
          width: e.data.width,
          height: e.data.height,
        });
      else reject(new Error(e.data.error || "Worker compression failed"));
    };
    activeWorker.onerror = (err) => {
      cleanup();
      reject(new Error(err.message || "Worker execution failed"));
    };
    activeWorker.postMessage({
      blob,
      maxWidth,
      maxHeight,
      quality,
      mimeType,
    });
  });
}
