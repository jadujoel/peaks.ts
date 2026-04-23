import {
	Application,
	Container,
	type FederatedPointerEvent,
	FillGradient,
	Graphics,
	Text,
	TextStyle,
	Ticker,
} from "pixi.js";
import type {
	CanvasDriver,
	DragBoundFn,
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
	PeaksPointerEvent,
	RectAttrs,
	SceneFunc,
	ShapeAttrs,
	TextAttrs,
	XY,
} from "../types";

// ─── Internal helpers ──────────────────────────────────────────────────────

// Domain-payload bag (segment, point, name, …) attached to a Container.
// Pixi containers don't have an `attrs` map like Konva nodes; the driver
// stores them on a WeakMap so wrappers can expose `attrs` / `getAttr`.
const ATTRS = new WeakMap<Container, Record<string, unknown>>();

function attrsOf(container: Container): Record<string, unknown> {
	let bag = ATTRS.get(container);
	if (!bag) {
		bag = {};
		ATTRS.set(container, bag);
	}
	return bag;
}

function unwrapNode(node: DriverNode): Container {
	if (node instanceof PixiDriverNode) {
		return node.container;
	}
	throw new Error("driver node was not produced by PixiCanvasDriver");
}

function unwrapLayer(layer: DriverLayer): PixiDriverLayer {
	if (layer instanceof PixiDriverLayer) {
		return layer;
	}
	throw new Error("driver layer was not produced by PixiCanvasDriver");
}

// ─── Stage host (one shared per stage) ─────────────────────────────────────

// Per-stage owner of the Pixi `Application`. The Pixi v8 renderer init is
// async; the driver hides that by appending a placeholder canvas
// synchronously and queueing draws/event subscriptions until init resolves.
class PixiStageHost {
	readonly app: Application;
	readonly canvas: HTMLCanvasElement;
	readonly ready: Promise<void>;
	readyResolved = false;
	private pendingDraw = false;
	readonly drag: DragController;
	readonly stageContainer: Container;

	constructor(
		readonly hostElement: HTMLDivElement,
		width: number,
		height: number,
	) {
		this.canvas = document.createElement("canvas");
		this.canvas.width = width;
		this.canvas.height = height;
		this.canvas.style.width = `${width}px`;
		this.canvas.style.height = `${height}px`;
		this.canvas.style.display = "block";
		hostElement.appendChild(this.canvas);

		this.app = new Application();
		this.stageContainer = this.app.stage;
		this.stageContainer.eventMode = "static";
		this.drag = new DragController(this);

		this.ready = this.app
			.init({
				autoStart: false,
				backgroundAlpha: 0,
				canvas: this.canvas,
				height,
				preference: "webgl",
				resolution: window.devicePixelRatio || 1,
				width,
			})
			.then(() => {
				this.readyResolved = true;
				this.app.ticker.autoStart = false;
				this.app.ticker.stop();
				this.drag.bind();
				if (this.pendingDraw) {
					this.pendingDraw = false;
					this.app.renderer.render(this.app.stage);
				}
			});
	}

	render(): void {
		if (!this.readyResolved) {
			this.pendingDraw = true;
			return;
		}
		this.app.renderer.render(this.app.stage);
	}

	resize(width: number, height: number): void {
		this.canvas.style.width = `${width}px`;
		this.canvas.style.height = `${height}px`;
		if (this.readyResolved) {
			this.app.renderer.resize(width, height);
			this.render();
		} else {
			this.canvas.width = width;
			this.canvas.height = height;
		}
	}

	destroy(): void {
		this.drag.unbind();
		const finalize = (): void => {
			try {
				this.app.destroy({ removeView: true }, true);
			} catch {
				// ignore double-destroy
			}
			if (this.canvas.parentElement === this.hostElement) {
				this.hostElement.removeChild(this.canvas);
			}
		};
		if (this.readyResolved) {
			finalize();
		} else {
			void this.ready.then(finalize, finalize);
		}
	}
}

// ─── Drag controller ───────────────────────────────────────────────────────

interface DragState {
	group: PixiDriverGroup;
	pointerStart: XY;
	nodeStart: XY;
	pointerId: number;
	dragging: boolean;
}

class DragController {
	private state: DragState | undefined = undefined;
	private bound = false;

	constructor(private readonly host: PixiStageHost) {}

	bind(): void {
		if (this.bound) {
			return;
		}
		this.bound = true;
		// `globalpointermove` fires regardless of hit target; we filter
		// on whether a drag is in progress.
		this.host.stageContainer.on("globalpointermove", this.onMove);
		this.host.stageContainer.on("pointerup", this.onUp);
		this.host.stageContainer.on("pointerupoutside", this.onUp);
		this.host.stageContainer.on("pointercancel", this.onUp);
	}

	unbind(): void {
		if (!this.bound) {
			return;
		}
		this.bound = false;
		this.host.stageContainer.off("globalpointermove", this.onMove);
		this.host.stageContainer.off("pointerup", this.onUp);
		this.host.stageContainer.off("pointerupoutside", this.onUp);
		this.host.stageContainer.off("pointercancel", this.onUp);
	}

