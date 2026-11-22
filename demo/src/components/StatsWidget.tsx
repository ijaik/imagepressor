import React from "react";
import {
  ArrowDownRight,
  Clock,
  Zap,
  Maximize2,
  ShieldCheck,
} from "lucide-react";
import type { CompressionMetrics, ImageFileDetails } from "../types";

function formatBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

export const StatsWidget: React.FC<{
  metrics: CompressionMetrics | null;
  original: ImageFileDetails | null;
  compressed: ImageFileDetails | null;
}> = ({ metrics, original, compressed }) => {
  if (!metrics || !original || !compressed) {
    return null;
  }

  const isSmaller = metrics.savedPercent > 0;
  const isIdentical = metrics.savedBytes === 0;

  // Compute aspect ratio
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(compressed.width || 1, compressed.height || 1);
  const ratioW = Math.round((compressed.width || 1) / divisor);
  const ratioH = Math.round((compressed.height || 1) / divisor);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-3 sm:p-4 backdrop-blur-md shadow-lg">
      {/* 1. Size Reduction */}
      <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
          <span className="font-medium">File Size Reduction</span>
          <ArrowDownRight
            className={`h-4 w-4 ${
              isIdentical
                ? "text-sky-400"
                : isSmaller
                  ? "text-emerald-400"
                  : "text-amber-400"
            }`}
          />
        </div>
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono text-white tracking-tight">
              {formatBytes(compressed.size)}
            </span>
            <span className="text-xs text-zinc-500 line-through font-mono">
              {formatBytes(original.size)}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold font-mono ${
                isIdentical
                  ? "bg-sky-500/15 text-sky-400 border border-sky-500/25"
                  : isSmaller
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25"
                    : "bg-amber-500/15 text-amber-400 border border-amber-500/25"
              }`}
            >
              {isIdentical
                ? "0.0% (Original Preserved)"
                : isSmaller
                  ? `-${metrics.savedPercent.toFixed(1)}%`
                  : `+${Math.abs(metrics.savedPercent).toFixed(1)}%`}
            </span>
            {isSmaller && (
              <span className="text-[10px] text-zinc-400 font-mono">
                ({formatBytes(metrics.savedBytes)} saved)
              </span>
            )}
            {!isSmaller &&
              !isIdentical &&
              original.mimeType === "image/webp" &&
              compressed.mimeType === "image/jpeg" && (
                <span className="text-[10px] text-amber-400/90 font-mono">
                  (WebP → JPEG format expansion)
                </span>
              )}
          </div>
        </div>
      </div>

      {/* 2. Compression Speed */}
      <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
          <span className="font-medium">Execution Time</span>
          <Clock className="h-4 w-4 text-sky-400" />
        </div>
        <div>
          <div className="text-xl font-bold font-mono text-white tracking-tight">
            {metrics.durationMs < 1000
              ? `${Math.round(metrics.durationMs)} ms`
              : `${(metrics.durationMs / 1000).toFixed(2)} s`}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] font-mono text-zinc-400">
            <Zap className="h-3 w-3 text-amber-400 fill-amber-400/20" />
            <span>
              {metrics.speedMBs > 0
                ? `${metrics.speedMBs.toFixed(1)} MB/s throughput`
                : "Ultra-fast"}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Output Resolution */}
      <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
          <span className="font-medium">Canvas Resolution</span>
          <Maximize2 className="h-4 w-4 text-indigo-400" />
        </div>
        <div>
          <div className="text-xl font-bold font-mono text-white tracking-tight truncate">
            {compressed.width} × {compressed.height}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] font-mono text-zinc-400">
            <span>
              {ratioW}:{ratioH} ratio
            </span>
            <span>•</span>
            <span className="text-zinc-500">
              Orig: {original.width}×{original.height}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Privacy Guarantee */}
      <div className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80 flex flex-col justify-between">
        <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
          <span className="font-medium">Privacy & Sandboxing</span>
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
        </div>
        <div>
          <div className="text-xl font-bold font-mono text-emerald-400 tracking-tight flex items-center gap-1.5">
            100% Local
          </div>
          <div className="mt-1 text-[11px] font-mono text-zinc-400">
            0 bytes leave browser
          </div>
        </div>
      </div>
    </div>
  );
};
