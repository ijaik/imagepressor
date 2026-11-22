import React, { useState, useRef, useCallback } from "react";
import {
  Download,
  Columns,
  SplitSquareVertical,
  Layers,
  Copy,
  Check,
  Grid,
} from "lucide-react";
import type { ImageFileDetails } from "../types";
interface ComparisonViewerProps {
  original: ImageFileDetails | null;
  compressed: ImageFileDetails | null;
  isCompressing?: boolean;
  onDownload: () => void;
}
function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}
export const ComparisonViewer: React.FC<ComparisonViewerProps> = ({
  original,
  compressed,
  isCompressing = false,
  onDownload,
}) => {
  const [sliderPos, setSliderPos] = useState<number>(50); // percentage 0 - 100
  const [viewMode, setViewMode] = useState<"split" | "side-by-side" | "flip">(
    "split",
  );
  const [zoomLevel, setZoomLevel] = useState<"fit" | "100" | "200">("fit");
  const [showCheckered, setShowCheckered] = useState<boolean>(true);
  const [flipActive, setFlipActive] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const updatePosition = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(percent);
  }, []);
  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    updatePosition(e.clientX);
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDraggingRef.current) updatePosition(e.clientX);
  };
  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {}
  };
  // Keyboard navigation for split slider accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") setSliderPos((prev) => Math.max(0, prev - 5));
    else if (e.key === "ArrowRight")
      setSliderPos((prev) => Math.min(100, prev + 5));
  };
  // Copy compressed image to clipboard
  const handleCopyImage = async () => {
    if (!compressed) return;
    try {
      const res = await fetch(compressed.previewUrl);
      const blob = await res.blob();
      // PNG is universally supported for clipboard image write
      if (blob.type === "image/png") {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        // For WebP/JPEG, convert via canvas to clipboard image/png
        const img = new Image();
        img.src = compressed.previewUrl;
        await img.decode();
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0);
        canvas.toBlob(async (pngBlob) => {
          if (pngBlob) {
            await navigator.clipboard.write([
              new ClipboardItem({ "image/png": pngBlob }),
            ]);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }
        }, "image/png");
      }
    } catch (err) {
      console.debug("Clipboard copy note:", err);
    }
  };
  if (!original)
    return (
      <div className="h-96 rounded-3xl bg-zinc-900/30 border border-zinc-800/80 flex flex-col items-center justify-center p-6 text-center text-zinc-500 space-y-2">
        <Layers className="h-8 w-8 text-zinc-600" />
        <p className="text-sm font-medium text-zinc-400">
          Interactive Visual Studio
        </p>
        <p className="text-xs text-zinc-600 max-w-xs">
          Select or drop an image above to compare quality, compression
          artifacts, and transparency side-by-side.
        </p>
      </div>
    );
  const zoomClass =
    zoomLevel === "200"
      ? "scale-200"
      : zoomLevel === "100"
        ? "scale-100 max-w-none max-h-none"
        : "max-h-full max-w-full object-contain";
  const savedPercent =
    compressed && original
      ? ((original.size - compressed.size) / original.size) * 100
      : null;
  return (
    <div className="space-y-3">
      {/* Studio Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900/70 border border-zinc-800/80 rounded-2xl p-2 px-3 backdrop-blur-md shadow-sm">
        {/* Left: View Mode Tabs */}
        <div className="inline-flex rounded-xl bg-zinc-950/80 border border-zinc-800/80 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setViewMode("split")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              viewMode === "split"
                ? "bg-zinc-800 text-white font-medium shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Split comparison slider"
          >
            <SplitSquareVertical className="h-3.5 w-3.5" />
            <span>Split Slider</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("side-by-side")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              viewMode === "side-by-side"
                ? "bg-zinc-800 text-white font-medium shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Side-by-side dual view"
          >
            <Columns className="h-3.5 w-3.5" />
            <span>Side-by-Side</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("flip")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              viewMode === "flip"
                ? "bg-zinc-800 text-white font-medium shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
            title="Toggle between original and compressed"
          >
            <Layers className="h-3.5 w-3.5" />
            <span>A/B Flip</span>
          </button>
        </div>
        {/* Center: Zoom & Transparency Options */}
        <div className="flex items-center gap-1.5">
          {/* Zoom controls */}
          <div className="hidden sm:inline-flex rounded-xl bg-zinc-950/80 border border-zinc-800/80 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setZoomLevel("fit")}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                zoomLevel === "fit"
                  ? "bg-zinc-800 text-white font-medium"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Fit
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel("100")}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                zoomLevel === "100"
                  ? "bg-zinc-800 text-white font-medium"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              1:1
            </button>
            <button
              type="button"
              onClick={() => setZoomLevel("200")}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                zoomLevel === "200"
                  ? "bg-zinc-800 text-white font-medium"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              2x
            </button>
          </div>
          {/* Checkerboard toggle */}
          <button
            type="button"
            onClick={() => setShowCheckered(!showCheckered)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
              showCheckered
                ? "bg-sky-500/10 border-sky-500/30 text-sky-300"
                : "bg-zinc-950/80 border-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
            title="Toggle transparency checkerboard grid"
          >
            <Grid className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Grid</span>
          </button>
        </div>
        {/* Right: Copy & Download Actions */}
        <div className="flex items-center gap-2">
          {compressed && (
            <>
              <button
                type="button"
                onClick={handleCopyImage}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-300 hover:text-white transition-all cursor-pointer"
                title="Copy compressed image to clipboard"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-zinc-400" />
                    <span>Copy</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onDownload}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-linear-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-semibold shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                title="Download compressed image"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download ({formatBytes(compressed.size)})</span>
              </button>
            </>
          )}
        </div>
      </div>
      {/* Mode 1: Split Slider Canvas */}
      {viewMode === "split" && (
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className={`relative w-full h-115 sm:h-140 rounded-3xl overflow-hidden border border-zinc-800/90 select-none cursor-ew-resize group shadow-2xl transition-all ${
            showCheckered ? "bg-checkered" : "bg-zinc-950"
          }`}
          style={{ "--split-pos": `${sliderPos}%` } as React.CSSProperties}
        >
          {/* Compressed Image (Background Layer) */}
          <div className="absolute inset-0 flex items-center justify-center p-4 overflow-hidden">
            <img
              src={compressed ? compressed.previewUrl : original.previewUrl}
              alt="Compressed result"
              className={`transition-transform duration-100 ${zoomClass}`}
            />
            {/* Compressed Floating Badge (Top Right) */}
            <div className="absolute top-4 right-4 z-10 px-3 py-1.5 rounded-xl bg-zinc-950/85 backdrop-blur-md border border-zinc-800 text-xs font-mono text-white shadow-xl pointer-events-none flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  isCompressing || !compressed
                    ? "bg-sky-400 animate-pulse"
                    : "bg-emerald-400"
                }`}
              ></span>
              <span className="text-zinc-400 font-semibold">Compressed:</span>
              <span className="text-white font-bold">
                {compressed ? formatBytes(compressed.size) : "Processing..."}
              </span>
              {savedPercent !== null && compressed && (
                <span
                  className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                    savedPercent > 0
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                  }`}
                >
                  {savedPercent > 0
                    ? `-${savedPercent.toFixed(1)}%`
                    : "Preserved"}
                </span>
              )}
            </div>
          </div>
          {/* Original Image (Clipped Foreground Layer) */}
          <div
            className="absolute inset-0 flex items-center justify-center p-4 overflow-hidden pointer-events-none"
            style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
          >
            <img
              src={original.previewUrl}
              alt="Original uncompressed"
              className={`transition-transform duration-100 ${zoomClass}`}
            />
            {/* Original Floating Badge (Top Left) */}
            <div className="absolute top-4 left-4 z-10 px-3 py-1.5 rounded-xl bg-zinc-950/85 backdrop-blur-md border border-zinc-800 text-xs font-mono text-white shadow-xl pointer-events-none flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-zinc-400"></span>
              <span className="text-zinc-400 font-semibold">Original:</span>
              <span className="text-white font-bold">
                {formatBytes(original.size)}
              </span>
              <span className="text-zinc-500 text-[11px]">
                {original.width}×{original.height}
              </span>
            </div>
          </div>

          {/* Divider Handle with Tactile Icon */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-linear-to-b from-sky-400 via-white to-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.8)] z-20 pointer-events-auto"
            style={{ left: `${sliderPos}%` }}
            tabIndex={0}
            role="slider"
            aria-label="Before and after split comparison slider"
            aria-valuenow={Math.round(sliderPos)}
            aria-valuemin={0}
            aria-valuemax={100}
            onKeyDown={handleKeyDown}
          >
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-zinc-900 text-sky-400 flex items-center justify-center shadow-2xl cursor-ew-resize border border-sky-500/60 ring-2 ring-sky-400/20 hover:scale-110 transition-transform">
              <SplitSquareVertical className="h-4 w-4" />
            </div>
          </div>
        </div>
      )}

      {/* Mode 2: Side-by-Side Dual View */}
      {viewMode === "side-by-side" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Original Card */}
          <div className="rounded-3xl border border-zinc-800/90 bg-zinc-950 p-3.5 flex flex-col shadow-xl">
            <div className="flex items-center justify-between text-xs pb-2.5 mb-2.5 border-b border-zinc-800/80">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-zinc-400"></span>
                <span className="font-semibold text-zinc-200">
                  Original Asset
                </span>
              </div>
              <span className="font-mono text-zinc-400 text-[11px]">
                {formatBytes(original.size)} • {original.width}×
                {original.height}
              </span>
            </div>
            <div
              className={`flex-1 min-h-80 flex items-center justify-center p-3 rounded-2xl overflow-hidden ${
                showCheckered ? "bg-checkered" : "bg-zinc-900/40"
              }`}
            >
              <img
                src={original.previewUrl}
                alt="Original"
                className={`rounded-lg ${zoomClass}`}
              />
            </div>
          </div>

          {/* Compressed Card */}
          <div className="rounded-3xl border border-zinc-800/90 bg-zinc-950 p-3.5 flex flex-col shadow-xl">
            <div className="flex items-center justify-between text-xs pb-2.5 mb-2.5 border-b border-zinc-800/80">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400"></span>
                <span className="font-semibold text-sky-400">
                  Compressed Output
                </span>
              </div>
              <span className="font-mono text-zinc-200 text-[11px]">
                {compressed ? (
                  <>
                    <span className="font-bold text-white">
                      {formatBytes(compressed.size)}
                    </span>
                    <span className="text-zinc-500"> • </span>
                    <span className="text-zinc-400">
                      {compressed.width}×{compressed.height}
                    </span>
                  </>
                ) : (
                  "Compressing..."
                )}
              </span>
            </div>
            <div
              className={`flex-1 min-h-80 flex items-center justify-center p-3 rounded-2xl overflow-hidden ${
                showCheckered ? "bg-checkered" : "bg-zinc-900/40"
              }`}
            >
              {compressed ? (
                <img
                  src={compressed.previewUrl}
                  alt="Compressed"
                  className={`rounded-lg ${zoomClass}`}
                />
              ) : (
                <div className="text-xs text-zinc-500 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse"></span>
                  Processing compression...
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mode 3: A/B Flip Toggle */}
      {viewMode === "flip" && (
        <div className="space-y-2">
          <div
            onClick={() => setFlipActive(!flipActive)}
            className={`relative w-full h-115 sm:h-140 rounded-3xl overflow-hidden border border-zinc-800/90 select-none cursor-pointer group shadow-2xl flex items-center justify-center p-4 transition-all ${
              showCheckered ? "bg-checkered" : "bg-zinc-950"
            }`}
          >
            <img
              src={
                flipActive
                  ? original.previewUrl
                  : compressed
                    ? compressed.previewUrl
                    : original.previewUrl
              }
              alt="Flip comparison"
              className={`transition-transform duration-100 ${zoomClass}`}
            />

            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-4 py-1.5 rounded-full bg-zinc-950/90 backdrop-blur-md border border-zinc-800 text-xs font-mono shadow-xl flex items-center gap-2">
              <span className="text-zinc-400">Showing:</span>
              <span
                className={`font-bold ${
                  flipActive ? "text-amber-400" : "text-emerald-400"
                }`}
              >
                {flipActive ? "ORIGINAL" : "COMPRESSED"}
              </span>
              <span className="text-zinc-500 text-[10px]">
                (Click anywhere to flip)
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
