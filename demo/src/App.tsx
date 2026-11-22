import { useState, useEffect, useRef, useCallback } from "react";
import { compressImage, getImageMetadata } from "imagepressor";
import { Header } from "./components/Header";
import { Dropzone } from "./components/Dropzone";
import { OptionsPanel } from "./components/OptionsPanel";
import { ComparisonViewer } from "./components/ComparisonViewer";
import { StatsWidget } from "./components/StatsWidget";
import { ExifInspector } from "./components/ExifInspector";
import { ProgressBar } from "./components/ProgressBar";
import { CodeSnippet } from "./components/CodeSnippet";
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
  const [progressState, setProgressState] = useState<CompressionProgressState>({
    isCompressing: false,
    progress: 0,
    stage: "",
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentObjectUrlsRef = useRef<string[]>([]);
  const optionsRef = useRef(options);
  const autoCompressRef = useRef(autoCompress);

  // Keep refs in sync inside effects to satisfy react-hooks rules
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    autoCompressRef.current = autoCompress;
  }, [autoCompress]);

  // Register an object URL for cleanup
  const trackUrl = useCallback((url: string) => {
    currentObjectUrlsRef.current.push(url);
    return url;
  }, []);

  // Cleanup object URLs on unmount
  useEffect(() => {
    const urls = currentObjectUrlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // Measure dimensions of an image blob/file
  const getImageDimensions = (
    blob: Blob,
  ): Promise<{ width: number; height: number }> => {
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
  };

  // Perform compression
  const runCompression = useCallback(
    async (fileDetails: ImageFileDetails, opts: CompressOptions) => {
      // Cancel any ongoing run
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setProgressState({
        isCompressing: true,
        progress: 0,
        stage: "Initializing compression...",
      });

      const startTime = performance.now();

      try {
        const compressedResult = await compressImage(fileDetails.file, {
          ...opts,
          signal: controller.signal,
          onProgress: (p, stage) => {
            setProgressState({
              isCompressing: true,
              progress: p,
              stage,
            });
          },
        });

        const endTime = performance.now();
        const durationMs = Math.max(1, endTime - startTime);

        // Get dimensions of output
        const dims = await getImageDimensions(compressedResult);
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

        setCompressed(outDetails);

        // Inspect output metadata using imagepressor package (supports JPEG and WebP)
        const compExif = await getImageMetadata(compressedResult);
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

        setProgressState({
          isCompressing: false,
          progress: 100,
          stage: "Compression complete",
        });
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setProgressState({
            isCompressing: false,
            progress: 0,
            stage: "Compression cancelled",
          });
          return;
        }
        console.error("Compression error:", err);
        setProgressState({
          isCompressing: false,
          progress: 0,
          stage: "Compression error",
        });
      }
    },
    [trackUrl],
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
      // Immediately reset compressed state so previous image is never shown
      setCompressed(null);
      setMetrics(null);
      setCompressedExif(null);

      const dims = await getImageDimensions(file);
      const previewUrl = trackUrl(URL.createObjectURL(file));

      const detectedMime =
        file.type ||
        (/\.webp$/i.test(name)
          ? "image/webp"
          : /\.png$/i.test(name)
            ? "image/png"
            : "image/jpeg");

      const details: ImageFileDetails = {
        file,
        name,
        size: file.size,
        width: dims.width,
        height: dims.height,
        mimeType: detectedMime,
        previewUrl,
      };

      setOriginal(details);
      setActivePreset(presetKey);

      // Inspect original metadata using imagepressor package (supports JPEG and WebP)
      const origExif = await getImageMetadata(file);
      setOriginalExif(origExif);

      // Only auto-compress if forceCompress or autoCompress is enabled
      if (forceCompress || autoCompressRef.current) {
        const runOpts = optsOverride || optionsRef.current;
        runCompression(details, runOpts);
      }
    },
    [runCompression, trackUrl],
  );

  // Preset loading handler
  const handleSelectPreset = useCallback(
    async (preset: DemoPreset) => {
      try {
        const isWebpOrPng =
          preset.key === "logo" || /\.webp$/i.test(preset.url);
        const targetMime: "image/jpeg" | "image/webp" = isWebpOrPng
          ? "image/webp"
          : "image/jpeg";
        const nextOptions: CompressOptions = {
          ...optionsRef.current,
          mimeType: targetMime,
        };
        setOptions(nextOptions);
        optionsRef.current = nextOptions;

        const res = await fetch(preset.url);
        const blob = await res.blob();
        const filename = preset.url.split("/").pop() || `${preset.key}.jpg`;
        await loadFile(blob, filename, preset.key, true, nextOptions);
      } catch (err) {
        console.error("Failed to load preset:", err);
      }
    },
    [loadFile],
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
    const isWebP = file.type === "image/webp" || /\.webp$/i.test(file.name);
    const isPng = file.type === "image/png" || /\.png$/i.test(file.name);
    const targetMime: "image/jpeg" | "image/webp" =
      isWebP || isPng ? "image/webp" : "image/jpeg";

    const nextOptions: CompressOptions = {
      ...optionsRef.current,
      mimeType: targetMime,
    };
    setOptions(nextOptions);
    optionsRef.current = nextOptions;

    loadFile(file, file.name, null, autoCompressRef.current, nextOptions);
  };

  // Debounced auto-compression when options change
  useEffect(() => {
    if (!autoCompress || !original) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      runCompression(original, options);
    }, 500);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [options, autoCompress, original, runCompression]);

  // Handle abort
  const handleAbort = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  // Handle reset options
  const handleReset = () => {
    setOptions(DEFAULT_OPTIONS);
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
    <div className="min-h-screen bg-[#090d16] text-zinc-100 flex flex-col font-sans selection:bg-sky-500/30">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
        {/* Active Asset Toolbar or Hero Dropzone */}
        <Dropzone
          currentFile={original}
          activePreset={activePreset}
          onSelectFile={handleSelectFile}
          onSelectPreset={handleSelectPreset}
          onClear={() => {
            setOriginal(null);
            setCompressed(null);
            setMetrics(null);
            setOriginalExif(null);
            setCompressedExif(null);
            setActivePreset(null);
          }}
        />

        {/* Live Compression Progress Hairline */}
        <ProgressBar state={progressState} />

        {/* Studio Canvas and Control Inspector Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Main Visual Studio Workspace (Left 7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <ComparisonViewer
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

            {/* EXIF & Display P3 Color Gamut Analyzer */}
            <ExifInspector
              originalExif={originalExif}
              compressedExif={compressedExif}
              preserveMetadata={options.preserveMetadata ?? true}
            />
          </div>

          {/* Configuration Inspector & Developer Hub (Right 5 cols) */}
          <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-20">
            <OptionsPanel
              options={options}
              autoCompress={autoCompress}
              isCompressing={progressState.isCompressing}
              originalExif={originalExif}
              originalMimeType={original?.mimeType}
              onOptionsChange={setOptions}
              onAutoCompressChange={setAutoCompress}
              onManualCompress={() =>
                original && runCompression(original, options)
              }
              onAbort={handleAbort}
              onReset={handleReset}
            />

            {/* Copyable TypeScript Code Drawer */}
            <CodeSnippet options={options} />
          </div>
        </div>
      </main>

      {/* Studio Footer */}
      <footer className="border-t border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md py-6 text-center text-xs text-zinc-500 mt-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            Built with{" "}
            <a
              href="https://github.com/ijaik/imagepressor"
              target="_blank"
              rel="noreferrer"
              className="text-zinc-300 hover:text-white font-mono underline underline-offset-2"
            >
              imagepressor
            </a>{" "}
            by{" "}
            <a
              href="https://github.com/ijaik"
              target="_blank"
              rel="noreferrer"
              className="text-sky-400 hover:text-sky-300 font-medium font-mono"
            >
              Jai (@ijaik)
            </a>
          </div>
          <div className="flex items-center gap-4 text-zinc-400 font-mono text-[11px]">
            <span>100% Client-Side</span>
            <span>•</span>
            <span>MIT License</span>
            <span>•</span>
            <a
              href="https://www.npmjs.com/package/imagepressor"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white"
            >
              npm package
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
