// Canvas driver abstraction. The high-level peaks.ts code consumes only
// these interfaces; concrete implementations (e.g. Konva) live under
// `src/driver/<name>/`.

export interface XY {
	readonly x: number;
	readonly y: number;
}

export type DragBoundFn = (pos: XY) => XY;

// Marker / event target. Used by `getMarkerObject` to bubble up the scene
// graph looking for a node with a `name` attribute.
export interface DriverEventTarget {
	readonly attrs?: Record<string, unknown>;
	parent?: DriverEventTarget | null;
	getAttr?: (name: string) => unknown;
}

export interface PeaksPointerEvent<TEvent extends Event = Event> {
	readonly evt: TEvent;
	readonly target: DriverEventTarget;
	readonly type: string;
	cancelBubble: boolean;
}

export type EventHandler<TEvent extends Event = Event> = (
	event: PeaksPointerEvent<TEvent>,
) => void;

// Base node. All scene-graph nodes provide these.
export interface DriverNode extends DriverEventTarget {
	on<E extends Event = Event>(event: string, handler: EventHandler<E>): void;
	off<E extends Event = Event>(event: string, handler?: EventHandler<E>): void;
	x(value?: number): number;
	y(value?: number): number;
	width(value?: number): number;
	height(value?: number): number;
	visible(value?: boolean): boolean;
	show(): void;
	hide(): void;
	destroy(): void;
	remove(): void;
	setAttrs(attrs: Record<string, unknown>): void;
	getAbsolutePosition(): XY;
	moveToTop(): void;
	getWidth(): number;
	// Test-friendly aliases that mirror Konva's auto-generated getters.
	getX(): number;
	getY(): number;
}

export interface DriverGroup extends DriverNode {
	add(child: DriverNode): void;
	destroyChildren(): void;
	draggable(value?: boolean): boolean;
	startDrag(): void;
	stopDrag(): void;
	clipWidth(value: number): void;
}

export interface DriverRect extends DriverNode {
	fill(value?: string | null): string | null;
	stroke(value?: string | null): string | null;
	// Test-friendly aliases that mirror Konva's auto-generated getters.
	getFill(): string | null;
	getStroke(): string | null;
	getStrokeWidth(): number;
	getOpacity(): number;
	getCornerRadius(): number | number[];
}

export interface DriverLine extends DriverNode {
	points(value?: readonly number[]): readonly number[];
	stroke(value?: string | null): string | null;
}

export interface DriverText extends DriverNode {
	text(value?: string): string;
	setText(value: string): void;
	fill(value?: string): string;
	// Test-friendly aliases that mirror Konva's auto-generated getters.
	getText(): string;
	// Override the default text rendering. The supplied callback receives
	// the canvas context and a `drawDefault` thunk that draws the text using
	// the underlying renderer's default behaviour.
	sceneFunc(fn: (ctx: DriverContext, drawDefault: () => void) => void): void;
}

// `DriverContext` exposes the subset of CanvasRenderingContext2D-like
// operations that custom shape `sceneFunc` callbacks need.
export interface DriverContext {
	fillStyle: string;
	beginPath(): void;
	closePath(): void;
	moveTo(x: number, y: number): void;
	lineTo(x: number, y: number): void;
	rect(x: number, y: number, w: number, h: number): void;
	fillRect(x: number, y: number, w: number, h: number): void;
	stroke(): void;
	fill(): void;
	setAttr(key: string, value: unknown): void;
	fillText(text: string, x: number, y: number): void;
	measureText(text: string): { readonly width: number };
	// Renders the supplied shape using its configured fill/stroke style.
	fillShape(shape: DriverShape): void;
}

export type SceneFunc = (ctx: DriverContext, shape: DriverShape) => void;

export interface DriverShape extends DriverNode {
	fill(value?: string | null): string | null;
	fillLinearGradientStartPointY(value?: number | null): number | null;
	fillLinearGradientEndPointY(value?: number | null): number | null;
	fillLinearGradientColorStops(
		value?: readonly (string | number)[] | null,
	): readonly (string | number)[] | null;
	sceneFunc(fn: SceneFunc): void;
}