	begin(group: PixiDriverGroup, event: FederatedPointerEvent): void {
		const global = event.global;
		this.state = {
			dragging: false,
			group,
			nodeStart: { x: group.container.x, y: group.container.y },
			pointerId: event.pointerId,
			pointerStart: { x: global.x, y: global.y },
		};
	}

	startProgrammatic(group: PixiDriverGroup): void {
		// `Group.startDrag()` is called from `insert-segment-mouse-drag-handler`
		// without a real pointerdown. Synthesize a no-op state that a
		// subsequent pointermove will turn into a real drag.
		this.state = {
			dragging: false,
			group,
			nodeStart: { x: group.container.x, y: group.container.y },
			pointerId: -1,
			pointerStart: { x: 0, y: 0 },
		};
	}

	stopProgrammatic(group: PixiDriverGroup): void {
		if (this.state && this.state.group === group) {
			if (this.state.dragging) {
				this.fire("dragend", group);
			}
			this.state = undefined;
		}
	}

	private onMove = (event: FederatedPointerEvent): void => {
		const state = this.state;
		if (!state) {
			return;
		}
		const dx = event.global.x - state.pointerStart.x;
		const dy = event.global.y - state.pointerStart.y;

		if (!state.dragging) {
			if (state.pointerId === -1) {
				// Programmatic start: latch position to current pointer.
				state.pointerStart = { x: event.global.x, y: event.global.y };
				state.pointerId = event.pointerId;
				return;
			}
			if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
				return;
			}
			state.dragging = true;
			this.fire("dragstart", state.group);
		}

		let next: XY = {
			x: state.nodeStart.x + dx,
			y: state.nodeStart.y + dy,
		};
		const bound = state.group.dragBoundFunc;
		if (bound) {
			next = bound(next);
		}
		state.group.container.x = next.x;
		state.group.container.y = next.y;
		this.fire("dragmove", state.group);
	};

	private onUp = (_event: FederatedPointerEvent): void => {
		const state = this.state;
		if (!state) {
			return;
		}
		if (state.dragging) {
			this.fire("dragend", state.group);
		}
		this.state = undefined;
	};

	private fire(type: string, group: PixiDriverGroup): void {
		group.dispatch(type, {
			cancelBubble: false,
			evt: new Event(type),
			target: group,
			type,
		});
	}
}

// ─── Event adapter ─────────────────────────────────────────────────────────

function adaptEvent(
	target: DriverEventTarget,
	type: string,
	event: Event,
): PeaksPointerEvent {
	const wrapper: PeaksPointerEvent = {
		get cancelBubble(): boolean {
			return Boolean((event as { cancelBubble?: boolean }).cancelBubble);
		},
		set cancelBubble(value: boolean) {
			if (value) {
				const fed = event as { stopPropagation?: () => void };
				fed.stopPropagation?.();
			}
		},
		evt: event,
		target,
		type,
	};
	return wrapper;
}

// ─── Node base ─────────────────────────────────────────────────────────────

