import type { Group } from "konva/lib/Group";
import { Line } from "konva/lib/shapes/Line";
import { Rect } from "konva/lib/shapes/Rect";
import { Text } from "konva/lib/shapes/Text";
import type { CreatePointMarkerOptions, PointUpdateOptions } from "./types";

export const DefaultOptions = {
	color: "#000",
	editable: false,
	fontFamily: "sans-serif",
	fontSize: 10,
	fontStyle: "normal",
} as const satisfies CreatePointMarkerOptions;

export interface DefaultPointMarkerFromOptions {
	readonly options: CreatePointMarkerOptions;
}

export class DefaultPointMarker {
	private readonly options: CreatePointMarkerOptions;
	private label: Text | undefined;
	private handle!: Rect;
	private line!: Line;
	private time!: Text;
	private draggable: boolean;

	static DefaultOptions = DefaultOptions;

	static from(options: DefaultPointMarkerFromOptions): DefaultPointMarker {
		return new DefaultPointMarker(options.options);
	}

	private constructor(options: CreatePointMarkerOptions) {
		this.options = {
			...DefaultOptions,
			...options,
		};
		this.draggable = this.options.editable ?? false;
	}

	init(group: Group): void {
		const handleWidth = 10;
		const handleHeight = 20;
		const handleX = -(handleWidth / 2) + 0.5; // Place in the middle of the marker

		// Label

		if (this.options.view === "zoomview") {
			// Label - create with default y, the real value is set in fitToView().
			this.label = new Text({
				fill: "#000",
				fontFamily: this.options.fontFamily || "sans-serif",
				fontSize: this.options.fontSize || 10,
				fontStyle: this.options.fontStyle || "normal",
				text: this.options.point?.labelText ?? "",
				textAlign: "left",
				x: 2,
				y: 0,
			});
		}

		// Handle - create with default y, the real value is set in fitToView().

		this.handle = new Rect({
			fill: this.options.color ?? DefaultOptions.color,
			height: handleHeight,
			visible: this.draggable,
			width: handleWidth,
			x: handleX,
			y: 0,
		});

		// Line - create with default y and points, the real values
		// are set in fitToView().
		this.line = new Line({
			stroke: this.options.color ?? DefaultOptions.color,
			strokeWidth: 1,
			x: 0,
			y: 0,
		});

		const point = this.options.point;
		if (point === undefined) {
			throw new Error(
				"Point data is required to initialize DefaultPointMarker",
			);
		}

		// Time label - create with default y, the real value is set
		// in fitToView().
		this.time = new Text({
			fill: "#000",
			fontFamily: this.options.fontFamily ?? DefaultOptions.fontFamily,
			fontSize: this.options.fontSize ?? DefaultOptions.fontSize,
			fontStyle: this.options.fontStyle ?? DefaultOptions.fontStyle,
			text: this.options.layer?.formatTime(point.time) ?? "",
			textAlign: "center",
			x: -24,
			y: 0,
		});

		this.time.hide();

		group.add(this.handle);

		group.add(this.line);

		if (this.label) {
			group.add(this.label);
		}

		group.add(this.time);

		this.fitToView();

		this.bindEventHandlers(group);
	}

	bindEventHandlers(group: Group): void {
		this.handle.on("mouseover touchstart", () => {
			if (this.draggable) {
				// Position text to the left of the marker
				this.time.x(-24 - this.time.getWidth());
				this.time.show();
			}
		});

		this.handle.on("mouseout touchend", () => {
			if (this.draggable) {
				this.time.hide();
			}
		});

		group.on("dragstart", () => {
			this.time.x(-24 - this.time.getWidth());
			this.time.show();
		});

		group.on("dragend", () => {
			this.time.hide();
		});
	}

	fitToView(): void {
		const height = this.options.layer?.getHeight() ?? 0;

		this.line.points([0.5, 0, 0.5, height]);

		if (this.label) {
			this.label.y(12);
		}

		if (this.handle) {
			this.handle.y(height / 2 - 10.5);
		}

		if (this.time) {
			this.time.y(height / 2 - 5);
		}
	}

	update(options: PointUpdateOptions): void {
		if (options.time !== undefined) {
			if (this.time) {
				this.time.setText(this.options.layer?.formatTime(options.time) ?? "");
			}
		}

		if (options.labelText !== undefined) {
			if (this.label) {
				this.label.text(options.labelText);
			}
		}

		if (options.color !== undefined) {
			if (this.handle) {
				this.handle.fill(options.color);
			}

			this.line.stroke(options.color);
		}

		if (options.editable !== undefined) {
			this.draggable = options.editable;
			this.handle.visible(this.draggable);
		}
	}
}
