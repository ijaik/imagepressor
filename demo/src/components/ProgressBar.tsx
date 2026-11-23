import type { CompressionProgressState } from "../types";
export default function ProgressBar({
  state,
}: {
  state: CompressionProgressState;
}) {
  // Hide only the explicit idle state, so cancelled/error terminal states stay visible.
  if (!state.isCompressing && state.progress === 0 && !state.stage) return null;
  const isIndeterminate = state.isCompressing && state.progress <= 5;
  return (
    <div className="rounded-panel border border-line bg-ink-2 px-4 py-3">
      <div className="flex items-baseline justify-between gap-4">
        <span
          role="status"
          aria-live="polite"
          className="flex min-w-0 items-center gap-2 truncate font-mono text-[10px] uppercase tracking-[0.16em] text-muted"
        >
          <span
            aria-hidden="true"
            className={
              state.isCompressing
                ? "size-1.5 shrink-0 bg-signal"
                : "size-1.5 shrink-0 bg-line-2"
            }
          />
          {state.stage || (state.isCompressing ? "Compressing…" : "Ready")}
        </span>
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-signal">
          {isIndeterminate ? "——" : `${Math.round(state.progress)}%`}
        </span>
      </div>
      {/* Semantic native progress element per modern-web-guidance */}
      <progress
        aria-label="Image compression progress"
        max={100}
        value={isIndeterminate ? undefined : state.progress}
        className="mt-2.5"
      />
    </div>
  );
}
