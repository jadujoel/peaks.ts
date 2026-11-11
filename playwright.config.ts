import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
		{
			name: "firefox",
			use: {
				...devices["Desktop Firefox"],
				launchOptions: {
					// Allow Web Audio to start without a real user gesture, so
					// AudioContext.resume() does not stay pending in headless runs.
					firefoxUserPrefs: {
						"media.autoplay.block-webaudio": false,
						"media.autoplay.default": 0,
					},
				},
			},
		},
		{
			name: "webkit",
			use: { ...devices["Desktop Safari"] },
		},
	],
	reporter: [["html", { open: "never" }]],
	testDir: "./e2e",
	use: {
		baseURL: "http://127.0.0.1:8090",
		trace: "retain-on-failure",
	},
	webServer: [
		{
			command: "bun --filter @peaks/main-example dev",
			env: { PORT: "8090" },
			reuseExistingServer: !process.env.CI,
			url: "http://127.0.0.1:8090",
		},
	],
});
