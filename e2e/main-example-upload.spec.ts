import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";

const BASE = "http://127.0.0.1:8090";

async function gotoReady(page: Page): Promise<void> {
	await page.goto(`${BASE}/`);
	await expect(page.locator("#status")).toHaveText("Ready", {
		timeout: 30_000,
	});
	await page.waitForFunction(() =>
		Boolean(
			(globalThis as unknown as { peaksInstance?: unknown }).peaksInstance,
		),
	);
}

test("uploading an audio file replaces the loaded source", async ({ page }) => {
	await gotoReady(page);

	const initialDuration = await page.evaluate(() => {
		const peaks = (
			globalThis as unknown as {
				peaksInstance: { player: { getDuration: () => number } };
			}
		).peaksInstance;
		return peaks.player.getDuration();
	});
	expect(initialDuration).toBeGreaterThan(0);

	// Use the project's bundled mp3 sample so any browser (including the
	// linux WebKit build used by Playwright, which only decodes MP3 via
	// Web Audio) accepts it. The shape of the test does not depend on the
	// codec — it asserts the upload pipeline swaps the audio.
	const samplePath = resolve(
		process.cwd(),
		"workspaces/main-example/public/angsten.mp3",
	);
	const bytes = await readFile(samplePath);

	await page.locator("#audio-file").setInputFiles({
		buffer: bytes,
		mimeType: "audio/mpeg",
		name: "user-upload.mp3",
	});

	await expect(page.locator(".file-chip__name")).toHaveText("user-upload.mp3", {
		timeout: 15_000,
	});
	await expect(page.locator("#status-chip-text")).toHaveText("ready", {
		timeout: 15_000,
	});

	const newDuration = await page.evaluate(() => {
		const peaks = (
			globalThis as unknown as {
				peaksInstance: { player: { getDuration: () => number } };
			}
		).peaksInstance;
		return peaks.player.getDuration();
	});
	expect(newDuration).toBeGreaterThan(0);
});
