import type { Group } from "konva/lib/Group";
import { Rect } from "konva/lib/shapes/Rect";
import { Text } from "konva/lib/shapes/Text";
import type { CreateSegmentMarkerOptions, SegmentUpdateOptions } from "./types";

export interface OverlaySegmentMarkerFromOptions {
	readonly options: CreateSegmentMarkerOptions;
}

export class OverlaySegmentMarker {
	private readonly options: CreateSegmentMarkerOptions;
	private label!: Text;
	private handle!: Rect;

	static from(options: OverlaySegmentMarkerFromOptions): OverlaySegmentMarker {
		return new OverlaySegmentMarker(options.options);
	}

	private constructor(options: CreateSegmentMarkerOptions) {
		this.options = options;
	}

	init(group: Group): void {
		const handleWidth = 10;
		const handleHeight = 20;
		const handleX = -(handleWidth / 2) + 0.5; // Place in the middle of the marker

		const xPosition = this.options.startMarker ? -24 : 24;

		const time = this.options.startMarker
			? this.options.segment.startTime
			: this.options.segment.endTime;

		// Label - create with default y, the real value is set in fitToView().
		this.label = new Text({
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

		// Handle - create with default y, the real value is set in fitToView().
		this.handle = new Rect({
			height: handleHeight,
			width: handleWidth,
			x: handleX,
			y: 0,
		});

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
}
