import { expect, test } from "@playwright/test";

const BASE = "http://127.0.0.1:8090";

test("main example loads, exposes every feature group, and round-trips actions", async ({
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

	await page.goto(`${BASE}/`);

	// Initialisation completed
	await expect(page.locator("#status")).toHaveText("Ready", {
		timeout: 30_000,
	});

	// Waveform canvases render via Pixi
	await expect(
		page.locator("#zoomview-container canvas").first(),
	).toBeVisible();
	await expect(
		page.locator("#overview-container canvas").first(),
	).toBeVisible();

	// All control fieldsets exist
	const fieldsetLegends = await page
		.locator("fieldset legend")
		.allTextContents();
	for (const legend of [
		"Playback",
		"Loops",
		"Zoom",
		"Display",
		"Colors",
		"Amplitude",
		"Channels",
		"Size",
		"Segments",
		"Points",
	]) {
		expect(fieldsetLegends).toContain(legend);
	}

	// Seeded segments are listed and the loop button works
	const loopBtn = page.locator(
		'button[data-action="loop-segment"][data-id="segment-1"]',
	);
	await expect(loopBtn).toBeVisible();
	await loopBtn.click();
	await expect(page.locator("#loop-status")).toContainText("Loop A");
	await page.locator('button[data-action="stop-loop"]').click();
	await expect(page.locator("#loop-status")).toHaveText("(none)");

	// Add a segment at the playhead and verify a new row appears
	const initialRowCount = await page
		.locator("#segments-table tbody tr")
		.count();
	await page.locator('button[data-action="add-segment"]').click();
	await expect(page.locator("#segments-table tbody tr")).toHaveCount(
		initialRowCount + 1,
	);

	// Add a point at the playhead and verify the points table grows
	const initialPointRows = await page.locator("#points-table tbody tr").count();
	await page.locator('button[data-action="add-point"]').click();
	await expect(page.locator("#points-table tbody tr")).toHaveCount(
		initialPointRows + 1,
	);

	// Toggle scrollbar visibility
	await page.locator("#show-scrollbar").click();
	await expect(page.locator("#scrollbar-container")).toHaveClass(
		/(^|\s)hide($|\s)/,
	);
	await page.locator("#show-scrollbar").click();

	// Toggle overview
	await page.locator("#show-overview").click();
	await expect(page.locator("#overview-container")).toHaveClass(
		/(^|\s)hide($|\s)/,
	);
	await page.locator("#show-overview").click();
	await expect(
		page.locator("#overview-container canvas").first(),
	).toBeVisible();

	// Auto-scroll toggle (no assertion on visual side-effect, just shouldn't throw)
	await page.locator("#auto-scroll").click();
	await page.locator("#auto-scroll").click();

	// Drag-mode and segment-drag-mode selects
	await page.selectOption("#waveform-drag-mode", "insert-segment");
	await page.selectOption("#waveform-drag-mode", "scroll");
	await page.selectOption("#segment-drag-mode", "no-overlap");

	// Color pickers — use fill() since color inputs accept value programmatically
	await page.locator("#waveform-color").evaluate((el: HTMLInputElement) => {
		el.value = "#112233";
		el.dispatchEvent(new Event("input", { bubbles: true }));
	});

	// Amplitude scale slider
	await page.locator("#amplitude-scale").evaluate((el: HTMLInputElement) => {
		el.value = "2";
		el.dispatchEvent(new Event("input", { bubbles: true }));
	});
	await expect(page.locator("#amplitude-scale-value")).toHaveText("2.0");

	// Width / height resize
	await page.locator("#width").evaluate((el: HTMLInputElement) => {
		el.value = "800";
		el.dispatchEvent(new Event("input", { bubbles: true }));
	});
	await expect(page.locator("#width-value")).toHaveText("800");

	// Channel switch (mono → stereo) — should not throw
	await page.selectOption("#channel-mode", "stereo");
	// Wait briefly for setSource to resolve
	await page.waitForTimeout(500);

	expect(pageErrors, `pageerrors: ${pageErrors.join(" | ")}`).toEqual([]);
	// Filter out benign Web-Audio warnings if any.
	const fatal = consoleErrors.filter(
		(line) =>
			!line.includes("AudioContext was not allowed") &&
			!line.toLowerCase().includes("autoplay"),
	);
	expect(fatal, `console errors: ${fatal.join(" | ")}`).toEqual([]);
});
