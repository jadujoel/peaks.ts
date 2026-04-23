import type { CanvasDriver } from "./driver/types";
import { Scrollbar } from "./scrollbar";
import type { PeaksInstance } from "./types";
import { WaveformOverview } from "./waveform/overview";
import { WaveformZoomView } from "./waveform/zoomview";

export interface ViewControllerFromOptions {
	readonly peaks: PeaksInstance;
	readonly driver: CanvasDriver;
}

export class ViewController {
	private constructor(
		private readonly peaks: PeaksInstance,
		private readonly driver: CanvasDriver,
		private overview: WaveformOverview | undefined,
		private zoomview: WaveformZoomView | undefined,
		private scrollbar: Scrollbar | undefined,
	) {}

	static from(options: ViewControllerFromOptions): ViewController {
		return new ViewController(
			options.peaks,
			options.driver,
			undefined,
			undefined,
			undefined,
		);
	}

	/**
	 * Creates the overview waveform view.
	 *
	 * @throws {Error} If waveform data has not been initialized yet.
	 */
	async createOverview(container: HTMLDivElement): Promise<WaveformOverview> {
		if (this.overview) {
			return this.overview;
		}

		const waveformData = this.peaks.getWaveformData();

		if (!waveformData) {
			throw new Error("No waveform data available");
		}

		this.overview = await WaveformOverview.from({
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
	async createZoomview(container: HTMLDivElement): Promise<WaveformZoomView> {
		if (this.zoomview) {
			return this.zoomview;
		}

		const waveformData = this.peaks.getWaveformData();

		if (!waveformData) {
			throw new Error("No waveform data available");
		}

		this.zoomview = await WaveformZoomView.from({
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
	 */
	async createScrollbar(container: HTMLDivElement): Promise<Scrollbar> {
		this.scrollbar = await Scrollbar.from({
			container,
			driver: this.driver,
			peaks: this.peaks,
		});

		return this.scrollbar;
	}

	destroyOverview(): void {
		if (!this.overview) {
			return;
		}

		if (!this.zoomview) {
			return;
		}

		this.overview.dispose();
		this.overview = undefined;
	}

	destroyZoomview(): void {
		if (!this.zoomview) {
			return;
		}

		if (!this.overview) {
			return;
		}

		this.zoomview.dispose();
		this.zoomview = undefined;

		this.overview.removeHighlightRect();
	}

	dispose(): void {
		if (this.overview) {
			this.overview.dispose();
			this.overview = undefined;
		}

		if (this.zoomview) {
			this.zoomview.dispose();
			this.zoomview = undefined;
		}

		if (this.scrollbar) {
			this.scrollbar.dispose();
			this.scrollbar = undefined;
		}
	}

	getView(
		name?: "overview" | "zoomview" | (string & {}),
	): WaveformOverview | WaveformZoomView | undefined {
		switch (name) {
			case "overview":
				return this.overview;
			case "zoomview":
				return this.zoomview;
			case undefined: {
				if (this.overview !== undefined && this.zoomview !== undefined) {
					return undefined;
				}
				return this.overview ?? this.zoomview;
			}
			default:
				return undefined;
		}
	}

	getScrollbar(): Scrollbar | undefined {
		return this.scrollbar;
	}
}
