import type { Group } from "konva/lib/Group";
import { Line } from "konva/lib/shapes/Line";
import { Rect } from "konva/lib/shapes/Rect";
import { Text } from "konva/lib/shapes/Text";
import type { CreatePointMarkerOptions, PointUpdateOptions } from "./types";

export const DefaultOptions = {
	editable: false,
	color: "#000",
	fontFamily: "sans-serif",
	fontSize: 10,
	fontStyle: "normal",
} as const satisfies CreatePointMarkerOptions;

export interface DefaultPointMarkerFromOptions {
	readonly options: CreatePointMarkerOptions;
}

export class DefaultPointMarker {
	private readonly _options: CreatePointMarkerOptions;
	private _label: Text | undefined;
	private _handle!: Rect;
	private _line!: Line;
	private _time!: Text;
	private _draggable: boolean;

	static DefaultOptions = DefaultOptions;

	static from(options: DefaultPointMarkerFromOptions): DefaultPointMarker {
		return new DefaultPointMarker(options.options);
	}

	private constructor(options: CreatePointMarkerOptions) {
		this._options = {
			...DefaultOptions,
			...options,
		};
		this._draggable = this._options.editable ?? false;
	}

	init(group: Group): void {
		const handleWidth = 10;
		const handleHeight = 20;
		const handleX = -(handleWidth / 2) + 0.5; // Place in the middle of the marker

		// Label

		if (this._options.view === "zoomview") {
			// Label - create with default y, the real value is set in fitToView().
			this._label = new Text({
				x: 2,
				y: 0,
				text: this._options.point?.labelText ?? "",
				textAlign: "left",
				fontFamily: this._options.fontFamily || "sans-serif",
				fontSize: this._options.fontSize || 10,
				fontStyle: this._options.fontStyle || "normal",
				fill: "#000",
			});
		}

		// Handle - create with default y, the real value is set in fitToView().

		this._handle = new Rect({
			x: handleX,
			y: 0,
			width: handleWidth,
			height: handleHeight,
			fill: this._options.color ?? DefaultOptions.color,
			visible: this._draggable,
		});

		// Line - create with default y and points, the real values
		// are set in fitToView().
		this._line = new Line({
			x: 0,
			y: 0,
			stroke: this._options.color ?? DefaultOptions.color,
			strokeWidth: 1,
		});

		const point = this._options.point;
		if (point === undefined) {
			throw new Error(
				"Point data is required to initialize DefaultPointMarker",
			);
		}

		// Time label - create with default y, the real value is set
		// in fitToView().
		this._time = new Text({
			x: -24,
			y: 0,
			text: this._options.layer?.formatTime(point.time) ?? "",
			fontFamily: this._options.fontFamily ?? DefaultOptions.fontFamily,
			fontSize: this._options.fontSize ?? DefaultOptions.fontSize,
			fontStyle: this._options.fontStyle ?? DefaultOptions.fontStyle,
			fill: "#000",
			textAlign: "center",
		});

		this._time.hide();

		group.add(this._handle);

		group.add(this._line);

		if (this._label) {
			group.add(this._label);
		}

		group.add(this._time);

		this.fitToView();

		this.bindEventHandlers(group);
	}

	bindEventHandlers(group: Group): void {
		this._handle.on("mouseover touchstart", () => {
			if (this._draggable) {
				// Position text to the left of the marker
				this._time.x(-24 - this._time.getWidth());
				this._time.show();
			}
		});

		this._handle.on("mouseout touchend", () => {
			if (this._draggable) {
				this._time.hide();
			}
		});

		group.on("dragstart", () => {
			this._time.x(-24 - this._time.getWidth());
			this._time.show();
		});

		group.on("dragend", () => {
			this._time.hide();
		});
	}

	fitToView(): void {
		const height = this._options.layer?.getHeight() ?? 0;

		this._line.points([0.5, 0, 0.5, height]);

		if (this._label) {
			this._label.y(12);
		}

		if (this._handle) {
			this._handle.y(height / 2 - 10.5);
		}

		if (this._time) {
			this._time.y(height / 2 - 5);
		}
	}

	update(options: PointUpdateOptions): void {
		if (options.time !== undefined) {
			if (this._time) {
				this._time.setText(this._options.layer?.formatTime(options.time) ?? "");
			}
		}

		if (options.labelText !== undefined) {
			if (this._label) {
				this._label.text(options.labelText);
			}
		}

		if (options.color !== undefined) {
			if (this._handle) {
				this._handle.fill(options.color);
			}

			this._line.stroke(options.color);
		}

		if (options.editable !== undefined) {
			this._draggable = options.editable;
			this._handle.visible(this._draggable);
		}
	}
}
