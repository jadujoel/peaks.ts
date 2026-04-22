import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const SRC_ROOT = new URL("../src/", import.meta.url);
const ALLOWED_DIRS = [
	new URL("../src/driver/audio/", import.meta.url).pathname,
	new URL("../src/types.ts", import.meta.url).pathname,
];

// Match anything that pulls the legacy duck-typed adapter surface back
// into the codebase outside of the audio-driver module. `PlayerAdapter`
// itself is retained in `src/types.ts` for the deprecated
// `PeaksConfiguration.player` field; everywhere else should consume
// `AudioDriver` from `src/driver/audio/types.ts`.
const leakPattern =
	/\bPlayerAdapter\b|\bvalidateAdapter\b|\bgetAllPropertiesFrom\b/;

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
		if (
			ALLOWED_DIRS.some(
				(allowed) => file === allowed || file.startsWith(allowed),
			)
		) {
			continue;
		}
		const content = await readFile(file, "utf8");
		if (leakPattern.test(content)) {
			failures.push(file);
		}
	}

	if (failures.length > 0) {
		throw new Error(
			`Audio adapter leak detected in: ${failures.join(", ")}. Implement AudioDriver from src/driver/audio/types.ts instead of importing PlayerAdapter.`,
		);
	}

	console.log("No audio adapter leaks detected outside src/driver/audio/.");
};

await run();
