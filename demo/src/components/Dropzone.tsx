import React, { useRef, useState } from "react";
import {
  UploadCloud,
  Image as ImageIcon,
  Sparkles,
  FileImage,
  RefreshCw,
  FolderOpen,
} from "lucide-react";
import type { DemoPreset, PresetKey, ImageFileDetails } from "../types";

const PRESETS: DemoPreset[] = [
  {
    key: "landscape",
    label: "4K Landscape",
    sublabel: "3840×2160 • High Detail",
    url: `${import.meta.env.BASE_URL}samples/sample-landscape.webp`,
    type: "image/jpeg",
    badge: "JPEG 4K",
  },
  {
    key: "portrait",
    label: "Portrait",
    sublabel: "Display P3 • EXIF Tags",
    url: `${import.meta.env.BASE_URL}samples/sample-portrait.webp`,
    type: "image/jpeg",
    badge: "P3 & EXIF",
  },
  {
    key: "logo",
    label: "Tech Logo",
    sublabel: "Alpha Transparency → WebP",
    url: `${import.meta.env.BASE_URL}samples/sample-logo.png`,
    type: "image/webp",
    badge: "WebP Alpha",
  },
];

interface DropzoneProps {
  currentFile: ImageFileDetails | null;
  activePreset: PresetKey | null;
  onSelectFile: (file: File) => void;
  onSelectPreset: (preset: DemoPreset) => void;
  onClear: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

export const Dropzone: React.FC<DropzoneProps> = ({
  currentFile,
  activePreset,
  onSelectFile,
  onSelectPreset,
  onClear,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (
        file.type.startsWith("image/") ||
        /\.(jpe?g|png|webp|avif)$/i.test(file.name)
      ) {
        onSelectFile(file);
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      onSelectFile(file);
      e.target.value = "";
    }
  };

  // State A: Active Asset Toolbar (compact, sleek bar when an image is already in studio)
  if (currentFile) {
    return (
      <div className="bg-zinc-900/80 border border-zinc-800/90 rounded-2xl p-3 sm:p-4 backdrop-blur-md shadow-xl flex flex-wrap items-center justify-between gap-3 transition-all">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={handleFileInput}
          className="hidden"
        />

        {/* Current Asset Info */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-zinc-800 border border-zinc-700/80 overflow-hidden flex items-center justify-center shrink-0">
            {currentFile.previewUrl ? (
              <img
                src={currentFile.previewUrl}
                alt="Thumbnail"
                className="h-full w-full object-cover"
              />
            ) : (
              <FileImage className="h-5 w-5 text-sky-400" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-white truncate max-w-48 sm:max-w-72 font-mono">
                {currentFile.name}
              </span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-sky-400 border border-zinc-700/60 shrink-0">
                {currentFile.mimeType.replace("image/", "")}
              </span>
            </div>
            <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-2 mt-0.5">
              <span>{formatBytes(currentFile.size)}</span>
              <span>•</span>
              <span>
                {currentFile.width} × {currentFile.height} px
              </span>
            </div>
          </div>
        </div>

        {/* Instant Preset Switcher Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 max-w-full">
          <span className="text-[11px] text-zinc-500 font-medium shrink-0 mr-1 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-amber-400" />
            Samples:
          </span>
          {PRESETS.map((preset) => {
            const isActive = activePreset === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => onSelectPreset(preset)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  isActive
                    ? "bg-sky-500/20 border-sky-500/60 text-sky-200 shadow-sm"
                    : "bg-zinc-950/60 hover:bg-zinc-800 border-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
                title={`Switch to ${preset.label}`}
              >
                <span>{preset.label}</span>
                <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-zinc-800/80 text-zinc-400">
                  {preset.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800/90 hover:bg-zinc-700/90 border border-zinc-700 text-xs font-medium text-zinc-200 hover:text-white transition-all cursor-pointer shadow-sm"
            title="Choose a different image file"
          >
            <FolderOpen className="h-3.5 w-3.5 text-sky-400" />
            <span className="hidden sm:inline">Change File</span>
          </button>
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-950/80 hover:bg-rose-950/30 hover:border-rose-800/60 border border-zinc-800 text-xs font-medium text-zinc-400 hover:text-rose-300 transition-all cursor-pointer"
            title="Reset and clear active asset"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        </div>
      </div>
    );
  }

  // State B: Welcoming Hero Dropzone (when no asset is currently selected)
  return (
    <div className="space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-4 ${
          isDragging
            ? "border-sky-400 bg-sky-500/10 scale-[0.99] shadow-2xl shadow-sky-500/10"
            : "border-zinc-800 hover:border-sky-500/50 bg-zinc-900/40 hover:bg-zinc-900/70 shadow-xl"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          onChange={handleFileInput}
          className="hidden"
        />

        <div className="h-14 w-14 rounded-2xl bg-linear-to-b from-sky-500/20 to-sky-500/5 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-inner">
          <UploadCloud className="h-7 w-7" />
        </div>

        <div className="max-w-md space-y-1.5">
          <h2 className="text-base sm:text-lg font-semibold text-white tracking-tight">
            Drag & drop an image here, or{" "}
            <span className="text-sky-400 underline underline-offset-4 decoration-sky-400/50 hover:decoration-sky-400">
              browse files
            </span>
          </h2>
          <p className="text-xs text-zinc-400">
            Lossy & lossless client-side compression for JPEG, WebP, and PNG.
            Images never leave your browser.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] font-mono text-zinc-500 pt-1">
          <span className="px-2 py-0.5 rounded-full bg-zinc-800/80 border border-zinc-700/60">
            JPEG
          </span>
          <span className="px-2 py-0.5 rounded-full bg-zinc-800/80 border border-zinc-700/60">
            WebP
          </span>
          <span className="px-2 py-0.5 rounded-full bg-zinc-800/80 border border-zinc-700/60">
            PNG
          </span>
          <span>•</span>
          <span>Up to 100 MB</span>
        </div>
      </div>

      {/* Instant Sample Presets Grid */}
      <div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-2.5 font-medium px-1">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          <span>
            Or test immediately with built-in photographic test presets:
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              onClick={() => onSelectPreset(preset)}
              className="p-3.5 rounded-2xl text-left border border-zinc-800/90 bg-zinc-900/60 hover:bg-zinc-850 hover:border-sky-500/40 text-zinc-300 transition-all flex items-center justify-between gap-3 cursor-pointer group shadow-sm hover:shadow-md"
            >
              <div className="min-w-0">
                <div className="text-xs font-semibold text-white group-hover:text-sky-300 transition-colors flex items-center gap-1.5 truncate">
                  <ImageIcon className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                  <span className="truncate">{preset.label}</span>
                </div>
                <div className="text-[11px] text-zinc-400 truncate mt-0.5 font-mono">
                  {preset.sublabel}
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-zinc-800 text-zinc-400 border border-zinc-700/60 shrink-0 group-hover:border-sky-500/30">
                {preset.badge}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