abstract class PixiDriverNode<TContainer extends Container = Container>
	implements DriverNode
{
	protected width_ = 0;
	protected height_ = 0;
	protected listeners = new Map<
		string,
		Map<EventHandler, (evt: unknown) => void>
	>();

	protected constructor(public readonly container: TContainer) {}

	get attrs(): Record<string, unknown> {
		return attrsOf(this.container);
	}

	get parent(): DriverEventTarget | null {
		const parent = this.container.parent;
		if (!parent) {
			return null;
		}
		const wrapper = WRAPPERS.get(parent);
		return (wrapper ?? parent) as DriverEventTarget;
	}

	getAttr(name: string): unknown {
		return attrsOf(this.container)[name];
	}

	on<E extends Event = Event>(event: string, handler: EventHandler<E>): void {
		const wrapped = (evt: unknown): void => {
			const adapted = adaptEvent(
				this,
				event,
				(evt as Event) ?? new Event(event),
			);
			(handler as EventHandler)(adapted);
		};
		let map = this.listeners.get(event);
		if (!map) {
			map = new Map();
			this.listeners.set(event, map);
		}
		map.set(handler as EventHandler, wrapped);
		this.container.on(event, wrapped as never);
	}

	off<E extends Event = Event>(event: string, handler?: EventHandler<E>): void {
		const map = this.listeners.get(event);
		if (!map) {
			return;
		}
		if (handler) {
			const wrapped = map.get(handler as EventHandler);
			if (wrapped) {
				this.container.off(event, wrapped as never);
				map.delete(handler as EventHandler);
			}
			return;
		}
		for (const wrapped of map.values()) {
			this.container.off(event, wrapped as never);
		}
		map.clear();
	}

	x(value?: number): number {
		if (value === undefined) {
			return this.container.x;
		}
		this.container.x = value;
		return this.container.x;
	}

	y(value?: number): number {
		if (value === undefined) {
			return this.container.y;
		}
		this.container.y = value;
		return this.container.y;
	}

	width(value?: number): number {
		if (value === undefined) {
			return this.width_;
		}
		this.width_ = value;
		this.applyWidth(value);
		return this.width_;
	}

	height(value?: number): number {
		if (value === undefined) {
			return this.height_;
		}
		this.height_ = value;
		this.applyHeight(value);
		return this.height_;
	}

	protected applyWidth(_value: number): void {
		// Subclasses override when the width affects the drawn primitive.
	}

	protected applyHeight(_value: number): void {
		// Subclasses override when the height affects the drawn primitive.
	}

	visible(value?: boolean): boolean {
		if (value === undefined) {
			return this.container.visible;
		}
		this.container.visible = value;
		return this.container.visible;
	}

	show(): void {
		this.container.visible = true;
	}

	hide(): void {
		this.container.visible = false;
	}

	destroy(): void {
		WRAPPERS.delete(this.container);
		this.container.destroy({ children: true });
	}

	remove(): void {
		this.container.parent?.removeChild(this.container);
	}

	setAttrs(attrs: Record<string, unknown>): void {
		const bag = attrsOf(this.container);
		for (const [key, value] of Object.entries(attrs)) {
			bag[key] = value;
			this.applyAttr(key, value);
		}
	}

	protected applyAttr(key: string, value: unknown): void {
		switch (key) {
			case "x":
				if (typeof value === "number") {
					this.container.x = value;
				}
				return;
			case "y":
				if (typeof value === "number") {
					this.container.y = value;
				}
				return;
			case "visible":
				if (typeof value === "boolean") {
					this.container.visible = value;
				}
				return;
			case "width":
				if (typeof value === "number") {
					this.width(value);
				}
				return;
			case "height":
				if (typeof value === "number") {
					this.height(value);
				}
				return;
			case "listening":
				if (typeof value === "boolean") {
					this.container.eventMode = value ? "static" : "none";
				}
				return;
			default:
				return;
		}
	}

	getAbsolutePosition(): XY {
		const point = this.container.getGlobalPosition();
		return { x: point.x, y: point.y };
	}

	moveToTop(): void {
		const parent = this.container.parent;
		if (!parent) {
			return;
		}
		parent.setChildIndex(this.container, parent.children.length - 1);
	}

	getWidth(): number {
		return this.width_;
	}

	getX(): number {
		return this.container.x;
	}

	getY(): number {
		return this.container.y;
	}
}

// Reverse map used by parent traversal so `getMarkerObject` walks the
// driver wrappers (which carry `attrs`/`getAttr`) rather than raw Pixi
// Containers.
const WRAPPERS = new WeakMap<Container, PixiDriverNode>();

function registerWrapper(wrapper: PixiDriverNode): void {
	WRAPPERS.set(wrapper.container, wrapper);
}

// Walk the container tree and re-run the scene functions of any shapes
// found. Konva re-evaluates `sceneFunc` on every draw cycle; we mirror
// that semantic so that shapes whose state changes between draws (or
// whose closures captured uninitialized state at construction time)
// are repainted at the right moment.
function runShapesIn(container: Container): void {
	const wrapper = WRAPPERS.get(container) as
		| (PixiDriverNode & { runScene?: () => void })
		| undefined;
	if (wrapper && typeof wrapper.runScene === "function") {
		wrapper.runScene();
	}
	for (const child of container.children) {
		if (child instanceof Container) {
			runShapesIn(child);
		}
	}
}

// ─── Group ─────────────────────────────────────────────────────────────────

export class PixiDriverGroup extends PixiDriverNode implements DriverGroup {
	dragBoundFunc: DragBoundFn | undefined = undefined;
	private isDraggable = false;
	private host: PixiStageHost | undefined = undefined;
	private maskRect: Graphics | undefined = undefined;

	private constructor(container: Container) {
		super(container);
		registerWrapper(this);
	}

	static fromOpts(opts?: GroupAttrs): PixiDriverGroup {
		const container = new Container();
		const group = new PixiDriverGroup(container);
		if (opts) {
			group.setAttrs({ ...opts });
		}
		return group;
	}

	add(child: DriverNode): void {
		const childContainer = unwrapNode(child);
		this.container.addChild(childContainer);
	}

	destroyChildren(): void {
		while (this.container.children.length > 0) {
			const child = this.container.children[0];
			if (!child) {
				break;
			}
			child.destroy({ children: true });
		}
	}

	draggable(value?: boolean): boolean {
		if (value === undefined) {
			return this.isDraggable;
		}
		this.isDraggable = value;
		this.container.eventMode = value ? "static" : "passive";
		if (value) {
			this.container.on("pointerdown", this.onPointerDown);
		} else {
			this.container.off("pointerdown", this.onPointerDown);
		}
		return this.isDraggable;
	}

	startDrag(): void {
		if (this.host) {
			this.host.drag.startProgrammatic(this);
		}
	}

