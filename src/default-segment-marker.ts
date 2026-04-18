import type { Group } from "konva/lib/Group";
import { Line } from "konva/lib/shapes/Line";
import { Rect } from "konva/lib/shapes/Rect";
import { Text } from "konva/lib/shapes/Text";
import type { CreateSegmentMarkerOptions, SegmentUpdateOptions } from "./types";

class DefaultSegmentMarker {
	private _options: CreateSegmentMarkerOptions;
	private _editable: boolean;
	private _label!: Text;
	private _handle!: Rect;
	private _line!: Line;

	constructor(options: CreateSegmentMarkerOptions) {
		this._options = options;
		this._editable = options.editable;
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
			visible: this._editable,
		});

		this._label.hide();

		// Handle - create with default y, the real value is set in fitToView().
		this._handle = new Rect({
			x: handleX,
			y: 0,
			width: handleWidth,
			height: handleHeight,
			fill: this._options.color,
			stroke: this._options.color,
			strokeWidth: 1,
			visible: this._editable,
		});

		// Vertical Line - create with default y and points, the real values
		// are set in fitToView().
		this._line = new Line({
			x: 0,
			y: 0,
			stroke: this._options.color,
			strokeWidth: 1,
			visible: this._editable,
		});

		group.add(this._label);
		group.add(this._line);
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
		});

		this._handle.on("mouseout touchend", () => {
			this._label.hide();
		});
	}

	fitToView(): void {
		const height = this._options.layer.getHeight();

		this._label.y(height / 2 - 5);
		this._handle.y(height / 2 - 10.5);
		this._line.points([0.5, 0, 0.5, height]);
	}

	update(options: SegmentUpdateOptions): void {
		if (options.startTime !== undefined && this._options.startMarker) {
			this._label.text(this._options.layer.formatTime(options.startTime));
		}

		if (options.endTime !== undefined && !this._options.startMarker) {
			this._label.text(this._options.layer.formatTime(options.endTime));
		}

		if (options.editable !== undefined) {
			this._editable = options.editable;

			this._label.visible(this._editable);
			this._handle.visible(this._editable);
			this._line.visible(this._editable);
		}
	}
}

export default DefaultSegmentMarker;
