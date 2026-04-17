import { execSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const distDir = resolve(import.meta.dir, "..", "dist");

// Clean dist
rmSync(distDir, { recursive: true, force: true });
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
	outdir: distDir,
	format: "esm",
	sourcemap: "external",
	naming: "peaks.esm.js",
	external: ["konva", "konva/*", "waveform-data", "eventemitter3"],
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
	outdir: distDir,
	format: "esm",
	sourcemap: "external",
	naming: "peaks.min.js",
	minify: true,
	external: ["konva", "konva/*", "waveform-data", "eventemitter3"],
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
console.log("Build complete.");
