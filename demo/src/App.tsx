import { useState, useEffect, useRef, useCallback } from "react";
import { compressImage, detectInputMime, getImageMetadata } from "imagepressor";
import Header from "./components/Header";
import Dropzone from "./components/Dropzone";
import OptionsPanel from "./components/OptionsPanel";
import ComparisonViewer from "./components/ComparisonViewer";
import StatsWidget from "./components/StatsWidget";
import ExifInspector from "./components/ExifInspector";
import ProgressBar from "./components/ProgressBar";
import CodeSnippet from "./components/CodeSnippet";
import type {
  CompressOptions,
  ImageFileDetails,
  CompressionMetrics,
  ExifTagInfo,
  DemoPreset,
  PresetKey,
  CompressionProgressState,
} from "./types";
const DEFAULT_OPTIONS: CompressOptions = {
  quality: 0.85,
  maxSizeMB: undefined,
  maxWidth: undefined,
  maxHeight: undefined,
  mimeType: "image/jpeg",
  preserveMetadata: true,
  useWebWorker: true,
};
const IDLE_PROGRESS: CompressionProgressState = {
  isCompressing: false,
  progress: 0,
  stage: "",
};
const TERMINAL_STATE_MS = 2000;
/** Identity of one compression request, used to skip duplicate auto-runs. */
function runSignature(
  file: ImageFileDetails,
  options: CompressOptions,
): string {
  return [
    file.name,
    file.size,
    options.mimeType ?? "",
    options.quality ?? 0.85,
    options.maxSizeMB ?? "",
    options.maxWidth ?? "",
    options.maxHeight ?? "",
    options.preserveMetadata ?? true,
    options.useWebWorker ?? true,
  ].join("|");
}
/** Measure dimensions of an image blob/file. */
function getImageDimensions(
  blob: Blob,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve({ width: 0, height: 0 });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}
