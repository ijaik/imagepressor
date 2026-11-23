import {
  useState,
  useRef,
  useCallback,
  type ReactNode,
  type PointerEvent,
  type KeyboardEvent,
} from "react";
import {
  Check,
  Columns,
  Copy,
  Download,
  Grid,
  Layers,
  SplitSquareVertical,
} from "lucide-react";
import type { ImageFileDetails } from "../types";
import { formatBytes } from "../lib/format";
import { useCopiedFlag } from "../lib/clipboard";
import { Button, Label, Segmented } from "./Primitives";
type ViewMode = "split" | "side-by-side" | "flip";
type ZoomLevel = "fit" | "100" | "200";
const VIEW_MODES: ReadonlyArray<{
  value: ViewMode;
  label: ReactNode;
  title: string;
}> = [
  {
    value: "split",
    label: (
      <>
        <SplitSquareVertical className="size-3" aria-hidden="true" />
        Split
      </>
    ),
    title: "Split comparison slider",
  },
  {
    value: "side-by-side",
    label: (
      <>
        <Columns className="size-3" aria-hidden="true" />
        Side
      </>
    ),
    title: "Side-by-side view",
  },
  {
    value: "flip",
    label: (
      <>
        <Layers className="size-3" aria-hidden="true" />
        A/B
      </>
    ),
    title: "Flip between original and compressed",
  },
];
const ZOOM_LEVELS: ReadonlyArray<{
  value: ZoomLevel;
  label: string;
  title: string;
}> = [
  { value: "fit", label: "Fit", title: "Fit to frame" },
  { value: "100", label: "1:1", title: "Actual pixels" },
  { value: "200", label: "2×", title: "Zoom to 200%" },
];
const ZOOM_CLASS: Record<ZoomLevel, string> = {
  fit: "max-h-full max-w-full object-contain",
  "100": "max-w-none max-h-none",
  "200": "scale-200",
};
interface ComparisonViewerProps {
  original: ImageFileDetails | null;
  compressed: ImageFileDetails | null;
  isCompressing?: boolean;
  onDownload: () => void;
  className?: string;
}
export default function ComparisonViewer({
  original,
  compressed,
  isCompressing = false,
  onDownload,
  className,
}: ComparisonViewerProps) {
  const [sliderPos, setSliderPos] = useState<number>(50);
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>("fit");
  const [showCheckered, setShowCheckered] = useState<boolean>(true);
  const [flipActive, setFlipActive] = useState<boolean>(false);
  const [copied, flashCopied] = useCopiedFlag();
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const updatePosition = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setSliderPos(Math.max(0, Math.min(100, (x / rect.width) * 100)));
  }, []);
  const handlePointerDown = (e: PointerEvent) => {
    isDraggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    updatePosition(e.clientX);
  };
  const handlePointerMove = (e: PointerEvent) => {
    if (isDraggingRef.current) updatePosition(e.clientX);
  };
  const handlePointerUp = (e: PointerEvent) => {
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {
      /* pointer capture may already be gone */
    }
  };
  // Keyboard alternative for the drag interaction
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") setSliderPos((prev) => Math.max(0, prev - 5));
    else if (e.key === "ArrowRight")
      setSliderPos((prev) => Math.min(100, prev + 5));
  };
  // Clipboard image writes only accept PNG, so other formats convert once.
  const toPngBlob = (blob: Blob): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error("Canvas 2D context unavailable"));
          return;
        }
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((pngBlob) => {
          URL.revokeObjectURL(url);
          if (pngBlob) resolve(pngBlob);
          else reject(new Error("PNG conversion failed"));
        }, "image/png");
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to decode image"));
      };
      img.src = url;
    });
  const handleCopyImage = async () => {
    if (!compressed) return;
    try {
      const pngBlob =
        compressed.file.type === "image/png"
          ? compressed.file
          : await toPngBlob(compressed.file);
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": pngBlob }),
      ]);
      flashCopied();
    } catch (err) {
      console.debug("Clipboard copy note:", err);
    }
  };
  if (!original) {
    return (
      <div
        className={`
          "flex min-h-70 flex-1 flex-col items-center justify-center gap-2 rounded-panel border border-line bg-ink-2 px-6 py-10 text-center",
          ${className}
        `}
      >
        <Layers className="size-4 text-dim" aria-hidden="true" />
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          plate empty
        </p>
        <p className="max-w-[34ch] text-[12px] leading-relaxed text-dim">
          Load an image to inspect quality, compression artefacts and alpha
          transparency side by side.
        </p>
      </div>
    );
  }
  const savedPercent = compressed
    ? ((original.size - compressed.size) / original.size) * 100
    : null;
  const badge =
    "pointer-events-none absolute z-10 flex items-center gap-2 rounded-control border border-line bg-ink px-2.5 py-1.5 font-mono text-[10px] tabular-nums";
  return (
    <div className={`flex min-h-0 flex-col gap-2 ${className}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-panel border border-line bg-ink-2 px-3 py-2">
        <Segmented
          label="Comparison mode"
          value={viewMode}
          options={VIEW_MODES}
          onChange={setViewMode}
        />
        <span className="hidden h-5 w-px bg-line sm:block" aria-hidden="true" />
        <Segmented
          label="Zoom level"
          value={zoomLevel}
          options={ZOOM_LEVELS}
          onChange={setZoomLevel}
        />
        <Button
          variant="quiet"
          onClick={() => setShowCheckered((v) => !v)}
          aria-pressed={showCheckered}
          title="Toggle the transparency checkerboard"
          className={`h-8 px-2.5 ${showCheckered ? "text-paper" : ""}`}
        >
          <Grid className="size-3" aria-hidden="true" />
          Grid
        </Button>
        <div className="ml-auto flex items-center gap-1.5">
          {compressed && (
            <>
              <Button
                variant="quiet"
                onClick={handleCopyImage}
                title="Copy the compressed image to the clipboard"
                className={`h-8 border border-line px-2.5 ${copied ? "text-good" : "text-muted hover:text-paper"}`}
              >
                {copied ? (
                  <Check className="size-3" aria-hidden="true" />
                ) : (
                  <Copy className="size-3" aria-hidden="true" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button variant="primary" onClick={onDownload}>
                <Download className="size-3" aria-hidden="true" />
                {formatBytes(compressed.size)}
              </Button>
            </>
          )}
        </div>
      </div>
      {/* Split slider */}
      {viewMode === "split" && (
        <div
          ref={containerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`relative min-h-100 w-full flex-1 touch-none select-none overflow-hidden rounded-panel border border-line sm:min-h-130 cursor-ew-resize ${showCheckered ? "bg-checker" : "bg-[#0a0908]"}`}
        >
          <div className="absolute inset-0 flex items-center justify-center overflow-hidden p-5">
            <img
              src={compressed ? compressed.previewUrl : original.previewUrl}
              alt="Compressed result"
              className={`transition-transform duration-100 ${ZOOM_CLASS[zoomLevel]}`}
            />
          </div>
          <div className={`${badge} top-3 right-3`}>
            <span
              className={`size-1.5 rounded-full ${isCompressing || !compressed ? "bg-signal" : "bg-good"}`}
            />
            <span className="text-dim">out</span>
            <span className="text-paper">
              {compressed ? formatBytes(compressed.size) : "···"}
            </span>
            {savedPercent !== null && (
              <span
                className={
                  savedPercent > 0.05
                    ? "text-good"
                    : savedPercent < -0.05
                      ? "text-warn"
                      : "text-dim"
                }
              >
                {savedPercent > 0.05
                  ? `−${savedPercent.toFixed(1)}%`
                  : savedPercent < -0.05
                    ? `+${Math.abs(savedPercent).toFixed(1)}%`
                    : "same"}
              </span>
            )}
          </div>
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden p-5"
            style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
          >
            <img
              src={original.previewUrl}
              alt="Original"
              className={`transition-transform duration-100 ${ZOOM_CLASS[zoomLevel]}`}
            />
          </div>
          <div className={`${badge} top-3 left-3`}>
            <span className="size-1.5 rounded-full bg-muted" />
            <span className="text-dim">in</span>
            <span className="text-paper">{formatBytes(original.size)}</span>
            <span className="text-dim">
              {original.width}×{original.height}
            </span>
          </div>
          <div
            className="absolute top-0 bottom-0 z-20 w-px bg-paper/80"
            style={{ left: `${sliderPos}%` }}
            tabIndex={0}
            role="slider"
            aria-label="Original and compressed split position"
            aria-valuenow={Math.round(sliderPos)}
            aria-valuemin={0}
            aria-valuemax={100}
            onKeyDown={handleKeyDown}
          >
            <div className="absolute top-1/2 left-1/2 flex size-6 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center gap-0.5 rounded-xs border border-ink bg-paper">
              <span className="h-2.5 w-px bg-ink/60" aria-hidden="true" />
              <span className="h-2.5 w-px bg-ink/60" aria-hidden="true" />
            </div>
          </div>
        </div>
      )}
      {/* Side by side */}
      {viewMode === "side-by-side" && (
        <div className="grid auto-rows-fr grid-cols-1 gap-2 md:grid-cols-2 flex-1">
          {[
            {
              key: "in",
              title: "Original",
              size: original.size,
              width: original.width,
              height: original.height,
              url: original.previewUrl,
            },
            {
              key: "out",
              title: "Compressed",
              size: compressed?.size ?? 0,
              width: compressed?.width ?? 0,
              height: compressed?.height ?? 0,
              url: compressed?.previewUrl ?? null,
            },
          ].map((plate) => (
            <div
              key={plate.key}
              className="flex flex-col rounded-panel border border-line bg-ink-2"
            >
              <div className="flex items-baseline justify-between gap-3 border-b border-line px-3 py-2">
                <Label
                  className={plate.key === "out" ? "text-paper" : undefined}
                >
                  {plate.title}
                </Label>
                <span className="font-mono text-[10px] tabular-nums text-dim">
                  {plate.url
                    ? `${formatBytes(plate.size)} · ${plate.width}×${plate.height}`
                    : "working"}
                </span>
              </div>
              <div
                className={`flex min-h-60 flex-1 items-center justify-center overflow-hidden p-4 sm:min-h-80 ${showCheckered ? "bg-checker" : "bg-[#0a0908]"}`}
              >
                {plate.url ? (
                  <img
                    src={plate.url}
                    alt={plate.title}
                    className={ZOOM_CLASS[zoomLevel]}
                  />
                ) : (
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-signal">
                    encoding…
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {/* A/B flip */}
      {viewMode === "flip" && (
        <div
          onClick={() => setFlipActive((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setFlipActive((v) => !v);
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Toggle between original and compressed"
          className={`relative flex min-h-100 w-full flex-1 cursor-pointer select-none items-center justify-center overflow-hidden rounded-panel border border-line px-5 sm:min-h-130 ${showCheckered ? "bg-checker" : "bg-[#0a0908]"}`}
        >
          <img
            src={
              flipActive
                ? original.previewUrl
                : (compressed?.previewUrl ?? original.previewUrl)
            }
            alt="Comparison"
            className={`transition-transform duration-100 ${ZOOM_CLASS[zoomLevel]}`}
          />
          <div className={`${badge} top-3 left-1/2 -translate-x-1/2`}>
            <span className="text-dim">showing</span>
            <span className={flipActive ? "text-muted" : "text-good"}>
              {flipActive ? "original" : "compressed"}
            </span>
            <span className="hidden text-dim sm:inline">click to flip</span>
          </div>
        </div>
      )}
    </div>
  );
}
