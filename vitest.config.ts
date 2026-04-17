import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const rootDir = fileURLToPath(new URL(".", import.meta.url));
const testDataDir = resolve(rootDir, "test/data");
const requestPrefix = "/base/test/data/";

const contentTypes = {
	".dat": "application/octet-stream",
	".json": "application/json",
	".mp3": "audio/mpeg",
	".ogg": "audio/ogg",
	".wav": "audio/wav",
};

function serveTestData() {
	return {
		name: "serve-test-data",
		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				const requestUrl = req.url ?? "";

				if (!requestUrl.startsWith(requestPrefix)) {
					next();
					return;
				}

				const relativePath = decodeURIComponent(
					requestUrl.slice(requestPrefix.length).split("?")[0],
				);
				const filePath = resolve(testDataDir, relativePath);

				if (!filePath.startsWith(testDataDir) || !existsSync(filePath)) {
					res.statusCode = 404;
					res.end();
					return;
				}

				const fileStat = statSync(filePath);

				if (!fileStat.isFile()) {
					res.statusCode = 404;
					res.end();
					return;
				}

				const rangeHeader = req.headers.range;
				const contentType =
					contentTypes[extname(filePath)] ?? "application/octet-stream";

				res.setHeader("Accept-Ranges", "bytes");
				res.setHeader("Content-Type", contentType);

				if (typeof rangeHeader === "string") {
					const match = rangeHeader.match(/^bytes=(\d+)-(\d*)$/);

					if (!match) {
						res.statusCode = 416;
						res.setHeader("Content-Range", `bytes */${fileStat.size}`);
						res.end();
						return;
					}

					const start = Number.parseInt(match[1], 10);
					const end = match[2]
						? Number.parseInt(match[2], 10)
						: fileStat.size - 1;

					if (start >= fileStat.size || end < start) {
						res.statusCode = 416;
						res.setHeader("Content-Range", `bytes */${fileStat.size}`);
						res.end();
						return;
					}

					res.statusCode = 206;
					res.setHeader("Content-Length", end - start + 1);
					res.setHeader(
						"Content-Range",
						`bytes ${start}-${end}/${fileStat.size}`,
					);
					createReadStream(filePath, { start, end }).pipe(res);
					return;
				}

				res.statusCode = 200;
				res.setHeader("Content-Length", fileStat.size);
				createReadStream(filePath).pipe(res);
			});
		},
	};
}

export default defineConfig({
	plugins: [serveTestData()],
	test: {
		globals: true,
		include: ["test/**/*-spec.js"],
		setupFiles: ["./test/vitest.setup.js"],
		fileParallelism: false,
		browser: {
			enabled: true,
			headless: true,
			testerHtmlPath: "./test/browser.tester.html",
			provider: playwright({
				launchOptions: {
					channel: "chromium",
					args: ["--autoplay-policy=no-user-gesture-required"],
				},
			}),
			instances: [{ browser: "chromium" }],
		},
		coverage: {
			provider: "v8",
			include: ["src/**/*.ts"],
			reporter: ["html", "text", "text-summary"],
		},
	},
});
