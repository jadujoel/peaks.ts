// Lightweight loader for the Pixi canvas driver.
//
// The real implementation in `./driver` has a static `import "pixi.js"` at
// module top, so importing it eagerly would force every bundle that
// re-exports it (such as the demo bundle that ships across all demo pages)
// to also resolve `pixi.js` — even on pages that don't use Pixi at all.
//
// This loader keeps the public `PixiCanvasDriver.create()` API unchanged
// while deferring the real Pixi import to first use via dynamic import.

import type { CanvasDriver } from "../types";

export class PixiCanvasDriver {
	static async create(): Promise<CanvasDriver> {
		const { PixiCanvasDriver: Impl } = await import("./driver");
		return Impl.create();
	}
}
