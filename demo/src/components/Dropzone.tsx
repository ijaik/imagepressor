import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { FileImage, FolderOpen, UploadCloud, X } from "lucide-react";
import type { DemoPreset, PresetKey, ImageFileDetails } from "../types";
import { formatBytes } from "../lib/format";
import { Button, Label, Segmented } from "./Primitives";
const PRESETS: DemoPreset[] = [
  {
    key: "landscape",
    label: "4K Landscape",
    sublabel: "3840 × 2160 · high detail",
    url: `${import.meta.env.BASE_URL}samples/sample-landscape.webp`,
    mimeType: "image/jpeg",
    badge: "JPEG",
  },
  {
    key: "portrait",
    label: "Portrait",
    sublabel: "Display P3 · camera EXIF",
    url: `${import.meta.env.BASE_URL}samples/sample-portrait.webp`,
    mimeType: "image/jpeg",
    badge: "P3",
  },
  {
    key: "logo",
    label: "Tech Logo",
    sublabel: "Alpha channel · VP8L",
    url: `${import.meta.env.BASE_URL}samples/sample-logo.png`,
    mimeType: "image/webp",
    badge: "ALPHA",
  },
];
const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp,image/avif";
const SPECS = [
  { term: "Bundle", detail: "≈ 6 KB gzip" },
  { term: "Runtime", detail: "Web Worker" },
  { term: "Deps", detail: "none" },
];
interface DropzoneProps {
  currentFile: ImageFileDetails | null;
  activePreset: PresetKey | null;
  onSelectFile: (file: File) => void;
  onSelectPreset: (preset: DemoPreset) => void;
  onClear: () => void;
}
export default function Dropzone({
  currentFile,
  activePreset,
  onSelectFile,
  onSelectPreset,
  onClear,
}: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const openPicker = () => fileInputRef.current?.click();
  const acceptFile = (file: File) => {
    if (
      file.type.startsWith("image/") ||
      /\.(jpe?g|png|webp|avif)$/i.test(file.name)
    )
      onSelectFile(file);
  };
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) acceptFile(file);
  };
  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onSelectFile(file);
    e.target.value = "";
  };
  const choosePreset = (key: PresetKey | undefined) => {
    const preset = PRESETS.find((p) => p.key === key);
    if (preset) onSelectPreset(preset);
  };
  return (
    <>
      {/* One input shared by both states */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        onChange={handleFileInput}
        className="sr-only"
        tabIndex={-1}
      />
      {currentFile ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-panel border border-line bg-ink-2 p-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="size-11 shrink-0 overflow-hidden rounded-control border border-line bg-ink-3">
              {currentFile.previewUrl ? (
                <img
                  src={currentFile.previewUrl}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                <FileImage
                  className="m-auto size-4 text-dim"
                  aria-hidden="true"
                />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="truncate font-mono text-[12px] text-paper">
                  {currentFile.name}
                </span>
                <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.16em] text-signal">
                  {currentFile.mimeType.replace("image/", "")}
                </span>
              </div>
              <div className="mt-1 font-mono text-[10px] tabular-nums text-dim">
                {formatBytes(currentFile.size)}
                <span className="mx-1.5 text-line-2">/</span>
                {currentFile.width} × {currentFile.height} px
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label className="hidden sm:inline">specimens</Label>
            <Segmented
              label="Load a sample image"
              value={activePreset ?? undefined}
              options={PRESETS.map((p) => ({
                value: p.key,
                label: p.label.split(" ")[0],
                title: p.sublabel,
              }))}
              onChange={choosePreset}
            />
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <Button onClick={openPicker} title="Choose a different image">
              <FolderOpen className="size-3" aria-hidden="true" />
              Change
            </Button>
            <Button variant="quiet" onClick={onClear} title="Clear the studio">
              <X className="size-3" aria-hidden="true" />
              Clear
            </Button>
          </div>
        </div>
      ) : (
        <section className="border-b border-line pb-10">
          <div className="grid items-stretch gap-8 lg:grid-cols-[1.08fr_0.92fr]">
            <div className="flex flex-col justify-center">
              <Label tone="signal">01 — ingest</Label>
              <h1 className="mt-5 font-display text-[46px] leading-[0.92] tracking-[-0.015em] text-paper sm:text-[64px] lg:text-[68px]">
                Shrink the file.
                <br />
                <em className="text-muted">Keep the picture.</em>
              </h1>
              <p className="mt-5 max-w-[46ch] text-[13px] leading-relaxed text-muted">
                JPEG, PNG and WebP recompressed in the browser. The encoder runs
                in a worker on your own machine — no upload, no round trip, no
                server bill.
              </p>
              <dl className="mt-7 flex flex-wrap items-baseline gap-x-7 gap-y-2 font-mono text-[10px] uppercase tracking-[0.14em]">
                {SPECS.map((spec) => (
                  <div key={spec.term} className="flex items-baseline gap-2">
                    <dt className="text-dim">{spec.term}</dt>
                    <dd className="text-paper">{spec.detail}</dd>
                  </div>
                ))}
              </dl>
            </div>
            {/* Drop plate */}
            <div
              role="button"
              tabIndex={0}
              aria-label="Drop an image or browse files to compress"
              onClick={openPicker}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  openPicker();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`group flex min-h-58 cursor-pointer flex-col items-center justify-center gap-3 rounded-panel border border-dashed px-6 py-10 text-center transition-colors duration-150" ${
                isDragging
                  ? "border-signal bg-signal/[0.07]"
                  : "border-line-2 hover:border-dim hover:bg-ink-2"
              }`}
            >
              <UploadCloud
                className={`size-5 transition-colors duration-150" ${
                  isDragging ? "text-signal" : "text-dim group-hover:text-paper"
                }`}
                aria-hidden="true"
              />
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-paper">
                Drop an image
              </p>
              <p className="text-[12px] text-muted">
                or{" "}
                <span className="underline decoration-line-2 underline-offset-4 group-hover:decoration-signal">
                  browse files
                </span>
              </p>
              <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-dim">
                JPEG · PNG · WebP · AVIF
              </p>
            </div>
          </div>
          {/* Specimen strip */}
          <div className="mt-10">
            <div className="flex items-center gap-3">
              <Label>specimens</Label>
              <span className="h-px flex-1 bg-line" aria-hidden="true" />
              <span className="font-mono text-[10px] text-dim">
                load instantly
              </span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {PRESETS.map((preset, index) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => onSelectPreset(preset)}
                  className="group flex cursor-pointer items-start gap-3 rounded-panel border border-line bg-ink-2 p-3.5 text-left transition-colors duration-150 hover:border-line-2 hover:bg-ink-3"
                >
                  <span className="font-mono text-[10px] text-dim group-hover:text-signal">
                    0{index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] text-paper">
                      {preset.label}
                    </span>
                    <span className="mt-1 block truncate font-mono text-[10px] text-dim">
                      {preset.sublabel}
                    </span>
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-dim">
                    {preset.badge}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
