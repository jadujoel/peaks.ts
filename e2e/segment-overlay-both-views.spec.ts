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

test.describe("segment overlay rendered in both views", () => {
	test("seeded segments draw an overlay rect AND a waveform shape in zoomview and overview", async ({
		page,
	}) => {
		await gotoReady(page);

		// segmentsLayer culls segment shapes that fall outside the visible
		// time window. Scroll the zoomview to each seeded segment in turn
		// and inspect that segment's shape in both views before moving on.
		const inspection = await page.evaluate(async () => {
			type Shape = {
				readonly overlayRect?: unknown;
				readonly overlayText?: unknown;
				readonly waveformShape?: unknown;
			};
			type View = {
				segmentsLayer: {
					getSegmentShape: (segment: unknown) => Shape | undefined;
				};
			};
			type ZoomView = View & {
				setStartTime: (time: number) => void;
			};
			type Peaks = {
				segments: {
					getSegments: () => readonly { id: string; startTime: number }[];
				};
				views: {
					getView(name: "zoomview"): ZoomView | undefined;
					getView(name: "overview"): View | undefined;
				};
			};
			const peaks = (globalThis as unknown as { peaksInstance: Peaks })
				.peaksInstance;
			const segments = peaks.segments.getSegments();
			const zoom = peaks.views.getView("zoomview");
			const overview = peaks.views.getView("overview");
			if (!zoom || !overview) {
				throw new Error("Missing views");
			}
			const results: Array<{
				id: string;
				zoom: {
					hasOverlayRect: boolean;
					hasOverlayText: boolean;
					hasWaveformShape: boolean;
				};
				overview: {
					hasOverlayRect: boolean;
					hasOverlayText: boolean;
					hasWaveformShape: boolean;
				};
			}> = [];

			for (const segment of segments) {
				zoom.setStartTime(Math.max(0, segment.startTime - 0.5));
				await new Promise((resolve) =>
					globalThis.requestAnimationFrame(() => resolve(undefined)),
				);
				const z = zoom.segmentsLayer.getSegmentShape(segment);
				const o = overview.segmentsLayer.getSegmentShape(segment);
				results.push({
					id: segment.id,
					overview: {
						hasOverlayRect: Boolean(o?.overlayRect),
						hasOverlayText: Boolean(o?.overlayText),
						hasWaveformShape: Boolean(o?.waveformShape),
					},
					zoom: {
						hasOverlayRect: Boolean(z?.overlayRect),
						hasOverlayText: Boolean(z?.overlayText),
						hasWaveformShape: Boolean(z?.waveformShape),
					},
				});
			}
			return results;
		});

		expect(inspection.length).toBeGreaterThanOrEqual(2);
		for (const entry of inspection) {
			expect(entry.zoom.hasOverlayRect, `${entry.id} zoom rect`).toBe(true);
			expect(entry.zoom.hasOverlayText, `${entry.id} zoom text`).toBe(true);
			expect(
				entry.zoom.hasWaveformShape,
				`${entry.id} zoom waveform (combined mode)`,
			).toBe(true);
			expect(entry.overview.hasOverlayRect, `${entry.id} overview rect`).toBe(
				true,
			);
			expect(entry.overview.hasOverlayText, `${entry.id} overview text`).toBe(
				true,
			);
			expect(
				entry.overview.hasWaveformShape,
				`${entry.id} overview waveform (combined mode)`,
			).toBe(true);
		}
	});
});
