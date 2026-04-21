import type { Group } from "konva/lib/Group";
import { Line } from "konva/lib/shapes/Line";
import { Rect } from "konva/lib/shapes/Rect";
import { Text } from "konva/lib/shapes/Text";
import type { CreatePointMarkerOptions, PointUpdateOptions } from "./types";

export const DefaultOptions = {
	color: "#000",
	draggable: false,
	editable: false,
	fontFamily: "sans-serif",
	fontSize: 10,
	fontStyle: "normal",
} as const satisfies Omit<CreatePointMarkerOptions, "point">;

export interface DefaultPointMarkerFromOptions {
	readonly options: CreatePointMarkerOptions;
}

export class DefaultPointMarker {
	private constructor(
		private readonly options: CreatePointMarkerOptions,
		private readonly label: Text,
		private readonly handle: Rect,
		private readonly line: Line,
		private readonly time: Text,
		private draggable: boolean,
	) {}

	static DefaultOptions = DefaultOptions;
	static from(opts: DefaultPointMarkerFromOptions): DefaultPointMarker {
		const options = {
			...DefaultOptions,
			...opts.options,
		};
		const handleWidth = 10 as const;
		const handleHeight = 20 as const;
		const handleX = -(handleWidth / 2) + 0.5; // Place in the middle of the marker

		// Label - create with default y, the real value is set in fitToView().
		const label =
			options.view === "zoomview"
				? new Text({
						fill: "#000",
						fontFamily: options.fontFamily ?? DefaultOptions.fontFamily,
						fontSize: options.fontSize ?? DefaultOptions.fontSize,
						fontStyle: options.fontStyle ?? DefaultOptions.fontStyle,
						text: options.point?.labelText ?? "",
						textAlign: "left",
						x: 2,
						y: 0,
					})
				: new Text({
						fontSize: 0,
						text: "",
					});

		// Handle - create with default y, the real value is set in fitToView().
		const handle = new Rect({
			fill: options.color,
			height: handleHeight,
			visible: options.draggable,
			width: handleWidth,
			x: handleX,
			y: 0,
		});

		// Line - create with default y and points, the real values
		// are set in fitToView().
		const line = new Line({
			stroke: options.color ?? DefaultOptions.color,
			strokeWidth: 1,
			x: 0,
			y: 0,
		});

		const point = options.point;
		if (point === undefined) {
			throw new Error(
				"Point data is required to initialize DefaultPointMarker",
			);
		}

		// Time label - create with default y, the real value is set
		// in fitToView().
		const time = new Text({
			fill: "#000",
			fontFamily: options.fontFamily ?? DefaultOptions.fontFamily,
			fontSize: options.fontSize ?? DefaultOptions.fontSize,
			fontStyle: options.fontStyle ?? DefaultOptions.fontStyle,
			text: options.layer?.formatTime(point.time) ?? "",
			textAlign: "center",
			x: -24,
			y: 0,
		});
		time.hide();

		return new DefaultPointMarker(
			options,
			label,
			handle,
			line,
			time,
			options.editable ?? false,
		);
	}

	init(group: Group): void {
		group.add(this.handle);
		group.add(this.line);
		if (this.label !== undefined) {
			group.add(this.label);
		}
		group.add(this.time);

		this.fitToView();
		this.bindEventHandlers(group);
	}

	dispose(): void {
		// Shapes are destroyed by group.destroyChildren() in PointMarker.dispose()
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
			this.label.text(options.labelText);
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
