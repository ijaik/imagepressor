import { rmSync } from "node:fs";
import { build } from "bun";
async function main() {
  console.log("Building imagepressor with Bun...");
  rmSync("dist", { recursive: true, force: true });
  const esmResult = await build({
    entrypoints: ["src/index.ts"],
    outdir: "dist",
    format: "esm",
    naming: "index.js",
    target: "browser",
    minify: true,
    sourcemap: "linked",
  });
  if (!esmResult.success) {
    console.error("ESM build failed:", esmResult.logs);
    process.exitCode = 1;
    return;
  }
  const cjsResult = await build({
    entrypoints: ["src/index.ts"],
    outdir: "dist",
    format: "cjs",
    naming: "index.cjs",
    target: "node",
    minify: true,
    sourcemap: "linked",
  });
  if (!cjsResult.success) {
    console.error("CJS build failed:", cjsResult.logs);
    process.exitCode = 1;
    return;
  }
  const tscProc = Bun.spawn(["bun", "x", "tsc", "-p", "tsconfig.build.json"], {
    stdout: "inherit",
    stderr: "inherit",
  });
  const code = await tscProc.exited;
  if (code !== 0) {
    console.error("Declaration generation failed:", code);
    process.exitCode = code;
    return;
  }
  console.log("✓ Successfully built imagepressor!");
}
main().catch((error) => {
  console.error("Build failed:", error);
  process.exitCode = 1;
});
