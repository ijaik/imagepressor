import { useCallback, useEffect, useRef, useState } from "react";
/** Write text to the clipboard. Resolves false when the browser refuses. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
/**
 * "Copied" flag that clears itself. The timer is cleared on unmount and on
 * every new flash, so a rapid second copy never leaves a stale flag behind.
 */
export function useCopiedFlag(resetMs = 1800) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };
  useEffect(() => clearTimer, []);
  const flash = useCallback(() => {
    setCopied(true);
    clearTimer();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setCopied(false);
    }, resetMs);
  }, [resetMs]);
  return [copied, flash] as const;
}
