import React, { useState } from "react";
import { Check, Copy, Code2, Terminal } from "lucide-react";
import type { CompressOptions } from "../types";
export const CodeSnippet: React.FC<{ options: CompressOptions }> = ({
  options,
}) => {
  const [activeTab, setActiveTab] = useState<"ts" | "install">("ts");
  const [copied, setCopied] = useState(false);
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
  const formattedOpts =
    Object.keys(cleanOpts).length > 0
      ? JSON.stringify(cleanOpts, null, 2)
          .replace(/"([^"]+)":/g, "$1:")
          .split("\n")
          .map((line, idx) => (idx === 0 ? line : `  ${line}`))
          .join("\n")
      : "{ quality: 0.85, maxSizeMB: 1 }";
  const tsCode = `import { compressImage } from "imagepressor";

// Compress file or blob client-side
const compressedFile = await compressImage(file, ${formattedOpts});`;

  const installCode = `# Install with your preferred package manager
bun add imagepressor
# or
npm install imagepressor
# or
pnpm add imagepressor`;
  const activeContent = activeTab === "ts" ? tsCode : installCode;
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  return (
    <div className="rounded-3xl bg-zinc-900/80 border border-zinc-800/90 overflow-hidden shadow-2xl backdrop-blur-xl">
      {/* Drawer Header & Tabs */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-950/70 text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("ts")}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-mono text-xs transition-all cursor-pointer ${
              activeTab === "ts"
                ? "bg-sky-500/15 text-sky-300 font-semibold border border-sky-500/30"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Code2 className="h-3.5 w-3.5 text-sky-400" />
            <span>Usage Snippet</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("install")}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg font-mono text-xs transition-all cursor-pointer ${
              activeTab === "install"
                ? "bg-sky-500/15 text-sky-300 font-semibold border border-sky-500/30"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Terminal className="h-3.5 w-3.5 text-emerald-400" />
            <span>Install</span>
          </button>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/60 text-[11px] font-mono text-zinc-300 hover:text-white transition-all cursor-pointer"
          title="Copy code to clipboard"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 text-zinc-400" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      {/* Code Area */}
      <pre className="p-4 text-xs font-mono text-zinc-300 overflow-x-auto leading-relaxed bg-zinc-950/60 select-all">
        <code>{activeContent}</code>
      </pre>
    </div>
  );
};
