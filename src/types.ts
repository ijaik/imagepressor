export interface CompressOptions {
  /** Target maximum output file size in megabytes (e.g. 1 for 1 MB). If omitted, compression is governed by quality and dimensions without a hard megabyte ceiling. */
  maxSizeMB?: number;
  /** Maximum width in pixels. Proportional downscaling preserves aspect ratio. */
  maxWidth?: number;
  /** Maximum height in pixels. Proportional downscaling preserves aspect ratio. */
  maxHeight?: number;
  /** Compression quality between 0.0 and 1.0. Default: 0.85 */
  quality?: number;
  /** Output MIME type. Default: input file type, or 'image/jpeg' if input type is not supported. */
  mimeType?: "image/jpeg" | "image/webp" | "image/png";
  /** Whether to preserve JPEG EXIF (camera, lens, ISO) and ICC color profile (Display P3). Default: true */
  preserveMetadata?: boolean;
  /** Background color fill when converting images with transparency to JPEG. Default: '#ffffff' */
  backgroundColor?: string;
  /** Whether to run compression off the main thread in a Web Worker. Default: true */
  useWebWorker?: boolean;
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
