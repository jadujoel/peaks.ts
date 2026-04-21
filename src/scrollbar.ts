import Konva from "konva/lib/Core";
import type { Group } from "konva/lib/Group";
import type { Layer } from "konva/lib/Layer";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Stage } from "konva/lib/Stage";
import { Rect } from "konva/lib/shapes/Rect";
import type { PeaksInstance, ScrollbarDisplayOptions, XY } from "./types";
import { clamp } from "./utils";
import type { WaveformZoomView } from "./waveform/zoomview";

export interface ScrollbarFromOptions {
	readonly container: HTMLDivElement;
	readonly peaks: PeaksInstance;
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
		private readonly container: Pick<
			HTMLElement,
			"clientWidth" | "clientHeight"
		>,
		private readonly peaks: PeaksInstance,
		private readonly stage: Stage,
		private readonly layer: Layer,
		private readonly scrollbox: Group,
		private readonly scrollboxRect: Rect,
		private readonly color: string,
		private readonly minScrollboxWidth: number,
		private readonly offsetY: number,
		private width: number,
		private height: number,
		private scrollboxX: number = 0,
		private scrollboxWidth: number = 0,
		private zoomview: WaveformZoomView | undefined = undefined,
		private dragging: boolean = false,
	) {}

	static from(options: ScrollbarFromOptions): Scrollbar {
		const scrollbarOptions = options.peaks.options.scrollbar;
		const width = options.container.clientWidth;
		const height = options.container.clientHeight;

		const stage = new Konva.Stage({
			container: options.container,
			height,
			width,
		});

		const layer = new Konva.Layer();
		stage.add(layer);

		const scrollbox = new Konva.Group({
			dragBoundFunc: scrollboxDragBoundFunc,
			draggable: true,
		});

		const scrollboxRect = new Rect({
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
			0,
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
		options.peaks.on("zoomview.update", instance.onZoomviewUpdate);

		instance.updateScrollbarWidthAndPosition();

		return instance;
	}

	setZoomview(zoomview: WaveformZoomView | undefined): void {
		this.zoomview = zoomview;

		this.updateScrollbarWidthAndPosition();
	}

	fitToContainer(): void {
		if (this.container.clientWidth === 0 && this.container.clientHeight === 0) {
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
		this.peaks.off("zoomview.update", this.onZoomviewUpdate);
		this.layer.destroy();
		this.stage.destroy();
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

	private onScrollbarClick = (event: KonvaEventObject<MouseEvent>): void => {
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
