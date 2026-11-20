# imgcompressor

> High-performance, zero-dependency, client-side image compression library that runs off the main thread in a Web Worker, preserving camera EXIF metadata and Display P3 color profiles.

[![npm version](https://img.shields.io/npm/v/imgcompressor.svg)](https://www.npmjs.com/package/imgcompressor)
[![license](https://img.shields.io/npm/l/imgcompressor.svg)](https://github.com/ijaik/imgcompressor/blob/main/LICENSE)

---

## Highlights

- **Off-Main-Thread Processing:** Resizes and compresses images inside a dedicated Web Worker via `createImageBitmap` and `OffscreenCanvas`. No UI freezing, even with 30MB+ camera uploads.
- **100% CSP-Safe & Offline Ready:** Self-contained inline Web Worker. Never loads scripts from public CDNs like jsDelivr, ensuring full compliance with strict Content Security Policies.
- **Preserves True Colors (Display P3):** Automatically detects and re-injects APP2 (ICC color profile) binary segments into compressed JPEGs, preventing washed-out colors on iPhones and modern monitors.
- **Non-Destructive EXIF:** Preserves camera model, focal length, ISO, shutter speed, and capture timestamp.
- **Automatic Orientation Normalization:** Resets the EXIF orientation tag in-place to `1`, permanently preventing sideways/double-rotated images in external viewers.
- **Transparency Protection:** Pre-fills transparent pixels before converting PNG/WebP to JPEG, eliminating ugly black backgrounds.
- **Zero Runtime Dependencies:** Pure TypeScript and native Web Platform APIs. Under 7 KB minified.

---

## Installation

```bash
bun add imgcompressor
# or
npm install imgcompressor
# or
pnpm add imgcompressor
# or
yarn add imgcompressor
```

---

## Quick Start

Compress an image file down to under 1 MB and max 1920px width:

```typescript
import { compressImage } from "imgcompressor";

const fileInput = document.querySelector('input[type="file"]');

fileInput.addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const compressed = await compressImage(file, {
      maxSizeMB: 1,       // Target maximum size: 1 MB
      maxWidth: 1920,     // Max width in pixels (maintains aspect ratio)
      quality: 0.85,      // Visual quality (0.0 to 1.0)
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

### 1. Real-Time Progress Tracking

Keep your users informed during large multi-pass compressions:

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

### 2. Cancellation with AbortSignal

Cancel compression instantly if the user navigates away or clicks "Cancel":

```typescript
const controller = new AbortController();

// Cancel button click handler
cancelButton.addEventListener("click", () => {
  controller.abort();
});

try {
  const result = await compressImage(file, {
    maxSizeMB: 1,
    signal: controller.signal,
  });
} catch (err) {
  if (err.name === "AbortError") {
    console.log("Compression cancelled by user.");
  } else {
    console.error("An unexpected error occurred:", err);
  }
}
```

### 3. Converting Formats (PNG/WebP to JPEG)

When converting images with transparency to JPEG, specify a custom background color (defaults to `#ffffff`):

```typescript
const jpegFile = await compressImage(pngWithAlpha, {
  mimeType: "image/jpeg",
  backgroundColor: "#f4f4f5", // Fill color for transparent pixels
  quality: 0.88,
});
```

### 4. Direct Blob and Camera Input

`compressImage` accepts both `File` and `Blob` instances. If given a `File`, it returns a new `File` with the original filename and timestamp. If given a `Blob`, it returns a compressed `Blob`:

```typescript
// From a canvas or camera stream blob
const compressedBlob = await compressImage(canvasBlob, {
  maxSizeMB: 0.5,
  mimeType: "image/webp",
});
```

---

## Options API Reference

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `maxSizeMB` | `number` | `undefined` | Target maximum output file size in megabytes (e.g. `1` for 1 MB). If omitted, compression is governed by `quality` and dimensions without forcing a hard size ceiling. |
| `maxWidth` | `number` | `undefined` | Maximum width in pixels. Proportional scaling preserves aspect ratio. |
| `maxHeight` | `number` | `undefined` | Maximum height in pixels. Proportional scaling preserves aspect ratio. |
| `quality` | `number` | `0.85` | Compression quality between `0.0` (lowest, smallest) and `1.0` (highest, largest). |
| `mimeType` | `string` | input type | Target format (`"image/jpeg"`, `"image/webp"`, `"image/png"`). |
| `preserveMetadata`| `boolean` | `true` | When `true`, extracts and re-injects JPEG EXIF and ICC (Display P3) color profiles. |
| `backgroundColor` | `string` | `"#ffffff"` | Fill color for transparent pixels when converting alpha images to JPEG. |
| `useWebWorker` | `boolean` | `true` | Runs off the main thread in a Web Worker. Automatically falls back to main-thread processing if workers or `OffscreenCanvas` are unavailable. |
| `signal` | `AbortSignal` | `undefined` | An `AbortSignal` to cancel compression immediately and clean up worker memory. |
| `onProgress` | `function` | `undefined` | Callback receiving `(percent: number, stage: string)`. |

---

## Browser Support

`imgcompressor` is tested and supported across all modern browsers:

- **Chrome / Edge / Chromium:** 69+
- **Firefox:** 105+
- **Safari / iOS Safari:** 16.4+ (falls back gracefully to main thread on older iOS Safari)
- **Node.js / SSR:** Safely passes through input files without crashing during server-side rendering.

---

## Author

**Jai**  
GitHub: [@ijaik](https://github.com/ijaik)

---

## License

[MIT](LICENSE)
