import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const SRC_ROOT = new URL("../src/", import.meta.url);
const ALLOWED_DIR = new URL("../src/driver/konva/", import.meta.url).pathname;

const leakPattern =
	/from\s+["']konva|konva\/lib|new Konva\.|KonvaEventObject|KonvaMouseEvent|KonvaWheelEvent|KonvaTouchEvent|KonvaPointerEvent/;

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

const run = async (): Promise<void> => {
	const failures: string[] = [];
	for await (const file of walk(SRC_ROOT.pathname)) {
		if (file.startsWith(ALLOWED_DIR)) {
			continue;
		}
		const content = await readFile(file, "utf8");
		if (leakPattern.test(content)) {
			failures.push(file);
		}
	}

	if (failures.length > 0) {
		throw new Error(
			`Konva leak detected in: ${failures.join(", ")}. Move Konva types and constructors behind the CanvasDriver abstraction.`,
		);
	}

	console.log("No Konva leaks detected outside src/driver/konva/.");
};

await run();
