import { Scrollbar } from "./scrollbar";
import type { PeaksInstance } from "./types";
import { isNullOrUndefined } from "./utils";
import { WaveformOverview } from "./waveform-overview";
import { WaveformZoomView } from "./waveform-zoomview";

export interface ViewControllerFromOptions {
	readonly peaks: PeaksInstance;
}

export class ViewController {
	public readonly peaks: PeaksInstance;
	private _overview?: WaveformOverview | undefined;
	private _zoomview?: WaveformZoomView | undefined;
	private _scrollbar?: Scrollbar | undefined;

	static from(options: ViewControllerFromOptions): ViewController {
		return new ViewController(options.peaks);
	}

	private constructor(peaks: PeaksInstance) {
		this.peaks = peaks;
	}

	/**
	 * Creates the overview waveform view.
	 *
	 * @throws {Error} If waveform data has not been initialized yet.
	 */
	createOverview(container: HTMLDivElement): WaveformOverview | never {
		if (this._overview) {
			return this._overview;
		}

		const waveformData = this.peaks.getWaveformData();

		if (!waveformData) {
			throw new Error("No waveform data available");
		}

		this._overview = WaveformOverview.from({
			waveformData,
			container,
			peaks: this.peaks,
		});

		if (this._zoomview) {
			this._overview.showHighlight(
				this._zoomview.getStartTime(),
				this._zoomview.getEndTime(),
			);
		}

		return this._overview;
	}

	/**
	 * Creates the zoomable waveform view.
	 *
	 * @throws {Error} If waveform data has not been initialized yet.
	 */
	createZoomview(container: HTMLDivElement): WaveformZoomView | never {
		if (this._zoomview) {
			return this._zoomview;
		}

		const waveformData = this.peaks.getWaveformData();

		if (!waveformData) {
			throw new Error("No waveform data available");
		}

		this._zoomview = WaveformZoomView.from({
			waveformData,
			container,
			peaks: this.peaks,
		});

		if (this._scrollbar) {
			this._scrollbar.setZoomview(this._zoomview);
		}

		return this._zoomview;
	}

	/**
	 * Creates the scrollbar view.
	 *
	 * @throws {Error} If scrollbar options are missing from the Peaks configuration.
	 */
	createScrollbar(container: HTMLDivElement): Scrollbar | never {
		this._scrollbar = Scrollbar.from({ container, peaks: this.peaks });

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
		this._overview = undefined;
	}

	destroyZoomview(): void {
		if (!this._zoomview) {
			return;
		}

		if (!this._overview) {
			return;
		}

		this._zoomview.destroy();
		this._zoomview = undefined;

		this._overview.removeHighlightRect();
	}

	destroy(): void {
		if (this._overview) {
			this._overview.destroy();
			this._overview = undefined;
		}

		if (this._zoomview) {
			this._zoomview.destroy();
			this._zoomview = undefined;
		}

		if (this._scrollbar) {
			this._scrollbar.destroy();
			this._scrollbar = undefined;
		}
	}

	getView(name?: string): WaveformOverview | WaveformZoomView | undefined {
		if (isNullOrUndefined(name)) {
			if (this._overview && this._zoomview) {
				return undefined;
			} else if (this._overview) {
				return this._overview;
			} else if (this._zoomview) {
				return this._zoomview;
			} else {
				return undefined;
			}
		} else {
			switch (name) {
				case "overview":
					return this._overview;

				case "zoomview":
					return this._zoomview;

				default:
					return undefined;
			}
		}
	}

	getScrollbar(): Scrollbar | undefined {
		return this._scrollbar;
	}
}
