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

test.describe("main-example inbox fixes", () => {
	test("clicking the overview scrolls the zoomview to the new playhead", async ({
		page,
	}) => {
		await gotoReady(page);

		// Capture the duration so the click target maps to a time outside the
		// initial zoomview window.
		const duration = await page.evaluate(() => {
			const peaks = (
				globalThis as unknown as {
					peaksInstance: { player: { getDuration: () => number } };
				}
			).peaksInstance;
			return peaks.player.getDuration();
		});
		expect(duration).toBeGreaterThan(0);

		const overviewContainer = page.locator("#overview-container");
		await overviewContainer
			.locator("canvas")
			.first()
			.waitFor({ state: "visible" });
		// Scroll the overview into view so raw mouse coordinates from
		// boundingBox() map into the visible viewport. Without this, a
		// taller header layout can push the overview below the fold and
		// page.mouse.click(...) silently misses.
		await overviewContainer.scrollIntoViewIfNeeded();
		const box = await overviewContainer.boundingBox();
		if (!box) throw new Error("overview not laid out");

		const beforeWindow = await page.evaluate(() => {
			const peaks = (
				globalThis as unknown as {
					peaksInstance: {
						views: {
							getZoomview: () =>
								| {
										getStartTime: () => number;
										getEndTime: () => number;
								  }
								| undefined;
						};
					};
				}
			).peaksInstance;
			const zoom = peaks.views.getZoomview();
			if (!zoom) throw new Error("no zoomview");
			return { endTime: zoom.getEndTime(), startTime: zoom.getStartTime() };
		});

		// Click ~75% across the overview via raw mouse coordinates so the
		// Konva/Pixi-stacked canvases don't block the actionability check.
		await page.mouse.click(box.x + box.width * 0.75, box.y + box.height / 2);

		// We don't rely on `player.getCurrentTime()` here — the AudioContext
		// stays suspended without a real user gesture, so the worklet may
		// report 0. The view-side scroll is independent of playback state.
		const expectedTime = duration * 0.75;
		const afterWindow = await page.evaluate(() => {
			const peaks = (
				globalThis as unknown as {
					peaksInstance: {
						views: {
							getZoomview: () =>
								| {
										getStartTime: () => number;
										getEndTime: () => number;
								  }
								| undefined;
						};
					};
				}
			).peaksInstance;
			const zoom = peaks.views.getZoomview();
			if (!zoom) throw new Error("no zoomview");
			return { endTime: zoom.getEndTime(), startTime: zoom.getStartTime() };
		});

		expect(afterWindow.startTime).toBeGreaterThan(beforeWindow.startTime);
		// Click time should fall inside the visible zoomview window.
		expect(afterWindow.startTime).toBeLessThanOrEqual(expectedTime);
		expect(afterWindow.endTime).toBeGreaterThanOrEqual(expectedTime);
	});

	test("editing a looping segment's bounds live-updates the loop status", async ({
		page,
	}) => {
		await gotoReady(page);

		await page.evaluate(async () => {
			const peaks = (
				globalThis as unknown as {
					peaksInstance: {
						segments: { getSegment: (id: string) => unknown };
					};
				}
			).peaksInstance;
			const lc = (
				globalThis as unknown as {
					__loopController: { loopSegment: (s: unknown) => Promise<void> };
				}
			).__loopController;
			await lc.loopSegment(peaks.segments.getSegment("segment-intro"));
		});
		await expect(page.locator("#loop-status")).toContainText("Intro");
		await expect(page.locator("#loop-status")).toContainText("0.00");
		await expect(page.locator("#loop-status")).toContainText("3.93");

		// Programmatically extend the loop end. LoopController observes
		// `segments.update`, calls `player.setLoopBounds`, and re-emits the
		// formatted status label — so the readout must reflect the new bounds.
		await page.evaluate(() => {
			const peaks = (
				globalThis as unknown as {
					peaksInstance: {
						segments: {
							getSegment: (
								id: string,
							) => { update: (props: { endTime: number }) => void } | undefined;
						};
					};
				}
			).peaksInstance;
			const segment = peaks.segments.getSegment("segment-intro");
			if (!segment) throw new Error("missing segment-intro");
			segment.update({ endTime: 20 });
		});

		await expect(page.locator("#loop-status")).toContainText("20.00");
	});

	test("Jump action on a point row seeks the playhead to that point", async ({
		page,
	}) => {
		await gotoReady(page);

		// Wrap player.seek in the page context so we can capture the
		// argument the click delegates to. Reading currentTime is unreliable
		// before the AudioContext is resumed by a real user gesture.
		const pointTime = await page.evaluate(() => {
			const peaks = (
				globalThis as unknown as {
					peaksInstance: {
						player: { seek: (time: number) => void };
						points: {
							getPoint: (id: string) => { time: number } | undefined;
						};
					};
				} & { __seekCalls?: number[] }
			).peaksInstance;
			(globalThis as unknown as { __seekCalls: number[] }).__seekCalls = [];
			const original = peaks.player.seek.bind(peaks.player);
			peaks.player.seek = (time: number) => {
				(globalThis as unknown as { __seekCalls: number[] }).__seekCalls.push(
					time,
				);
				return original(time);
			};
			return peaks.points.getPoint("point-1")?.time ?? -1;
		});
		expect(pointTime).toBeGreaterThan(0);

		await page
			.locator(
				'#points-compact button[data-action="jump-point"][data-id="point-1"]',
			)
			.click();

		const calls = await page.evaluate(
			() => (globalThis as unknown as { __seekCalls: number[] }).__seekCalls,
		);
		expect(calls).toHaveLength(1);
		expect(calls[0]).toBeCloseTo(pointTime, 5);
	});
});
