import { ArrowDownRight, Clock, Maximize2 } from "lucide-react";
import type { CompressionMetrics, ImageFileDetails } from "../types";
import { formatBytes } from "../lib/format";
import { Panel, PanelHead, Readout } from "./Primitives";
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
export default function StatsWidget({
  metrics,
  original,
  compressed,
}: {
  metrics: CompressionMetrics | null;
  original: ImageFileDetails | null;
  compressed: ImageFileDetails | null;
}) {
  if (!metrics || !original || !compressed) return null;
  const isSmaller = metrics.savedPercent > 0;
  const isIdentical = metrics.savedBytes === 0;
  const isWebpToJpeg =
    original.mimeType === "image/webp" && compressed.mimeType === "image/jpeg";
  const divisor = gcd(compressed.width || 1, compressed.height || 1);
  const ratio = `${Math.round((compressed.width || 1) / divisor)}:${Math.round(
    (compressed.height || 1) / divisor,
  )}`;
  const reduction = isIdentical
    ? "0.0%"
    : isSmaller
      ? `−${metrics.savedPercent.toFixed(1)}%`
      : `+${Math.abs(metrics.savedPercent).toFixed(1)}%`;
  return (
    <Panel>
      <PanelHead
        title="02 — result"
        meta={`${compressed.width}×${compressed.height} · ${ratio}`}
      />
      <dl className="grid grid-cols-2 divide-x divide-y divide-line md:grid-cols-4 md:divide-y-0">
        <Readout
          label="output size"
          value={formatBytes(compressed.size)}
          note={`from ${formatBytes(original.size)}`}
        />
        <Readout
          label="reduction"
          value={reduction}
          tone={isIdentical ? "signal" : isSmaller ? "good" : "warn"}
          icon={<ArrowDownRight className="size-3" aria-hidden="true" />}
          note={
            isIdentical
              ? "original preserved"
              : isSmaller
                ? `${formatBytes(metrics.savedBytes)} saved`
                : isWebpToJpeg
                  ? "webp → jpeg expansion"
                  : "format overhead"
          }
        />
        <Readout
          label="encode time"
          value={
            metrics.durationMs < 1000
              ? `${Math.round(metrics.durationMs)} ms`
              : `${(metrics.durationMs / 1000).toFixed(2)} s`
          }
          icon={<Clock className="size-3" aria-hidden="true" />}
          note={
            metrics.speedMBs > 0
              ? `${metrics.speedMBs.toFixed(1)} MB/s throughput`
              : "instant"
          }
        />
        <Readout
          label="frame"
          value={`${compressed.width} × ${compressed.height}`}
          icon={<Maximize2 className="size-3" aria-hidden="true" />}
          note={`source ${original.width}×${original.height}`}
        />
      </dl>
    </Panel>
  );
}
