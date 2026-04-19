import type { PeaksInstance } from "./types";

export interface ZoomControllerFromOptions {
	readonly peaks: PeaksInstance;
	readonly zoomLevels: number[];
}

export class ZoomController {
	private _peaks: PeaksInstance;
	private _zoomLevels: number[];
	private _zoomLevelIndex: number;

	static from(options: ZoomControllerFromOptions): ZoomController {
		return new ZoomController(options.peaks, options.zoomLevels);
	}

	private constructor(peaks: PeaksInstance, zoomLevels: number[]) {
		this._peaks = peaks;
		this._zoomLevels = zoomLevels;
		this._zoomLevelIndex = 0;
	}

	setZoomLevels(zoomLevels: number[]): void {
		this._zoomLevels = zoomLevels;
		this.setZoom(0, true);
	}

	zoomIn(): void {
		this.setZoom(this._zoomLevelIndex - 1, false);
	}

	zoomOut(): void {
		this.setZoom(this._zoomLevelIndex + 1, false);
	}

	setZoom(zoomLevelIndex: number, forceUpdate: boolean): void {
		if (zoomLevelIndex >= this._zoomLevels.length) {
			zoomLevelIndex = this._zoomLevels.length - 1;
		}

		if (zoomLevelIndex < 0) {
			zoomLevelIndex = 0;
		}

		if (!forceUpdate && zoomLevelIndex === this._zoomLevelIndex) {
			return;
		}

		this._zoomLevelIndex = zoomLevelIndex;

		const zoomview = this._peaks.views.getView("zoomview");

		if (!zoomview) {
			return;
		}

		const scale = this._zoomLevels[zoomLevelIndex];

		if (scale !== undefined) {
			zoomview.setZoom?.({ scale });
		}
	}

	getZoom(): number {
		return this._zoomLevelIndex;
	}

	getZoomLevel(): number {
		return this._zoomLevels[this._zoomLevelIndex] ?? 0;
	}
}
