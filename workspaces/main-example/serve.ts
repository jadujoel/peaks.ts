import { resolve } from "node:path";
import { build } from "./build";

const root = import.meta.dir;
const port = Number(process.env.PORT ?? 8090);

const ok = await build({ clean: true });
if (!ok) {
	process.exit(1);
}

const indexHtml = resolve(root, "index.html");
const styleCss = resolve(root, "style.css");
const distDir = resolve(root, "dist");
const publicDir = resolve(root, "public");

function contentType(path: string): string {
	if (path.endsWith(".html")) return "text/html; charset=utf-8";
	if (path.endsWith(".css")) return "text/css; charset=utf-8";
	if (path.endsWith(".js") || path.endsWith(".mjs"))
		return "text/javascript; charset=utf-8";
	if (path.endsWith(".json")) return "application/json; charset=utf-8";
	if (path.endsWith(".map")) return "application/json; charset=utf-8";
	if (path.endsWith(".mp3")) return "audio/mpeg";
	if (path.endsWith(".ogg")) return "audio/ogg";
	return "application/octet-stream";
}

async function serveFile(path: string): Promise<Response> {
	const file = Bun.file(path);
	const exists = await file.exists();
	if (!exists) {
		return new Response("Not found", { status: 404 });
	}
	return new Response(file, {
		headers: { "content-type": contentType(path) },
	});
}

const server = Bun.serve({
	async fetch(request) {
		const url = new URL(request.url);
		const pathname = url.pathname === "/" ? "/index.html" : url.pathname;

		if (pathname === "/index.html") return serveFile(indexHtml);
		if (pathname === "/style.css") return serveFile(styleCss);
		if (pathname.startsWith("/dist/")) {
			return serveFile(resolve(distDir, pathname.slice("/dist/".length)));
		}
		if (pathname === "/pixi.min.mjs") {
			return serveFile(resolve(publicDir, "pixi.min.mjs"));
		}
		// Anything else falls through to /public
		return serveFile(resolve(publicDir, pathname.replace(/^\//, "")));
	},
	port,
});

console.log(`Main example listening on http://127.0.0.1:${server.port}`);
