import { expect, test } from "@playwright/test";

test("precomputed waveform demo loads without runtime errors", async ({
	page,
}) => {
	const consoleErrors: string[] = [];
	const pageErrors: string[] = [];

	page.on("console", (message) => {
		if (message.type() === "error") {
			consoleErrors.push(message.text());
		}
	});

	page.on("pageerror", (error) => {
		pageErrors.push(error.message);
	});

	await page.goto("/index.html");

	await expect(
		page.locator('#controls button[data-action="zoom-in"]'),
	).toBeVisible();
	await expect(
		page.locator("#zoomview-container .konvajs-content canvas").first(),
	).toBeVisible();
	await expect(
		page.locator("#overview-container .konvajs-content canvas").first(),
	).toBeVisible();

	await page.locator('button[data-action="zoom-in"]').click();
	await page.locator('button[data-action="zoom-out"]').click();

	expect(pageErrors).toEqual([]);
	expect(consoleErrors).toEqual([]);
});

test("precomputed waveform demo handles keyboard navigation without errors", async ({
	page,
}) => {
	const consoleErrors: string[] = [];
	const pageErrors: string[] = [];

	page.on("console", (message) => {
		if (message.type() === "error") {
			consoleErrors.push(message.text());
		}
	});

	page.on("pageerror", (error) => {
		pageErrors.push(error.message);
	});

	await page.goto("/index.html");

	const zoomview = page.locator("#zoomview-container .konvajs-content").first();

	await expect(zoomview).toBeVisible();
	await zoomview.click();
	await page.keyboard.press("ArrowRight");
	await page.keyboard.press("Shift+ArrowLeft");
	await page.keyboard.press("Space");

	expect(pageErrors).toEqual([]);
	expect(consoleErrors).toEqual([]);
});

test("public init API returns a thenable Result", async ({ page }) => {
	await page.goto("/index.html");

	const result = await page.evaluate(async () => {
		const loadPeaks = new Function(
			'return import("/peaks.esm.js")',
		) as () => Promise<{
			Peaks: { from: (...args: unknown[]) => unknown };
		}>;
		const peaksModule = await loadPeaks();

		const returnValue = peaksModule.Peaks.from({
			mediaElement: document.getElementById("audio"),
		});

		const isThenable =
			returnValue !== null &&
			typeof returnValue === "object" &&
			typeof (returnValue as { then?: unknown }).then === "function";

		const awaited = (await returnValue) as { isErr: () => boolean };

		return { isErr: awaited.isErr(), isThenable };
	});

	expect(result.isThenable).toBe(true);
	expect(result.isErr).toBe(true);
});

test("public async init API resolves with an instance", async ({ page }) => {
	await page.goto("/index.html");

	const result = await page.evaluate(async () => {
		const loadPeaks = new Function(
			'return import("/peaks.esm.js")',
		) as () => Promise<{
			Peaks: {
				from: (options: Record<string, unknown>) => Promise<{
					_unsafeUnwrap: () => {
						dispose: () => void;
						views: { getView: (name: string) => unknown };
					};
				}>;
			};
		}>;
		const peaksModule = await loadPeaks();
		const instance = (
			await peaksModule.Peaks.from({
				dataUri: {
					arraybuffer: "/TOL_6min_720p_download.dat",
					json: "/TOL_6min_720p_download.json",
				},
				mediaElement: document.getElementById("audio"),
				overview: {
					container: document.getElementById("overview-container"),
				},
				zoomview: {
					container: document.getElementById("zoomview-container"),
					playheadClickTolerance: 3,
				},
			})
		)._unsafeUnwrap();

		const hasZoomview = Boolean(instance.views.getView("zoomview"));
		instance.dispose();

		return hasZoomview;
	});

	expect(result).toBe(true);
});

test("public async init API returns working concrete view instances", async ({
	page,
}) => {
	await page.goto("/index.html");

	const result = await page.evaluate(async () => {
		const loadPeaks = new Function(
			'return import("/peaks.esm.js")',
		) as () => Promise<{
			Peaks: {
				from: (options: Record<string, unknown>) => Promise<{
					_unsafeUnwrap: () => {
						dispose: () => void;
						views: {
							getView: (name: string) => {
								constructor?: { name?: string };
								getStartTime: () => number;
								scrollWaveform?: (options: { pixels: number }) => void;
							};
						};
					};
				}>;
			};
		}>;
		const peaksModule = await loadPeaks();
		const instance = (
			await peaksModule.Peaks.from({
				dataUri: {
					arraybuffer: "/TOL_6min_720p_download.dat",
					json: "/TOL_6min_720p_download.json",
				},
				mediaElement: document.getElementById("audio"),
				overview: {
					container: document.getElementById("overview-container"),
				},
				zoomview: {
					container: document.getElementById("zoomview-container"),
				},
			})
		)._unsafeUnwrap();

		const overview = instance.views.getView("overview");
		const zoomview = instance.views.getView("zoomview");
		const startTimeBefore = zoomview?.getStartTime() ?? 0;

		zoomview?.scrollWaveform?.({ pixels: 64 });

		const startTimeAfter = zoomview?.getStartTime() ?? 0;
		const evaluation = {
			overviewName: overview?.constructor?.name,
			startTimeMoved: startTimeAfter > startTimeBefore,
			zoomviewName: zoomview?.constructor?.name,
		};

		instance.dispose();

		return evaluation;
	});

	expect(result.overviewName).toBe("WaveformOverview");
	expect(result.zoomviewName).toBe("WaveformZoomView");
	expect(result.startTimeMoved).toBe(true);
});

