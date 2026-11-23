import { useState, type CSSProperties } from "react";
import { RotateCcw, Shield, Sparkles, Zap } from "lucide-react";
import type { CompressOptions, ExifTagInfo } from "../types";
import {
  Button,
  Field,
  Label,
  Note,
  Panel,
  PanelHead,
  Segmented,
  Toggle,
} from "./Primitives";
const SIZE_PRESETS: ReadonlyArray<{
  value: number | undefined;
  label: string;
}> = [
  { value: undefined, label: "off" },
  { value: 0.5, label: "0.5 MB" },
  { value: 1, label: "1 MB" },
  { value: 2, label: "2 MB" },
  { value: 5, label: "5 MB" },
];
const RESOLUTION_PRESETS: ReadonlyArray<{
  value: number | undefined;
  label: string;
}> = [
  { value: 3840, label: "4K" },
  { value: 1920, label: "FHD" },
  { value: 1280, label: "HD" },
  { value: undefined, label: "off" },
];
const QUALITY_SNAPS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 50, label: "50" },
  { value: 75, label: "75" },
  { value: 85, label: "85" },
  { value: 90, label: "90" },
];
const FORMATS = [
  {
    mime: "image/jpeg" as const,
    label: "JPEG",
    desc: "Universal photo support",
  },
  {
    mime: "image/webp" as const,
    label: "WebP",
    desc: "Smaller files, alpha",
  },
];
interface OptionsPanelProps {
  options: CompressOptions;
  autoCompress: boolean;
  isCompressing: boolean;
  originalExif?: ExifTagInfo | null;
  originalMimeType?: string;
  onOptionsChange: (newOptions: CompressOptions) => void;
  onAutoCompressChange: (enabled: boolean) => void;
  onManualCompress: () => void;
  onAbort: () => void;
  onReset: () => void;
}
export default function OptionsPanel({
  options,
  autoCompress,
  isCompressing,
  originalExif,
  originalMimeType,
  onOptionsChange,
  onAutoCompressChange,
  onManualCompress,
  onAbort,
  onReset,
}: OptionsPanelProps) {
  // Local sliding state keeps the slider at 60fps; the encoder runs on release.
  const [localQuality, setLocalQuality] = useState<number | null>(null);
  const isWebpToJpeg =
    originalMimeType === "image/webp" && options.mimeType === "image/jpeg";
  const displayQuality =
    localQuality ?? Math.round((options.quality ?? 0.85) * 100);
  const hasMetadata = originalExif
    ? originalExif.hasExif || originalExif.hasIccProfile
    : null;
  const hasCeiling =
    options.maxSizeMB !== undefined &&
    options.maxSizeMB !== Number.POSITIVE_INFINITY;
  const updateOption = <K extends keyof CompressOptions>(
    key: K,
    value: CompressOptions[K],
  ) => onOptionsChange({ ...options, [key]: value });
  const commitQuality = () => {
    if (localQuality !== null) {
      updateOption("quality", localQuality / 100);
      setLocalQuality(null);
    }
  };
  const qualityWord =
    displayQuality >= 85
      ? "high fidelity"
      : displayQuality >= 70
        ? "balanced"
        : "aggressive";
  return (
    <Panel className="flex h-full flex-col">
      <PanelHead title="controls">
        <button
          type="button"
          onClick={() => {
            setLocalQuality(null);
            onReset();
          }}
          className="inline-flex h-7 cursor-pointer items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-dim transition-colors duration-150 hover:text-paper"
        >
          <RotateCcw className="size-3" aria-hidden="true" />
          reset
        </button>
      </PanelHead>
      <Field
        label="output format"
        meta={hasCeiling ? "ceiling on" : "quality driven"}
      >
        <div className="grid grid-cols-2 gap-2">
          {FORMATS.map((format) => {
            const selected = (options.mimeType || "image/jpeg") === format.mime;
            return (
              <button
                key={format.mime}
                type="button"
                aria-pressed={selected}
                onClick={() => updateOption("mimeType", format.mime)}
                className={`cursor-pointer rounded-control border px-3 py-2.5 text-left transition-colors duration-150 ${
                  selected
                    ? "border-signal/70 bg-signal/10"
                    : "border-line bg-transparent hover:border-line-2 hover:bg-ink-3"
                }`}
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span
                    className={`font-mono text-[12px] tracking-tight ${selected ? "text-signal" : "text-paper"}`}
                  >
                    {format.label}
                  </span>
                  <span
                    className={`size-1.5 rounded-full ${selected ? "bg-signal" : "bg-line-2"}`}
                    aria-hidden="true"
                  />
                </span>
                <span className="mt-1 block text-[11px] text-dim">
                  {format.desc}
                </span>
              </button>
            );
          })}
        </div>
        {isWebpToJpeg && (
          <Note tone="warn" className="mt-2">
            WebP is roughly 30% more efficient than JPEG, so re-encoding this
            asset to JPEG will usually grow the file. Keep WebP for a smaller
            result.
          </Note>
        )}
      </Field>
      <Field
        label="quality"
        meta={
          <span className="tabular-nums">
            {qualityWord} · {displayQuality}%
          </span>
        }
      >
        <input
          id="quality-slider"
          type="range"
          min={5}
          max={100}
          step={1}
          value={displayQuality}
          aria-label="Compression quality"
          onChange={(e) => setLocalQuality(Number(e.target.value))}
          onPointerUp={commitQuality}
          onKeyUp={commitQuality}
          onBlur={commitQuality}
          onPointerCancel={() => setLocalQuality(null)}
          style={{ "--fill": displayQuality } as CSSProperties}
        />
        <Segmented
          label="Quality snap points"
          tone="accent"
          className="mt-2"
          value={displayQuality}
          options={QUALITY_SNAPS}
          onChange={(value) => updateOption("quality", value / 100)}
        />
        {displayQuality >= 100 && !hasCeiling && (
          <Note tone="warn" className="mt-2.5" role="alert">
            {options.mimeType === "image/webp" ? (
              <>
                At 100% browsers may switch WebP to lossless (VP8L) and inflate
                photographic files by ~45%. imagepressor returns the original in
                that case rather than grow it.
              </>
            ) : (
              <>
                At 100% with no ceiling and no downscale, imagepressor returns
                the original bytes instead of re-encoding, so nothing is lost to
                generation compression.
              </>
            )}
          </Note>
        )}
      </Field>
      <Field
        label="size ceiling"
        meta={hasCeiling ? `${options.maxSizeMB} MB` : "none"}
      >
        <Segmented
          label="Target maximum file size"
          tone="accent"
          value={hasCeiling ? options.maxSizeMB : undefined}
          options={SIZE_PRESETS}
          onChange={(value) => updateOption("maxSizeMB", value)}
        />
        <p className="mt-2 text-[11px] leading-snug text-dim">
          With a ceiling set, the encoder steps quality down until the file fits
          — or hands back the smallest attempt if it cannot.
        </p>
      </Field>
      <Field label="downscale" meta="long edge">
        <Segmented
          label="Maximum width preset"
          tone="accent"
          value={options.maxWidth}
          options={RESOLUTION_PRESETS}
          onChange={(width) =>
            onOptionsChange({
              ...options,
              maxWidth: width,
              maxHeight: undefined,
            })
          }
        />
        <div className="mt-3 grid grid-cols-2 gap-2">
          {(
            [
              { key: "maxWidth", label: "Max width" },
              { key: "maxHeight", label: "Max height" },
            ] as const
          ).map((field) => (
            <label key={field.key} className="block">
              <Label className="mb-1.5 block tracking-[0.14em]">
                {field.label}
              </Label>
              <span className="relative block">
                <input
                  type="number"
                  min={10}
                  inputMode="numeric"
                  placeholder="auto"
                  value={options[field.key] ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    updateOption(
                      field.key,
                      raw ? Math.max(10, Number(raw)) : undefined,
                    );
                  }}
                  className="h-9 w-full rounded-control border border-line bg-ink px-2.5 pr-8 font-mono text-[12px] tabular-nums text-paper placeholder:text-dim/70 hover:border-line-2 focus:border-signal focus:outline-none"
                />
                <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 font-mono text-[10px] text-dim">
                  px
                </span>
              </span>
            </label>
          ))}
        </div>
      </Field>
      <div className="divide-y divide-line">
        <Toggle
          checked={hasMetadata !== false && (options.preserveMetadata ?? true)}
          disabled={hasMetadata === false}
          onChange={(checked) => updateOption("preserveMetadata", checked)}
          label="Preserve EXIF & ICC"
          description={
            hasMetadata === false
              ? "This image carries no EXIF tags or embedded profile."
              : "Carries camera tags and the embedded ICC profile to the output."
          }
          icon={<Shield className="size-3" aria-hidden="true" />}
        />
        <Toggle
          checked={options.useWebWorker ?? true}
          onChange={(checked) => updateOption("useWebWorker", checked)}
          label="Web Worker"
          description="Encodes off the main thread so the interface keeps its frame rate."
          icon={<Zap className="size-3" aria-hidden="true" />}
        />
        <Toggle
          checked={autoCompress}
          onChange={onAutoCompressChange}
          label="Live re-encode"
          description="Re-runs 500 ms after any control changes."
          icon={<Sparkles className="size-3" aria-hidden="true" />}
        />
      </div>
      <div className="mt-auto p-3">
        {isCompressing ? (
          <Button variant="danger" onClick={onAbort} className="h-10 w-full">
            Stop encoding
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={onManualCompress}
            className="h-10 w-full"
          >
            <Zap className="size-3" aria-hidden="true" />
            Compress now
          </Button>
        )}
      </div>
    </Panel>
  );
}
