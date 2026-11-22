import React from "react";
import type { CompressionProgressState } from "../types";

export const ProgressBar: React.FC<{ state: CompressionProgressState }> = ({
  state,
}) => {
  if (!state.isCompressing && state.progress === 0) {
    return null;
  }

  const isIndeterminate = state.isCompressing && state.progress <= 5;

  return (
    <div className="w-full bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-3.5 shadow-xl backdrop-blur-md transition-all animate-in fade-in duration-200">
      <div className="flex items-center justify-between text-xs mb-2">
        <span
          role="status"
          aria-live="polite"
          className="font-medium text-zinc-200 flex items-center gap-2 font-mono text-[11px]"
        >
          {state.isCompressing && (
            <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse inline-block" />
          )}
          {state.stage || (state.isCompressing ? "Compressing..." : "Ready")}
        </span>
        <span className="font-mono text-sky-400 font-bold text-xs">
          {isIndeterminate ? "..." : `${Math.round(state.progress)}%`}
        </span>
      </div>

      {/* Semantic native progress element per modern-web-guidance */}
      <progress
        aria-label="Image compression progress"
        max={100}
        value={isIndeterminate ? undefined : state.progress}
        className="w-full"
      />
    </div>
  );
};
