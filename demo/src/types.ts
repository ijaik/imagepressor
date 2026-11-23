import type {
  CompressOptions,
  ImageMetadata,
  JpegMetadata,
} from "imagepressor";
export type { CompressOptions, ImageMetadata, JpegMetadata };
export type ExifTagInfo = ImageMetadata;
export interface ImageFileDetails {
  file: File | Blob;
  name: string;
  size: number;
  width: number;
  height: number;
  mimeType: string;
  previewUrl: string;
}
export interface CompressionMetrics {
  originalSize: number;
  compressedSize: number;
  savedBytes: number;
  savedPercent: number;
  durationMs: number;
  speedMBs: number;
}
export type PresetKey = "landscape" | "portrait" | "logo";
export interface DemoPreset {
  key: PresetKey;
  label: string;
  sublabel: string;
  url: string;
  mimeType: "image/jpeg" | "image/webp";
  badge: string;
}
export interface CompressionProgressState {
  isCompressing: boolean;
  progress: number;
  stage: string;
}
