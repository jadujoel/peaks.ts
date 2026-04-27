import { expect, type Locator, type Page, test } from "@playwright/test";

const BASE = "http://127.0.0.1:8090";

// ─── Helpers ───────────────────────────────────────────────────────────────

async function gotoReady(page: Page): Promise<{
	consoleErrors: string[];
	pageErrors: string[];
}> {
	const consoleErrors: string[] = [];
	const pageErrors: string[] = [];
	page.on("console", (m) => {
		if (m.type() === "error") consoleErrors.push(m.text());
	});
	page.on("pageerror", (e) => {
		pageErrors.push(e.message);
	});
	await page.goto(`${BASE}/`);
	await expect(page.locator("#status")).toHaveText("Ready", {
		timeout: 30_000,
	});
	await expect(
		page.locator("#zoomview-container canvas").first(),
	).toBeVisible();
	return { consoleErrors, pageErrors };
}

function fatalConsoleErrors(errors: readonly string[]): readonly string[] {
	return errors.filter(
		(line) =>
			!line.includes("AudioContext was not allowed") &&
			!line.toLowerCase().includes("autoplay"),
	);
}

interface CanvasStats {
	readonly width: number;
	readonly height: number;
	readonly nonTransparent: number;
	readonly avgR: number;
	readonly avgG: number;
	readonly avgB: number;
	readonly redLeaning: number;
	readonly greenLeaning: number;
	readonly hash: string;
}

// Snapshot the Pixi canvas in the page context and return a coarse summary
// (count of opaque pixels + per-channel average + a 32-bit hash). The Pixi
// driver enables `preserveDrawingBuffer: true` so the WebGL back-buffer can
// be `drawImage`'d at any time.
async function statsForCanvas(canvas: Locator): Promise<CanvasStats> {
	return canvas.evaluate((src: HTMLCanvasElement) => {
		const sample = document.createElement("canvas");
		sample.width = src.width;
		sample.height = src.height;
		const ctx = sample.getContext("2d");
		if (!ctx) throw new Error("no 2d ctx");
		ctx.drawImage(src, 0, 0);
		const data = ctx.getImageData(0, 0, src.width, src.height).data;
		// First sample as-is. If the WebGL back-buffer was already cleared
		// by composition (drawImage gives all-transparent pixels), fall
		// back to Pixi's `app.renderer.extract.canvas(stage)` which renders
		// the scene into a fresh 2D canvas regardless of the
		// preserveDrawingBuffer state.
		let pixels = data;
		let opaque = 0;
		for (let i = 3; i < pixels.length; i += 4) {
			if ((pixels[i] ?? 0) > 8) {
				opaque += 1;
				if (opaque > 2) break;
			}
		}
		if (opaque <= 2) {
			interface PeaksGlobal {
				peaksInstance: {
					views: { getView: (n: string) => unknown };
				};
			}
			const peaks = (window as unknown as PeaksGlobal).peaksInstance;
			const viewName =
				src.closest("#zoomview-container") !== null ? "zoomview" : "overview";
			const view = peaks.views.getView(viewName) as
				| { stage?: unknown }
				| undefined;
			const stage = view?.stage as
				| {
						host?: {
							app?: {
								stage: unknown;
								renderer?: {
									extract?: { canvas: (s: unknown) => HTMLCanvasElement };
								};
							};
						};
				  }
				| undefined;
			const app = stage?.host?.app;
			if (app?.renderer?.extract?.canvas) {
				const ex = app.renderer.extract.canvas(app.stage);
				const exCtx = ex.getContext("2d");
				if (exCtx) {
					pixels = exCtx.getImageData(0, 0, ex.width, ex.height).data;
				}
			}
		}
		let nonTransparent = 0;
		let sumR = 0;
		let sumG = 0;
		let sumB = 0;
		let redLeaning = 0;
		let greenLeaning = 0;
		let hash = 0x811c9dc5;
		for (let i = 0; i < pixels.length; i += 4) {
			const a = pixels[i + 3] ?? 0;
			if (a > 8) {
				const r = pixels[i] ?? 0;
				const g = pixels[i + 1] ?? 0;
				const b = pixels[i + 2] ?? 0;
				nonTransparent += 1;
				sumR += r;
				sumG += g;
				sumB += b;
				if (r > g + 30 && r > b + 30) redLeaning += 1;
				if (g > r + 30 && g > b + 30) greenLeaning += 1;
			}
		}
		for (let i = 0; i < pixels.length; i += 4) {
			hash ^= pixels[i] ?? 0;
			hash = Math.imul(hash, 0x01000193) >>> 0;
		}
		const denom = nonTransparent || 1;
		return {
			avgB: sumB / denom,
			avgG: sumG / denom,
			avgR: sumR / denom,
			greenLeaning,
			hash: hash.toString(16),
			height: src.height,
			nonTransparent,
			redLeaning,
			width: src.width,
		};
	});
}

