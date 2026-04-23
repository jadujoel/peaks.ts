import { execSync } from "node:child_process";
import {
	copyFileSync,
	mkdirSync,
	readdirSync,
	rmSync,
	unlinkSync,
} from "node:fs";
import { resolve } from "node:path";

const distDir = resolve(import.meta.dir, "..", "dist");
const demoDir = resolve(import.meta.dir, "..", "demo");

// Clean dist
rmSync(distDir, { force: true, recursive: true });
mkdirSync(distDir, { recursive: true });

// Clean stale demo chunk-*.js / chunk-*.map artifacts from previous builds
for (const entry of readdirSync(demoDir)) {
	if (
		entry.startsWith("chunk-") &&
		(entry.endsWith(".js") || entry.endsWith(".map"))
	) {
		unlinkSync(resolve(demoDir, entry));
	}
}

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

// Build bundled demo ESM bundle for the browser demo pages
const demoResult = await Bun.build({
	entrypoints: [resolve(import.meta.dir, "..", "src", "main.ts")],
	external: ["pixi.js", "pixi.js/*"],
	format: "esm",
	naming: "peaks.esm.js",
	outdir: demoDir,
	sourcemap: "external",
	splitting: true,
	target: "browser",
});

if (!demoResult.success) {
	console.error("Demo ESM build failed:");
	for (const log of demoResult.logs) {
		console.error(log);
	}
	process.exit(1);
}

console.log("✓ demo/peaks.esm.js");

// Build bundled minified demo bundle for the browser demo pages
const demoMinResult = await Bun.build({
	entrypoints: [resolve(import.meta.dir, "..", "src", "main.ts")],
	external: ["pixi.js", "pixi.js/*"],
	format: "esm",
	minify: true,
	naming: "peaks.min.js",
	outdir: demoDir,
	sourcemap: "external",
	splitting: true,
	target: "browser",
});

if (!demoMinResult.success) {
	console.error("Demo minified build failed:");
	for (const log of demoMinResult.logs) {
		console.error(log);
	}
	process.exit(1);
}

console.log("✓ demo/peaks.min.js");

const customMarkersResult = await Bun.build({
	entrypoints: [
		resolve(import.meta.dir, "..", "demo", "custom-markers", "main.ts"),
	],
	format: "esm",
	naming: "custom-markers.js",
	outdir: resolve(import.meta.dir, "..", "demo", "custom-markers"),
	sourcemap: "external",
	target: "browser",
});

if (!customMarkersResult.success) {
	console.error("Custom markers demo build failed:");
	for (const log of customMarkersResult.logs) {
		console.error(log);
	}
	process.exit(1);
}

console.log("✓ demo/custom-markers/custom-markers.js");

// Copy the prebuilt Pixi browser bundle into demo/ so the pixi-driver
// demo can resolve `pixi.js` via an importmap without needing network
// access (the demo bundle externalizes pixi.js so only the pixi demo
// page pays the download cost).
copyFileSync(
	resolve(
		import.meta.dir,
		"..",
		"node_modules",
		"pixi.js",
		"dist",
		"pixi.min.mjs",
	),
	resolve(demoDir, "pixi.min.mjs"),
);
copyFileSync(
	resolve(
		import.meta.dir,
		"..",
		"node_modules",
		"pixi.js",
		"dist",
		"pixi.min.mjs.map",
	),
	resolve(demoDir, "pixi.min.mjs.map"),
);
console.log("✓ demo/pixi.min.mjs");

console.log("Build complete.");
