import { expect, test } from "@playwright/test";

test("typed events bus delivers payloads to listeners", async ({ page }) => {
	await page.goto("/index.html");

	const result = await page.evaluate(async () => {
		const loadPeaks = new Function(
			'return import("/peaks.esm.js")',
		) as () => Promise<{
			Peaks: {
				from: (options: Record<string, unknown>) => Promise<{
					_unsafeUnwrap: () => {
						dispose: () => void;
						events: {
							addEventListener: (
								type: string,
								listener: (event: Record<string, unknown>) => void,
								options?: { once?: boolean },
							) => void;
							removeEventListener: (
								type: string,
								listener: (event: Record<string, unknown>) => void,
							) => void;
						};
						segments: {
							add: (segment: Record<string, unknown>) => void;
							removeAll: () => void;
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

		const addEvents: Array<{
			type: string;
			length: number;
		}> = [];
		const removeAllEvents: Array<{ type: string }> = [];

		instance.events.addEventListener("segments.add", (event) => {
			const segments = event.segments as Array<unknown>;
			addEvents.push({ length: segments.length, type: event.type as string });
		});

		const onceListener = (event: Record<string, unknown>) => {
			removeAllEvents.push({ type: event.type as string });
		};
		instance.events.addEventListener("segments.remove_all", onceListener, {
			once: true,
		});

		instance.segments.add({
			color: "#ff0000",
			editable: true,
			endTime: 2,
			labelText: "first",
			startTime: 1,
		});
		instance.segments.add({
			color: "#00ff00",
			editable: true,
			endTime: 4,
			labelText: "second",
			startTime: 3,
		});
		instance.segments.removeAll();
		instance.segments.add({
			color: "#0000ff",
			editable: true,
			endTime: 6,
			labelText: "third",
			startTime: 5,
		});
		instance.segments.removeAll();

		const result = { addEvents, removeAllEvents };

		instance.dispose();

		return result;
	});

	expect(result.addEvents).toEqual([
		{ length: 1, type: "segments.add" },
		{ length: 1, type: "segments.add" },
		{ length: 1, type: "segments.add" },
	]);
	expect(result.removeAllEvents).toEqual([{ type: "segments.remove_all" }]);
});
