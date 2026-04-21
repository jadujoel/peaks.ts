import type { Group } from "konva/lib/Group";
import { Line } from "konva/lib/shapes/Line";
import { Rect } from "konva/lib/shapes/Rect";
import { Text } from "konva/lib/shapes/Text";
import type { CreateSegmentMarkerOptions, SegmentUpdateOptions } from "./types";

export const SegmentMarkerDefaults = {
	color: "#000",
	fontFamily: "sans-serif",
	fontSize: 10,
	fontStyle: "normal",
	handleHeight: 20,
	handleWidth: 10,
} as const;

export interface DefaultSegmentMarkerFromOptions {
	readonly options: CreateSegmentMarkerOptions;
}

export class DefaultSegmentMarker {
	private constructor(
		private readonly options: CreateSegmentMarkerOptions,
		private readonly label: Text,
		private readonly handle: Rect,
		private readonly line: Line,
		private readonly labelX: number,
		private editable: boolean,
	) {}

	static from(opts: DefaultSegmentMarkerFromOptions): DefaultSegmentMarker {
		const { options } = opts;
		const editable = options.editable ?? false;
		const handleX = -(SegmentMarkerDefaults.handleWidth / 2) + 0.5;
		const labelXPosition = options.startMarker ? -24 : 24;

		const time =
			(options.startMarker
				? options.segment?.startTime
				: options.segment?.endTime) ?? 0;

		const label = new Text({
			fill: "#000",
			fontFamily: options.fontFamily ?? SegmentMarkerDefaults.fontFamily,
			fontSize: options.fontSize ?? SegmentMarkerDefaults.fontSize,
			fontStyle: options.fontStyle ?? SegmentMarkerDefaults.fontStyle,
			text: options.layer?.formatTime(time) ?? "",
			textAlign: "center",
			visible: editable,
			x: labelXPosition,
			y: 0,
		});
		label.hide();

		const handle = new Rect({
			fill: options.color ?? SegmentMarkerDefaults.color,
			height: SegmentMarkerDefaults.handleHeight,
			stroke: options.color ?? SegmentMarkerDefaults.color,
			strokeWidth: 1,
			visible: editable,
			width: SegmentMarkerDefaults.handleWidth,
			x: handleX,
			y: 0,
		});

		const line = new Line({
			stroke: options.color ?? SegmentMarkerDefaults.color,
			strokeWidth: 1,
			visible: editable,
			x: 0,
			y: 0,
		});

		return new DefaultSegmentMarker(
			options,
			label,
			handle,
			line,
			labelXPosition,
			editable,
		);
	}

	init(group: Group): void {
		group.add(this.label);
		group.add(this.line);
		group.add(this.handle);

		this.fitToView();
		this.bindEventHandlers(group);
	}

	fitToView(): void {
		const height = this.options.layer?.getHeight() ?? 0;

		this.label.y(height / 2 - 5);
		this.handle.y(height / 2 - 10.5);
		this.line.points([0.5, 0, 0.5, height]);
	}

	update(options: SegmentUpdateOptions): void {
		if (options.startTime !== undefined && this.options.startMarker) {
			this.label.text(this.options.layer?.formatTime(options.startTime) ?? "");
		}

		if (options.endTime !== undefined && !this.options.startMarker) {
			this.label.text(this.options.layer?.formatTime(options.endTime) ?? "");
		}

		if (options.editable !== undefined) {
			this.editable = options.editable;

			this.label.visible(this.editable);
			this.handle.visible(this.editable);
			this.line.visible(this.editable);
		}
	}

	dispose(): void {
		// Shapes are destroyed by group.destroyChildren() in SegmentMarker.dispose()
	}

	private bindEventHandlers(group: Group): void {
		group.on("dragstart", () => {
			if (this.options.startMarker) {
				this.label.x(this.labelX - this.label.getWidth());
			}

			this.label.show();
		});

		group.on("dragend", () => {
			this.label.hide();
		});

		this.handle.on("mouseover touchstart", () => {
			if (this.options.startMarker) {
				this.label.x(this.labelX - this.label.getWidth());
			}

			this.label.show();
		});

		this.handle.on("mouseout touchend", () => {
			this.label.hide();
		});
	}
}