	stopDrag(): void {
		if (this.host) {
			this.host.drag.stopProgrammatic(this);
		}
	}

	clipWidth(value: number): void {
		const height = this.height_ || 1;
		if (!this.maskRect) {
			this.maskRect = new Graphics();
			this.container.addChild(this.maskRect);
			this.container.mask = this.maskRect;
		}
		this.maskRect.clear().rect(0, 0, value, height).fill({ color: 0xffffff });
	}

	dispatch(type: string, event: PeaksPointerEvent): void {
		const map = this.listeners.get(type);
		if (!map) {
			return;
		}
		for (const wrapped of map.values()) {
			wrapped(event);
		}
	}

	bindHost(host: PixiStageHost): void {
		this.host = host;
	}

	protected override applyAttr(key: string, value: unknown): void {
		super.applyAttr(key, value);
		if (key === "draggable" && typeof value === "boolean") {
			this.draggable(value);
		} else if (key === "dragBoundFunc" && typeof value === "function") {
			this.dragBoundFunc = value as DragBoundFn;
		} else if (key === "clipWidth" && typeof value === "number") {
			this.clipWidth(value);
		} else if (
			key !== "x" &&
			key !== "y" &&
			key !== "visible" &&
			key !== "width" &&
			key !== "height" &&
			key !== "listening"
		) {
			// Domain payloads (`segment`, `point`, `name`, …) live in the attrs
			// bag; nothing further to do.
		}
	}

	private onPointerDown = (event: FederatedPointerEvent): void => {
		if (!this.host) {
			// Walk up to find the stage host. The group may have been added
			// to a layer that's been added to a stage after `draggable(true)`
			// was called, so resolve lazily here.
			let parent: Container | null = this.container.parent;
			while (parent) {
				const host = STAGE_HOSTS.get(parent);
				if (host) {
					this.host = host;
					break;
				}
				parent = parent.parent;
			}
		}
		if (this.host) {
			this.host.drag.begin(this, event);
		}
	};
}

// ─── Layer ─────────────────────────────────────────────────────────────────

const STAGE_HOSTS = new WeakMap<Container, PixiStageHost>();

export class PixiDriverLayer extends PixiDriverNode implements DriverLayer {
	private host: PixiStageHost | undefined = undefined;

	private constructor(container: Container) {
		super(container);
		registerWrapper(this);
	}

	static fromOpts(opts?: LayerAttrs): PixiDriverLayer {
		const container = new Container();
		container.eventMode = "passive";
		const layer = new PixiDriverLayer(container);
		if (opts) {
			if (opts.listening !== undefined) {
				layer.listening(opts.listening);
			}
			if (opts.visible !== undefined) {
				layer.visible(opts.visible);
			}
		}
		return layer;
	}

	bindHost(host: PixiStageHost): void {
		this.host = host;
		this.height_ = host.canvas.height;
		// Propagate to children groups so they can hand off drags.
		this.propagateHost(this.container);
	}

	private propagateHost(node: Container): void {
		const wrapper = WRAPPERS.get(node);
		if (wrapper instanceof PixiDriverGroup && this.host) {
			wrapper.bindHost(this.host);
		}
		for (const child of node.children) {
			this.propagateHost(child as Container);
		}
	}

	add(child: DriverNode): void {
		const childContainer = unwrapNode(child);
		this.container.addChild(childContainer);
		if (this.host) {
			const wrapper = WRAPPERS.get(childContainer);
			if (wrapper instanceof PixiDriverGroup) {
				wrapper.bindHost(this.host);
			}
		}
	}

	removeChildren(): void {
		while (this.container.children.length > 0) {
			this.container.removeChildAt(0);
		}
	}

	draw(): void {
		runShapesIn(this.container);
		this.host?.render();
	}

	getHeight(): number {
		return this.height_;
	}

	listening(value?: boolean): boolean {
		if (value === undefined) {
			return this.container.eventMode !== "none";
		}
		this.container.eventMode = value ? "passive" : "none";
		return value;
	}
}

// ─── Rect ──────────────────────────────────────────────────────────────────

interface RectState {
	x: number;
	y: number;
	width: number;
	height: number;
	fill: string | null;
	stroke: string | null;
	strokeWidth: number;
	opacity: number;
	cornerRadius: number;
}

export class PixiDriverRect extends PixiDriverNode implements DriverRect {
	private state: RectState = {
		cornerRadius: 0,
		fill: null,
		height: 0,
		opacity: 1,
		stroke: null,
		strokeWidth: 1,
		width: 0,
		x: 0,
		y: 0,
	};
	private graphics: Graphics;

	private constructor(container: Container, graphics: Graphics) {
		super(container);
		this.graphics = graphics;
		registerWrapper(this);
	}

	static fromOpts(opts?: RectAttrs): PixiDriverRect {
		const container = new Container();
		const graphics = new Graphics();
		container.addChild(graphics);
		const rect = new PixiDriverRect(container, graphics);
		if (opts) {
			rect.setAttrs({ ...opts });
			rect.repaint();
		}
		return rect;
	}

