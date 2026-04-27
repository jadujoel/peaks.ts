import { expect, test } from "@playwright/test";

const BASE = "http://127.0.0.1:8090";

interface Dims {
	readonly zoomContainer: { readonly w: number; readonly h: number };
	readonly zoomCanvas: { readonly w: number; readonly h: number };
	readonly overviewContainer: { readonly w: number; readonly h: number };
	readonly overviewCanvas: { readonly w: number; readonly h: number };
	readonly scrollContainer: { readonly w: number; readonly h: number };
	readonly scrollCanvas: { readonly w: number; readonly h: number };
}

test("Size controls resize the waveform stages, not just the CSS containers", async ({
	page,
}) => {
	const pageErrors: string[] = [];
	page.on("pageerror", (error) => {
		pageErrors.push(error.message);
	});
	page.on("console", (m) => {
		if (m.type() === "error" || m.type() === "warning") {
			console.log(`[browser ${m.type()}]`, m.text());
		}
	});

	await page.goto(`${BASE}/`);
	await expect(page.locator("#status")).toHaveText("Ready", {
		timeout: 30_000,
	});
	await page
		.locator("#zoomview-container canvas")
		.first()
		.waitFor({ state: "visible" });

	const readDims = (): Promise<Dims> =>
		page.evaluate(() => {
			const measure = (id: string) => {
				const container = document.getElementById(id);
				const canvas = container?.querySelector("canvas") as
					| HTMLCanvasElement
					| undefined;
				return {
					// clientWidth/Height reflect CSS box size and are
					// independent of devicePixelRatio scaling that Konva applies
					// to the backing-store `width`/`height` attributes.
					canvas: {
						h: canvas?.clientHeight ?? 0,
						w: canvas?.clientWidth ?? 0,
					},
					container: {
						h: container?.clientHeight ?? 0,
						w: container?.clientWidth ?? 0,
					},
				};
			};
			const zoom = measure("zoomview-container");
			const overview = measure("overview-container");
			const scroll = measure("scrollbar-container");
			return {
				overviewCanvas: overview.canvas,
				overviewContainer: overview.container,
				scrollCanvas: scroll.canvas,
				scrollContainer: scroll.container,
				zoomCanvas: zoom.canvas,
				zoomContainer: zoom.container,
			};
		});

	const setSlider = async (id: string, value: number): Promise<void> => {
		await page.evaluate(
			({ id, value }: { id: string; value: number }) => {
				const slider = document.getElementById(id) as HTMLInputElement;
				slider.value = String(value);
				slider.dispatchEvent(new Event("input", { bubbles: true }));
			},
			{ id, value },
		);
		// Wait for the canvas (in CSS pixels) to actually catch up with the
		// container size — ResizeObserver flushes asynchronously and webkit
		// is slower than chromium.
		await page.waitForFunction(
			() => {
				const c = document.getElementById("zoomview-container");
				const canvas = c?.querySelector("canvas") as
					| HTMLCanvasElement
					| undefined;
				return (
					c !== null &&
					canvas !== undefined &&
					canvas.clientWidth === c.clientWidth &&
					canvas.clientHeight === c.clientHeight
				);
			},
			{ timeout: 5_000 },
		);
	};

	// Shrink width and height so the container becomes smaller than the
	// initial canvas backing store. The canvas must follow.
	await setSlider("width", 500);
	await setSlider("height", 120);

	const shrunk = await readDims();
	expect(shrunk.zoomContainer.w).toBe(500);
	expect(shrunk.zoomContainer.h).toBe(120);
	expect(shrunk.zoomCanvas.w).toBe(shrunk.zoomContainer.w);
	expect(shrunk.zoomCanvas.h).toBe(shrunk.zoomContainer.h);
	expect(shrunk.overviewCanvas.w).toBe(shrunk.overviewContainer.w);
	expect(shrunk.overviewCanvas.h).toBe(shrunk.overviewContainer.h);
	expect(shrunk.scrollCanvas.w).toBe(shrunk.scrollContainer.w);
	expect(shrunk.scrollCanvas.h).toBe(shrunk.scrollContainer.h);

	// Grow back. Width is clamped by viewport but height should reach 400.
	await setSlider("width", 1600);
	await setSlider("height", 400);

	const grown = await readDims();
	expect(grown.zoomContainer.h).toBe(400);
	expect(grown.zoomCanvas.w).toBe(grown.zoomContainer.w);
	expect(grown.zoomCanvas.h).toBe(grown.zoomContainer.h);
	expect(grown.overviewCanvas.w).toBe(grown.overviewContainer.w);
	expect(grown.scrollCanvas.w).toBe(grown.scrollContainer.w);

	expect(pageErrors).toEqual([]);
});
