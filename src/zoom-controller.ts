import type { PeaksInstance } from "./types";

export interface ZoomControllerFromOptions {
	readonly peaks: PeaksInstance;
	readonly zoomLevels: number[];
}

export class ZoomController {
	private readonly peaks: PeaksInstance;
	private zoomLevels: number[];
	private zoomLevelIndex: number;

	static from(options: ZoomControllerFromOptions): ZoomController {
		return new ZoomController(options.peaks, options.zoomLevels);
	}

	private constructor(peaks: PeaksInstance, zoomLevels: number[]) {
		this.peaks = peaks;
		this.zoomLevels = zoomLevels;
		this.zoomLevelIndex = 0;
	}

	setZoomLevels(zoomLevels: number[]): void {
		this.zoomLevels = zoomLevels;
		this.setZoom(0, true);
	}

	zoomIn(): void {
		this.setZoom(this.zoomLevelIndex - 1, false);
	}

	zoomOut(): void {
		this.setZoom(this.zoomLevelIndex + 1, false);
	}

	setZoom(zoomLevelIndex: number, forceUpdate: boolean): void {
		if (zoomLevelIndex >= this.zoomLevels.length) {
			zoomLevelIndex = this.zoomLevels.length - 1;
		}

		if (zoomLevelIndex < 0) {
			zoomLevelIndex = 0;
		}

		if (!forceUpdate && zoomLevelIndex === this.zoomLevelIndex) {
			return;
		}

		this.zoomLevelIndex = zoomLevelIndex;

		const zoomview = this.peaks.views.getView("zoomview");

		if (!zoomview) {
			return;
		}

		const scale = this.zoomLevels[zoomLevelIndex];

		if (scale !== undefined) {
			zoomview.setZoom?.({ scale });
		}
	}

	getZoom(): number {
		return this.zoomLevelIndex;
	}

	getZoomLevel(): number {
		return this.zoomLevels[this.zoomLevelIndex] ?? 0;
	}
}