export interface DriverLayer extends DriverNode {
	add(child: DriverNode): void;
	removeChildren(): void;
	draw(): void;
	getHeight(): number;
	listening(value?: boolean): boolean;
}

export interface DriverStage {
	add(layer: DriverLayer): void;
	on<E extends Event = Event>(event: string, handler: EventHandler<E>): void;
	off<E extends Event = Event>(event: string, handler?: EventHandler<E>): void;
	width(value?: number): number;
	height(value?: number): number;
	container(value?: HTMLDivElement): HTMLDivElement;
	destroy(): void;
}

export interface DriverAnimation {
	start(): void;
	stop(): void;
}

// ─── Attribute DTOs ────────────────────────────────────────────────────────

export interface RectAttrs {
	readonly x?: number;
	readonly y?: number;
	readonly width?: number;
	readonly height?: number;
	readonly fill?: string;
	readonly stroke?: string;
	readonly strokeWidth?: number;
	readonly opacity?: number;
	readonly cornerRadius?: number;
	readonly visible?: boolean;
	readonly listening?: boolean;
}

export interface LineAttrs {
	readonly x?: number;
	readonly y?: number;
	readonly points?: readonly number[];
	readonly stroke?: string;
	readonly strokeWidth?: number;
	readonly visible?: boolean;
}

export interface TextAttrs {
	readonly x?: number;
	readonly y?: number;
	readonly text?: string;
	readonly fill?: string;
	readonly fontFamily?: string;
	readonly fontSize?: number;
	readonly fontStyle?: string;
	readonly align?: string;
	readonly textAlign?: string;
	readonly verticalAlign?: string;
	readonly padding?: number;
	readonly height?: number;
	readonly width?: number;
	readonly visible?: boolean;
	readonly listening?: boolean;
}

export interface GroupAttrs {
	readonly x?: number;
	readonly y?: number;
	readonly width?: number;
	readonly height?: number;
	readonly visible?: boolean;
	readonly listening?: boolean;
	readonly name?: string;
	readonly draggable?: boolean;
	readonly dragBoundFunc?: DragBoundFn;
	readonly clipX?: number;
	readonly clipY?: number;
	readonly clipWidth?: number;
	readonly clipHeight?: number;
	// Allow arbitrary attribute bags so callers can stash domain payloads
	// (e.g. `segment`, `point`) on the node, matching Konva's behaviour.
	readonly [key: string]: unknown;
}

export interface LayerAttrs {
	readonly listening?: boolean;
	readonly visible?: boolean;
}

export interface ShapeAttrs {
	readonly x?: number;
	readonly y?: number;
	readonly fill?: string | null;
	readonly fillLinearGradientStartPointY?: number;
	readonly fillLinearGradientEndPointY?: number;
	readonly fillLinearGradientColorStops?: readonly (string | number)[];
	readonly fontFamily?: string;
	readonly fontSize?: number;
	readonly fontStyle?: string;
	readonly text?: string;
	readonly padding?: number;
	readonly align?: string;
	readonly sceneFunc?: SceneFunc;
}

// ─── Driver factory ────────────────────────────────────────────────────────

export interface CanvasDriver {
	createStage(opts: {
		readonly container: HTMLDivElement;
		readonly width: number;
		readonly height: number;
	}): DriverStage;
	createLayer(opts?: LayerAttrs): DriverLayer;
	createGroup(opts?: GroupAttrs): DriverGroup;
	createRect(opts?: RectAttrs): DriverRect;
	createLine(opts?: LineAttrs): DriverLine;
	createText(opts?: TextAttrs): DriverText;
	createShape(opts?: ShapeAttrs): DriverShape;
	createAnimation(tick: () => void, layer: DriverLayer): DriverAnimation;
}
