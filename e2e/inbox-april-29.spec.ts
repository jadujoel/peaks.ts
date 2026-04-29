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

test.describe("inbox 2026-04-29", () => {
	test("default tempo offset is 0.12s", async ({ page }) => {
		await gotoReady(page);
		await expect(page.locator("#tempo-offset")).toHaveValue("0.12");
	});

	test("seeded segments start at 0.12s and align with bars", async ({
		page,
	}) => {
		await gotoReady(page);
		const intro = await page.evaluate(() => {
			const peaks = (
				globalThis as unknown as {
					peaksInstance: {
						segments: {
							getSegment: (
								id: string,
							) => { startTime: number; endTime: number } | undefined;
						};
					};
				}
			).peaksInstance;
			const s = peaks.segments.getSegment("segment-intro");
			return s ? { end: s.endTime, start: s.startTime } : undefined;
		});
		expect(intro?.start).toBeCloseTo(0.12, 5);
		expect(intro?.end).toBeCloseTo(4.12, 5);

		const verse = await page.evaluate(() => {
			const peaks = (
				globalThis as unknown as {
					peaksInstance: {
						segments: {
							getSegment: (
								id: string,
							) => { startTime: number; endTime: number } | undefined;
						};
					};
				}
			).peaksInstance;
			const s = peaks.segments.getSegment("segment-verse-1");
			return s ? { end: s.endTime, start: s.startTime } : undefined;
		});
		expect(verse?.start).toBeCloseTo(4.12, 5);
		expect(verse?.end).toBeCloseTo(20.12, 5);
	});

	test("spacebar toggles play/pause", async ({ page }) => {
		await gotoReady(page);
		const isPlaying = (): Promise<boolean> =>
			page.evaluate(() => {
				const peaks = (
					globalThis as unknown as {
						peaksInstance: { player: { isPlaying: () => boolean } };
					}
				).peaksInstance;
				return peaks.player.isPlaying();
			});
		expect(await isPlaying()).toBe(false);
		// Move focus to body so the key handler isn't intercepted by an input.
		await page.evaluate(() => {
			const active = document.activeElement;
			if (active instanceof HTMLElement) active.blur();
		});
		await page.keyboard.press("Space");
		await expect.poll(isPlaying).toBe(true);
		await page.keyboard.press("Space");
		await expect.poll(isPlaying).toBe(false);
	});

	test("single play/pause button updates its label", async ({ page }) => {
		await gotoReady(page);
		const btn = page.locator("#play-pause");
		await expect(btn).toContainText("Play");
		// Old separate pause button must no longer exist.
		await expect(page.locator('button[data-action="pause"]')).toHaveCount(0);
		await expect(page.locator('button[data-action="play"]')).toHaveCount(0);
		await btn.click();
		await expect(btn).toContainText("Pause");
		await btn.click();
		await expect(btn).toContainText("Play");
	});

	test("Snap-all button snaps every segment to the grid", async ({ page }) => {
		await gotoReady(page);
		// Add a deliberately off-grid segment.
		await page.evaluate(() => {
			const peaks = (
				globalThis as unknown as {
					peaksInstance: {
						segments: {
							add: (s: {
								id: string;
								startTime: number;
								endTime: number;
								editable: boolean;
							}) => void;
						};
					};
				}
			).peaksInstance;
			peaks.segments.add({
				editable: true,
				endTime: 110.37,
				id: "segment-misaligned",
				startTime: 100.37,
			});
		});
		await page.locator('button[data-action="snap-all-segments"]').click();
		const snapped = await page.evaluate(() => {
			const peaks = (
				globalThis as unknown as {
					peaksInstance: {
						segments: {
							getSegment: (
								id: string,
							) => { startTime: number; endTime: number } | undefined;
						};
					};
				}
			).peaksInstance;
			const s = peaks.segments.getSegment("segment-misaligned");
			return s ? { end: s.endTime, start: s.startTime } : undefined;
		});
		// 1/4 grid at 120 BPM = 0.5s, plus 0.12s offset → snapped values land
		// on N*0.5 + 0.12.
		expect(snapped).toBeDefined();
		const isOnGrid = (t: number): boolean => {
			const remainder = ((t - 0.12) * 1000) % 500;
			return Math.min(remainder, 500 - remainder) < 1;
		};
		expect(isOnGrid(snapped?.start ?? -1)).toBe(true);
		expect(isOnGrid(snapped?.end ?? -1)).toBe(true);
	});

	test("when grid is enabled, segment list shows bar numbers", async ({
		page,
	}) => {
		await gotoReady(page);
		// grid-visible defaults to checked so labels should already be bars.
		const intro = page.locator(
			'#segments-compact li[data-segment-id="segment-intro"] .compact-list__time',
		);
		await expect(intro).toContainText("Bar");
		// Toggle off → should fall back to seconds.
		await page.locator("#grid-visible").click();
		await expect(intro).not.toContainText("Bar");
		await expect(intro).toContainText(".");
	});

	test("default segment marker color matches the segment color", async ({
		page,
	}) => {
		await gotoReady(page);
		const result = await page.evaluate(() => {
			const peaks = (
				globalThis as unknown as {
					peaksInstance: {
						segments: {
							getSegment: (id: string) => { color?: string } | undefined;
						};
						views: {
							getZoomview: () => unknown;
						};
					};
				}
			).peaksInstance;
			const seg = peaks.segments.getSegment("segment-intro");
			const zoomview = peaks.views.getZoomview() as {
				view: {
					segmentsLayer?: {
						getSegmentShape?: (segment: unknown) => {
							startMarkerInstance?: {
								marker?: { options?: { color?: string } };
							};
							endMarkerInstance?: { marker?: { options?: { color?: string } } };
						};
					};
				};
			};
			const shape = zoomview.view.segmentsLayer?.getSegmentShape?.(seg);
			return {
				endMarker: shape?.endMarkerInstance?.marker?.options?.color,
				segmentColor: seg?.color,
				startMarker: shape?.startMarkerInstance?.marker?.options?.color,
			};
		});
		expect(result.segmentColor).toBe("#22c55e");
		expect(result.startMarker).toBe("#22c55e");
		expect(result.endMarker).toBe("#22c55e");
	});
});
