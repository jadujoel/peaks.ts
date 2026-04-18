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

test("public init API throws a clear error when callback is missing", async ({
	page,
}) => {
	await page.goto("/index.html");

	const errorMessage = await page.evaluate(async () => {
		const loadPeaks = new Function(
			'return import("/peaks.esm.js")',
		) as () => Promise<{ default: { init: (...args: unknown[]) => void } }>;
		const peaksModule = await loadPeaks();

		try {
			peaksModule.default.init({
				mediaElement: document.getElementById("audio"),
			});
			return null;
		} catch (error) {
			return error instanceof Error ? error.message : String(error);
		}
	});

	expect(errorMessage).toBe("Peaks.init(): Missing callback function");
});

test("public async init API resolves with an instance", async ({ page }) => {
	await page.goto("/index.html");

	const result = await page.evaluate(async () => {
		const loadPeaks = new Function(
			'return import("/peaks.esm.js")',
		) as () => Promise<{
			default: {
				fromOptionsAsync: (options: Record<string, unknown>) => Promise<{
					destroy: () => void;
					views: { getView: (name: string) => unknown };
				}>;
			};
		}>;
		const peaksModule = await loadPeaks();
		const instance = await peaksModule.default.fromOptionsAsync({
			zoomview: {
				container: document.getElementById("zoomview-container"),
				playheadClickTolerance: 3,
			},
			overview: {
				container: document.getElementById("overview-container"),
			},
			mediaElement: document.getElementById("audio"),
			dataUri: {
				arraybuffer: "/TOL_6min_720p_download.dat",
				json: "/TOL_6min_720p_download.json",
			},
		});

		const hasZoomview = Boolean(instance.views.getView("zoomview"));
		instance.destroy();

		return hasZoomview;
	});

	expect(result).toBe(true);
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
