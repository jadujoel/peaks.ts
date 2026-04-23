import { Animation } from "konva/lib/Animation";
import type { Context as KonvaContext } from "konva/lib/Context";
import Konva from "konva/lib/Core";
import type { Group as KonvaGroup } from "konva/lib/Group";
import type { Layer as KonvaLayer } from "konva/lib/Layer";
import type { Node as KonvaNode } from "konva/lib/Node";
import type { Shape as KonvaShape } from "konva/lib/Shape";
import type { Stage as KonvaStage } from "konva/lib/Stage";
import { Line } from "konva/lib/shapes/Line";
import { Rect } from "konva/lib/shapes/Rect";
import { Text } from "konva/lib/shapes/Text";
import type {
	CanvasDriver,
	DriverAnimation,
	DriverContext,
	DriverEventTarget,
	DriverGroup,
	DriverLayer,
	DriverLine,
	DriverNode,
	DriverRect,
	DriverShape,
	DriverStage,
	DriverText,
	EventHandler,
	GroupAttrs,
	LayerAttrs,
	LineAttrs,
	RectAttrs,
	SceneFunc,
	ShapeAttrs,
	TextAttrs,
	XY,
} from "../types";

// All Konva-specific types are isolated in this file. Wrapper classes
// adapt Konva's runtime objects to the driver-agnostic interfaces in
// `../types`, so the rest of the codebase never touches a Konva symbol.

// ─── Internal helpers ──────────────────────────────────────────────────────

// Returns true for a value that quacks like a Konva.Node — has `getStage`
// and `getLayer` methods. Custom marker factories may construct raw Konva
// objects directly and hand them back through `PeaksNode.from`, so the
// driver accepts both wrapped and raw Konva nodes.
function isKonvaNode(value: unknown): value is KonvaNode {
	return (
		typeof value === "object" &&
		value !== null &&
		typeof (value as { getStage?: unknown }).getStage === "function" &&
		typeof (value as { getLayer?: unknown }).getLayer === "function"
	);
}

function unwrapNode<TNode extends KonvaNode>(node: DriverNode): TNode {
	if (node instanceof KonvaDriverNode) {
		return node.konvaNode as unknown as TNode;
	}
	if (isKonvaNode(node)) {
		return node as unknown as TNode;
	}
	throw new Error("driver node was not produced by KonvaCanvasDriver");
}

function unwrapLayer(layer: DriverLayer): KonvaLayer {
	if (layer instanceof KonvaDriverLayer) {
		return layer.konvaLayer;
	}
	if (isKonvaNode(layer)) {
		return layer as unknown as KonvaLayer;
	}
	throw new Error("driver layer was not produced by KonvaCanvasDriver");
}

function colorToString(value: string | CanvasGradient | undefined): string {
	return typeof value === "string" ? value : "";
}

function colorToStringOrNull(
	value: string | CanvasGradient | undefined,
): string | null {
	return typeof value === "string" ? value : null;
}

// ─── Node base ─────────────────────────────────────────────────────────────

abstract class KonvaDriverNode<TNode extends KonvaNode = KonvaNode>
	implements DriverNode
{
	protected constructor(protected readonly node: TNode) {}

	get konvaNode(): TNode {
		return this.node;
	}

	get attrs(): Record<string, unknown> {
		return this.node.attrs as Record<string, unknown>;
	}

	get parent(): DriverEventTarget | null {
		return (this.node.parent as DriverEventTarget | null) ?? null;
	}

	on<E extends Event = Event>(event: string, handler: EventHandler<E>): void {
		this.node.on(event, handler as never);
	}

	off<E extends Event = Event>(event: string, handler?: EventHandler<E>): void {
		this.node.off(event, handler as never);
	}

	x(value?: number): number {
		if (value === undefined) {
			return this.node.x();
		}
		this.node.x(value);
		return this.node.x();
	}

	y(value?: number): number {
		if (value === undefined) {
			return this.node.y();
		}
		this.node.y(value);
		return this.node.y();
	}

	width(value?: number): number {
		if (value === undefined) {
			return this.node.width();
		}
		this.node.width(value);
		return this.node.width();
	}

	height(value?: number): number {
		if (value === undefined) {
			return this.node.height();
		}
		this.node.height(value);
		return this.node.height();
	}

	visible(value?: boolean): boolean {
		if (value === undefined) {
			return this.node.visible();
		}
		this.node.visible(value);
		return this.node.visible();
	}

	show(): void {
		this.node.show();
	}

	hide(): void {
		this.node.hide();
	}

	destroy(): void {
		this.node.destroy();
	}

	remove(): void {
		this.node.remove();
	}

	setAttrs(attrs: Record<string, unknown>): void {
		this.node.setAttrs(attrs);
	}

	getAbsolutePosition(): XY {
		const pos = this.node.getAbsolutePosition();
		return { x: pos.x, y: pos.y };
	}

	moveToTop(): void {
		this.node.moveToTop();
	}

	getWidth(): number {
		return this.node.width();
	}

	getX(): number {
		return this.node.x();
	}

	getY(): number {
		return this.node.y();
	}

	getAttr(name: string): unknown {
		return this.node.getAttr(name);
	}
}

