import { Scrollbar } from "./scrollbar";
import type { PeaksInstance } from "./types";
import { isNullOrUndefined } from "./utils";
import { WaveformOverview } from "./waveform/overview";
import { WaveformZoomView } from "./waveform/zoomview";

export interface ViewControllerFromOptions {
	readonly peaks: PeaksInstance;
}

export class ViewController {
	private constructor(
		private readonly peaks: PeaksInstance,
		private overview: WaveformOverview | undefined,
		private zoomview: WaveformZoomView | undefined,
		private scrollbar: Scrollbar | undefined,
	) {}

	static from(options: ViewControllerFromOptions): ViewController {
		return new ViewController(options.peaks, undefined, undefined, undefined);
	}

	/**
	 * Creates the overview waveform view.
	 *
	 * @throws {Error} If waveform data has not been initialized yet.
	 */
	createOverview(container: HTMLDivElement): WaveformOverview | never {
		if (this.overview) {
			return this.overview;
		}

		const waveformData = this.peaks.getWaveformData();

		if (!waveformData) {
			throw new Error("No waveform data available");
		}

		this.overview = WaveformOverview.from({
			container,
			peaks: this.peaks,
			waveformData,
		});

		if (this.zoomview) {
			this.overview.showHighlight(
				this.zoomview.getStartTime(),
				this.zoomview.getEndTime(),
			);
		}

		return this.overview;
	}

	/**
	 * Creates the zoomable waveform view.
	 *
	 * @throws {Error} If waveform data has not been initialized yet.
	 */
	createZoomview(container: HTMLDivElement): WaveformZoomView | never {
		if (this.zoomview) {
			return this.zoomview;
		}

		const waveformData = this.peaks.getWaveformData();

		if (!waveformData) {
			throw new Error("No waveform data available");
		}

		this.zoomview = WaveformZoomView.from({
			container,
			peaks: this.peaks,
			waveformData,
		});

		if (this.scrollbar) {
			this.scrollbar.setZoomview(this.zoomview);
		}

		return this.zoomview;
	}

	/**
	 * Creates the scrollbar view.
	 *
	 * @throws {Error} If scrollbar options are missing from the Peaks configuration.
	 */
	createScrollbar(container: HTMLDivElement): Scrollbar | never {
		this.scrollbar = Scrollbar.from({ container, peaks: this.peaks });

		return this.scrollbar;
	}

	destroyOverview(): void {
		if (!this.overview) {
			return;
		}

		if (!this.zoomview) {
			return;
		}

		this.overview.destroy();
		this.overview = undefined;
	}

	destroyZoomview(): void {
		if (!this.zoomview) {
			return;
		}

		if (!this.overview) {
			return;
		}

		this.zoomview.destroy();
		this.zoomview = undefined;

		this.overview.removeHighlightRect();
	}

	destroy(): void {
		if (this.overview) {
			this.overview.destroy();
			this.overview = undefined;
		}

		if (this.zoomview) {
			this.zoomview.destroy();
			this.zoomview = undefined;
		}

		if (this.scrollbar) {
			this.scrollbar.dispose();
			this.scrollbar = undefined;
		}
	}

	getView(name?: string): WaveformOverview | WaveformZoomView | undefined {
		if (isNullOrUndefined(name)) {
			if (this.overview && this.zoomview) {
				return undefined;
			} else if (this.overview) {
				return this.overview;
			} else if (this.zoomview) {
				return this.zoomview;
			} else {
				return undefined;
			}
		} else {
			switch (name) {
				case "overview":
					return this.overview;

				case "zoomview":
					return this.zoomview;

				default:
					return undefined;
			}
		}
	}

	getScrollbar(): Scrollbar | undefined {
		return this.scrollbar;
	}
}
