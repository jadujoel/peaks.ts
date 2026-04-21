import type { Group } from "konva/lib/Group";
import { Rect } from "konva/lib/shapes/Rect";
import { Text } from "konva/lib/shapes/Text";
import type { CreateSegmentMarkerOptions, SegmentUpdateOptions } from "./types";

export interface OverlaySegmentMarkerFromOptions {
	readonly options: CreateSegmentMarkerOptions;
}

export class OverlaySegmentMarker {
	private constructor(
		private readonly options: CreateSegmentMarkerOptions,
		private readonly label: Text,
		private readonly handle: Rect,
	) {}

	static from(opts: OverlaySegmentMarkerFromOptions): OverlaySegmentMarker {
		const options = opts.options;
		const handleWidth = 10;
		const handleHeight = 20;
		const handleX = -(handleWidth / 2) + 0.5;
		const xPosition = options.startMarker ? -24 : 24;
		const time = options.startMarker
			? options.segment.startTime
			: options.segment.endTime;

		const label = new Text({
			fill: "#000",
			fontFamily: options.fontFamily,
			fontSize: options.fontSize,
			fontStyle: options.fontStyle,
			text: options.layer.formatTime(time),
			textAlign: "center",
			visible: false,
			x: xPosition,
			y: 0,
		});

		const handle = new Rect({
			height: handleHeight,
			width: handleWidth,
			x: handleX,
			y: 0,
		});

		return new OverlaySegmentMarker(options, label, handle);
	}

	init(group: Group): void {
		group.add(this.label);
		group.add(this.handle);

		this.fitToView();

		this.bindEventHandlers(group);
	}

	bindEventHandlers(group: Group): void {
		const xPosition = this.options.startMarker ? -24 : 24;

		group.on("dragstart", () => {
			if (this.options.startMarker) {
				this.label.x(xPosition - this.label.getWidth());
			}

			this.label.show();
		});

		group.on("dragend", () => {
			this.label.hide();
		});

		this.handle.on("mouseover touchstart", () => {
			if (this.options.startMarker) {
				this.label.x(xPosition - this.label.getWidth());
			}

			this.label.show();

			document.body.style.cursor = "ew-resize";
		});

		this.handle.on("mouseout touchend", () => {
			this.label.hide();

			document.body.style.cursor = "default";
		});
	}

	fitToView(): void {
		const viewHeight = this.options.layer.getHeight();

		const overlayOffset = this.options.segmentOptions.overlayOffset;
		const overlayRectHeight = Math.max(0, viewHeight - 2 * overlayOffset);

		this.label.y(viewHeight / 2 - 5);
		this.handle.y(overlayOffset);
		this.handle.height(overlayRectHeight);
	}

	update(options: SegmentUpdateOptions): void {
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
