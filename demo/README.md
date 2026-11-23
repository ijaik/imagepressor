# imagepressor-demo

> Interactive visual studio and playground for **[imagepressor](https://github.com/ijaik/imagepressor)** — the zero-dependency, client-side image compression library that preserves EXIF metadata and Display P3 wide-gamut color profiles.

🌐 **Live Demo:** [https://ijaik.github.io/imagepressor/](https://ijaik.github.io/imagepressor/)

---

## Features

- **Split & Side-by-Side Visual Comparison:** Smooth interactive comparison slider with zoom/pan inspection to verify visual fidelity at 1:1 pixel scale.
- **Real-Time EXIF & Display P3 Color Gamut Analyzer:**
  - Inspects camera hardware (make & model), ISO, lens data, and capture timestamps.
  - Verifies Apple Display P3 wide-color gamut retention (APP2 / ICCP chunks).
  - Displays in-place EXIF orientation normalization status.
- **Dynamic Studio Controls:**
  - **Target Formats:** Instant switching between JPEG and WebP.
  - **Quality Slider:** 60 fps smooth slider with high-fidelity snapping presets (50%, 75%, 85%, 90%).
  - **Target Size Ceiling:** Max file size caps (0.5 MB, 1.0 MB, 2.0 MB, 5.0 MB).
  - **Downscaling Dimensions:** Instant proportional downscaling presets (4K 3840px, FHD 1920px, HD 1280px, Clear).
  - **Auto-Compress & Debounce:** Live background re-compression with 500ms debounce.
- **Throughput & Efficiency Metrics:**
  - Real-time file size reduction percentage and bytes saved.
  - Compression execution time in milliseconds and throughput in MB/s.
  - Anti-expansion indicators (detects and explains WebP $\rightarrow$ JPEG format expansions).
  - 100% Local privacy badge (zero bytes uploaded to servers).
- **Copyable TypeScript Code Drawer:** Generates ready-to-paste TypeScript snippet matching the exact active parameters in the studio.

---

## Tech Stack

- **Framework:** React 19 + TypeScript + Vite 8
- **Styling:** Tailwind CSS v4
- **Icons:** Lucide React
- **Linter:** Oxlint (high-performance Rust-based linter)
- **Runtime & Package Manager:** Bun

---

## Development

### Prerequisites

Ensure [Bun](https://bun.sh) is installed on your machine:

```bash
bun --version
```

### Installation

From the repository root or demo directory:

```bash
cd demo
bun install
```

### Available Scripts

| Command           | Description                                                        |
| :---------------- | :----------------------------------------------------------------- |
| `bun run dev`     | Starts Vite local development server with HMR.                     |
| `bun run build`   | Type-checks with `tsc -b` and builds production bundle to `dist/`. |
| `bun run lint`    | Runs `oxlint` on demo source files.                                |
| `bun run preview` | Previews the production build locally.                             |

---

## License

[MIT](https://github.com/ijaik/imagepressor/blob/main/LICENSE)
