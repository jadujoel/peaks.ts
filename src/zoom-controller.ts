import { err, ok, type Result } from "neverthrow";
import type { PeaksInstance } from "./types";
import { clamp } from "./utils";

export interface ZoomControllerFromOptions {
	readonly peaks: PeaksInstance;
	readonly levels: readonly number[];
}

export class ZoomController {
	private constructor(
		private readonly peaks: PeaksInstance,
		private levels: readonly number[],
		private index: number = 0,
	) {}

	static from(options: ZoomControllerFromOptions): ZoomController {
		return new ZoomController(options.peaks, options.levels);
	}

	static ErrorMessages = {
		INVALID_ZOOM_LEVEL_INDEX: "ZoomController: Invalid zoom level index",
		ZOOMVIEW_NOT_FOUND: "ZoomController: Zoomview not found",
	} as const;

	setZoomLevels(levels: readonly number[]): Result<undefined, Error> {
		this.levels = levels;
		return this.setZoom(0, true);
	}

	zoomIn(): Result<undefined, Error> {
		return this.setZoom(this.index - 1);
	}

	zoomOut(): Result<undefined, Error> {
		return this.setZoom(this.index + 1);
	}

	setZoom(
		index: number = this.index,
		forceUpdate: boolean = false,
	): Result<undefined, Error> {
		const clamped = clamp(index, 0, this.levels.length - 1);
		if (clamped === this.index && !forceUpdate) {
			return ok(undefined);
		}
		this.index = clamped;

		const zoomview = this.peaks.views.getView("zoomview");
		if (!zoomview?.setZoom) {
			return err(new Error(ZoomController.ErrorMessages.ZOOMVIEW_NOT_FOUND));
		}

		const scale = this.levels[clamped];
		if (scale === undefined) {
			throw new Error(ZoomController.ErrorMessages.INVALID_ZOOM_LEVEL_INDEX);
		}
		zoomview.setZoom({ scale });
		return ok(undefined);
	}

	getZoom(): number {
		return this.index;
	}

	getZoomLevel(): number {
		return this.levels[this.index] ?? 0;
	}
}