// ─── Group ─────────────────────────────────────────────────────────────────

export class KonvaDriverGroup
	extends KonvaDriverNode<KonvaGroup>
	implements DriverGroup
{
	protected constructor(node: KonvaGroup) {
		super(node);
	}

	static from(node: KonvaGroup): KonvaDriverGroup {
		return new KonvaDriverGroup(node);
	}

	static fromOpts(opts?: GroupAttrs): KonvaDriverGroup {
		return new KonvaDriverGroup(new Konva.Group(opts as never));
	}

	add(child: DriverNode): void {
		this.node.add(unwrapNode<KonvaGroup | KonvaShape>(child));
	}

	destroyChildren(): void {
		this.node.destroyChildren();
	}

	draggable(value?: boolean): boolean {
		if (value === undefined) {
			return this.node.draggable();
		}
		this.node.draggable(value);
		return this.node.draggable();
	}

	startDrag(): void {
		this.node.startDrag();
	}

	stopDrag(): void {
		this.node.stopDrag();
	}

	clipWidth(value: number): void {
		this.node.clipWidth(value);
	}
}

// ─── Layer ─────────────────────────────────────────────────────────────────

export class KonvaDriverLayer
	extends KonvaDriverNode<KonvaLayer>
	implements DriverLayer
{
	protected constructor(node: KonvaLayer) {
		super(node);
	}

	static from(node: KonvaLayer): KonvaDriverLayer {
		return new KonvaDriverLayer(node);
	}

	static fromOpts(opts?: LayerAttrs): KonvaDriverLayer {
		return new KonvaDriverLayer(new Konva.Layer(opts));
	}

	get konvaLayer(): KonvaLayer {
		return this.node;
	}

	add(child: DriverNode): void {
		this.node.add(unwrapNode<KonvaGroup | KonvaShape>(child));
	}

	removeChildren(): void {
		this.node.removeChildren();
	}

	draw(): void {
		this.node.draw();
	}

	getHeight(): number {
		return this.node.height();
	}

	listening(value?: boolean): boolean {
		if (value === undefined) {
			return this.node.listening();
		}
		this.node.listening(value);
		return this.node.listening();
	}
}

// ─── Rect ──────────────────────────────────────────────────────────────────

export class KonvaDriverRect
	extends KonvaDriverNode<Rect>
	implements DriverRect
{
	protected constructor(node: Rect) {
		super(node);
	}

	static fromOpts(opts?: RectAttrs): KonvaDriverRect {
		return new KonvaDriverRect(new Rect(opts));
	}

	fill(value?: string | null): string | null {
		if (value === undefined) {
			return colorToStringOrNull(this.node.fill());
		}
		this.node.fill(value as string);
		return colorToStringOrNull(this.node.fill());
	}

	stroke(value?: string | null): string | null {
		if (value === undefined) {
			return colorToStringOrNull(this.node.stroke());
		}
		this.node.stroke(value as string);
		return colorToStringOrNull(this.node.stroke());
	}

	getFill(): string | null {
		return colorToStringOrNull(this.node.fill());
	}

	getStroke(): string | null {
		return colorToStringOrNull(this.node.stroke());
	}

	getStrokeWidth(): number {
		return this.node.strokeWidth();
	}

	getOpacity(): number {
		return this.node.opacity();
	}

	getCornerRadius(): number | number[] {
		return this.node.cornerRadius();
	}
}

// ─── Line ──────────────────────────────────────────────────────────────────

export class KonvaDriverLine
	extends KonvaDriverNode<Line>
	implements DriverLine
{
	protected constructor(node: Line) {
		super(node);
	}

	static fromOpts(opts?: LineAttrs): KonvaDriverLine {
		return new KonvaDriverLine(new Line(opts as never));
	}

	points(value?: readonly number[]): readonly number[] {
		if (value === undefined) {
			return this.node.points();
		}
		this.node.points(value as number[]);
		return this.node.points();
	}

	stroke(value?: string | null): string | null {
		if (value === undefined) {
			return colorToStringOrNull(this.node.stroke());
		}
		this.node.stroke(value as string);
		return colorToStringOrNull(this.node.stroke());
	}
}