async function settle(page: Page): Promise<void> {
	// Several rAFs to allow Peaks' draw scheduler to flush, the
	// waveform-builder to (re)compute downsamples, and Pixi's renderer
	// to present the next frame.
	await page.evaluate(
		() =>
			new Promise<void>((resolve) => {
				const tick = (n: number): void => {
					if (n === 0) {
						resolve();
						return;
					}
					requestAnimationFrame(() => tick(n - 1));
				};
				tick(6);
			}),
	);
}

async function getPlayheadTime(page: Page): Promise<number> {
	const value = await page
		.locator("#playhead-time")
		.evaluate((el) => (el as HTMLOutputElement).value);
	return Number.parseFloat(value || "0");
}

// Assert the Pixi-rendered canvas has at least a minimum amount of
// non-transparent pixels and a non-trivial colour signal.
async function expectCanvasRenders(
	canvas: Locator,
	context: string,
): Promise<CanvasStats> {
	const stats = await statsForCanvas(canvas);
	const diag = `${context}: ${JSON.stringify(stats)}`;
	expect(stats.nonTransparent, `non-transparent ${diag}`).toBeGreaterThan(500);
	expect(
		stats.avgR + stats.avgG + stats.avgB,
		`colour ${diag}`,
	).toBeGreaterThan(10);
	return stats;
}

// ─── Tests ────────────────────────────────────────────────────────────────

