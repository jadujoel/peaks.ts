import type {
	CanvasDriver,
	DriverGroup,
	DriverLayer,
	DriverRect,
	DriverStage,
	PeaksPointerEvent,
} from "./driver/types";
import type { PeaksInstance, XY } from "./types";
import { clamp } from "./utils";
import type { WaveformZoomView } from "./waveform/zoomview";

export interface ScrollbarFromOptions {
	readonly container: HTMLDivElement;
	readonly peaks: PeaksInstance;
	readonly driver: CanvasDriver;
}

function scrollboxDragBoundFunc(pos: XY): XY {
	// Allow the scrollbar to be moved horizontally but not vertically.
	return {
		x: pos.x,
		y: 0,
	};
}

/**
 * Creates a scrollbar.
 *
 * @throws {Error} If scrollbar display options are missing from the Peaks configuration.
 */
export class Scrollbar {
	private constructor(
		private readonly container: HTMLDivElement,
		private readonly peaks: PeaksInstance,
		private readonly stage: DriverStage,
		private readonly layer: DriverLayer,
		private readonly scrollbox: DriverGroup,
		private readonly scrollboxRect: DriverRect,
		private readonly color: string,
		private readonly minScrollboxWidth: number,
		private width: number,
		private height: number,
		private scrollboxX: number = 0,
		private scrollboxWidth: number = 0,
		private zoomview: WaveformZoomView | undefined = undefined,
		private dragging: boolean = false,
		private resizeObserver: ResizeObserver | undefined = undefined,
	) {}

	static async from(options: ScrollbarFromOptions): Promise<Scrollbar> {
		const scrollbarOptions = options.peaks.options.scrollbar;
		const width = options.container.clientWidth;
		const height = options.container.clientHeight;
		const driver = options.driver;

		const stage = await driver.createStage({
			container: options.container,
			height,
			width,
		});

		const layer = driver.createLayer();
		stage.add(layer);

		const scrollbox = driver.createGroup({
			dragBoundFunc: scrollboxDragBoundFunc,
			draggable: true,
		});

		const scrollboxRect = driver.createRect({
			fill: scrollbarOptions.color,
			height,
			width: 0,
			x: 0,
			y: 0,
		});

		scrollbox.add(scrollboxRect);
		layer.add(scrollbox);

		const zoomview = options.peaks.views.getView("zoomview") as
			| WaveformZoomView
			| undefined;

		const instance = new Scrollbar(
			options.container,
			options.peaks,
			stage,
			layer,
			scrollbox,
			scrollboxRect,
			scrollbarOptions.color,
			scrollbarOptions.minWidth,
			width,
			height,
			0,
			0,
			zoomview,
		);

		stage.on("click", instance.onScrollbarClick);
		scrollbox.on("dragstart", instance.onScrollboxDragStart);
		scrollbox.on("dragmove", instance.onScrollboxDragMove);
		scrollbox.on("dragend", instance.onScrollboxDragEnd);
		options.peaks.events.addEventListener(
			"zoomview.update",
			instance.onZoomviewUpdate,
		);

		instance.updateScrollbarWidthAndPosition();
		instance.observeContainerResize();

		return instance;
	}

	setZoomview(zoomview: WaveformZoomView | undefined): void {
		this.zoomview = zoomview;

		this.updateScrollbarWidthAndPosition();
	}

	fitToContainer(): void {
		if (this.container.clientWidth === 0 || this.container.clientHeight === 0) {
			return;
		}

		if (this.container.clientWidth !== this.width) {
			this.width = this.container.clientWidth;
			this.stage.width(this.width);

			this.updateScrollbarWidthAndPosition();
		}

		this.height = this.container.clientHeight;
		this.stage.height(this.height);
	}

	dispose(): void {
		this.resizeObserver?.disconnect();
		this.resizeObserver = undefined;
		this.peaks.events.removeEventListener(
			"zoomview.update",
			this.onZoomviewUpdate,
		);
		this.layer.destroy();
		this.stage.destroy();
	}

	private observeContainerResize(): void {
		if (typeof ResizeObserver === "undefined") {
			return;
		}

		this.resizeObserver = new ResizeObserver(() => {
			this.fitToContainer();
		});
		this.resizeObserver.observe(this.container);
	}

	/**
	 * Sets the width of the scrollbox, based on the visible waveform region
	 * in the zoomview and minimum scrollbox width option.
	 */
	private setScrollboxWidth(): void {
		if (this.zoomview) {
			this.scrollboxWidth = Math.floor(
				(this.width * this.zoomview.pixelsToTime(this.zoomview.getWidth())) /
					this.peaks.player.getDuration(),
			);

			if (this.scrollboxWidth < this.minScrollboxWidth) {
				this.scrollboxWidth = this.minScrollboxWidth;
			}
		} else {
			this.scrollboxWidth = this.width;
		}

		this.scrollboxRect.width(this.scrollboxWidth);
	}

	private getScrollbarRange(): number {
		return this.width - this.scrollboxWidth;
	}

	private onScrollboxDragStart = (): void => {
		this.dragging = true;
	};

	private onScrollboxDragEnd = (): void => {
		this.dragging = false;
	};

	private onScrollboxDragMove = (): void => {
		const range = this.getScrollbarRange();
		const x = clamp(this.scrollbox.x(), 0, range);

		this.scrollbox.x(x);

		if (x !== this.scrollboxX) {
			this.scrollboxX = x;

			if (this.zoomview) {
				this.updateWaveformPosition(x);
			}
		}
	};

	private onZoomviewUpdate = (): void => {
		if (!this.dragging) {
			this.updateScrollbarWidthAndPosition();
		}
	};

	private updateScrollbarWidthAndPosition(): void {
		this.setScrollboxWidth();

		if (this.zoomview) {
			const startTime = this.zoomview.getStartTime();

			const zoomviewRange =
				this.zoomview.getPixelLength() - this.zoomview.getWidth();

			const scrollBoxPos = Math.floor(
				(this.zoomview.timeToPixels(startTime) * this.getScrollbarRange()) /
					zoomviewRange,
			);

			this.scrollbox.x(scrollBoxPos);
			this.layer.draw();
		}
	}

	private onScrollbarClick = (event: PeaksPointerEvent<MouseEvent>): void => {
		// Handle clicks on the scrollbar outside the scrollbox.
		if (event.target === this.stage) {
			if (this.zoomview) {
				// Centre the scrollbox where the user clicked.
				let x = Math.floor(event.evt.offsetX - this.scrollboxWidth / 2);

				if (x < 0) {
					x = 0;
				}

				this.updateWaveformPosition(x);
			}
		}
	};

	/**
	 * Sets the zoomview waveform position based on scrollbar position.
	 */
	private updateWaveformPosition(x: number): void {
		if (!this.zoomview) {
			return;
		}

		const offset = Math.floor(
			((this.zoomview.getPixelLength() - this.zoomview.getWidth()) * x) /
				this.getScrollbarRange(),
		);

		this.zoomview.updateWaveform(offset);
	}
}
