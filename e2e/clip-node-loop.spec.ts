import { expect, test } from "@playwright/test";

test("clip-node loop demo loads and can loop a segment", async ({ page }) => {
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

	await page.goto("/clip-node-loop.html");

	// Waveform canvases render.
	await expect(
		page.locator("#zoomview-container .konvajs-content canvas").first(),
	).toBeVisible();
	await expect(
		page.locator("#overview-container .konvajs-content canvas").first(),
	).toBeVisible();

	// Seeded segments are rendered in the table.
	await expect(page.locator("#segments")).toBeVisible();
	await expect(
		page.locator('button[data-action="loop-segment"][data-id="segment-1"]'),
	).toBeVisible();

	// Loop status starts as "(none)".
	await expect(page.locator("#loop-status")).toHaveText("(none)");

	// Click the first segment's "Loop" button, then verify the loop status updates.
	await page
		.locator('button[data-action="loop-segment"][data-id="segment-1"]')
		.click();

	// If the page failed to initialize, surface the error before the assertion.
	const initErrorVisible = await page.locator("#init-error").isVisible();
	if (initErrorVisible) {
		const initErrorText = await page.locator("#init-error").textContent();
		throw new Error(
			`Demo failed to initialize: ${initErrorText}\n` +
				`Page errors: ${pageErrors.join(" | ")}\n` +
				`Console errors: ${consoleErrors.join(" | ")}`,
		);
	}

	await expect(page.locator("#loop-status")).toContainText("Loop A");

	// Stop the loop and verify the status resets.
	await page.locator('button[data-action="stop-loop"]').click();
	await expect(page.locator("#loop-status")).toHaveText("(none)");

	expect(pageErrors).toEqual([]);
	expect(consoleErrors).toEqual([]);
});
