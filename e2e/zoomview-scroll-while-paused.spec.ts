import { expect, type Page, test } from "@playwright/test";

const BASE = "http://127.0.0.1:8090";

interface ZoomviewHandle {
	setStartTime: (time: number) => void;
	getStartTime: () => number;
}

interface PeaksHandle {
	player: { isPlaying: () => boolean; getDuration: () => number };
	views: { getView: (name: "zoomview") => ZoomviewHandle | undefined };
}

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

function isPlaying(page: Page): Promise<boolean> {
	return page.evaluate(() =>
		(
			globalThis as unknown as { peaksInstance: PeaksHandle }
		).peaksInstance.player.isPlaying(),
	);
}

test.describe("zoomview scroll while paused", () => {
	// Regression: the clip-node worklet reports a frame on every audio block,
	// also while paused. Each report became a `player.timeupdate`, and the
	// zoomview auto-scrolled back to the idle playhead about 4 times per
	// second, so the user could not scroll away from the playhead.
	test("a scrolled zoomview stays put while playback is paused", async ({
		page,
	}) => {
		await gotoReady(page);

		// Start and pause playback with real clicks, so the AudioContext runs.
		const playPause = page.locator("#play-pause");
		await playPause.click();
		await expect.poll(() => isPlaying(page)).toBe(true);
		await playPause.click();
		await expect.poll(() => isPlaying(page)).toBe(false);

		const target = await page.evaluate(() => {
			const peaks = (globalThis as unknown as { peaksInstance: PeaksHandle })
				.peaksInstance;
			const zoom = peaks.views.getView("zoomview");
			if (!zoom) throw new Error("Missing zoomview");
			const time = peaks.player.getDuration() / 2;
			zoom.setStartTime(time);
			return zoom.getStartTime();
		});
		expect(target).toBeGreaterThan(5);

		// Several time-update intervals (250 ms each) pass while paused.
		await page.waitForTimeout(1_500);

		const after = await page.evaluate(
			() =>
				(
					globalThis as unknown as { peaksInstance: PeaksHandle }
				).peaksInstance.views
					.getView("zoomview")
					?.getStartTime() ?? -1,
		);
		expect(after).toBeCloseTo(target, 3);
	});
});
