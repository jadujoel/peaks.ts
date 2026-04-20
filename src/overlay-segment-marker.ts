import type { Group } from "konva/lib/Group";
import { Rect } from "konva/lib/shapes/Rect";
import { Text } from "konva/lib/shapes/Text";
import type { CreateSegmentMarkerOptions, SegmentUpdateOptions } from "./types";

export interface OverlaySegmentMarkerFromOptions {
	readonly options: CreateSegmentMarkerOptions;
}

export class OverlaySegmentMarker {
	private readonly _options: CreateSegmentMarkerOptions;
	private _label!: Text;
	private _handle!: Rect;

	static from(options: OverlaySegmentMarkerFromOptions): OverlaySegmentMarker {
		return new OverlaySegmentMarker(options.options);
	}

	private constructor(options: CreateSegmentMarkerOptions) {
		this._options = options;
	}

	init(group: Group): void {
		const handleWidth = 10;
		const handleHeight = 20;
		const handleX = -(handleWidth / 2) + 0.5; // Place in the middle of the marker

		const xPosition = this._options.startMarker ? -24 : 24;

		const time = this._options.startMarker
			? this._options.segment.startTime
			: this._options.segment.endTime;

		// Label - create with default y, the real value is set in fitToView().
		this._label = new Text({
			x: xPosition,
			y: 0,
			text: this._options.layer.formatTime(time),
			fontFamily: this._options.fontFamily,
			fontSize: this._options.fontSize,
			fontStyle: this._options.fontStyle,
			fill: "#000",
			textAlign: "center",
			visible: false,
		});

		// Handle - create with default y, the real value is set in fitToView().
		this._handle = new Rect({
			x: handleX,
			y: 0,
			width: handleWidth,
			height: handleHeight,
		});

		group.add(this._label);
		group.add(this._handle);

		this.fitToView();

		this.bindEventHandlers(group);
	}

	bindEventHandlers(group: Group): void {
		const xPosition = this._options.startMarker ? -24 : 24;

		group.on("dragstart", () => {
			if (this._options.startMarker) {
				this._label.x(xPosition - this._label.getWidth());
			}

			this._label.show();
		});

		group.on("dragend", () => {
			this._label.hide();
		});

		this._handle.on("mouseover touchstart", () => {
			if (this._options.startMarker) {
				this._label.x(xPosition - this._label.getWidth());
			}

			this._label.show();

			document.body.style.cursor = "ew-resize";
		});

		this._handle.on("mouseout touchend", () => {
			this._label.hide();

			document.body.style.cursor = "default";
		});
	}

	fitToView(): void {
		const viewHeight = this._options.layer.getHeight();

		const overlayOffset = this._options.segmentOptions.overlayOffset;
		const overlayRectHeight = Math.max(0, viewHeight - 2 * overlayOffset);

		this._label.y(viewHeight / 2 - 5);
		this._handle.y(overlayOffset);
		this._handle.height(overlayRectHeight);
	}

	update(options: SegmentUpdateOptions): void {
		if (options.startTime !== undefined && this._options.startMarker) {
			this._label.text(this._options.layer.formatTime(options.startTime));
		}

		if (options.endTime !== undefined && !this._options.startMarker) {
			this._label.text(this._options.layer.formatTime(options.endTime));
		}
	}
}
