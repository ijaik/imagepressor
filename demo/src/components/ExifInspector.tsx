import { CheckCircle2, ShieldAlert } from "lucide-react";
import { Label, Panel, Readout } from "./Primitives";
import type { ExifTagInfo } from "../types";
export interface ExifInspectorProps {
  originalExif: ExifTagInfo | null;
  compressedExif: ExifTagInfo | null;
  preserveMetadata: boolean;
}
export default function ExifInspector({
  originalExif,
  compressedExif,
  preserveMetadata,
}: ExifInspectorProps) {
  if (!originalExif) return null;
  const hasAnyMetadata =
    Boolean(originalExif.make) ||
    Boolean(originalExif.model) ||
    Boolean(originalExif.dateTime) ||
    originalExif.hasIccProfile ||
    originalExif.hasExif;
  const profileKept =
    preserveMetadata && Boolean(compressedExif?.hasIccProfile);
  const exifKept =
    preserveMetadata &&
    Boolean(compressedExif?.hasExif || originalExif.hasExif);
  const status = profileKept
    ? { label: "icc + exif kept", tone: "text-good" }
    : exifKept
      ? { label: "exif kept", tone: "text-good" }
      : { label: "stripped", tone: "text-dim" };
  const camera =
    `${originalExif.make ?? ""} ${originalExif.model ?? ""}`.trim();
  return (
    <Panel>
      <div className="flex min-h-11 flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-2.5">
        <Label>03 — metadata</Label>
        <span
          className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em]" ${status.tone}
            `}
        >
          {profileKept || exifKept ? (
            <CheckCircle2 className="size-3" aria-hidden="true" />
          ) : (
            <ShieldAlert className="size-3" aria-hidden="true" />
          )}
          {status.label}
        </span>
      </div>
      <dl className="grid grid-cols-2 divide-x divide-y divide-line md:grid-cols-4 md:divide-y-0">
        <Readout
          label="camera"
          value={camera || "web graphic"}
          note={camera ? "exif make / model" : "no camera tags"}
        />
        <Readout
          label="colour profile"
          value={originalExif.colorSpace || "none"}
          tone={originalExif.hasIccProfile ? "warn" : "paper"}
          note={originalExif.hasIccProfile ? "embedded icc" : "sRGB assumed"}
        />
        <Readout
          label="captured"
          value={originalExif.dateTime || "not recorded"}
          note="exif datetime"
        />
        <Readout
          label="orientation"
          value={
            originalExif.orientation && originalExif.orientation !== 1
              ? `tag ${originalExif.orientation}${
                  compressedExif
                    ? ` → ${compressedExif.orientation ?? "?"}`
                    : ""
                }`
              : "1 · standard"
          }
          note={
            originalExif.orientation && originalExif.orientation !== 1
              ? "normalised on re-encode"
              : "no rotation tag"
          }
        />
      </dl>
      {!hasAnyMetadata && (
        <p className="border-t border-line px-4 py-3 text-[11px] leading-relaxed text-dim">
          This sample carries plain raster headers only. Load the Portrait
          specimen to see camera tags and an embedded Display P3 profile travel
          through the encoder.
        </p>
      )}
    </Panel>
  );
}
