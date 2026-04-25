import { expect, type Page, test } from "@playwright/test";

const BASE = "http://127.0.0.1:8090";
const SNAP_TOLERANCE = 0.02;

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

async function setSegmentTimes(
	page: Page,
	id: string,
	startTime: number,
	endTime: number,
): Promise<void> {
	await page.evaluate(
		({ id, startTime, endTime }) => {
			const peaks = (
				globalThis as unknown as {
					peaksInstance: {
						segments: {
							getSegment: (id: string) =>
								| {
										update: (props: {
											startTime: number;
											endTime: number;
										}) => void;
								  }
								| undefined;
						};
					};
				}
			).peaksInstance;
			peaks.segments.getSegment(id)?.update({ endTime, startTime });
		},
		{ endTime, id, startTime },
	);
}

async function configureTempo(
	page: Page,
	options: {
		bpm: number;
		gridStep: string;
		snap: { segments?: boolean; segmentMarkers?: boolean; points?: boolean };
	},
): Promise<void> {
	await page.evaluate((opts) => {
		const peaks = (
			globalThis as unknown as {
				peaksInstance: {
					views: {
						getView: (name: string) =>
							| {
									setTempoMap: (map: unknown) => void;
									setGridStep: (step: string) => void;
									setSnapEnabled: (kind: string, enabled: boolean) => void;
							  }
							| undefined;
					};
				};
			}
		).peaksInstance;
		const mod = (
			globalThis as unknown as {
				PeaksTest?: { TempoMap: { constant: (o: { bpm: number }) => unknown } };
			}
		).PeaksTest;
		if (!mod) throw new Error("PeaksTest not exposed");
		const map = mod.TempoMap.constant({ bpm: opts.bpm });
		const view = peaks.views.getView("zoomview");
		if (!view) throw new Error("no zoomview");
		view.setTempoMap(map);
		view.setGridStep(opts.gridStep);
		for (const kind of [
			"segments",
			"segmentMarkers",
			"points",
			"insertSegment",
		]) {
			view.setSnapEnabled(kind, false);
		}
		for (const [k, v] of Object.entries(opts.snap)) {
			view.setSnapEnabled(k, Boolean(v));
		}
	}, options);
}

async function getSegment(
	page: Page,
	id: string,
): Promise<{ startTime: number; endTime: number }> {
	return page.evaluate((id) => {
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
		const s = peaks.segments.getSegment(id);
		if (!s) throw new Error(`segment ${id} not found`);
		return { endTime: s.endTime, startTime: s.startTime };
	}, id);
}

test.describe("tempo map snap", () => {
	test("snapTimeFor returns 1/8 lattice when snap enabled, raw when disabled", async ({
		page,
	}) => {
		await gotoReady(page);

		await configureTempo(page, {
			bpm: 120,
			gridStep: "1/8",
			snap: { segmentMarkers: true },
		});

		// At 120 BPM, 1/8 step = 0.25s. Snap 1.31 -> 1.25.
		const snapped = await page.evaluate(() => {
			const peaks = (
				globalThis as unknown as {
					peaksInstance: { options: { tempoMapContext: unknown } };
				}
			).peaksInstance;
			const ctx = peaks.options.tempoMapContext as {
				snapTimeFor: (kind: string, t: number) => number;
			};
			return ctx.snapTimeFor("segmentMarkers", 1.31);
		});
		expect(snapped).toBeCloseTo(1.25, 5);

		// With snap disabled, time passes through unchanged.
		await configureTempo(page, {
			bpm: 120,
			gridStep: "1/8",
			snap: {},
		});
		const raw = await page.evaluate(() => {
			const peaks = (
				globalThis as unknown as {
					peaksInstance: { options: { tempoMapContext: unknown } };
				}
			).peaksInstance;
			const ctx = peaks.options.tempoMapContext as {
				snapTimeFor: (kind: string, t: number) => number;
			};
			return ctx.snapTimeFor("segmentMarkers", 1.31);
		});
		expect(raw).toBeCloseTo(1.31, 5);
	});

	test("segment update through Peaks API stays untouched (snap is drag-time only)", async ({
		page,
	}) => {
		await gotoReady(page);
		// Programmatic API updates are not snapped — only interactive drags.
		await setSegmentTimes(page, "segment-1", 0.37, 1.31);
		const segment = await getSegment(page, "segment-1");
		expect(segment.startTime).toBeCloseTo(0.37, 5);
		expect(segment.endTime).toBeCloseTo(1.31, 5);
	});

	test("snap.apply event fires when context snaps a value", async ({
		page,
	}) => {
		await gotoReady(page);
		await configureTempo(page, {
			bpm: 120,
			gridStep: "1/8",
			snap: { segments: true },
		});

		const result = await page.evaluate(() => {
			return new Promise<{
				rawTime: number;
				snappedTime: number;
				kind: string;
			}>((resolve) => {
				const peaks = (
					globalThis as unknown as {
						peaksInstance: {
							events: {
								addEventListener: (
									ev: string,
									fn: (e: {
										kind: string;
										rawTime: number;
										snappedTime: number;
									}) => void,
								) => void;
							};
							options: {
								tempoMapContext: {
									snapTimeFor: (kind: string, t: number) => number;
								};
							};
						};
					}
				).peaksInstance;
				peaks.events.addEventListener("snap.apply", (event) => {
					resolve({
						kind: event.kind,
						rawTime: event.rawTime,
						snappedTime: event.snappedTime,
					});
				});
				peaks.options.tempoMapContext.snapTimeFor("segments", 0.62);
			});
		});

		expect(result.kind).toBe("segments");
		expect(result.rawTime).toBeCloseTo(0.62, 5);
		expect(Math.abs(result.snappedTime - 0.5)).toBeLessThan(SNAP_TOLERANCE);
	});
});
