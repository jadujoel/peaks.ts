import { Line } from "konva/lib/shapes/Line";

interface MarkerGroup {
	add(node: unknown): void;
}

interface MarkerLayer {
	getHeight(): number;
}

interface PointMarkerOptions {
	color: string;
	layer: MarkerLayer;
}

interface MarkerUpdateOptions {
	color?: string;
}

export class SimplePointMarker {
	private readonly _options: PointMarkerOptions;
	private _line: Line | null = null;

	constructor(options: PointMarkerOptions) {
		this._options = options;
	}

	init(group: MarkerGroup): void {
		this._line = new Line({
			stroke: this._options.color,
			strokeWidth: 1,
			x: 0,
			y: 0,
		});

		group.add(this._line);
		this.fitToView();
	}

	fitToView(): void {
		if (!this._line) {
			return;
		}

		const height = this._options.layer.getHeight();
		this._line.points([0.5, 0, 0.5, height]);
	}

	update(options: MarkerUpdateOptions): void {
		if (options.color !== undefined) {
			this._line?.stroke(options.color);
		}
	}
}
