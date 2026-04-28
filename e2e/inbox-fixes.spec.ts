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

	test("snap controls live under Tempo & Grid as a single toggle", async ({
		page,
	}) => {
		await gotoReady(page);
		// The four per-kind snap toggles have been collapsed into a single
		// `Snap` toggle that controls all snap kinds at once.
		await expect(page.locator("#snap-enabled")).toBeVisible();
		await expect(page.locator("#snap-segments")).toHaveCount(0);
		await expect(page.locator("#snap-segment-markers")).toHaveCount(0);
		await expect(page.locator("#snap-points")).toHaveCount(0);
		await expect(page.locator("#snap-insert-segment")).toHaveCount(0);
		const labelTexts = await page
			.locator("label.toggle span")
			.allTextContents();
		expect(labelTexts).toContain("Snap");
		expect(labelTexts).not.toContain("Segment body");
		expect(labelTexts).not.toContain("Segment markers");
		expect(labelTexts).not.toContain("On insert");
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

	test("width slider has been removed (waveform is full-width)", async ({
		page,
	}) => {
		await gotoReady(page);
		await expect(page.locator("#width")).toHaveCount(0);
		await expect(page.locator("#width-value")).toHaveCount(0);
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

	test("right-clicking a segment row opens the editor popover and applies edits", async ({
		page,
	}) => {
		await gotoReady(page);

		const row = page.locator(
			'#segments-compact li[data-segment-id="segment-1"]',
		);
		await row.dispatchEvent("contextmenu");
		await expect(page.locator("#context-menu")).not.toHaveClass(/hide/);
		await page
			.locator('#context-menu .context-menu__item:has-text("Edit")')
			.click();
		await expect(page.locator("#edit-popover")).not.toHaveClass(/hide/);

		await page
			.locator('#edit-popover input[data-edit-field="startTime"]')
			.fill("6.5");
		await page
			.locator('#edit-popover input[data-edit-field="endTime"]')
			.fill("11");
		await page
			.locator('#edit-popover button[data-action="apply-edit"]')
			.click();

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

	test("right-clicking a point row opens the editor popover and applies edits", async ({
		page,
	}) => {
		await gotoReady(page);

		const row = page.locator('#points-compact li[data-point-id="point-1"]');
		await row.dispatchEvent("contextmenu");
		await page
			.locator('#context-menu .context-menu__item:has-text("Edit")')
			.click();
		await page
			.locator('#edit-popover input[data-edit-field="time"]')
			.fill("25.25");
		await page
			.locator('#edit-popover button[data-action="apply-edit"]')
			.click();

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

	test("side panel is always-visible and waveform stretches full width", async ({
		page,
	}) => {
		await gotoReady(page);

		// The aside is no longer collapsible; ensure a non-zero width.
		const asideWidth = await page
			.locator(".page__aside")
			.evaluate((el) => el.getBoundingClientRect().width);
		expect(asideWidth).toBeGreaterThan(100);

		// The waveform container fills the available main-column width.
		const { mainW, waveformW } = await page.evaluate(() => {
			const main = document.querySelector(".page__main") as HTMLElement;
			const wf = document.querySelector(".waveform-container") as HTMLElement;
			return {
				mainW: main.getBoundingClientRect().width,
				waveformW: wf.getBoundingClientRect().width,
			};
		});
		expect(waveformW).toBeGreaterThan(mainW * 0.9);
	});

	test("playback-rate slider applies the rate to the player", async ({
		page,
	}) => {
		await gotoReady(page);

		// Spy on player.setPlaybackRate to capture the value the slider sends.
		await page.evaluate(() => {
			const peaks = (
				globalThis as unknown as {
					peaksInstance: {
						player: { setPlaybackRate: (rate: number) => void };
					};
				}
			).peaksInstance;
			(globalThis as unknown as { __rateCalls: number[] }).__rateCalls = [];
			const original = peaks.player.setPlaybackRate.bind(peaks.player);
			peaks.player.setPlaybackRate = (rate: number) => {
				(globalThis as unknown as { __rateCalls: number[] }).__rateCalls.push(
					rate,
				);
				original(rate);
			};
		});

		await page.locator("#playback-rate").evaluate((el: HTMLInputElement) => {
			el.value = "1.5";
			el.dispatchEvent(new Event("input", { bubbles: true }));
		});

		const calls = await page.evaluate(
			() => (globalThis as unknown as { __rateCalls: number[] }).__rateCalls,
		);
		expect(calls.at(-1)).toBeCloseTo(1.5, 5);
		await expect(page.locator("#playback-rate-value")).toHaveText("1.50");
	});

	test("right-clicking the zoomview adds a segment at the click position", async ({
		page,
	}) => {
		await gotoReady(page);

		const before = await page.evaluate(() => {
			const peaks = (
				globalThis as unknown as {
					peaksInstance: { segments: { getSegments: () => unknown[] } };
				}
			).peaksInstance;
			return peaks.segments.getSegments().length;
		});

		const container = page.locator("#zoomview-container");
		await container.scrollIntoViewIfNeeded();
		const box = await container.boundingBox();
		if (!box) throw new Error("zoomview not laid out");
		await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
		await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, {
			button: "right",
		});
		await page
			.locator('#context-menu .context-menu__item:has-text("Add segment")')
			.click();

		const after = await page.evaluate(() => {
			const peaks = (
				globalThis as unknown as {
					peaksInstance: { segments: { getSegments: () => unknown[] } };
				}
			).peaksInstance;
			return peaks.segments.getSegments().length;
		});
		expect(after).toBe(before + 1);
	});
});
