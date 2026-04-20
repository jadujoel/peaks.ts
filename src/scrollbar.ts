import Konva from "konva/lib/Core";
import type { Group } from "konva/lib/Group";
import type { Layer } from "konva/lib/Layer";
import type { KonvaEventObject } from "konva/lib/Node";
import type { Stage } from "konva/lib/Stage";
import { Rect } from "konva/lib/shapes/Rect";
import type { PeaksInstance, ScrollbarDisplayOptions } from "./types";
import { clamp } from "./utils";
import type WaveformZoomView from "./waveform-zoomview";

/**
 * Creates a scrollbar.
 *
 * @throws {Error} If scrollbar display options are missing from the Peaks configuration.
 */

export interface ScrollbarFromOptions {
	readonly container: HTMLDivElement;
	readonly peaks: PeaksInstance;
}

export class Scrollbar {
	private readonly container: HTMLDivElement;
	private readonly peaks: PeaksInstance;
	private readonly scrollbarOptions: ScrollbarDisplayOptions;
	private zoomview: WaveformZoomView | undefined;
	private width: number;
	private height: number;
	private readonly stage: Stage;
	private readonly layer: Layer;
	private readonly color: string;
	private scrollboxX: number;
	private readonly minScrollboxWidth: number;
	private readonly offsetY: number;
	private readonly scrollbox: Group;
	private readonly scrollboxRect: Rect;
	private scrollboxWidth!: number;
	private dragging!: boolean;

	static from(options: ScrollbarFromOptions): Scrollbar {
		return new Scrollbar(options.container, options.peaks);
	}

	private constructor(container: HTMLDivElement, peaks: PeaksInstance) {
		this.container = container;
		this.peaks = peaks;

		const scrollbarOptions = peaks.options.scrollbar;

		if (!scrollbarOptions) {
			throw new Error("Scrollbar: missing scrollbar options");
		}

		this.scrollbarOptions = scrollbarOptions;
		this.zoomview = peaks.views.getView("zoomview") as
			| WaveformZoomView
			| undefined;

		this.peaks.on("zoomview.update", this.onZoomviewUpdate);

		this.width = container.clientWidth;
		this.height = container.clientHeight;

		this.stage = new Konva.Stage({
			container: container,
			height: this.height,
			width: this.width,
		});

		this.layer = new Konva.Layer();
		this.stage.on("click", this.onScrollbarClick);

		this.stage.add(this.layer);

		this.color = this.scrollbarOptions.color;
		this.scrollboxX = 0;
		this.minScrollboxWidth = this.scrollbarOptions.minWidth;

		this.offsetY = 0;

		this.scrollbox = new Konva.Group({
			dragBoundFunc: this.dragBoundFunc,
			draggable: true,
		});

		this.scrollboxRect = new Rect({
			fill: this.color,
			height: this.height,
			width: 0,
			x: this.scrollboxX,
			y: this.offsetY,
		});

		this.scrollbox.add(this.scrollboxRect);
		this.setScrollboxWidth();

		this.scrollbox.on("dragstart", this.onScrollboxDragStart);
		this.scrollbox.on("dragmove", this.onScrollboxDragMove);
		this.scrollbox.on("dragend", this.onScrollboxDragEnd);

		this.layer.add(this.scrollbox);

		this.updateScrollbarWidthAndPosition();
	}

	setZoomview(zoomview: WaveformZoomView | undefined): void {
		this.zoomview = zoomview;

		this.updateScrollbarWidthAndPosition();
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

	/**
	 * @returns {Number} The maximum scrollbox position, in pixels.
	 */

	private getScrollbarRange(): number {
		return this.width - this.scrollboxWidth;
	}

	private dragBoundFunc = (pos: {
		x: number;
		y: number;
	}): { x: number; y: number } => {
		// Allow the scrollbar to be moved horizontally but not vertically.
		return {
			x: pos.x,
			y: 0,
		};
	};

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

	destroy(): void {
		this.peaks.off("zoomview.update", this.onZoomviewUpdate);

		this.layer.destroy();

		this.stage.destroy();
	}
}
