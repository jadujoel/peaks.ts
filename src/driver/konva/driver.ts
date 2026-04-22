import { Animation } from "konva/lib/Animation";
import Konva from "konva/lib/Core";
import { Line } from "konva/lib/shapes/Line";
import { Rect } from "konva/lib/shapes/Rect";
import { Text } from "konva/lib/shapes/Text";
import type {
	CanvasDriver,
	DriverAnimation,
	DriverGroup,
	DriverLayer,
	DriverLine,
	DriverRect,
	DriverShape,
	DriverStage,
	DriverText,
	GroupAttrs,
	LayerAttrs,
	LineAttrs,
	RectAttrs,
	ShapeAttrs,
	TextAttrs,
} from "../types";

// Konva nodes already provide the structural surface that the driver
// interfaces describe — so each `create*` method constructs the Konva
// object and returns it cast to the corresponding driver type. This keeps
// the abstraction zero-cost at runtime while concentrating every Konva
// import under `src/driver/konva/`.

export class KonvaCanvasDriver implements CanvasDriver {
	private constructor() {
		// Stages in this app routinely exceed Konva's recommended layer count.
		Konva.showWarnings = false;
	}

	static default = (): KonvaCanvasDriver => {
		return new KonvaCanvasDriver();
	};

	createStage = (opts: {
		readonly container: HTMLDivElement;
		readonly width: number;
		readonly height: number;
	}): DriverStage => {
		return new Konva.Stage({
			container: opts.container,
			height: opts.height,
			width: opts.width,
		}) as unknown as DriverStage;
	};

	createLayer = (opts?: LayerAttrs): DriverLayer => {
		return new Konva.Layer(opts) as unknown as DriverLayer;
	};

	createGroup = (opts?: GroupAttrs): DriverGroup => {
		return new Konva.Group(opts) as unknown as DriverGroup;
	};

	createRect = (opts?: RectAttrs): DriverRect => {
		return new Rect(opts) as unknown as DriverRect;
	};

	createLine = (opts?: LineAttrs): DriverLine => {
		return new Line(opts as never) as unknown as DriverLine;
	};

	createText = (opts?: TextAttrs): DriverText => {
		return new Text(opts) as unknown as DriverText;
	};

	createShape = (opts?: ShapeAttrs): DriverShape => {
		return new Konva.Shape(opts as never) as unknown as DriverShape;
	};

	createAnimation = (tick: () => void, layer: DriverLayer): DriverAnimation => {
		return new Animation(tick, layer as never) as unknown as DriverAnimation;
	};
}
