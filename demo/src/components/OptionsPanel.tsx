import React, { useState } from "react";
import {
  Sliders,
  Zap,
  XCircle,
  RotateCcw,
  Shield,
  AlertTriangle,
  Sparkles,
  Maximize2,
} from "lucide-react";
import type { CompressOptions, ExifTagInfo } from "../types";

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

const SIZE_PRESETS = [
  { label: "None", value: undefined },
  { label: "0.5 MB", value: 0.5 },
  { label: "1.0 MB", value: 1.0 },
  { label: "2.0 MB", value: 2.0 },
  { label: "5.0 MB", value: 5.0 },
];

const RESOLUTION_PRESETS = [
  { label: "4K (3840)", w: 3840 },
  { label: "FHD (1920)", w: 1920 },
  { label: "HD (1280)", w: 1280 },
  { label: "Clear", w: undefined },
];

const QUALITY_SNAPS = [
  { label: "50%", val: 50 },
  { label: "75%", val: 75 },
  { label: "85%", val: 85 },
  { label: "90%", val: 90 },
];

export const OptionsPanel: React.FC<OptionsPanelProps> = ({
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
}) => {
  // Local sliding state: keeps UI responsive at 60fps without triggering compression until release
  const [localQuality, setLocalQuality] = useState<number | null>(null);
  const isWebpToJpeg =
    originalMimeType === "image/webp" && options.mimeType === "image/jpeg";

  const displayQuality =
    localQuality ?? Math.round((options.quality ?? 0.85) * 100);
  const hasMetadata = originalExif
    ? originalExif.hasExif || originalExif.hasIccProfile
    : null;

  const updateOption = <K extends keyof CompressOptions>(
    key: K,
    value: CompressOptions[K],
  ) => {
    onOptionsChange({
      ...options,
      [key]: value,
    });
  };

  const updateOptions = (patch: Partial<CompressOptions>) => {
    onOptionsChange({
      ...options,
      ...patch,
    });
  };

  const commitQuality = () => {
    if (localQuality !== null) {
      updateOption("quality", localQuality / 100);
      setLocalQuality(null);
    }
  };

  return (
    <div className="bg-zinc-900/80 border border-zinc-800/90 rounded-3xl p-5 sm:p-6 space-y-6 backdrop-blur-xl shadow-2xl">
      {/* Deck Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-zinc-800/80">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400">
            <Sliders className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-tight">
              Studio Controls
            </h2>
            <p className="text-[11px] text-zinc-400">
              Tweak parameters with real-time feedback
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setLocalQuality(null);
            onReset();
          }}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-all cursor-pointer"
          title="Reset options to defaults"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Reset</span>
        </button>
      </div>

      {/* 1. Target MIME Format */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-zinc-200 uppercase tracking-wider text-[11px]">
            Target Format
          </label>
          <span className="text-[11px] font-mono text-zinc-500">
            Lossy & Lossless
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {[
            {
              mime: "image/jpeg" as const,
              label: "JPEG",
              desc: "Universal photo compatibility",
              badge: "Standard",
            },
            {
              mime: "image/webp" as const,
              label: "WebP",
              desc: "Higher savings & alpha transparency",
              badge: "Modern",
            },
          ].map((fmt) => {
            const isSelected = (options.mimeType || "image/jpeg") === fmt.mime;
            return (
              <button
                key={fmt.mime}
                type="button"
                onClick={() => updateOption("mimeType", fmt.mime)}
                className={`p-3 rounded-2xl border text-xs font-medium transition-all text-left flex flex-col justify-between gap-1 cursor-pointer ${
                  isSelected
                    ? "bg-sky-500/15 border-sky-500/60 text-white shadow-sm ring-1 ring-sky-500/30"
                    : "bg-zinc-950/60 hover:bg-zinc-800/70 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-bold text-sm text-zinc-100">
                    {fmt.label}
                  </span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      isSelected
                        ? "bg-sky-500/20 text-sky-300"
                        : "bg-zinc-800 text-zinc-400"
                    }`}
                  >
                    {fmt.badge}
                  </span>
                </div>
                <span className="text-[11px] text-zinc-400 leading-tight">
                  {fmt.desc}
                </span>
              </button>
            );
          })}
        </div>

        {isWebpToJpeg && (
          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-[11px] leading-relaxed">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
            <span>
              <strong>Format note:</strong> WebP is ~30% more efficient than
              JPEG. Converting this WebP asset to JPEG typically increases file
              size because JPEG requires more bytes for the same image fidelity.
              For smaller files, keep WebP.
            </span>
          </div>
        )}
      </div>

      {/* 2. Quality & Fidelity Slider */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between">
          <label
            htmlFor="quality-slider"
            className="text-xs font-semibold text-zinc-200 uppercase tracking-wider text-[11px]"
          >
            Compression Quality
          </label>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-400 font-mono">
              {displayQuality >= 85
                ? "High Fidelity"
                : displayQuality >= 70
                  ? "Balanced"
                  : "Aggressive"}
            </span>
            <span className="text-xs font-bold font-mono px-2 py-0.5 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/30">
              {displayQuality}%
            </span>
          </div>
        </div>

        <input
          id="quality-slider"
          type="range"
          min={5}
          max={100}
          step={1}
          value={displayQuality}
          onChange={(e) => setLocalQuality(Number(e.target.value))}
          onPointerUp={commitQuality}
          onTouchEnd={commitQuality}
          onKeyUp={commitQuality}
          className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer"
        />

        {/* Snap Buttons */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex gap-1.5">
            {QUALITY_SNAPS.map((snap) => (
              <button
                key={snap.val}
                type="button"
                onClick={() => updateOption("quality", snap.val / 100)}
                className={`px-2 py-0.5 rounded-md text-[11px] font-mono border transition-all cursor-pointer ${
                  displayQuality === snap.val
                    ? "bg-sky-500/20 text-sky-300 border-sky-500/40"
                    : "bg-zinc-950/60 text-zinc-400 hover:text-zinc-200 border-zinc-800"
                }`}
              >
                {snap.label}
              </button>
            ))}
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">
            85% default
          </span>
        </div>

        {/* 100% Quality Alert Notice */}
        {displayQuality >= 100 &&
          (!options.maxSizeMB ||
            options.maxSizeMB === Number.POSITIVE_INFINITY) && (
            <div
              role="alert"
              className="flex items-start gap-2 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-300 mt-2"
            >
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-[11px] leading-relaxed">
                {options.mimeType === "image/webp" ? (
                  <>
                    <strong className="font-semibold text-amber-200">
                      WebP 100% Notice:
                    </strong>{" "}
                    Browser canvas encodes WebP at 100% quality in lossless mode
                    (VP8L), which inflates photographic file sizes (+45%).
                    Imagepressor returns the original image to avoid file
                    expansion.
                  </>
                ) : (
                  <>
                    <strong className="font-semibold text-amber-200">
                      JPEG 100% Notice:
                    </strong>{" "}
                    At 100% quality without a size ceiling or resizing,
                    Imagepressor returns the original image to preserve full
                    fidelity and prevent re-compression generation loss.
                  </>
                )}
              </div>
            </div>
          )}
      </div>

      {/* 3. Target Max Size Ceiling */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-zinc-200 uppercase tracking-wider text-[11px]">
            Target Max Size Ceiling
          </label>
          <span className="text-[11px] font-mono text-zinc-400">
            {options.maxSizeMB && options.maxSizeMB !== Number.POSITIVE_INFINITY
              ? `${options.maxSizeMB} MB Ceiling`
              : "None (Governed by Quality)"}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SIZE_PRESETS.map((preset) => {
            const isSelected =
              preset.value === undefined
                ? !options.maxSizeMB ||
                  options.maxSizeMB === Number.POSITIVE_INFINITY
                : options.maxSizeMB === preset.value;
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => updateOption("maxSizeMB", preset.value)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono border transition-all cursor-pointer ${
                  isSelected
                    ? "bg-sky-500/20 border-sky-500/50 text-sky-300 font-semibold shadow-sm"
                    : "bg-zinc-950/60 hover:bg-zinc-800/80 border-zinc-800 text-zinc-400"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Resolution & Downscaling */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200 uppercase tracking-wider text-[11px]">
            <Maximize2 className="h-3.5 w-3.5 text-sky-400" />
            <span>Downscaling Dimensions</span>
          </div>
          <div className="flex gap-1.5">
            {RESOLUTION_PRESETS.map((res) => {
              const isSelected =
                res.w === undefined
                  ? !options.maxWidth && !options.maxHeight
                  : options.maxWidth === res.w;
              return (
                <button
                  key={res.label}
                  type="button"
                  onClick={() => {
                    updateOptions({ maxWidth: res.w, maxHeight: undefined });
                  }}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-sky-500/20 text-sky-300 border-sky-500/40 font-semibold shadow-xs"
                      : "bg-zinc-950/60 text-zinc-400 hover:text-zinc-200 border-zinc-800"
                  }`}
                >
                  {res.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className="text-[11px] text-zinc-400 mb-1 block">
              Max Width (px)
            </label>
            <input
              type="number"
              placeholder="e.g. 1920"
              value={options.maxWidth ?? ""}
              onChange={(e) =>
                updateOption(
                  "maxWidth",
                  e.target.value
                    ? Math.max(10, Number(e.target.value))
                    : undefined,
                )
              }
              className="w-full px-3 py-2 bg-zinc-950/80 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-sky-500"
            />
          </div>
          <div>
            <label className="text-[11px] text-zinc-400 mb-1 block">
              Max Height (px)
            </label>
            <input
              type="number"
              placeholder="e.g. 1080"
              value={options.maxHeight ?? ""}
              onChange={(e) =>
                updateOption(
                  "maxHeight",
                  e.target.value
                    ? Math.max(10, Number(e.target.value))
                    : undefined,
                )
              }
              className="w-full px-3 py-2 bg-zinc-950/80 border border-zinc-800 rounded-xl text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>
      </div>

      {/* 5. Engine Toggles (Metadata, Web Worker, Auto-Compress) */}
      <div className="pt-3 border-t border-zinc-800/80 space-y-3.5">
        {/* Preserve Metadata */}
        <div className="space-y-1.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Shield className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div
                  className={`text-xs font-semibold ${hasMetadata === false ? "text-zinc-500" : "text-zinc-200"}`}
                >
                  Preserve EXIF & Display P3 Gamut
                </div>
                <div className="text-[11px] text-zinc-400 leading-tight">
                  Preserves camera lens, ISO, timestamp & Display P3 ICC profile
                </div>
              </div>
            </div>
            <label
              className={`relative inline-flex items-center shrink-0 ${hasMetadata === false ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
            >
              <input
                type="checkbox"
                role="switch"
                disabled={hasMetadata === false}
                checked={
                  hasMetadata !== false && (options.preserveMetadata ?? true)
                }
                onChange={(e) =>
                  updateOption("preserveMetadata", e.target.checked)
                }
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>
          {hasMetadata === false && (
            <div
              role="alert"
              className="flex items-center gap-1.5 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300"
            >
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span>
                This image does not contain EXIF metadata or Display P3 ICC
                profile.
              </span>
            </div>
          )}
        </div>

        {/* Web Worker Toggle */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <Zap className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-semibold text-zinc-200">
                Web Worker Execution
              </div>
              <div className="text-[11px] text-zinc-400 leading-tight">
                Processes off main thread; keeps UI responsive at 60fps
              </div>
            </div>
          </div>
          <label className="relative inline-flex items-center shrink-0 cursor-pointer">
            <input
              type="checkbox"
              role="switch"
              checked={options.useWebWorker ?? true}
              onChange={(e) => updateOption("useWebWorker", e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
          </label>
        </div>

        {/* Instant Auto-Compress Toggle */}
        <div className="flex items-start justify-between gap-3 pt-1 border-t border-zinc-800/60">
          <div className="flex items-start gap-2.5">
            <Sparkles className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-semibold text-zinc-200">
                Instant Auto-Compress
              </div>
              <div className="text-[11px] text-zinc-400 leading-tight">
                Automatically recompresses with 500ms debounce
              </div>
            </div>
          </div>
          <label className="relative inline-flex items-center shrink-0 cursor-pointer">
            <input
              type="checkbox"
              role="switch"
              checked={autoCompress}
              onChange={(e) => onAutoCompressChange(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
          </label>
        </div>
      </div>

      {/* Action CTA Button */}
      <div className="pt-2">
        {isCompressing ? (
          <button
            type="button"
            onClick={onAbort}
            className="w-full py-3 px-4 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-rose-600/20 transition-all cursor-pointer"
          >
            <XCircle className="h-4 w-4" />
            <span>Abort Compression</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onManualCompress}
            className="w-full py-3 px-4 rounded-2xl bg-linear-to-r from-sky-500 via-cyan-500 to-emerald-500 hover:from-sky-400 hover:to-emerald-400 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-xl shadow-sky-500/25 transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
          >
            <Zap className="h-4 w-4 fill-current" />
            <span>Compress Now</span>
          </button>
        )}
      </div>
    </div>
  );
};
