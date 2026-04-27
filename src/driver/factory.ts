import type { CanvasDriver } from "./types";

export type CanvasDriverKind = "konva" | "pixi";

export interface CreateCanvasDriverOptions {
	readonly kind: CanvasDriverKind;
}

/**
 * Returns a {@link CanvasDriver} for the requested backend. Always
 * resolves to a Promise so callers don't have to write the
 * `Konva | Pixi` union type or handle the sync/async signature
 * mismatch between the underlying drivers.
 *
 * The Pixi backend is loaded via dynamic import (mirroring
 * {@link PixiCanvasDriver.create}), so consumers that only ever ask for
 * `"konva"` won't pull `pixi.js` into their bundle.
 *
 * @throws {Error} If `kind` is not a supported backend.
 */
export async function createCanvasDriver(
	options: CreateCanvasDriverOptions,
): Promise<CanvasDriver> {
	switch (options.kind) {
		case "konva": {
			const { KonvaCanvasDriver } = await import("./konva/driver");
			return KonvaCanvasDriver.default();
		}
		case "pixi": {
			const { PixiCanvasDriver } = await import("./pixi/loader");
			return PixiCanvasDriver.create();
		}
		default: {
			const exhaustive: never = options.kind;
			throw new Error(
				`createCanvasDriver: unknown kind '${String(exhaustive)}'`,
			);
		}
	}
}
