export interface CompressOptions {
  /** Target maximum output file size in megabytes (e.g. 1 for 1 MB). If omitted or Infinity, compression is governed by quality and dimensions without a hard megabyte ceiling. */
  maxSizeMB?: number;
  /** Maximum width in pixels. Proportional downscaling preserves aspect ratio. */
  maxWidth?: number;
  /** Maximum height in pixels. Proportional downscaling preserves aspect ratio. */
  maxHeight?: number;
  /** Compression quality between 0.0 and 1.0. Default: 0.85 */
  quality?: number;
  /** Output MIME type. Default: WebP for WebP/PNG inputs, otherwise JPEG (PNG is re-encoded as WebP because PNG has no lossy mode). */
  mimeType?: "image/jpeg" | "image/webp";
  /** Whether to preserve JPEG & WebP EXIF (camera, lens, ISO) and the embedded ICC color profile. Default: true. Metadata preservation is best-effort and never fails a compression. */
  preserveMetadata?: boolean;
  /** Whether to run compression off the main thread in a Web Worker. Default: true */
  useWebWorker?: boolean;
  /**
   * Whether to output the original image if the compressed result is larger than the original.
   * Default: true for same-format compression; optional for format conversions (e.g. WebP to JPEG).
   * Ignored when `maxSizeMB` is set: the smallest attempt is returned so the requested ceiling wins.
   */
  strict?: boolean;
  /** AbortSignal to cancel compression. */
  signal?: AbortSignal;
  /** Progress notification callback (progress: 0 to 100, stage: descriptive phase). */
  onProgress?: (progress: number, stage: string) => void;
}
export interface CompressionResult {
  blob: Blob;
  width: number;
  height: number;
}
export interface ImageMetadata {
  hasExif: boolean;
  hasIccProfile: boolean;
  orientation?: number;
  make?: string;
  model?: string;
  dateTime?: string;
  colorSpace: string;
}
export type JpegMetadata = ImageMetadata;