test.describe("pixi rendering @ main-example", () => {
	test("zoomview and overview render non-empty canvases on load", async ({
		page,
	}) => {
		const errs = await gotoReady(page);
		const zoom = page.locator("#zoomview-container canvas").first();
		const overview = page.locator("#overview-container canvas").first();

		const zoomStats = await expectCanvasRenders(zoom, "zoomview");
		const overviewStats = await expectCanvasRenders(overview, "overview");

		// The seeded waveform colour is the demo default `#00e180` — the
		// zoomview should be visibly green-leaning. The overview only needs
		// to have rendered some non-transparent pixels (its colour signal
		// can be more axis-dominant).
		expect(zoomStats.greenLeaning).toBeGreaterThan(zoomStats.redLeaning);
		expect(overviewStats.nonTransparent).toBeGreaterThan(500);

		expect(errs.pageErrors).toEqual([]);
		expect(fatalConsoleErrors(errs.consoleErrors)).toEqual([]);
	});

	test("seeking to a different time repaints the zoomview", async ({
		page,
	}) => {
		await gotoReady(page);
		const zoom = page.locator("#zoomview-container canvas").first();
		const before = await statsForCanvas(zoom);
		expect(before.nonTransparent).toBeGreaterThan(500);

		// Drive the visible region directly via the zoomview API. Seeking
		// alone only nudges the 1px playhead marker which is below the
		// hash-sampler's noise floor; setStartTime shifts the entire
		// waveform render and is the strongest visual signal.
		await page.evaluate(() => {
			const win = window as unknown as {
				peaksInstance: {
					views: {
						getView: (n: string) => { setStartTime: (t: number) => void };
					};
					player: { seek: (t: number) => void };
				};
			};
			win.peaksInstance.player.seek(15);
			win.peaksInstance.views.getView("zoomview").setStartTime(10);
		});
		await settle(page);
		await settle(page);

		const after = await statsForCanvas(zoom);
		expect(after.nonTransparent, `after ${after.hash}`).toBeGreaterThan(500);
		expect(after.hash, `before=${before.hash} after=${after.hash}`).not.toBe(
			before.hash,
		);
	});

	test("zoom in / out repaints the zoomview at a different scale", async ({
		page,
	}) => {
		await gotoReady(page);
		const zoom = page.locator("#zoomview-container canvas").first();
		const baseline = await statsForCanvas(zoom);

		// The demo starts at the most-zoomed-in level, so zoom out first
		// (zoomIn at level 0 is a no-op) and then zoom back in to confirm
		// both directions trigger a repaint.
		await page.evaluate(() => {
			const win = window as unknown as {
				peaksInstance: { zoom: { zoomIn: () => void; zoomOut: () => void } };
			};
			win.peaksInstance.zoom.zoomOut();
		});
		await settle(page);
		await settle(page);
		const zoomedOut = await statsForCanvas(zoom);
		expect(
			zoomedOut.hash,
			`baseline=${baseline.hash} zoomedOut=${zoomedOut.hash}`,
		).not.toBe(baseline.hash);
		expect(zoomedOut.nonTransparent).toBeGreaterThan(500);

		await page.evaluate(() => {
			const win = window as unknown as {
				peaksInstance: { zoom: { zoomIn: () => void; zoomOut: () => void } };
			};
			win.peaksInstance.zoom.zoomIn();
		});
		await settle(page);
		await settle(page);
		const zoomedIn = await statsForCanvas(zoom);
		expect(zoomedIn.hash).not.toBe(zoomedOut.hash);
		expect(zoomedIn.nonTransparent).toBeGreaterThan(500);
	});

	test("looping a segment paints + plays + can be stopped", async ({
		page,
	}) => {
		await gotoReady(page);
		const zoom = page.locator("#zoomview-container canvas").first();

		const beforeLoop = await statsForCanvas(zoom);
		const loopBtn = page.locator(
			'button[data-action="loop-segment"][data-id="segment-1"]',
		);
		await expect(loopBtn).toBeVisible();
		await loopBtn.click();

		await expect(page.locator("#loop-status")).not.toHaveText("(none)");

		// Wait for time to advance inside the segment.
		await expect
			.poll(async () => getPlayheadTime(page))
			.toBeGreaterThanOrEqual(5);

		await settle(page);
		const duringLoop = await statsForCanvas(zoom);
		expect(duringLoop.nonTransparent).toBeGreaterThan(500);
		expect(duringLoop.hash).not.toBe(beforeLoop.hash);

		await page.locator('button[data-action="stop-loop"]').click();
		await expect(page.locator("#loop-status")).toHaveText("(none)");

		// Pause so the playhead stops drifting and the canvas stabilises.
		await page.locator('button[data-action="pause"]').click();
		await settle(page);
		const afterStop = await statsForCanvas(zoom);
		expect(afterStop.nonTransparent).toBeGreaterThan(500);
	});

	test("adding a segment at the playhead renders a new shape", async ({
		page,
	}) => {
		await gotoReady(page);
		const zoom = page.locator("#zoomview-container canvas").first();

		// Move the playhead to a region that has no seeded segment.
		await page.evaluate(() => {
			const win = window as unknown as {
				peaksInstance: { player: { seek: (t: number) => void } };
			};
			win.peaksInstance.player.seek(28);
		});
		await settle(page);
		const before = await statsForCanvas(zoom);
		const initialRows = await page.locator("#segments-table tbody tr").count();

		await page.locator('button[data-action="add-segment"]').click();
		await expect(page.locator("#segments-table tbody tr")).toHaveCount(
			initialRows + 1,
		);
		await settle(page);

		const after = await statsForCanvas(zoom);
		// Adding a segment changes pixel content (segment shape + handles).
		expect(after.hash).not.toBe(before.hash);
		expect(after.nonTransparent).toBeGreaterThan(500);
	});

	test("adding a point at the playhead renders a marker", async ({ page }) => {
		await gotoReady(page);
		const zoom = page.locator("#zoomview-container canvas").first();

		await page.evaluate(() => {
			const win = window as unknown as {
				peaksInstance: { player: { seek: (t: number) => void } };
			};
			win.peaksInstance.player.seek(20);
		});
		await settle(page);
		const before = await statsForCanvas(zoom);
		const initialRows = await page.locator("#points-table tbody tr").count();

		await page.locator('button[data-action="add-point"]').click();
		await expect(page.locator("#points-table tbody tr")).toHaveCount(
			initialRows + 1,
		);
		await settle(page);

		const after = await statsForCanvas(zoom);
		expect(after.hash).not.toBe(before.hash);
		expect(after.nonTransparent).toBeGreaterThan(500);
	});

	test("changing the waveform colour repaints with the new colour", async ({
		page,
	}) => {
		await gotoReady(page);
		const zoom = page.locator("#zoomview-container canvas").first();

		const greenStats = await statsForCanvas(zoom);
		expect(greenStats.greenLeaning).toBeGreaterThan(greenStats.redLeaning);

		// Switch to a strongly red waveform colour. Drive the API directly
		// (in addition to the input event) so the test isn't sensitive to
		// the demo's wiring.
		await page.locator("#waveform-color").evaluate((el: HTMLInputElement) => {
			el.value = "#ff2200";
			el.dispatchEvent(new Event("input", { bubbles: true }));
		});
		await page.evaluate(() => {
			const win = window as unknown as {
				peaksInstance: {
					views: {
						getView: (n: string) => { setWaveformColor: (c: string) => void };
					};
				};
			};
			win.peaksInstance.views.getView("zoomview").setWaveformColor("#ff2200");
			win.peaksInstance.views.getView("overview").setWaveformColor("#ff2200");
		});
		await settle(page);
		await settle(page);

		const redStats = await statsForCanvas(zoom);
		expect(
			redStats.redLeaning,
			`red repaint ${JSON.stringify(redStats)}`,
		).toBeGreaterThan(redStats.greenLeaning);
		expect(redStats.hash).not.toBe(greenStats.hash);
	});

	test("switching to stereo mode keeps both canvases rendering", async ({
		page,
	}) => {
		const errs = await gotoReady(page);
		const zoom = page.locator("#zoomview-container canvas").first();
		const overview = page.locator("#overview-container canvas").first();

		await page.selectOption("#channel-mode", "stereo");

		// The waveform is rebuilt asynchronously via setSource. Poll until
		// both canvases settle into a stable, non-empty render.
		await expect
			.poll(
				async () => {
					const s = await statsForCanvas(zoom);
					return s.nonTransparent > 500 ? "ready" : "pending";
				},
				{ timeout: 15_000 },
			)
			.toBe("ready");

		const stereoZoom = await statsForCanvas(zoom);
		const stereoOverview = await statsForCanvas(overview);
		expect(stereoZoom.nonTransparent).toBeGreaterThan(500);
		expect(stereoOverview.nonTransparent).toBeGreaterThan(500);

		expect(errs.pageErrors).toEqual([]);
		expect(fatalConsoleErrors(errs.consoleErrors)).toEqual([]);
	});

	test("toggling the overview hides and restores its canvas content", async ({
		page,
	}) => {
		await gotoReady(page);
		const overview = page.locator("#overview-container canvas").first();
		const before = await statsForCanvas(overview);
		expect(before.nonTransparent).toBeGreaterThan(500);

		await page.locator("#show-overview").click();
		await expect(page.locator("#overview-container")).toHaveClass(
			/(^|\s)hide($|\s)/,
		);

		await page.locator("#show-overview").click();
		await expect(page.locator("#overview-container")).not.toHaveClass(
			/(^|\s)hide($|\s)/,
		);
		await settle(page);

		const after = await statsForCanvas(overview);
		expect(after.nonTransparent).toBeGreaterThan(500);
	});

	test("resizing the width keeps the zoomview rendering the waveform", async ({
		page,
	}) => {
		await gotoReady(page);
		const zoom = page.locator("#zoomview-container canvas").first();

		await page.locator("#width").evaluate((el: HTMLInputElement) => {
			el.value = "600";
			el.dispatchEvent(new Event("input", { bubbles: true }));
		});
		await settle(page);
		const small = await statsForCanvas(zoom);
		expect(small.nonTransparent).toBeGreaterThan(500);

		await page.locator("#width").evaluate((el: HTMLInputElement) => {
			el.value = "1200";
			el.dispatchEvent(new Event("input", { bubbles: true }));
		});
		await settle(page);
		const large = await statsForCanvas(zoom);
		expect(large.nonTransparent).toBeGreaterThan(500);
	});

	test("playing then pausing keeps the zoomview painted", async ({ page }) => {
		const errs = await gotoReady(page);
		const zoom = page.locator("#zoomview-container canvas").first();

		await page.locator('button[data-action="play"]').click();
		await expect
			.poll(async () => getPlayheadTime(page), { timeout: 5_000 })
			.toBeGreaterThan(0);

		await settle(page);
		const playing = await statsForCanvas(zoom);
		expect(playing.nonTransparent).toBeGreaterThan(500);

		await page.locator('button[data-action="pause"]').click();
		await settle(page);
		const paused = await statsForCanvas(zoom);
		expect(paused.nonTransparent).toBeGreaterThan(500);

		expect(errs.pageErrors).toEqual([]);
		expect(fatalConsoleErrors(errs.consoleErrors)).toEqual([]);
	});
});
