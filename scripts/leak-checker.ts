import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

export interface LeakCheckerOptions {
	readonly packageName: string;
	readonly allowedDir: URL;
	readonly leakPattern: RegExp;
	readonly srcRoot: URL;
}

async function* walk(dir: string): AsyncGenerator<string> {
	const entries = await readdir(dir);
	for (const entry of entries) {
		const full = path.join(dir, entry);
		const s = await stat(full);
		if (s.isDirectory()) {
			yield* walk(full);
		} else if (entry.endsWith(".ts")) {
			yield full;
		}
	}
}

export async function runLeakCheck(
	options: LeakCheckerOptions,
): Promise<undefined | never> {
	const allowedPath = options.allowedDir.pathname;
	const srcPath = options.srcRoot.pathname;
	const failures: string[] = [];

	for await (const file of walk(srcPath)) {
		if (file.startsWith(allowedPath)) {
			continue;
		}
		const content = await readFile(file, "utf8");
		if (options.leakPattern.test(content)) {
			failures.push(file);
		}
	}

	if (failures.length > 0) {
		throw new Error(
			`${options.packageName} leak detected in: ${failures.join(", ")}. Move ${options.packageName} types and constructors behind the CanvasDriver abstraction.`,
		);
	}

	console.log(
		`No ${options.packageName} leaks detected outside ${path.relative(process.cwd(), allowedPath)}.`,
	);
	return undefined;
}
