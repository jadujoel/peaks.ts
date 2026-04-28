import { execSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const distDir = resolve(import.meta.dir, "..", "dist");

// Clean dist
rmSync(distDir, { force: true, recursive: true });
mkdirSync(distDir, { recursive: true });

// Generate declarations with tsc
console.log("Generating declarations...");
execSync("bunx tsc -p tsconfig.build.json", {
	cwd: resolve(import.meta.dir, ".."),
	stdio: "inherit",
});
console.log("✓ declarations generated");

// Build readable ESM bundle
const result = await Bun.build({
	entrypoints: [resolve(import.meta.dir, "..", "src", "main.ts")],
	external: [
		"konva",
		"konva/*",
		"pixi.js",
		"pixi.js/*",
		"waveform-data",
		"eventemitter3",
	],
	format: "esm",
	naming: "peaks.esm.js",
	outdir: distDir,
	sourcemap: "external",
	target: "browser",
});

if (!result.success) {
	console.error("ESM build failed:");
	for (const log of result.logs) {
		console.error(log);
	}
	process.exit(1);
}

console.log("✓ dist/peaks.esm.js");

// Build minified ESM bundle
const minResult = await Bun.build({
	entrypoints: [resolve(import.meta.dir, "..", "src", "main.ts")],
	external: [
		"konva",
		"konva/*",
		"pixi.js",
		"pixi.js/*",
		"waveform-data",
		"eventemitter3",
	],
	format: "esm",
	minify: true,
	naming: "peaks.min.js",
	outdir: distDir,
	sourcemap: "external",
	target: "browser",
});

if (!minResult.success) {
	console.error("Minified ESM build failed:");
	for (const log of minResult.logs) {
		console.error(log);
	}
	process.exit(1);
}

console.log("✓ dist/peaks.min.js");

// Re-establish hardlinks between dist/ and the workspace dependency
// cache (`node_modules/.bun/@jadujoel+peaks.ts@root/...`). Cleaning and
// recreating dist/ above severs the prior hardlinks, so any subsequent
// `bun --filter @peaks/main-example build` would otherwise read a stale
// peaks.esm.js. `bun install` is idempotent and fast and rewires the
// hardlinks back to the freshly built dist.
try {
	execSync("bun install", {
		cwd: resolve(import.meta.dir, ".."),
		stdio: "inherit",
	});
} catch (error) {
	console.warn("post-build bun install failed:", error);
}

console.log("Build complete.");
