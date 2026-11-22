import React from "react";
import { Camera, Eye, Palette, CheckCircle2, ShieldAlert } from "lucide-react";
import type { ExifTagInfo } from "../types";

export const ExifInspector: React.FC<{
  originalExif: ExifTagInfo | null;
  compressedExif: ExifTagInfo | null;
  preserveMetadata: boolean;
}> = ({ originalExif, compressedExif, preserveMetadata }) => {
  if (!originalExif) return null;

  const hasAnyMetadata =
    Boolean(originalExif.make) ||
    Boolean(originalExif.model) ||
    Boolean(originalExif.dateTime) ||
    originalExif.hasIccProfile ||
    originalExif.hasExif;

  return (
    <div className="rounded-3xl bg-zinc-900/70 border border-zinc-800/80 p-5 backdrop-blur-md shadow-xl space-y-3.5">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-sky-500/10 border border-sky-500/25 flex items-center justify-center text-sky-400">
            <Camera className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-zinc-100 uppercase tracking-wider">
              EXIF & Display P3 Color Gamut Analyzer
            </h3>
            <p className="text-[11px] text-zinc-400">
              Inspects embedded APP1/APP2 markers & RIFF metadata chunks
            </p>
          </div>
        </div>

        {/* Preservation Status Badge */}
        <div className="flex items-center gap-1.5">
          {preserveMetadata && compressedExif?.hasIccProfile ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/25">
              <CheckCircle2 className="h-3.5 w-3.5" />
              P3 & EXIF Preserved
            </span>
          ) : preserveMetadata &&
            (compressedExif?.hasExif || originalExif.hasExif) ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium font-mono text-sky-400 bg-sky-500/10 px-2.5 py-1 rounded-full border border-sky-500/25">
              <CheckCircle2 className="h-3.5 w-3.5" />
              EXIF Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium font-mono text-zinc-400 bg-zinc-800 px-2.5 py-1 rounded-full border border-zinc-700/60">
              <ShieldAlert className="h-3.5 w-3.5 text-zinc-500" />
              Stripped
            </span>
          )}
        </div>
      </div>

      {/* 4 Technical Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
        {/* 1. Camera Device */}
        <div className="p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800/80">
          <div className="text-zinc-500 text-[11px] mb-1 font-medium">
            Camera Hardware
          </div>
          <div className="font-semibold text-zinc-100 truncate font-mono text-xs text-wrap">
            {originalExif.make || originalExif.model
              ? `${originalExif.make || ""} ${originalExif.model || ""}`.trim()
              : "Standard Web Graphic"}
          </div>
        </div>

        {/* 2. Color Gamut */}
        <div className="p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800/80">
          <div className="flex items-center gap-1 text-zinc-500 text-[11px] mb-1 font-medium">
            <Palette className="h-3 w-3 text-amber-400" />
            <span>Color Profile (ICC / P3)</span>
          </div>
          <div className="font-semibold truncate flex items-center gap-1.5">
            {originalExif.hasIccProfile ? (
              <span className="text-amber-300 font-mono text-xs flex items-center gap-1 text-wrap">
                <span className="h-2 w-2 rounded-full bg-amber-400"></span>
                Display P3 Wide Gamut
              </span>
            ) : (
              <span className="text-zinc-300 font-mono text-xs text-wrap">
                sRGB Standard
              </span>
            )}
          </div>
        </div>

        {/* 3. Capture Timestamp */}
        <div className="p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800/80">
          <div className="text-zinc-500 text-[11px] mb-1 font-medium">
            Capture Timestamp
          </div>
          <div className="font-medium text-zinc-200 font-mono text-[11px] truncate text-wrap">
            {originalExif.dateTime || "Not recorded"}
          </div>
        </div>

        {/* 4. Orientation */}
        <div className="p-3 rounded-2xl bg-zinc-950/70 border border-zinc-800/80">
          <div className="flex items-center gap-1 text-zinc-500 text-[11px] mb-1 font-medium">
            <Eye className="h-3 w-3 text-indigo-400" />
            <span>EXIF Orientation</span>
          </div>
          <div className="font-medium text-zinc-200 font-mono text-xs text-wrap">
            {originalExif.orientation
              ? `Tag #${originalExif.orientation} → 1 (Normalized)`
              : "1 (Standard)"}
          </div>
        </div>
      </div>

      {!hasAnyMetadata && (
        <p className="text-[11px] text-zinc-500 italic pt-1">
          Note: This test image contains standard web raster headers. For full
          camera tags and Display P3 wide gamut, test with the Portrait preset.
        </p>
      )}
    </div>
  );
};