// ─── Text ──────────────────────────────────────────────────────────────────

export class KonvaDriverText
	extends KonvaDriverNode<Text>
	implements DriverText
{
	protected constructor(node: Text) {
		super(node);
	}

	static fromOpts(opts?: TextAttrs): KonvaDriverText {
		return new KonvaDriverText(new Text(opts));
	}

	text(value?: string): string {
		if (value === undefined) {
			return this.node.text();
		}
		this.node.text(value);
		return this.node.text();
	}

	setText(value: string): void {
		this.node.setText(value);
	}

	fill(value?: string): string {
		if (value === undefined) {
			return colorToString(this.node.fill());
		}
		this.node.fill(value);
		return colorToString(this.node.fill());
	}

	getText(): string {
		return this.node.text();
	}

	sceneFunc(fn: (ctx: DriverContext, drawDefault: () => void) => void): void {
		// Capture Konva's default text-drawing scene function so the caller
		// can compose it (e.g. fill a background then render the text).
		const defaultSceneFunc = (
			this.node as unknown as {
				_sceneFunc: (ctx: KonvaContext) => void;
			}
		)._sceneFunc;
		this.node.sceneFunc((ctx: KonvaContext) => {
			fn(KonvaDriverContext.from(ctx), () => {
				defaultSceneFunc.call(this.node, ctx);
			});
		});
	}
}

// ─── Shape ─────────────────────────────────────────────────────────────────

export class KonvaDriverShape
	extends KonvaDriverNode<KonvaShape>
	implements DriverShape
{
	protected constructor(node: KonvaShape) {
		super(node);
	}

	static fromOpts(opts?: ShapeAttrs): KonvaDriverShape {
		const wrapper = new KonvaDriverShape(new Konva.Shape(opts as never));
		// `opts.sceneFunc` carries the driver-typed signature; rebind through
		// the wrapper so Konva sees a callback expecting `KonvaContext`.
		if (opts?.sceneFunc !== undefined) {
			wrapper.sceneFunc(opts.sceneFunc);
		}
		return wrapper;
	}

	fill(value?: string | null): string | null {
		if (value === undefined) {
			return colorToStringOrNull(this.node.fill());
		}
		this.node.fill(value as string);
		return colorToStringOrNull(this.node.fill());
	}

	fillLinearGradientStartPointY(value?: number | null): number | null {
		if (value === undefined) {
			return this.node.fillLinearGradientStartPointY() ?? null;
		}
		this.node.fillLinearGradientStartPointY(value as number);
		return this.node.fillLinearGradientStartPointY() ?? null;
	}

	fillLinearGradientEndPointY(value?: number | null): number | null {
		if (value === undefined) {
			return this.node.fillLinearGradientEndPointY() ?? null;
		}
		this.node.fillLinearGradientEndPointY(value as number);
		return this.node.fillLinearGradientEndPointY() ?? null;
	}

	fillLinearGradientColorStops(
		value?: readonly (string | number)[] | null,
	): readonly (string | number)[] | null {
		if (value === undefined) {
			return this.node.fillLinearGradientColorStops() ?? null;
		}
		this.node.fillLinearGradientColorStops(value as (string | number)[]);
		return this.node.fillLinearGradientColorStops() ?? null;
	}

	sceneFunc(fn: SceneFunc): void {
		this.node.sceneFunc((ctx: KonvaContext) => {
			fn(KonvaDriverContext.from(ctx), this);
		});
	}
}

// ─── Stage ─────────────────────────────────────────────────────────────────

export interface KonvaDriverStageFromOpts {
	readonly container: HTMLDivElement;
	readonly width: number;
	readonly height: number;
}

export class KonvaDriverStage implements DriverStage {
	private constructor(private readonly stage: KonvaStage) {}

	static from(stage: KonvaStage): KonvaDriverStage {
		return new KonvaDriverStage(stage);
	}

	static fromOpts(opts: KonvaDriverStageFromOpts): KonvaDriverStage {
		return new KonvaDriverStage(
			new Konva.Stage({
				container: opts.container,
				height: opts.height,
				width: opts.width,
			}),
		);
	}

	add(layer: DriverLayer): void {
		this.stage.add(unwrapLayer(layer));
	}

	on<E extends Event = Event>(event: string, handler: EventHandler<E>): void {
		const wrapped = (evt: unknown): void => {
			handler(this.adaptEvent(evt) as never);
		};
		(handler as unknown as { __wrapped?: unknown }).__wrapped = wrapped;
		this.stage.on(event, wrapped as never);
	}