	private repaint(): void {
		const g = this.graphics;
		g.clear();
		const r = this.state.cornerRadius;
		if (r > 0) {
			g.roundRect(0, 0, this.state.width, this.state.height, r);
		} else {
			g.rect(0, 0, this.state.width, this.state.height);
		}
		if (this.state.fill !== null) {
			g.fill({ alpha: this.state.opacity, color: this.state.fill });
		}
		if (this.state.stroke !== null && this.state.strokeWidth > 0) {
			g.stroke({ color: this.state.stroke, width: this.state.strokeWidth });
		}
	}

	protected override applyWidth(value: number): void {
		this.state.width = value;
		this.repaint();
	}

	protected override applyHeight(value: number): void {
		this.state.height = value;
		this.repaint();
	}

	protected override applyAttr(key: string, value: unknown): void {
		super.applyAttr(key, value);
		switch (key) {
			case "fill":
				this.state.fill = typeof value === "string" ? value : null;
				this.repaint();
				return;
			case "stroke":
				this.state.stroke = typeof value === "string" ? value : null;
				this.repaint();
				return;
			case "strokeWidth":
				if (typeof value === "number") {
					this.state.strokeWidth = value;
					this.repaint();
				}
				return;
			case "opacity":
				if (typeof value === "number") {
					this.state.opacity = value;
					this.container.alpha = value;
					this.repaint();
				}
				return;
			case "cornerRadius":
				if (typeof value === "number") {
					this.state.cornerRadius = value;
					this.repaint();
				}
				return;
			default:
				return;
		}
	}

	fill(value?: string | null): string | null {
		if (value === undefined) {
			return this.state.fill;
		}
		this.state.fill = value;
		this.repaint();
		return this.state.fill;
	}

	stroke(value?: string | null): string | null {
		if (value === undefined) {
			return this.state.stroke;
		}
		this.state.stroke = value;
		this.repaint();
		return this.state.stroke;
	}

	getFill(): string | null {
		return this.state.fill;
	}

	getStroke(): string | null {
		return this.state.stroke;
	}

	getStrokeWidth(): number {
		return this.state.strokeWidth;
	}

	getOpacity(): number {
		return this.state.opacity;
	}

	getCornerRadius(): number | number[] {
		return this.state.cornerRadius;
	}
}

// ─── Line ──────────────────────────────────────────────────────────────────

export class PixiDriverLine extends PixiDriverNode implements DriverLine {
	private graphics: Graphics;
	private pointsArr: readonly number[] = [];
	private strokeColor: string | null = null;
	private strokeWidth_ = 1;

	private constructor(container: Container, graphics: Graphics) {
		super(container);
		this.graphics = graphics;
		registerWrapper(this);
	}

	static fromOpts(opts?: LineAttrs): PixiDriverLine {
		const container = new Container();
		const graphics = new Graphics();
		container.addChild(graphics);
		const line = new PixiDriverLine(container, graphics);
		if (opts) {
			if (opts.x !== undefined) container.x = opts.x;
			if (opts.y !== undefined) container.y = opts.y;
			if (opts.visible !== undefined) container.visible = opts.visible;
			if (opts.stroke !== undefined) line.strokeColor = opts.stroke;
			if (opts.strokeWidth !== undefined) line.strokeWidth_ = opts.strokeWidth;
			if (opts.points !== undefined) line.pointsArr = opts.points;
			line.repaint();
		}
		return line;
	}

	private repaint(): void {
		const g = this.graphics;
		g.clear();
		const pts = this.pointsArr;
		if (pts.length < 4) {
			return;
		}
		g.moveTo(pts[0] ?? 0, pts[1] ?? 0);
		for (let i = 2; i < pts.length; i += 2) {
			g.lineTo(pts[i] ?? 0, pts[i + 1] ?? 0);
		}
		if (this.strokeColor !== null && this.strokeWidth_ > 0) {
			g.stroke({ color: this.strokeColor, width: this.strokeWidth_ });
		}
	}

	points(value?: readonly number[]): readonly number[] {
		if (value === undefined) {
			return this.pointsArr;
		}
		this.pointsArr = value.slice();
		this.repaint();
		return this.pointsArr;
	}

	stroke(value?: string | null): string | null {
		if (value === undefined) {
			return this.strokeColor;
		}
		this.strokeColor = value;
		this.repaint();
		return this.strokeColor;
	}
}

// ─── Text ──────────────────────────────────────────────────────────────────

export class PixiDriverText extends PixiDriverNode implements DriverText {
	private text_: Text;
	private background: Graphics;
	private sceneOverride:
		| ((ctx: DriverContext, drawDefault: () => void) => void)
		| undefined = undefined;
	private padding_ = 0;

	private constructor(container: Container, text: Text, background: Graphics) {
		super(container);
		this.text_ = text;
		this.background = background;
		registerWrapper(this);
	}

