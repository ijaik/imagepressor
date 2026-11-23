import { useState } from "react";
import { Check, Code2, Copy, Terminal } from "lucide-react";
import type { CompressOptions } from "../types";
import { copyText, useCopiedFlag } from "../lib/clipboard";
import { Label, Panel, Segmented } from "./Primitives";
const TABS = [
  {
    value: "ts" as const,
    label: (
      <>
        <Code2 className="size-3" aria-hidden="true" />
        usage
      </>
    ),
    title: "TypeScript usage",
  },
  {
    value: "install" as const,
    label: (
      <>
        <Terminal className="size-3" aria-hidden="true" />
        install
      </>
    ),
    title: "Install command",
  },
];
export default function CodeSnippet({ options }: { options: CompressOptions }) {
  const [activeTab, setActiveTab] = useState<"ts" | "install">("ts");
  const [copied, flashCopied] = useCopiedFlag();
  const cleanOpts: Record<string, unknown> = {};
  if (options.quality !== undefined && options.quality !== 0.85)
    cleanOpts.quality = options.quality;
  if (options.maxSizeMB && options.maxSizeMB !== Number.POSITIVE_INFINITY)
    cleanOpts.maxSizeMB = options.maxSizeMB;
  if (options.maxWidth) cleanOpts.maxWidth = options.maxWidth;
  if (options.maxHeight) cleanOpts.maxHeight = options.maxHeight;
  if (options.mimeType && options.mimeType !== "image/jpeg")
    cleanOpts.mimeType = options.mimeType;
  if (options.preserveMetadata === false) cleanOpts.preserveMetadata = false;
  if (options.useWebWorker === false) cleanOpts.useWebWorker = false;
  if (options.strict !== undefined) cleanOpts.strict = options.strict;
  const formattedOpts =
    Object.keys(cleanOpts).length > 0
      ? JSON.stringify(cleanOpts, null, 2)
          .replace(/"([^"]+)":/g, "$1:")
          .split("\n")
          .map((line, idx) => (idx === 0 ? line : `  ${line}`))
          .join("\n")
      : "{ quality: 0.85 }";
  const tsCode = `import { compressImage } from "imagepressor";

// Runs in a worker; returns the compressed File/Blob
const out = await compressImage(file, ${formattedOpts});`;
  const installCode = `# Install with your preferred package manager
bun add imagepressor
# or
npm install imagepressor
# or
pnpm add imagepressor`;
  const activeContent = activeTab === "ts" ? tsCode : installCode;
  const handleCopy = async () => {
    if (await copyText(activeContent)) flashCopied();
  };
  return (
    <Panel className="overflow-hidden">
      <div className="flex min-h-11 items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Label className="hidden sm:inline">snippet</Label>
          <Segmented
            label="Snippet view"
            value={activeTab}
            options={TABS}
            onChange={setActiveTab}
          />
        </div>
        <button
          type="button"
          onClick={handleCopy}
          title="Copy to clipboard"
          className={`
            "inline-flex h-7 cursor-pointer items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors duration-150",
            ${copied ? "text-good" : "text-dim hover:text-paper"}`}
        >
          {copied ? (
            <Check className="size-3" aria-hidden="true" />
          ) : (
            <Copy className="size-3" aria-hidden="true" />
          )}
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <pre className="overflow-x-auto bg-[#0a0908] px-4 py-3.5 font-mono text-[11.5px] leading-relaxed text-muted select-all">
        <code>{activeContent}</code>
      </pre>
    </Panel>
  );
}
