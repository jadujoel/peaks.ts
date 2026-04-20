import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
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
	reporter: [["html", { open: "never" }]],
	testDir: "./e2e",
	use: {
		baseURL: "http://127.0.0.1:8080",
		trace: "retain-on-failure",
	},
	webServer: {
		command: "bun run start",
		reuseExistingServer: !process.env.CI,
		url: "http://127.0.0.1:8080",
	},
});