	static fromOpts(opts?: TextAttrs): PixiDriverText {
		const container = new Container();
		const background = new Graphics();
		const text = new Text({
			style: new TextStyle({
				align: "left",
				fill: opts?.fill ?? "#000000",
				fontFamily: opts?.fontFamily ?? "sans-serif",
				fontSize: opts?.fontSize ?? 11,
				fontStyle: (opts?.fontStyle ?? "normal") as TextStyle["fontStyle"],
			}),
			text: opts?.text ?? "",
		});
		container.addChild(background);
		container.addChild(text);
		const inst = new PixiDriverText(container, text, background);
		if (opts) {
			if (opts.x !== undefined) container.x = opts.x;
			if (opts.y !== undefined) container.y = opts.y;
			if (opts.visible !== undefined) container.visible = opts.visible;
			if (opts.padding !== undefined) inst.padding_ = opts.padding;
			if (opts.width !== undefined) inst.width_ = opts.width;
			if (opts.height !== undefined) inst.height_ = opts.height;
			if (opts.listening !== undefined) {
				container.eventMode = opts.listening ? "static" : "none";
			}
			text.x = inst.padding_;
			text.y = inst.padding_;
		}
		return inst;
	}

	text(value?: string): string {
		if (value === undefined) {
			return this.text_.text;
		}
		this.text_.text = value;
		this.runScene();
		return this.text_.text;
	}

	setText(value: string): void {
		this.text_.text = value;
		this.runScene();
	}

	fill(value?: string): string {
		if (value === undefined) {
			return String(this.text_.style.fill);
		}
		this.text_.style.fill = value;
		return value;
	}

	getText(): string {
		return this.text_.text;
	}

	sceneFunc(fn: (ctx: DriverContext, drawDefault: () => void) => void): void {
		this.sceneOverride = fn;
		this.runScene();
	}

	private runScene(): void {
		if (!this.sceneOverride) {
			return;
		}
		const text = this.text_;
		const background = this.background;
		const ctx: DriverContext = new GraphicsDriverContext(background, text);
		this.sceneOverride(ctx, () => {
			// Default draw = ensure the text node is visible and positioned.
			text.visible = true;
		});
	}
}

// ─── Shape ─────────────────────────────────────────────────────────────────

export class PixiDriverShape extends PixiDriverNode implements DriverShape {
	private graphics: Graphics;
	private fill_: string | null = null;
	private gradient: FillGradient | undefined = undefined;
	private gradientStartY: number | null = null;
	private gradientEndY: number | null = null;
	private gradientStops: readonly (string | number)[] | null = null;
	private scene: SceneFunc | undefined = undefined;

	private constructor(container: Container, graphics: Graphics) {
		super(container);
		this.graphics = graphics;
		registerWrapper(this);
	}

	static fromOpts(opts?: ShapeAttrs): PixiDriverShape {
		const container = new Container();
		const graphics = new Graphics();
		container.addChild(graphics);
		const shape = new PixiDriverShape(container, graphics);
		if (opts) {
			if (opts.x !== undefined) container.x = opts.x;
			if (opts.y !== undefined) container.y = opts.y;
			if (opts.fill !== undefined) shape.fill_ = opts.fill ?? null;
			if (opts.fillLinearGradientStartPointY !== undefined) {
				shape.gradientStartY = opts.fillLinearGradientStartPointY;
			}
			if (opts.fillLinearGradientEndPointY !== undefined) {
				shape.gradientEndY = opts.fillLinearGradientEndPointY;
			}
			if (opts.fillLinearGradientColorStops !== undefined) {
				shape.gradientStops = opts.fillLinearGradientColorStops;
			}
			if (opts.sceneFunc !== undefined) {
				shape.sceneFunc(opts.sceneFunc);
			}
		}
		return shape;
	}

	get graphicsNode(): Graphics {
		return this.graphics;
	}

	get fillStyle(): string | FillGradient | null {
		if (this.gradientStartY !== null && this.gradientStops?.length) {
			if (!this.gradient) {
				this.rebuildGradient();
			}
			return this.gradient ?? this.fill_;
		}
		return this.fill_;
	}

	private rebuildGradient(): void {
		if (this.gradient) {
			this.gradient.destroy();
			this.gradient = undefined;
		}
		const stops = this.gradientStops;
		const startY = this.gradientStartY;
		const endY = this.gradientEndY;
		if (!stops || stops.length < 2 || startY === null || endY === null) {
			return;
		}
		const colorStops: { offset: number; color: string }[] = [];
		for (let i = 0; i + 1 < stops.length; i += 2) {
			const offset = Number(stops[i]);
			const color = String(stops[i + 1]);
			colorStops.push({ color, offset });
		}
		this.gradient = new FillGradient({
			colorStops,
			end: { x: 0, y: endY },
			start: { x: 0, y: startY },
			textureSpace: "global",
			type: "linear",
		});
	}

	fill(value?: string | null): string | null {
		if (value === undefined) {
			return this.fill_;
		}
		this.fill_ = value;
		return this.fill_;
	}

