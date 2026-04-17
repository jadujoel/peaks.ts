// biome-ignore lint/suspicious/noExplicitAny: peaks instance
export default class ZoomController {
	private _peaks: any;
	private _zoomLevels: number[];
	private _zoomLevelIndex: number;

	constructor(peaks: any, zoomLevels: number[]) {
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

		zoomview.setZoom({ scale: this._zoomLevels[zoomLevelIndex] });
	}

	getZoom(): number {
		return this._zoomLevelIndex;
	}

	getZoomLevel(): number {
		return this._zoomLevels[this._zoomLevelIndex]!;
	}
}
