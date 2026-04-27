import type { CanvasDriver } from "./driver/types";
import { Scrollbar } from "./scrollbar";
import type { PeaksInstance } from "./types";
import type { WaveformColor } from "./utils";
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

	/**
	 * Typed accessor for the zoomable waveform view. Prefer this over
	 * {@link ViewController.getView} when you need the concrete
	 * `WaveformZoomView` surface (autoscroll, drag modes, color setters).
	 */
	getZoomview(): WaveformZoomView | undefined {
		return this.zoomview;
	}

	/**
	 * Typed accessor for the overview waveform view.
	 */
	getOverview(): WaveformOverview | undefined {
		return this.overview;
	}

	getScrollbar(): Scrollbar | undefined {
		return this.scrollbar;
	}

	// ─── Fan-out helpers ──────────────────────────────────────────────
	//
	// Apply a setting to whichever views currently exist (zoomview and/or
	// overview). All helpers no-op silently if neither view is present, so
	// consumers can wire UI controls without first checking which views
	// have been created.

	setWaveformColor = (color: WaveformColor): void => {
		this.zoomview?.setWaveformColor(color);
		this.overview?.setWaveformColor(color);
	};

	setPlayedWaveformColor = (color: WaveformColor | undefined): void => {
		this.zoomview?.setPlayedWaveformColor(color);
		this.overview?.setPlayedWaveformColor(color);
	};

	setPlayheadColor = (color: string): void => {
		this.zoomview?.setPlayheadColor(color);
		this.overview?.setPlayheadColor(color);
	};

	setPlayheadTextColor = (color: string): void => {
		this.zoomview?.setPlayheadTextColor(color);
		this.overview?.setPlayheadTextColor(color);
	};

	setAxisLabelColor = (color: string): void => {
		this.zoomview?.setAxisLabelColor(color);
		this.overview?.setAxisLabelColor(color);
	};

	setAxisGridlineColor = (color: string): void => {
		this.zoomview?.setAxisGridlineColor(color);
		this.overview?.setAxisGridlineColor(color);
	};

	setSegmentStartMarkerColor = (color: string): void => {
		this.zoomview?.setSegmentStartMarkerColor(color);
		this.overview?.setSegmentStartMarkerColor(color);
	};

	setSegmentEndMarkerColor = (color: string): void => {
		this.zoomview?.setSegmentEndMarkerColor(color);
		this.overview?.setSegmentEndMarkerColor(color);
	};

	/**
	 * Applies an amplitude scale to both views. Throws via the underlying
	 * view if `scale` is invalid.
	 *
	 * @throws {Error} If scale is not a positive finite number.
	 */
	setAmplitudeScale = (scale: number): undefined | never => {
		this.zoomview?.setAmplitudeScale(scale);
		this.overview?.setAmplitudeScale(scale);
	};

	/**
	 * Overview-only setting; no-op if the overview is not currently
	 * created.
	 */
	setHighlightColor = (color: string): void => {
		this.overview?.setHighlightColor(color);
	};

	fitToContainer = (): void => {
		this.zoomview?.fitToContainer();
		this.overview?.fitToContainer();
	};
}