test("Peaks.from resolves to an Ok Result on success", async ({ page }) => {
	await page.goto("/index.html");

	const result = await page.evaluate(async () => {
		const loadPeaks = new Function(
			'return import("/peaks.esm.js")',
		) as () => Promise<{
			Peaks: {
				from: (options: Record<string, unknown>) => Promise<{
					isOk: () => boolean;
					_unsafeUnwrap: () => { dispose: () => void };
				}>;
			};
		}>;
		const peaksModule = await loadPeaks();

		const initResult = await peaksModule.Peaks.from({
			dataUri: {
				arraybuffer: "/TOL_6min_720p_download.dat",
				json: "/TOL_6min_720p_download.json",
			},
			mediaElement: document.getElementById("audio"),
			overview: {
				container: document.getElementById("overview-container"),
			},
			zoomview: {
				container: document.getElementById("zoomview-container"),
			},
		});

		const isOk = initResult.isOk();
		const instance = initResult._unsafeUnwrap();
		const instanceOk = Boolean(instance);
		instance.dispose();

		return { instanceOk, isOk };
	});

	expect(result.isOk).toBe(true);
	expect(result.instanceOk).toBe(true);
});

test("custom markers demo keeps edited labels after rerender", async ({
	page,
}) => {
	const consoleErrors: string[] = [];
	const pageErrors: string[] = [];

	page.on("console", (message) => {
		if (message.type() === "error") {
			consoleErrors.push(message.text());
		}
	});

	page.on("pageerror", (error) => {
		pageErrors.push(error.message);
	});

	await page.goto("/custom-markers/index.html");

	await expect(
		page.locator('#controls button[data-action="add-segment"]'),
	).toBeVisible();
	await expect(
		page.locator("#zoomview-container .konvajs-content canvas").first(),
	).toBeVisible();

	await page.locator('button[data-action="add-segment"]').click();
	await page.locator('button[data-action="add-point"]').click();
	await page.locator('button[data-action="log-data"]').click();

	const segmentLabelInput = page.locator(
		'input[data-action="update-segment-label"]',
	);
	const pointLabelInput = page.locator(
		'input[data-action="update-point-label"]',
	);

	await segmentLabelInput.fill("Renamed Segment");
	await pointLabelInput.fill("Renamed Point");
	await page.locator('button[data-action="log-data"]').click();

	await expect(segmentLabelInput).toHaveValue("Renamed Segment");
	await expect(pointLabelInput).toHaveValue("Renamed Point");

	expect(pageErrors).toEqual([]);
	expect(consoleErrors).toEqual([]);
});

test("custom point marker factory receives wrapper marker surface", async ({
	page,
}) => {
	await page.goto("/index.html");

	const result = await page.evaluate(async () => {
		const loadPeaks = new Function(
			'return import("/peaks.esm.js")',
		) as () => Promise<{
			Peaks: {
				from: (options: Record<string, unknown>) => Promise<{
					_unsafeUnwrap: () => {
						dispose: () => void;
						points: {
							add: (point: { time: number; editable: boolean }) => void;
						};
					};
				}>;
			};
		}>;
		const peaksModule = await loadPeaks();

		const markerSurface = {
			hasAddLine: false,
			hasAddRect: false,
			hasAddText: false,
		};

		const instance = (
			await peaksModule.Peaks.from({
				createPointMarker: () => {
					return {
						dispose: () => {},
						fitToView: () => {},
						init: (group: {
							addLine?: (attrs: Record<string, unknown>) => unknown;
							addRect?: (attrs: Record<string, unknown>) => unknown;
							addText?: (attrs: Record<string, unknown>) => unknown;
						}) => {
							markerSurface.hasAddRect = typeof group.addRect === "function";
							markerSurface.hasAddLine = typeof group.addLine === "function";
							markerSurface.hasAddText = typeof group.addText === "function";
							group.addRect?.({ height: 6, width: 6, x: -3, y: 8 });
							group.addLine?.({
								points: [0, 0, 0, 40],
								stroke: "#222",
								strokeWidth: 1,
							});
							group.addText?.({
								fill: "#111",
								fontSize: 10,
								text: "T",
								x: 4,
								y: 6,
							});
						},
						update: () => {},
					};
				},
				dataUri: {
					arraybuffer: "/TOL_6min_720p_download.dat",
					json: "/TOL_6min_720p_download.json",
				},
				mediaElement: document.getElementById("audio"),
				overview: {
					container: document.getElementById("overview-container"),
				},
				zoomview: {
					container: document.getElementById("zoomview-container"),
				},
			})
		)._unsafeUnwrap();

		instance.points.add({ editable: true, time: 1 });
		const surfaceSnapshot = { ...markerSurface };
		instance.dispose();

		return surfaceSnapshot;
	});

	expect(result).toEqual({
		hasAddLine: true,
		hasAddRect: true,
		hasAddText: true,
	});
});
