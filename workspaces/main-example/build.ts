import { copyFile, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

export interface BuildOptions {
	readonly minify?: boolean;
	readonly clean?: boolean;
}

const root = import.meta.dir;
const distDir = resolve(root, "dist");
const publicDir = resolve(root, "public");
const repoRoot = resolve(root, "..", "..");

async function copyAssets(): Promise<void> {
	await mkdir(publicDir, { recursive: true });
	const files: ReadonlyArray<readonly [string, string]> = [
		[
			resolve(repoRoot, "test", "data", "sample.mp3"),
			resolve(publicDir, "sample.mp3"),
		],
		[
			resolve(repoRoot, "test", "data", "sample.json"),
			resolve(publicDir, "sample.json"),
		],
		[
			resolve(repoRoot, "node_modules", "pixi.js", "dist", "pixi.min.mjs"),
			resolve(publicDir, "pixi.min.mjs"),
		],
	];

	for (const [from, to] of files) {
		await copyFile(from, to);
	}
}

export async function build(options: BuildOptions = {}): Promise<boolean> {
	if (options.clean) {
		await rm(distDir, { force: true, recursive: true });
	}
	await mkdir(distDir, { recursive: true });
	await copyAssets();

	const result = await Bun.build({
		entrypoints: [resolve(root, "src", "main.ts")],
		external: ["pixi.js", "pixi.js/*"],
		format: "esm",
		minify: options.minify === true,
		naming: "[name].js",
		outdir: distDir,
		sourcemap: "external",
		splitting: true,
		target: "browser",
	});

	if (!result.success) {
		console.error("Build failed:");
		for (const log of result.logs) {
			console.error(log);
		}
		return false;
	}

	for (const output of result.outputs) {
		console.log("✓", output.path.replace(`${root}/`, ""));
	}
	return true;
}

if (import.meta.main) {
	const ok = await build({
		clean: true,
		minify: process.argv.includes("--minify"),
	});
	if (!ok) {
		process.exit(1);
	}
}
