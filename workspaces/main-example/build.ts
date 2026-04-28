import { mkdir, rm, stat } from "node:fs/promises";
import { resolve } from "node:path";

export interface BuildOptions {
	readonly minify?: boolean;
	readonly clean?: boolean;
}

const root = import.meta.dir;
const distDir = resolve(root, "dist");
const publicDir = resolve(root, "public");
const repoRoot = resolve(root, "..", "..");
const angstenWav = resolve(repoRoot, "sounds", "angsten.wav");
const angstenOpus = resolve(publicDir, "angsten.opus");
const angstenMp3 = resolve(publicDir, "angsten.mp3");
const angstenDat = resolve(publicDir, "angsten.dat");

async function fileExists(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
}

async function isUpToDate(source: string, target: string): Promise<boolean> {
	try {
		const [src, tgt] = await Promise.all([stat(source), stat(target)]);
		return tgt.mtimeMs >= src.mtimeMs;
	} catch {
		return false;
	}
}

async function run(cmd: readonly string[], label: string): Promise<void> {
	const proc = Bun.spawn({
		cmd: [...cmd],
		stderr: "pipe",
		stdout: "pipe",
	});
	const exitCode = await proc.exited;
	if (exitCode !== 0) {
		const stderr = await new Response(proc.stderr).text();
		throw new Error(
			`${label} failed (exit ${exitCode}): ${cmd.join(" ")}\n${stderr}`,
		);
	}
}

async function ensureCommand(name: string): Promise<void> {
	const proc = Bun.spawn({
		cmd: ["which", name],
		stderr: "ignore",
		stdout: "ignore",
	});
	const exitCode = await proc.exited;
	if (exitCode !== 0) {
		throw new Error(
			`Required tool '${name}' is not installed. Install it (e.g. \`brew install ${name}\`) and re-run the build.`,
		);
	}
}

async function ensureAngstenAssets(): Promise<void> {
	if (!(await fileExists(angstenWav))) {
		throw new Error(`Source audio missing: ${angstenWav}`);
	}

	const opusFresh = await isUpToDate(angstenWav, angstenOpus);
	const mp3Fresh = await isUpToDate(angstenWav, angstenMp3);
	const datFresh = await isUpToDate(angstenWav, angstenDat);
	if (opusFresh && mp3Fresh && datFresh) return;

	if (!opusFresh) {
		await ensureCommand("ffmpeg");
		console.log("· encoding angsten.opus from angsten.wav");
		await run(
			[
				"ffmpeg",
				"-hide_banner",
				"-loglevel",
				"error",
				"-y",
				"-i",
				angstenWav,
				"-c:a",
				"libopus",
				"-b:a",
				"96k",
				"-application",
				"audio",
				angstenOpus,
			],
			"ffmpeg",
		);
	}
	if (!mp3Fresh) {
		await ensureCommand("ffmpeg");
		console.log("· encoding angsten.mp3 (fallback) from angsten.wav");
		await run(
			[
				"ffmpeg",
				"-hide_banner",
				"-loglevel",
				"error",
				"-y",
				"-i",
				angstenWav,
				"-c:a",
				"libmp3lame",
				"-b:a",
				"96k",
				angstenMp3,
			],
			"ffmpeg",
		);
	}
	if (!datFresh) {
		await ensureCommand("audiowaveform");
		console.log("· generating angsten.dat from angsten.wav");
		await run(
			[
				"audiowaveform",
				"-i",
				angstenWav,
				"-o",
				angstenDat,
				"-z",
				"128",
				"-b",
				"8",
			],
			"audiowaveform",
		);
	}
}

async function copyAssets(): Promise<void> {
	await mkdir(publicDir, { recursive: true });
	await ensureAngstenAssets();
	const files: ReadonlyArray<readonly [string, string]> = [
		[
			resolve(repoRoot, "node_modules", "pixi.js", "dist", "pixi.min.mjs"),
			resolve(publicDir, "pixi.min.mjs"),
		],
	];

	for (const [from, to] of files) {
		await Bun.write(to, Bun.file(from));
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
