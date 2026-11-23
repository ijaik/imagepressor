import { rmSync } from "node:fs";
import { build } from "bun";
console.log("Building imagepressor with Bun...");
// 0. Remove stale output so declarations from removed modules cannot be published
rmSync("./dist", { recursive: true, force: true });
// 1. Build ESM bundle for browsers and modern bundlers
const esmResult = await build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  format: "esm",
  naming: "index.js",
  target: "browser",
  minify: true,
  sourcemap: "external",
});
if (!esmResult.success) {
  console.error("ESM build failed:", esmResult.logs);
  process.exit(1);
}
// 2. Build CJS bundle for Node / legacy environments
const cjsResult = await build({
  entrypoints: ["./src/index.ts"],
  outdir: "./dist",
  format: "cjs",
  naming: "index.cjs",
  target: "node",
  minify: true,
  sourcemap: "external",
});
if (!cjsResult.success) {
  console.error("CJS build failed:", cjsResult.logs);
  process.exit(1);
}
// 3. Emit TypeScript declaration files
const tscProc = Bun.spawn(["bun", "x", "tsc", "-p", "./tsconfig.build.json"], {
  stdout: "inherit",
  stderr: "inherit",
});
const code = await tscProc.exited;
if (code !== 0) {
  console.error("TypeScript declaration generation failed with code", code);
  process.exit(code);
}
console.log("✓ Successfully built imagepressor (ESM, CJS, d.ts)");
