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