export default function App() {
  const [original, setOriginal] = useState<ImageFileDetails | null>(null);
  const [compressed, setCompressed] = useState<ImageFileDetails | null>(null);
  const [originalExif, setOriginalExif] = useState<ExifTagInfo | null>(null);
  const [compressedExif, setCompressedExif] = useState<ExifTagInfo | null>(
    null,
  );
  const [metrics, setMetrics] = useState<CompressionMetrics | null>(null);
  const [activePreset, setActivePreset] = useState<PresetKey | null>(
    "landscape",
  );
  const [options, setOptions] = useState<CompressOptions>(DEFAULT_OPTIONS);
  const [autoCompress, setAutoCompress] = useState<boolean>(true);
  const [progressState, setProgressState] =
    useState<CompressionProgressState>(IDLE_PROGRESS);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const objectUrlsRef = useRef<Set<string>>(new Set());
  const optionsRef = useRef(options);
  const autoCompressRef = useRef(autoCompress);
  const originalRef = useRef<ImageFileDetails | null>(null);
  const compressedRef = useRef<ImageFileDetails | null>(null);
  const runIdRef = useRef(0);
  const lastRunSignatureRef = useRef<string | null>(null);
  // Single writers keep state and the refs it mirrors in sync.
  const updateOptions = useCallback((next: CompressOptions) => {
    optionsRef.current = next;
    setOptions(next);
  }, []);
  const updateAutoCompress = useCallback((enabled: boolean) => {
    autoCompressRef.current = enabled;
    setAutoCompress(enabled);
  }, []);
  const clearTimer = (ref: {
    current: ReturnType<typeof setTimeout> | null;
  }) => {
    if (ref.current) {
      clearTimeout(ref.current);
      ref.current = null;
    }
  };
  const revokeUrl = useCallback((url: string) => {
    if (objectUrlsRef.current.delete(url)) URL.revokeObjectURL(url);
  }, []);
  const trackUrl = useCallback((url: string) => {
    objectUrlsRef.current.add(url);
    return url;
  }, []);
  // Release every object URL still alive on unmount
  useEffect(() => {
    const urls = objectUrlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);
  // Stop in-flight work when the page goes away
  useEffect(() => {
    return () => abortControllerRef.current?.abort();
  }, []);
  // Replace state and release the preview URL it no longer needs
  const applyOriginal = useCallback(
    (next: ImageFileDetails | null) => {
      const previous = originalRef.current;
      if (previous && previous !== next) revokeUrl(previous.previewUrl);
      originalRef.current = next;
      setOriginal(next);
    },
    [revokeUrl],
  );
  const applyCompressed = useCallback(
    (next: ImageFileDetails | null) => {
      const previous = compressedRef.current;
      if (previous && previous !== next) revokeUrl(previous.previewUrl);
      compressedRef.current = next;
      setCompressed(next);
    },
    [revokeUrl],
  );
  const resetDerived = useCallback(() => {
    applyCompressed(null);
    setMetrics(null);
    setCompressedExif(null);
    setProgressState(IDLE_PROGRESS);
  }, [applyCompressed]);
  // Perform compression
  const runCompression = useCallback(
    async (fileDetails: ImageFileDetails, opts: CompressOptions) => {
      // Cancel any ongoing run
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const runId = ++runIdRef.current;
      lastRunSignatureRef.current = runSignature(fileDetails, opts);
      clearTimer(idleTimerRef);
      const isCurrentRun = () => runId === runIdRef.current;
      setProgressState({
        isCompressing: true,
        progress: 0,
        stage: "Initializing compression...",
      });
      const startTime = performance.now();
      // Terminal states stay visible briefly, then return to idle.
      const finishWith = (state: CompressionProgressState) => {
        if (!isCurrentRun()) return;
        setProgressState(state);
        clearTimer(idleTimerRef);
        idleTimerRef.current = setTimeout(() => {
          idleTimerRef.current = null;
          if (isCurrentRun()) setProgressState(IDLE_PROGRESS);
        }, TERMINAL_STATE_MS);
      };
      try {
        const compressedResult = await compressImage(fileDetails.file, {
          ...opts,
          signal: controller.signal,
          onProgress: (p, stage) => {
            if (!isCurrentRun()) return;
            setProgressState({
              isCompressing: true,
              progress: p,
              stage,
            });
          },
        });
        if (!isCurrentRun()) return;
        const durationMs = Math.max(1, performance.now() - startTime);
        // Get dimensions of output
        const dims = await getImageDimensions(compressedResult);
        if (!isCurrentRun()) return;
        const previewUrl = trackUrl(URL.createObjectURL(compressedResult));
        const isOriginalPreserved = compressedResult === fileDetails.file;
        const outName = isOriginalPreserved
          ? fileDetails.name
          : fileDetails.file instanceof File
            ? fileDetails.file.name.replace(/\.[^/.]+$/, "") +
              (opts.mimeType === "image/webp" ? ".webp" : ".jpg")
            : opts.mimeType === "image/webp"
              ? "compressed.webp"
              : "compressed.jpg";
        const outDetails: ImageFileDetails = {
          file: compressedResult,
          name: outName,
          size: compressedResult.size,
          width: dims.width,
          height: dims.height,
          mimeType: isOriginalPreserved
            ? fileDetails.mimeType
            : compressedResult.type || opts.mimeType || "image/jpeg",
          previewUrl,
        };
        applyCompressed(outDetails);
        // Inspect output metadata using imagepressor package (supports JPEG and WebP)
        const compExif = await getImageMetadata(compressedResult);
        if (!isCurrentRun()) return;
        setCompressedExif(compExif);
        // Calculate performance metrics
        const savedBytes = fileDetails.size - compressedResult.size;
        const savedPercent = (savedBytes / fileDetails.size) * 100;
        const speedMBs =
          durationMs > 0
            ? fileDetails.size / (1024 * 1024) / (durationMs / 1000)
            : 0;
        setMetrics({
          originalSize: fileDetails.size,
          compressedSize: compressedResult.size,
          savedBytes,
          savedPercent,
          durationMs,
          speedMBs,
        });
        finishWith({
          isCompressing: false,
          progress: 100,
          stage: "Compression complete",
        });
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          finishWith({
            isCompressing: false,
            progress: 0,
            stage: "Compression cancelled",
          });
          return;
        }
        console.error("Compression error:", err);
        finishWith({
          isCompressing: false,
          progress: 0,
          stage: "Compression error",
        });
      }
    },
    [applyCompressed, trackUrl],
  );
  // Load a file/blob into state
  const loadFile = useCallback(
    async (
      file: File | Blob,
      name: string,
      presetKey: PresetKey | null = null,
      forceCompress = false,
      optsOverride?: CompressOptions,
    ) => {
      // Invalidate any run that is still in flight before replacing the asset
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      const loadId = ++runIdRef.current;
      lastRunSignatureRef.current = null;
      clearTimer(debounceTimerRef);
      clearTimer(idleTimerRef);
      resetDerived();
      const dims = await getImageDimensions(file);
      if (loadId !== runIdRef.current) return;
      const previewUrl = trackUrl(URL.createObjectURL(file));
      const detectedMime = detectInputMime(file, name) ?? "image/jpeg";
      const details: ImageFileDetails = {
        file,
        name,
        size: file.size,
        width: dims.width,
        height: dims.height,
        mimeType: detectedMime,
        previewUrl,
      };
      applyOriginal(details);
      setActivePreset(presetKey);
      // Inspect original metadata using imagepressor package (supports JPEG and WebP)
      const origExif = await getImageMetadata(file);
      if (loadId !== runIdRef.current) return;
      setOriginalExif(origExif);
      // Only auto-compress if forceCompress or autoCompress is enabled
      if (forceCompress || autoCompressRef.current) {
        runCompression(details, optsOverride || optionsRef.current);
      }
    },
    [applyOriginal, resetDerived, runCompression, trackUrl],
  );
  // Preset loading handler
  const handleSelectPreset = useCallback(
    async (preset: DemoPreset) => {
      try {
        // Don't let a pending debounce compress the previous image while this one loads
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        const nextOptions: CompressOptions = {
          ...optionsRef.current,
          mimeType: preset.mimeType,
        };
        updateOptions(nextOptions);
        const res = await fetch(preset.url);
        const blob = await res.blob();
        const filename = preset.url.split("/").pop() || `${preset.key}.jpg`;
        await loadFile(blob, filename, preset.key, true, nextOptions);
      } catch (err) {
        console.error("Failed to load preset:", err);
      }
    },
    [loadFile, updateOptions],
  );
  // Load initial preset ONCE on mount
  useEffect(() => {
    const initialPresetUrl = `${import.meta.env.BASE_URL}samples/sample-landscape.webp`;
    fetch(initialPresetUrl)
      .then((res) => res.blob())
      .then((blob) => {
        loadFile(blob, "sample-landscape.webp", "landscape", true);
      })
      .catch((err) => console.debug("Initial preset note:", err));
  }, [loadFile]); // loadFile identity is stable
  // Handle file select from dropzone
  const handleSelectFile = (file: File) => {
    const detected = detectInputMime(file);
    const targetMime: "image/jpeg" | "image/webp" =
      detected === "image/webp" || detected === "image/png"
        ? "image/webp"
        : "image/jpeg";
    const nextOptions: CompressOptions = {
      ...optionsRef.current,
      mimeType: targetMime,
    };
    updateOptions(nextOptions);
    loadFile(file, file.name, null, autoCompressRef.current, nextOptions);
  };
  // Debounced auto-compression when options change. The signature check makes
  // loadFile's immediate run and this effect produce exactly one run per change.
  useEffect(() => {
    if (!autoCompress || !original) return;
    const signature = runSignature(original, options);
    if (signature === lastRunSignatureRef.current) return;
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      if (runSignature(original, options) === lastRunSignatureRef.current)
        return;
      runCompression(original, options);
    }, 500);
    return () => clearTimer(debounceTimerRef);
  }, [options, autoCompress, original, runCompression]);
  // Handle abort
  const handleAbort = () => {
    abortControllerRef.current?.abort();
  };
  // Handle reset options
  const handleReset = () => {
    updateOptions(DEFAULT_OPTIONS);
  };
  // Clear the active asset and cancel any in-flight work
  const handleClear = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    runIdRef.current++;
    lastRunSignatureRef.current = null;
    clearTimer(debounceTimerRef);
    clearTimer(idleTimerRef);
    applyOriginal(null);
    resetDerived();
    setOriginalExif(null);
    setActivePreset(null);
  };
  // Download compressed file
  const handleDownload = () => {
    if (!compressed) return;
    const a = document.createElement("a");
    a.href = compressed.previewUrl;
    a.download = compressed.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="mx-auto w-full max-w-310 flex-1 px-5 pt-8 pb-16 sm:px-8 sm:pt-10">
        {/* Active Asset Toolbar or Hero Dropzone */}
        <Dropzone
          currentFile={original}
          activePreset={activePreset}
          onSelectFile={handleSelectFile}
          onSelectPreset={handleSelectPreset}
          onClear={handleClear}
        />
        <div className="mt-6 space-y-4">
          <ProgressBar state={progressState} />
          {/*
           * Studio: preview plates + control deck. Both columns stretch to the
           * same row height, so the deck's last rule lines up with the metadata
           * panel's bottom edge; the viewer absorbs the leftover space.
           */}
          <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,1fr)_368px]">
            <div className="flex min-w-0 flex-col gap-4">
              <ComparisonViewer
                className="flex-1"
                original={original}
                compressed={compressed}
                isCompressing={progressState.isCompressing}
                onDownload={handleDownload}
              />
              {/* Integrated Telemetry Dashboard */}
              <StatsWidget
                metrics={metrics}
                original={original}
                compressed={compressed}
              />
              {/* EXIF & ICC Color Profile Analyzer */}
              <ExifInspector
                originalExif={originalExif}
                compressedExif={compressedExif}
                preserveMetadata={options.preserveMetadata ?? true}
              />
            </div>
            <OptionsPanel
              options={options}
              autoCompress={autoCompress}
              isCompressing={progressState.isCompressing}
              originalExif={originalExif}
              originalMimeType={original?.mimeType}
              onOptionsChange={updateOptions}
              onAutoCompressChange={updateAutoCompress}
              onManualCompress={() =>
                original && runCompression(original, options)
              }
              onAbort={handleAbort}
              onReset={handleReset}
            />
          </div>
          <CodeSnippet options={options} />
        </div>
      </main>
      <footer className="border-t border-line">
        <div className="mx-auto flex w-full max-w-310 flex-col gap-3 px-5 py-6 font-mono text-[10px] uppercase tracking-[0.14em] text-dim sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>
            MIT · 2026 · built by{" "}
            <a
              href="https://github.com/ijaik"
              target="_blank"
              rel="noreferrer"
              className="text-muted underline decoration-line-2 underline-offset-4 transition-colors hover:text-paper hover:decoration-signal"
            >
              Jai
            </a>
          </p>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="text-signal">no upload</span>
            <a
              href="https://github.com/ijaik/imagepressor"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-paper"
            >
              source
            </a>
            <a
              href="https://www.npmjs.com/package/imagepressor"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-paper"
            >
              npm
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
