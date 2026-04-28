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

test.describe("inbox fixes (waveform color persists across resize)", () => {
	test("changing waveform color before resize is preserved after height changes", async ({
		page,
	}) => {
		await gotoReady(page);
		await page
			.locator("#zoomview-container canvas")
			.first()
			.waitFor({ state: "visible" });

		// Pick a custom color and dispatch the same `input` event the
		// color picker fires so the existing wireColors handler runs.
		const customColor = "#ff8800";
		await page.evaluate((color) => {
			const picker = document.getElementById(
				"waveform-color",
			) as HTMLInputElement;
			picker.value = color;
			picker.dispatchEvent(new Event("input", { bubbles: true }));
		}, customColor);

		// Sanity: the zoomview must exist before we mutate state.
		const hasZoom = await page.evaluate(() => {
			const peaks = (
				globalThis as unknown as {
					peaksInstance: {
						views: { getZoomview: () => unknown };
					};
				}
			).peaksInstance;
			return peaks.views.getZoomview() !== undefined;
		});
		expect(hasZoom).toBe(true);

		// Trigger a height change which routes through `view.fitToContainer`
		// → `waveformShape.fitToView()`. Pre-fix this snapped the color back
		// to the original construction-time value.
		await page.evaluate(() => {
			const slider = document.getElementById("height") as HTMLInputElement;
			slider.value = "300";
			slider.dispatchEvent(new Event("input", { bubbles: true }));
		});

		await page.waitForFunction(() => {
			const c = document.getElementById("zoomview-container");
			const canvas = c?.querySelector("canvas") as HTMLCanvasElement | null;
			return (
				c !== null &&
				canvas !== null &&
				canvas.clientHeight === c.clientHeight &&
				c.clientHeight === 300
			);
		});

		// Read the persisted color directly off the underlying WaveformShape.
		// Pre-fix `setWaveformColor` updated only the driver shape's fill;
		// the captured `color` field stayed at the construction-time value
		// and `fitToView()` snapped it back on resize.
		const persisted = await page.evaluate(() => {
			const peaks = (
				globalThis as unknown as {
					peaksInstance: {
						views: {
							getZoomview: () =>
								| {
										view: { waveformShape: { color: string } };
								  }
								| undefined;
						};
					};
				}
			).peaksInstance;
			const zoom = peaks.views.getZoomview();
			return zoom?.view.waveformShape.color;
		});

		expect(persisted).toBe(customColor);
	});

	test("snap controls live under Tempo & Grid without 'Snap' prefix labels", async ({
		page,
	}) => {
		await gotoReady(page);
		// Each snap toggle now uses a shorter label nested under the Snap
		// subgroup. The `Snap` heading and the four toggle inputs must exist.
		await expect(page.getByText("Snap", { exact: true }).first()).toBeVisible();
		await expect(page.locator("#snap-segments")).toBeVisible();
		await expect(page.locator("#snap-segment-markers")).toBeVisible();
		await expect(page.locator("#snap-points")).toBeVisible();
		await expect(page.locator("#snap-insert-segment")).toBeVisible();
		// The full `Snap segment body` label should no longer exist on any
		// individual `<span>` — the toggles use the shortened labels.
		const labelTexts = await page
			.locator("label.toggle span")
			.allTextContents();
		expect(labelTexts).toContain("Segment body");
		expect(labelTexts).not.toContain("Snap segment body");
		expect(labelTexts).not.toContain("Snap on insert");
	});

	test("background color picker re-tints the zoomview container", async ({
		page,
	}) => {
		await gotoReady(page);
		const newBg = "#221144";
		await page.evaluate((color) => {
			const picker = document.getElementById(
				"zoomview-bg-color",
			) as HTMLInputElement;
			picker.value = color;
			picker.dispatchEvent(new Event("input", { bubbles: true }));
		}, newBg);

		const bg = await page.evaluate(() => {
			const c = document.getElementById("zoomview-container");
			return c?.style.backgroundColor ?? "";
		});
		// Browsers normalise colors to rgb() — check the channels match.
		expect(bg).toBe("rgb(34, 17, 68)");
	});

	test("compact list jump button seeks to segment start", async ({ page }) => {
		await gotoReady(page);

		// The compact list only shows when the full Segments group is
		// collapsed. Close the details first to mirror the user-facing flow.
		await page.evaluate(() => {
			const details = document.getElementById(
				"segments-group",
			) as HTMLDetailsElement;
			details.open = false;
		});

		// Capture seek calls to verify the compact button delegates to
		// player.seek with the segment's startTime.
		await page.evaluate(() => {
			const peaks = (
				globalThis as unknown as {
					peaksInstance: { player: { seek: (t: number) => void } };
				}
			).peaksInstance;
			(globalThis as unknown as { __seekCalls: number[] }).__seekCalls = [];
			const original = peaks.player.seek.bind(peaks.player);
			peaks.player.seek = (time: number) => {
				(globalThis as unknown as { __seekCalls: number[] }).__seekCalls.push(
					time,
				);
				return original(time);
			};
		});

		await page
			.locator(
				'#segments-compact button[data-action="jump-segment"][data-id="segment-1"]',
			)
			.click();

		const calls = await page.evaluate(
			() => (globalThis as unknown as { __seekCalls: number[] }).__seekCalls,
		);
		expect(calls).toHaveLength(1);
		expect(calls[0]).toBeCloseTo(5, 5);
	});

	test("expanded segments/points panel widens the aside", async ({ page }) => {
		await gotoReady(page);

		// Collapse both panels and capture the slim aside width.
		await page.evaluate(() => {
			for (const id of ["segments-group", "points-group"]) {
				const el = document.getElementById(id) as HTMLDetailsElement;
				el.open = false;
			}
		});
		const collapsedWidth = await page
			.locator(".page__aside")
			.evaluate((el) => el.getBoundingClientRect().width);

		// Expand the segments panel — the table needs the wider column.
		await page.evaluate(() => {
			(document.getElementById("segments-group") as HTMLDetailsElement).open =
				true;
		});
		const expandedWidth = await page
			.locator(".page__aside")
			.evaluate((el) => el.getBoundingClientRect().width);

		expect(expandedWidth).toBeGreaterThan(collapsedWidth + 100);
	});

	test("played waveform color is applied on first paint", async ({ page }) => {
		await gotoReady(page);

		const initial = await page.evaluate(() => {
			const peaks = (
				globalThis as unknown as {
					peaksInstance: {
						views: {
							getZoomview: () =>
								| { view: { playedWaveformColor: string | undefined } }
								| undefined;
						};
					};
				}
			).peaksInstance;
			return peaks.views.getZoomview()?.view.playedWaveformColor;
		});
		// The HTML picker defaults to #aa0044, and Controls now applies it
		// on init so the played overlay appears without first input.
		expect(initial).toBe("#aa0044");
	});

	test("editing the segment start/end inputs updates the segment", async ({
		page,
	}) => {
		await gotoReady(page);

		// Locate the start-time input for segment-1 (seeded at 5..12) and
		// commit a new value via change event (mirrors blur/Enter).
		await page.evaluate(() => {
			const start = document.querySelector(
				'input[data-action="edit-segment-start"][data-id="segment-1"]',
			) as HTMLInputElement;
			start.value = "6.5";
			start.dispatchEvent(new Event("change", { bubbles: true }));
			const end = document.querySelector(
				'input[data-action="edit-segment-end"][data-id="segment-1"]',
			) as HTMLInputElement;
			end.value = "11";
			end.dispatchEvent(new Event("change", { bubbles: true }));
		});

		const bounds = await page.evaluate(() => {
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
			const seg = peaks.segments.getSegment("segment-1");
			return seg ? { end: seg.endTime, start: seg.startTime } : undefined;
		});
		expect(bounds?.start).toBeCloseTo(6.5, 5);
		expect(bounds?.end).toBeCloseTo(11, 5);
	});

	test("editing the point time input updates the point", async ({ page }) => {
		await gotoReady(page);

		await page.evaluate(() => {
			const t = document.querySelector(
				'input[data-action="edit-point-time"][data-id="point-1"]',
			) as HTMLInputElement;
			t.value = "25.25";
			t.dispatchEvent(new Event("change", { bubbles: true }));
		});

		const time = await page.evaluate(() => {
			const peaks = (
				globalThis as unknown as {
					peaksInstance: {
						points: {
							getPoint: (id: string) => { time: number } | undefined;
						};
					};
				}
			).peaksInstance;
			return peaks.points.getPoint("point-1")?.time;
		});
		expect(time).toBeCloseTo(25.25, 5);
	});

	test("Stop Loop disables the underlying clip-node loop flag", async ({
		page,
	}) => {
		await gotoReady(page);

		// Spy on player.setLooped to verify the loop controller calls it.
		await page.evaluate(() => {
			const peaks = (
				globalThis as unknown as {
					peaksInstance: {
						player: { setLooped: (loop: boolean) => void };
					};
				}
			).peaksInstance;
			(globalThis as unknown as { __loopedCalls: boolean[] }).__loopedCalls =
				[];
			const original = peaks.player.setLooped.bind(peaks.player);
			peaks.player.setLooped = (loop: boolean) => {
				(
					globalThis as unknown as { __loopedCalls: boolean[] }
				).__loopedCalls.push(loop);
				original(loop);
			};
		});

		// Start file loop then stop it via the demo's Stop Loop button.
		await page.locator('[data-action="loop-file"]').click();
		await page.locator('[data-action="stop-loop"]').click();

		const calls = await page.evaluate(
			() =>
				(globalThis as unknown as { __loopedCalls: boolean[] }).__loopedCalls,
		);
		expect(calls).toContain(false);
	});

	test("side panel collapses to a vertical strip and reclaims main width", async ({
		page,
	}) => {
		await gotoReady(page);

		const openWidth = await page
			.locator(".page__aside")
			.evaluate((el) => el.getBoundingClientRect().width);

		// Close the top-level side-panel <details>.
		await page.evaluate(() => {
			const panel = document.querySelector(".side-panel") as HTMLDetailsElement;
			panel.open = false;
		});

		const closedWidth = await page
			.locator(".page__aside")
			.evaluate((el) => el.getBoundingClientRect().width);

		// Closed strip should be markedly narrower than the open panel.
		expect(closedWidth).toBeLessThan(openWidth - 100);
	});
});
