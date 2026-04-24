import { expect, test } from "@playwright/test";

// Regression coverage for the Peaks-16 refactor: the named constructor
// `Peaks.from(config)` is the only way to build a Peaks instance, the
// default export is gone, and missing-container configs surface as an
// `Err` Result rather than throwing or silently resolving.

test("Peaks.from is the only public named constructor", async ({ page }) => {
	await page.goto("/index.html");

	const result = await page.evaluate(async () => {
		const loadPeaks = new Function(
			'return import("/peaks.esm.js")',
		) as () => Promise<Record<string, unknown>>;
		const peaksModule = await loadPeaks();
		const peaks = peaksModule.Peaks as
			| { from?: unknown; init?: unknown }
			| undefined;

		return {
			hasDefault: "default" in peaksModule,
			hasFromMethod: typeof peaks?.from === "function",
			hasInitMethod: typeof peaks?.init === "function",
			hasNamedExport: typeof peaks === "function",
		};
	});

	expect(result.hasNamedExport).toBe(true);
	expect(result.hasFromMethod).toBe(true);
	expect(result.hasInitMethod).toBe(false);
	expect(result.hasDefault).toBe(false);
});

test("Peaks.from with a valid config resolves with a disposable instance", async ({
	page,
}) => {
	await page.goto("/index.html");

	const result = await page.evaluate(async () => {
		const loadPeaks = new Function(
			'return import("/peaks.esm.js")',
		) as () => Promise<{
			Peaks: {
				from: (options: Record<string, unknown>) => Promise<{
					isOk: () => boolean;
					_unsafeUnwrap: () => {
						dispose: () => void;
						player: { getDuration: () => number };
					};
				}>;
			};
		}>;
		const { Peaks } = await loadPeaks();

		const initResult = await Peaks.from({
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
		const hasDispose = typeof instance.dispose === "function";
		const duration = instance.player.getDuration();
		instance.dispose();

		return { duration, hasDispose, isOk };
	});

	expect(result.isOk).toBe(true);
	expect(result.hasDispose).toBe(true);
	expect(result.duration).toBeGreaterThan(0);
});

test("Peaks.from returns an Err Result when containers are missing", async ({
	page,
}) => {
	await page.goto("/index.html");

	const result = await page.evaluate(async () => {
		const loadPeaks = new Function(
			'return import("/peaks.esm.js")',
		) as () => Promise<{
			Peaks: {
				from: (options: Record<string, unknown>) => Promise<{
					isErr: () => boolean;
					_unsafeUnwrapErr: () => Error;
				}>;
			};
		}>;
		const { Peaks } = await loadPeaks();

		const errResult = await Peaks.from({
			mediaElement: document.getElementById("audio"),
			// no overview/zoomview/scrollbar containers
		});

		const isErr = errResult.isErr();
		const message = isErr ? errResult._unsafeUnwrapErr().message : "";

		return { isErr, message };
	});

	expect(result.isErr).toBe(true);
	expect(result.message.length).toBeGreaterThan(0);
});