	off<E extends Event = Event>(event: string, handler?: EventHandler<E>): void {
		if (handler === undefined) {
			this.stage.off(event);
			return;
		}
		const wrapped = (handler as unknown as { __wrapped?: unknown }).__wrapped;
		this.stage.off(event, (wrapped ?? handler) as never);
	}

	private adaptEvent(evt: unknown): unknown {
		const source = evt as { target?: unknown };
		if (source && source.target === this.stage) {
			return new Proxy(source as object, {
				get: (obj, prop) => {
					if (prop === "target") {
						return this;
					}
					return (obj as Record<string | symbol, unknown>)[prop];
				},
			});
		}
		return evt;
	}

	width(value?: number): number {
		if (value === undefined) {
			return this.stage.width();
		}
		this.stage.width(value);
		return this.stage.width();
	}

	height(value?: number): number {
		if (value === undefined) {
			return this.stage.height();
		}
		this.stage.height(value);
		return this.stage.height();
	}

	container(value?: HTMLDivElement): HTMLDivElement {
		if (value === undefined) {
			return this.stage.container();
		}
		this.stage.container(value);
		return this.stage.container();
	}

	destroy(): void {
		this.stage.destroy();
	}
}

// ─── Animation ─────────────────────────────────────────────────────────────

export class KonvaDriverAnimation implements DriverAnimation {
	private constructor(private readonly animation: Animation) {}

	static fromOpts(tick: () => void, layer: DriverLayer): KonvaDriverAnimation {
		return new KonvaDriverAnimation(new Animation(tick, unwrapLayer(layer)));
	}

	start(): void {
		this.animation.start();
	}

	stop(): void {
		this.animation.stop();
	}
}

// ─── Context (used inside sceneFunc callbacks) ─────────────────────────────

export class KonvaDriverContext implements DriverContext {
	private constructor(private readonly ctx: KonvaContext) {}

	static from(ctx: KonvaContext): KonvaDriverContext {
		return new KonvaDriverContext(ctx);
	}

	get fillStyle(): string {
		const value = this.ctx._context.fillStyle;
		return typeof value === "string" ? value : "";
	}

	set fillStyle(value: string) {
		this.ctx.setAttr("fillStyle", value);
	}

	beginPath(): void {
		this.ctx.beginPath();
	}

	closePath(): void {
		this.ctx.closePath();
	}

	moveTo(x: number, y: number): void {
		this.ctx.moveTo(x, y);
	}

	lineTo(x: number, y: number): void {
		this.ctx.lineTo(x, y);
	}

	rect(x: number, y: number, w: number, h: number): void {
		this.ctx.rect(x, y, w, h);
	}

	fillRect(x: number, y: number, w: number, h: number): void {
		this.ctx.fillRect(x, y, w, h);
	}

	stroke(): void {
		this.ctx.stroke();
	}

	fill(): void {
		this.ctx.fill();
	}

	setAttr(key: string, value: unknown): void {
		this.ctx.setAttr(key, value);
	}

	fillText(text: string, x: number, y: number): void {
		this.ctx.fillText(text, x, y);
	}

	measureText(text: string): { readonly width: number } {
		const metrics = this.ctx.measureText(text);
		return { width: metrics.width };
	}

	fillShape(shape: DriverShape): void {
		this.ctx.fillShape(unwrapNode<KonvaShape>(shape));
	}
}

// ─── Driver factory ────────────────────────────────────────────────────────

export class KonvaCanvasDriver implements CanvasDriver {
	private constructor() {}

	static default(): KonvaCanvasDriver {
		// Stages in this app routinely exceed Konva's recommended layer count.
		Konva.showWarnings = false;
		return new KonvaCanvasDriver();
	}

	createStage = (opts: KonvaDriverStageFromOpts): DriverStage => {
		return KonvaDriverStage.fromOpts(opts);
	};

	createLayer = (opts?: LayerAttrs): DriverLayer => {
		return KonvaDriverLayer.fromOpts(opts);
	};

	createGroup = (opts?: GroupAttrs): DriverGroup => {
		return KonvaDriverGroup.fromOpts(opts);
	};

	createRect = (opts?: RectAttrs): DriverRect => {
		return KonvaDriverRect.fromOpts(opts);
	};

	createLine = (opts?: LineAttrs): DriverLine => {
		return KonvaDriverLine.fromOpts(opts);
	};

	createText = (opts?: TextAttrs): DriverText => {
		return KonvaDriverText.fromOpts(opts);
	};

	createShape = (opts?: ShapeAttrs): DriverShape => {
		return KonvaDriverShape.fromOpts(opts);
	};

	createAnimation = (tick: () => void, layer: DriverLayer): DriverAnimation => {
		return KonvaDriverAnimation.fromOpts(tick, layer);
	};
}
