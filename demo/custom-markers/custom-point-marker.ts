import { Label, Tag } from "konva/lib/shapes/Label";
import { Line } from "konva/lib/shapes/Line";
import { Text } from "konva/lib/shapes/Text";

export interface MarkerGroup {
	add(node: unknown): void;
	on(eventName: string, handler: () => void): void;
	y(value: number): void;
}

export interface MarkerLayer {
	getHeight(): number;
}

export interface PointMarkerOptions {
	color: string;
	point: {
		labelText: string;
	};
	layer: MarkerLayer;
}

export interface MarkerUpdateOptions {
	labelText?: string;
	color?: string;
}

export class CustomPointMarker {
	private readonly _options: PointMarkerOptions;
	private _group: MarkerGroup | null = null;
	private _label: Label | null = null;
	private _tag: Tag | null = null;
	private _text: Text | null = null;
	private _line: Line | null = null;

	constructor(options: PointMarkerOptions) {
		this._options = options;
	}

	init(group: MarkerGroup): void {
		this._group = group;

		this._label = new Label({
			x: 0.5,
			y: 0.5,
		});

		this._tag = new Tag({
			fill: this._options.color,
			lineJoin: "round",
			pointerDirection: "down",
			pointerHeight: 10,
			pointerWidth: 10,
			shadowBlur: 10,
			shadowColor: "black",
			shadowOffsetX: 3,
			shadowOffsetY: 3,
			shadowOpacity: 0.3,
			stroke: this._options.color,
			strokeWidth: 1,
		});

		this._label.add(this._tag);

		this._text = new Text({
			fill: "white",
			fontFamily: "Calibri",
			fontSize: 14,
			padding: 5,
			text: this._options.point.labelText,
		});

		this._label.add(this._text);

		this._line = new Line({
			stroke: this._options.color,
			strokeWidth: 1,
			x: 0,
			y: 0,
		});

		group.add(this._label);
		group.add(this._line);

		this.fitToView();
		this.bindEventHandlers();
	}

	private bindEventHandlers(): void {
		this._group?.on("mouseenter", () => {
			document.body.style.cursor = "move";
		});

		this._group?.on("mouseleave", () => {
			document.body.style.cursor = "default";
		});
	}

	fitToView(): void {
		if (!this._group || !this._text || !this._line) {
			return;
		}

		const height = this._options.layer.getHeight();
		const labelHeight = this._text.height() + 2 * this._text.padding();
		const offsetTop = 14;
		const offsetBottom = 26;

		this._group.y(offsetTop + labelHeight + 0.5);
		this._line.points([
			0.5,
			0,
			0.5,
			height - labelHeight - offsetTop - offsetBottom,
		]);
	}

	update(options: MarkerUpdateOptions): void {
		if (options.labelText !== undefined) {
			this._text?.text(options.labelText);
		}

		if (options.color !== undefined) {
			this._tag?.fill(options.color);
			this._tag?.stroke(options.color);
			this._line?.stroke(options.color);
		}
	}
}
