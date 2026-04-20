import type { Group } from "konva/lib/Group";
import { Line } from "konva/lib/shapes/Line";
import { Rect } from "konva/lib/shapes/Rect";
import { Text } from "konva/lib/shapes/Text";
import type { CreateSegmentMarkerOptions, SegmentUpdateOptions } from "./types";

export interface DefaultSegmentMarkerFromOptions {
	readonly options: CreateSegmentMarkerOptions;
}

export class DefaultSegmentMarker {
	private readonly options: CreateSegmentMarkerOptions;
	private editable: boolean;
	private label!: Text;
	private handle!: Rect;
	private line!: Line;

	static from(options: DefaultSegmentMarkerFromOptions): DefaultSegmentMarker {
		return new DefaultSegmentMarker(options.options);
	}

	private constructor(options: CreateSegmentMarkerOptions) {
		this.options = options;
		this.editable = options.editable ?? false;
	}

	init(group: Group): void {
		const handleWidth = 10;
		const handleHeight = 20;
		const handleX = -(handleWidth / 2) + 0.5; // Place in the middle of the marker

		const xPosition = this.options.startMarker ? -24 : 24;

		const time =
			(this.options.startMarker
				? this.options.segment?.startTime
				: this.options.segment?.endTime) ?? 0;
		// Label - create with default y, the real value is set in fitToView().
		this.label = new Text({
			fill: "#000",
			fontFamily: this.options.fontFamily,
			fontSize: this.options.fontSize,
			fontStyle: this.options.fontStyle,
			text: this.options.layer.formatTime(time),
			textAlign: "center",
			visible: this.editable,
			x: xPosition,
			y: 0,
		});

		this.label.hide();

		// Handle - create with default y, the real value is set in fitToView().
		this.handle = new Rect({
			fill: this.options.color,
			height: handleHeight,
			stroke: this.options.color,
			strokeWidth: 1,
			visible: this.editable,
			width: handleWidth,
			x: handleX,
			y: 0,
		});

		// Vertical Line - create with default y and points, the real values
		// are set in fitToView().
		this.line = new Line({
			stroke: this.options.color,
			strokeWidth: 1,
			visible: this.editable,
			x: 0,
			y: 0,
		});

		group.add(this.label);
		group.add(this.line);
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
		});

		this.handle.on("mouseout touchend", () => {
			this.label.hide();
		});
	}

	fitToView(): void {
		const height = this.options.layer.getHeight();

		this.label.y(height / 2 - 5);
		this.handle.y(height / 2 - 10.5);
		this.line.points([0.5, 0, 0.5, height]);
	}

	update(options: SegmentUpdateOptions): void {
		if (options.startTime !== undefined && this.options.startMarker) {
			this.label.text(this.options.layer.formatTime(options.startTime));
		}

		if (options.endTime !== undefined && !this.options.startMarker) {
			this.label.text(this.options.layer.formatTime(options.endTime));
		}

		if (options.editable !== undefined) {
			this.editable = options.editable;

			this.label.visible(this.editable);
			this.handle.visible(this.editable);
			this.line.visible(this.editable);
		}
	}
}
