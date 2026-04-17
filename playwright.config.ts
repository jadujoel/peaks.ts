import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./e2e",
	reporter: [["html", { open: "never" }]],
	use: {
		baseURL: "http://127.0.0.1:8080",
		trace: "retain-on-failure",
	},
	webServer: {
		command: "bun run preview",
		url: "http://127.0.0.1:8080",
		reuseExistingServer: !process.env.CI,
	},
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
		{
			name: "firefox",
			use: { ...devices["Desktop Firefox"] },
		},
		{
			name: "webkit",
			use: { ...devices["Desktop Safari"] },
		},
	],
});