	fillLinearGradientStartPointY(value?: number | null): number | null {
		if (value === undefined) {
			return this.gradientStartY;
		}
		this.gradientStartY = value;
		this.gradient?.destroy();
		this.gradient = undefined;
		return this.gradientStartY;
	}

	fillLinearGradientEndPointY(value?: number | null): number | null {
		if (value === undefined) {
			return this.gradientEndY;
		}
		this.gradientEndY = value;
		this.gradient?.destroy();
		this.gradient = undefined;
		return this.gradientEndY;
	}

	fillLinearGradientColorStops(
		value?: readonly (string | number)[] | null,
	): readonly (string | number)[] | null {
		if (value === undefined) {
			return this.gradientStops;
		}
		this.gradientStops = value;
		this.gradient?.destroy();
		this.gradient = undefined;
		return this.gradientStops;
	}

	sceneFunc(fn: SceneFunc): void {
		this.scene = fn;
	}

	runScene(): void {
		if (!this.scene) {
			return;
		}
		this.graphics.clear();
		const ctx = new GraphicsDriverContext(this.graphics);
		this.scene(ctx, this);
	}

	override destroy(): void {
		this.gradient?.destroy();
		this.gradient = undefined;
		super.destroy();
	}
}

// ─── Stage ─────────────────────────────────────────────────────────────────

export interface PixiDriverStageFromOpts {
	readonly container: HTMLDivElement;
	readonly width: number;
	readonly height: number;
}

export class PixiDriverStage implements DriverStage {
	private hostElement: HTMLDivElement;
	private host: PixiStageHost;
	private listeners = new Map<
		string,
		Map<EventHandler, (evt: unknown) => void>
	>();
	private width_: number;
	private height_: number;

	private constructor(opts: PixiDriverStageFromOpts) {
		this.hostElement = opts.container;
		this.width_ = opts.width;
		this.height_ = opts.height;
		this.host = new PixiStageHost(opts.container, opts.width, opts.height);
		STAGE_HOSTS.set(this.host.stageContainer, this.host);
	}

	static fromOpts(opts: PixiDriverStageFromOpts): PixiDriverStage {
		return new PixiDriverStage(opts);
	}

	add(layer: DriverLayer): void {
		const wrapped = unwrapLayer(layer);
		this.host.app.stage.addChild(wrapped.container);
		wrapped.bindHost(this.host);
	}

	on<E extends Event = Event>(event: string, handler: EventHandler<E>): void {
		const wrapped = (evt: unknown): void => {
			const fed = evt as { target?: Container };
			const targetContainer = fed?.target;
			let target: DriverEventTarget = this as unknown as DriverEventTarget;
			if (targetContainer) {
				const wrapper = WRAPPERS.get(targetContainer);
				if (wrapper) {
					target = wrapper as DriverEventTarget;
				}
			}
			const adapted = adaptEvent(
				target,
				event,
				(evt as Event) ?? new Event(event),
			);
			(handler as EventHandler)(adapted);
		};
		let map = this.listeners.get(event);
		if (!map) {
			map = new Map();
			this.listeners.set(event, map);
		}
		map.set(handler as EventHandler, wrapped);
		this.host.stageContainer.on(event, wrapped as never);
	}

	off<E extends Event = Event>(event: string, handler?: EventHandler<E>): void {
		const map = this.listeners.get(event);
		if (!map) {
			return;
		}
		if (handler) {
			const wrapped = map.get(handler as EventHandler);
			if (wrapped) {
				this.host.stageContainer.off(event, wrapped as never);
				map.delete(handler as EventHandler);
			}
			return;
		}
		for (const wrapped of map.values()) {
			this.host.stageContainer.off(event, wrapped as never);
		}
		map.clear();
	}

	width(value?: number): number {
		if (value === undefined) {
			return this.width_;
		}
		this.width_ = value;
		this.host.resize(value, this.height_);
		return this.width_;
	}

	height(value?: number): number {
		if (value === undefined) {
			return this.height_;
		}
		this.height_ = value;
		this.host.resize(this.width_, value);
		return this.height_;
	}

	container(value?: HTMLDivElement): HTMLDivElement {
		if (value === undefined) {
			return this.hostElement;
		}
		this.hostElement = value;
		return this.hostElement;
	}

	destroy(): void {
		this.host.destroy();
	}

	get attrs(): Record<string, unknown> {
		return {};
	}

	get parent(): DriverEventTarget | null {
		return null;
	}

	getAttr(_name: string): unknown {
		return undefined;
	}
}

// ─── Animation ─────────────────────────────────────────────────────────────

export class PixiDriverAnimation implements DriverAnimation {
	private running = false;
	private layer: PixiDriverLayer;
	private tickFn: (ticker: Ticker) => void;

	private constructor(
		private readonly tick: () => void,
		layer: PixiDriverLayer,
	) {
		this.layer = layer;
		this.tickFn = () => {
			this.tick();
			// Force a render after each animation tick (we keep autoStart off
			// so the renderer doesn't paint static scenes).
			this.layer.draw();
		};
	}

