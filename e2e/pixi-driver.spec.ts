import { expect, test } from "@playwright/test";

test("pixi-driver demo loads and renders without errors", async ({ page }) => {
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

	await page.goto("/pixi-driver.html");

	// The Pixi driver appends a raw <canvas> directly into the container
	// (no `.konvajs-content` wrapper).
	const canvas = page.locator("#zoomview-container canvas").first();
	await expect(canvas).toBeVisible({ timeout: 15_000 });

	// Wait for Peaks to be ready (set on window by the demo script).
	await page.waitForFunction(
		() =>
			(window as unknown as { peaksInstance?: unknown }).peaksInstance !==
			undefined,
		undefined,
		{ timeout: 15_000 },
	);

	expect(pageErrors).toEqual([]);
	expect(consoleErrors).toEqual([]);
});
