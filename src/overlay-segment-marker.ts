import type { PeaksGroup } from "./peaks-group";
import type { PeaksNode } from "./peaks-node";
import type { CreateSegmentMarkerOptions, SegmentUpdateOptions } from "./types";

export interface OverlaySegmentMarkerFromOptions {
	readonly options: CreateSegmentMarkerOptions;
}

export class OverlaySegmentMarker {
	private constructor(
		private readonly options: CreateSegmentMarkerOptions,
		private label: PeaksNode | undefined,
		private handle: PeaksNode | undefined,
	) {}

	static from(opts: OverlaySegmentMarkerFromOptions): OverlaySegmentMarker {
		const options = opts.options;
		return new OverlaySegmentMarker(options, undefined, undefined);
	}

	init(group: PeaksGroup): void {
		const handleWidth = 10;
		const handleHeight = 20;
		const handleX = -(handleWidth / 2) + 0.5;
		const xPosition = this.options.startMarker ? -24 : 24;
		const time = this.options.startMarker
			? this.options.segment.startTime
			: this.options.segment.endTime;

		this.label = group.addText({
			fill: "#000",
			fontFamily: this.options.fontFamily,
			fontSize: this.options.fontSize,
			fontStyle: this.options.fontStyle,
			text: this.options.layer.formatTime(time),
			textAlign: "center",
			visible: false,
			x: xPosition,
			y: 0,
		});

		this.handle = group.addRect({
			height: handleHeight,
			width: handleWidth,
			x: handleX,
			y: 0,
		});

		this.fitToView();

		this.bindEventHandlers(group);
	}

	bindEventHandlers(group: PeaksGroup): void {
		if (!this.handle || !this.label) {
			return;
		}

		const label = this.label;
		const handle = this.handle;

		const xPosition = this.options.startMarker ? -24 : 24;

		group.on("dragstart", () => {
			if (this.options.startMarker) {
				label.x(xPosition - label.getWidth());
			}

			label.show();
		});

		group.on("dragend", () => {
			label.hide();
		});

		handle.on("mouseover touchstart", () => {
			if (this.options.startMarker) {
				label.x(xPosition - label.getWidth());
			}

			label.show();

			document.body.style.cursor = "ew-resize";
		});

		handle.on("mouseout touchend", () => {
			label.hide();

			document.body.style.cursor = "default";
		});
	}

	fitToView(): void {
		if (!this.label || !this.handle) {
			return;
		}

		const viewHeight = this.options.layer.getHeight();

		const overlayOffset = this.options.segmentOptions.overlayOffset;
		const overlayRectHeight = Math.max(0, viewHeight - 2 * overlayOffset);

		this.label.y(viewHeight / 2 - 5);
		this.handle.y(overlayOffset);
		this.handle.height(overlayRectHeight);
	}

	update(options: SegmentUpdateOptions): void {
		if (!this.label) {
			return;
		}

		if (options.startTime !== undefined && this.options.startMarker) {
			this.label.text(this.options.layer.formatTime(options.startTime));
		}

		if (options.endTime !== undefined && !this.options.startMarker) {
			this.label.text(this.options.layer.formatTime(options.endTime));
		}
	}

	dispose(): void {
		// No external resources to clean up
	}
}
