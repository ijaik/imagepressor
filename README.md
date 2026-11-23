# imagepressor

> High-performance, zero-dependency, client-side image compression library that runs off the main thread in a Web Worker, preserving camera EXIF metadata and Display P3 color profiles across both JPEG and WebP.

[![Live Demo](https://img.shields.io/badge/demo-live%20interactive%20playground-sky?style=flat-square)](https://ijaik.github.io/imagepressor/)
[![npm version](https://img.shields.io/npm/v/imagepressor?style=flat-square&color=0ea5e9)](https://www.npmjs.com/package/imagepressor)
[![Bundle Size](https://img.shields.io/bundlephobia/minzip/imagepressor?style=flat-square&color=10b981)](https://bundlephobia.com/package/imagepressor)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

🎮 **Interactive Live Playground**: [https://ijaik.github.io/imagepressor/](https://ijaik.github.io/imagepressor/)

---

## Highlights

- **Off-Main-Thread Processing:** Compresses and resizes images inside a dedicated Web Worker via `createImageBitmap` and `OffscreenCanvas`. The UI remains smooth and responsive at 60 fps, even during 4K or 30MB+ camera photo uploads.
- **100% CSP-Safe & Offline-Ready:** Uses a self-contained inline Web Worker without external CDN scripts (`blob:` worker), complying with strict Content Security Policies.
- **Bi-Directional EXIF & Display P3 Preservation (JPEG & WebP):**
  - **JPEG:** Non-destructively preserves and re-injects raw APP1 (EXIF) and APP2 (ICC profile) segments.
  - **WebP:** Built-in pure TypeScript WebP RIFF muxer upgrades simple VP8 bitstreams into extended `VP8X` containers with dedicated `EXIF` and `ICCP` chunks (no WASM, no Node APIs).
  - Preserves camera make/model, focal length, ISO, shutter speed, and capture timestamps without washed-out colors on iPhones, MacBooks, and modern wide-gamut monitors.
- **Non-Destructive Orientation Normalization:** Normalizes EXIF orientation tags in place to `1` (Standard), preventing double-rotation issues in external viewers.
- **Zero-Memory Chunk-Hopping Inspector:** `getImageMetadata()` reads RIFF headers and hops past multi-megabyte image pixel frames directly to the metadata chunks, keeping memory footprint minimal.
- **Smart Anti-Expansion Guards & Strict Mode:**
  - Prevents generational file bloat when re-compressing already-optimized images.
  - Automatically guards against browser WebP 100% lossless mode (`VP8L`) inflation.
  - Supports `strict: true` (following Compressor.js standards) to guarantee output is never larger than the input file.
- **Native Transparency via WebP:** Recommends modern WebP for transparent assets (logos, UI graphics), eliminating black backgrounds without lossless PNG bloat.
- **Zero Runtime Dependencies:** Pure TypeScript and native Web Platform APIs. ~6 KB min+gzip.

---

## Installation

```bash
bun add imagepressor
# or
npm install imagepressor
# or
pnpm add imagepressor
# or
yarn add imagepressor
```

---

## Quick Start

Compress an image down to under 1 MB and max 1920px width:

```typescript
import { compressImage } from "imagepressor";

const fileInput = document.querySelector(
  'input[type="file"]',
) as HTMLInputElement;

fileInput.addEventListener("change", async (event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  try {
    const compressed = await compressImage(file, {
      maxSizeMB: 1, // Target maximum size: 1 MB
      maxWidth: 1920, // Max width in pixels (aspect ratio maintained)
      quality: 0.85, // Visual quality (0.0 to 1.0)
    });

    console.log("Original size:", file.size);
    console.log("Compressed size:", compressed.size);

    // Upload 'compressed' (File or Blob) to your server, S3, Cloudinary, etc.
  } catch (error) {
    console.error("Compression failed:", error);
  }
});
```

---

## Advanced Usage

### 1. WebP Compression with EXIF & Transparency

WebP delivers ~25–40% smaller file sizes than JPEG while supporting full alpha transparency. `imagepressor` injects TIFF-compliant EXIF and ICC chunks directly into the WebP container:

```typescript
const webpFile = await compressImage(originalFile, {
  mimeType: "image/webp",
  quality: 0.85,
  preserveMetadata: true, // Retains camera details & Display P3 ICC profile
});
```

### 2. Real-Time Progress Tracking

Keep users informed during multi-pass compression pipelines:

```typescript
const compressed = await compressImage(largeFile, {
  maxSizeMB: 1.5,
  maxWidth: 2560,
  onProgress: (percent, stage) => {
    console.log(`[${percent}%] Current stage: ${stage}`);
    // Stages: "Extracting metadata", "Compressing pixels", "Optimizing file size", "Preserving metadata", "Complete"
  },
});
```

### 3. Immediate Cancellation with AbortSignal

Cancel compression instantly if the user navigates away or clears the queue:

```typescript
const controller = new AbortController();

cancelButton.addEventListener("click", () => {
  controller.abort();
});

try {
  const result = await compressImage(file, {
    maxSizeMB: 1,
    signal: controller.signal,
  });
} catch (err: unknown) {
  if (err instanceof DOMException && err.name === "AbortError") {
    console.log("Compression cancelled by user.");
  } else {
    console.error("An unexpected error occurred:", err);
  }
}
```

### 4. Inspecting Image Metadata

Use the built-in parser to inspect camera hardware, orientation, and color profile from either JPEG or WebP files without decoding pixels:

```typescript
import { getImageMetadata } from "imagepressor";

const metadata = await getImageMetadata(file);

console.log(metadata.hasExif); // true
console.log(metadata.make); // "Apple"
console.log(metadata.model); // "iPhone 15 Pro"
console.log(metadata.dateTime); // "2024:05:12 14:23:01"
console.log(metadata.colorSpace); // "ICC profile embedded" (or "sRGB (Standard)")
console.log(metadata.orientation); // 1
```

---

## Options API Reference

| Option             | Type                                        | Default              | Description                                                                                                                                                                                                                            |
| :----------------- | :------------------------------------------ | :------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `maxSizeMB`        | `number`                                    | `undefined`          | Target maximum output file size in megabytes (e.g. `1` for 1 MB). If omitted, compression is governed by `quality` and dimensions without forcing a hard megabyte ceiling.                                                             |
| `maxWidth`         | `number`                                    | `undefined`          | Maximum width in pixels. Proportional scaling preserves aspect ratio.                                                                                                                                                                  |
| `maxHeight`        | `number`                                    | `undefined`          | Maximum height in pixels. Proportional scaling preserves aspect ratio.                                                                                                                                                                 |
| `quality`          | `number`                                    | `0.85`               | Compression quality between `0.0` (lowest, smallest) and `1.0` (highest, largest).                                                                                                                                                     |
| `mimeType`         | `"image/jpeg" \| "image/webp"`              | input type           | Target output format (`"image/jpeg"`, `"image/webp"`). Defaults to input MIME type (WebP/PNG $\rightarrow$ WebP, JPEG $\rightarrow$ JPEG).                                                                                             |
| `preserveMetadata` | `boolean`                                   | `true`               | When `true`, extracts and re-injects camera EXIF and the embedded ICC color profile for both JPEG and WebP outputs. Best-effort: corrupt metadata never fails a compression.                                                           |
| `strict`           | `boolean`                                   | `true` (same format) | When `true`, returns the original image if compression output turns out larger than the original image without dimension downscaling. Ignored when `maxSizeMB` is set: the smallest attempt is returned so the requested ceiling wins. |
| `useWebWorker`     | `boolean`                                   | `true`               | Runs off the main thread in an inline Web Worker. Automatically falls back to main-thread processing if workers or `OffscreenCanvas` are unavailable.                                                                                  |
| `signal`           | `AbortSignal`                               | `undefined`          | An `AbortSignal` to cancel compression immediately and clean up worker memory.                                                                                                                                                         |
| `onProgress`       | `(progress: number, stage: string) => void` | `undefined`          | Callback receiving `(percent: number, stage: string)`.                                                                                                                                                                                 |

---

## Exported Utilities

| Function                                           | Description                                                                                |
| :------------------------------------------------- | :----------------------------------------------------------------------------------------- |
| `compressImage(fileOrBlob, options)`               | Primary client-side compression function with worker offloading and metadata preservation. |
| `getImageMetadata(blob)`                           | Fast zero-memory metadata scanner for JPEG APP1/APP2 markers and WebP RIFF chunks.         |
| `extractMetadataSegments(blob)`                    | Extracts raw binary metadata segments (EXIF APP1 and ICC APP2) from JPEG or WebP files.    |
| `spliceMetadataIntoBlob(blob, segments)`           | Injects binary metadata segments into a JPEG blob.                                         |
| `spliceWebpMetadata(blob, segments, w, h)`         | Muxes binary metadata segments into an extended WebP container.                            |
| `insertWebPExif(webpBytes, rawExif, rawIcc, w, h)` | Low-level pure TypeScript WebP RIFF muxer that upgrades simple VP8 WebP to extended VP8X.  |
| `normalizeExifOrientation(segment)`                | Normalizes EXIF orientation tag in-place to `1` (Standard).                                |

---

## Browser Support

`imagepressor` is tested across all modern web browsers:

- **Chrome / Edge / Chromium:** 69+ (full Web Worker + `OffscreenCanvas` support)
- **Firefox:** 105+
- **Safari / iOS Safari:** 16.4+ (transparently falls back to main-thread canvas on older iOS Safari)
- **Node.js / SSR:** Safely passes through input files without crashing during server-side rendering.

---

## Author

**Jai**  
GitHub: [@ijaik](https://github.com/ijaik)

---

## License

[MIT](LICENSE)
