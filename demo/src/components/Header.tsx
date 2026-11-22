import React, { useState } from "react";
import { Zap, Package, ShieldCheck, Cpu, Copy, Check } from "lucide-react";

export const Header: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const copyInstall = async () => {
    try {
      await navigator.clipboard.writeText("npm i imagepressor");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <header className="border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-50 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-linear-to-tr from-sky-500 via-cyan-400 to-emerald-400 p-0.5 shadow-lg shadow-sky-500/20">
            <div className="h-full w-full bg-zinc-950 rounded-[10px] flex items-center justify-center">
              <Zap className="h-4.5 w-4.5 text-sky-400" />
            </div>
          </div>
          <div>
            <span className="text-base font-bold tracking-tight text-white font-mono">
              imagepressor
            </span>
            <p className="text-[11px] text-zinc-400 hidden md:block">
              Zero-dependency multi-threaded client compression • EXIF & Display
              P3 preserved
            </p>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-zinc-400">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900/80 border border-zinc-800/80 font-mono text-[11px]">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            &lt; 7 KB min+gzip
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900/80 border border-zinc-800/80 font-mono text-[11px]">
            <Cpu className="h-3.5 w-3.5 text-sky-400" />
            Web Worker
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900/80 border border-zinc-800/80 font-mono text-[11px]">
            0 Dependencies
          </span>
        </div>

        {/* Action Links & Install Command */}
        <div className="flex items-center gap-2.5">
          {/* Quick Install Pill */}
          <button
            type="button"
            onClick={copyInstall}
            className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800/90 border border-zinc-800 text-xs font-mono text-zinc-300 transition-all cursor-pointer group"
            title="Click to copy npm install command"
          >
            <span className="text-zinc-500 select-none">$</span>
            <span className="text-zinc-200">npm i imagepressor</span>
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
            )}
          </button>

          {/* NPM Link */}
          <a
            href="https://www.npmjs.com/package/imagepressor"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 transition-colors cursor-pointer"
            title="View package on npm"
          >
            <Package className="h-3.5 w-3.5 text-amber-400" />
            <span className="hidden xs:inline">npm</span>
          </a>

          {/* GitHub Link */}
          <a
            href="https://github.com/ijaik/imagepressor"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium rounded-xl bg-linear-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 text-white shadow-sm shadow-sky-600/25 transition-all cursor-pointer"
            title="View repository on GitHub"
          >
            <svg
              className="h-3.5 w-3.5 fill-current"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              />
            </svg>
            <span>GitHub</span>
          </a>
        </div>
      </div>
    </header>
  );
};
