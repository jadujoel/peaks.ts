import Scrollbar from "./scrollbar";
import { isNullOrUndefined } from "./utils";
import WaveformOverview from "./waveform-overview";
import WaveformZoomView from "./waveform-zoomview";

class ViewController {
	private _peaks: any;
	private _overview: WaveformOverview | null;
	private _zoomview: WaveformZoomView | null;
	private _scrollbar: Scrollbar | null;

	constructor(peaks: any) {
		this._peaks = peaks;
		this._overview = null;
		this._zoomview = null;
		this._scrollbar = null;
	}

	createOverview(container: HTMLElement): WaveformOverview {
		if (this._overview) {
			return this._overview;
		}

		const waveformData = this._peaks.getWaveformData();

		this._overview = new WaveformOverview(waveformData, container, this._peaks);

		if (this._zoomview) {
			this._overview.showHighlight(
				this._zoomview.getStartTime(),
				this._zoomview.getEndTime(),
			);
		}

		return this._overview;
	}

	createZoomview(container: HTMLElement): WaveformZoomView {
		if (this._zoomview) {
			return this._zoomview;
		}

		const waveformData = this._peaks.getWaveformData();

		this._zoomview = new WaveformZoomView(waveformData, container, this._peaks);

		if (this._scrollbar) {
			this._scrollbar.setZoomview(this._zoomview);
		}

		return this._zoomview;
	}

	createScrollbar(container: HTMLElement): Scrollbar {
		this._scrollbar = new Scrollbar(container, this._peaks);

		return this._scrollbar;
	}

	destroyOverview(): void {
		if (!this._overview) {
			return;
		}

		if (!this._zoomview) {
			return;
		}

		this._overview.destroy();
		this._overview = null;
	}

	destroyZoomview(): void {
		if (!this._zoomview) {
			return;
		}

		if (!this._overview) {
			return;
		}

		this._zoomview.destroy();
		this._zoomview = null;

		this._overview.removeHighlightRect();
	}

	destroy(): void {
		if (this._overview) {
			this._overview.destroy();
			this._overview = null;
		}

		if (this._zoomview) {
			this._zoomview.destroy();
			this._zoomview = null;
		}

		if (this._scrollbar) {
			this._scrollbar.destroy();
			this._scrollbar = null;
		}
	}

	getView(name?: string): WaveformOverview | WaveformZoomView | null {
		if (isNullOrUndefined(name)) {
			if (this._overview && this._zoomview) {
				return null;
			} else if (this._overview) {
				return this._overview;
			} else if (this._zoomview) {
				return this._zoomview;
			} else {
				return null;
			}
		} else {
			switch (name) {
				case "overview":
					return this._overview;

				case "zoomview":
					return this._zoomview;

				default:
					return null;
			}
		}
	}

	getScrollbar(): Scrollbar | null {
		return this._scrollbar;
	}
}

export default ViewController;