	static fromOpts(tick: () => void, layer: DriverLayer): PixiDriverAnimation {
		return new PixiDriverAnimation(tick, unwrapLayer(layer));
	}

	start(): void {
		if (this.running) {
			return;
		}
		this.running = true;
		Ticker.shared.add(this.tickFn);
		Ticker.shared.start();
	}

	stop(): void {
		if (!this.running) {
			return;
		}
		this.running = false;
		Ticker.shared.remove(this.tickFn);
	}
}

// ─── Context (used inside sceneFunc callbacks) ─────────────────────────────

class GraphicsDriverContext implements DriverContext {
	private path: { x: number; y: number }[] = [];
	private currentFillStyle: string | FillGradient | null = "#000000";

	constructor(
		private readonly graphics: Graphics,
		private readonly text?: Text,
	) {}

	get fillStyle(): string {
		return typeof this.currentFillStyle === "string"
			? this.currentFillStyle
			: "";
	}

	set fillStyle(value: string) {
		this.currentFillStyle = value;
	}

	beginPath(): void {
		this.path = [];
	}

	closePath(): void {
		this.graphics.closePath();
	}

	moveTo(x: number, y: number): void {
		this.path = [{ x, y }];
		this.graphics.moveTo(x, y);
	}

	lineTo(x: number, y: number): void {
		this.path.push({ x, y });
		this.graphics.lineTo(x, y);
	}

	rect(x: number, y: number, w: number, h: number): void {
		this.graphics.rect(x, y, w, h);
	}

	fillRect(x: number, y: number, w: number, h: number): void {
		this.graphics.rect(x, y, w, h);
		const fill = this.currentFillStyle;
		if (fill instanceof FillGradient) {
			this.graphics.fill(fill);
		} else if (fill) {
			this.graphics.fill({ color: fill });
		}
	}

	stroke(): void {
		const fill = this.currentFillStyle;
		if (typeof fill === "string") {
			this.graphics.stroke({ color: fill, width: 1 });
		} else {
			this.graphics.stroke({ color: 0x000000, width: 1 });
		}
	}

	fill(): void {
		const fill = this.currentFillStyle;
		if (fill instanceof FillGradient) {
			this.graphics.fill(fill);
		} else if (typeof fill === "string") {
			this.graphics.fill({ color: fill });
		}
	}

	setAttr(key: string, value: unknown): void {
		if (key === "fillStyle" && typeof value === "string") {
			this.currentFillStyle = value;
		}
	}

	fillText(text: string, x: number, y: number): void {
		if (!this.text) {
			return;
		}
		this.text.text = text;
		this.text.x = x;
		this.text.y = y;
		this.text.visible = true;
	}

	measureText(text: string): { readonly width: number } {
		if (this.text) {
			const previous = this.text.text;
			this.text.text = text;
			const width = this.text.width;
			this.text.text = previous;
			return { width };
		}
		// Crude fallback: ~6px per char.
		return { width: text.length * 6 };
	}

	fillShape(shape: DriverShape): void {
		if (shape instanceof PixiDriverShape) {
			const fill = shape.fillStyle;
			if (fill instanceof FillGradient) {
				shape.graphicsNode.fill(fill);
			} else if (typeof fill === "string") {
				shape.graphicsNode.fill({ color: fill });
			}
		}
	}
}

// ─── Driver factory ────────────────────────────────────────────────────────

export class PixiCanvasDriver implements CanvasDriver {
	private constructor() {}

	/**
	 * Async factory for the Pixi driver. Pixi v8's renderer init is itself
	 * async (WebGL/WebGPU detection). Awaiting once before constructing
	 * Peaks lets the driver create stages synchronously.
	 *
	 * @returns A driver ready to be passed as `PeaksOptions.driver`.
	 */
	static async create(): Promise<PixiCanvasDriver> {
		return new PixiCanvasDriver();
	}

	createStage = (opts: PixiDriverStageFromOpts): DriverStage => {
		return PixiDriverStage.fromOpts(opts);
	};

	createLayer = (opts?: LayerAttrs): DriverLayer => {
		return PixiDriverLayer.fromOpts(opts);
	};

	createGroup = (opts?: GroupAttrs): DriverGroup => {
		return PixiDriverGroup.fromOpts(opts);
	};

	createRect = (opts?: RectAttrs): DriverRect => {
		return PixiDriverRect.fromOpts(opts);
	};

	createLine = (opts?: LineAttrs): DriverLine => {
		return PixiDriverLine.fromOpts(opts);
	};

	createText = (opts?: TextAttrs): DriverText => {
		return PixiDriverText.fromOpts(opts);
	};

	createShape = (opts?: ShapeAttrs): DriverShape => {
		return PixiDriverShape.fromOpts(opts);
	};

	createAnimation = (tick: () => void, layer: DriverLayer): DriverAnimation => {
		return PixiDriverAnimation.fromOpts(tick, layer);
	};
}
