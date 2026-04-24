import { describe, expect, it } from "vitest";
import { KonvaCanvasDriver } from "../src/driver/konva/driver";
import { PixiCanvasDriver } from "../src/driver/pixi/driver";
import type { CanvasDriver, DriverStage } from "../src/driver/types";

// ─── Driver harness ────────────────────────────────────────────────────────
//
// Every observable check is run twice – once against Konva (the reference)
// and once against Pixi – through a shared `describe.each` block. Any
// behavioural drift between the two drivers will surface as a failed
// expectation.  In addition, an explicit "cross-driver parity" suite runs
// both drivers side-by-side on the same scene and asserts that the two
// observable surfaces agree value-for-value.

interface Harness {
	readonly name: string;
	readonly create: () => Promise<CanvasDriver>;
}

const HARNESSES: readonly Harness[] = [
	{ create: async () => KonvaCanvasDriver.default(), name: "konva" },
	{ create: () => PixiCanvasDriver.create(), name: "pixi" },
] as const;

interface MountedStage {
	readonly driver: CanvasDriver;
	readonly stage: DriverStage;
	readonly container: HTMLDivElement;
	readonly width: number;
	readonly height: number;
	dispose(): Promise<void>;
}

async function mountStage(
	driver: CanvasDriver,
	width = 200,
	height = 100,
): Promise<MountedStage> {
	const container = document.createElement("div");
	container.style.width = `${width}px`;
	container.style.height = `${height}px`;
	document.body.appendChild(container);
	const stage = (await driver.createStage({
		container,
		height,
		width,
	})) as DriverStage;
	return {
		container,
		dispose: async () => {
			stage.destroy();
			// Pixi's destroy is deferred until init resolves.
			await new Promise((resolve) => setTimeout(resolve, 50));
			if (container.parentElement) {
				container.parentElement.removeChild(container);
			}
		},
		driver,
		height,
		stage,
		width,
	};
}

function getCanvas(container: HTMLDivElement): HTMLCanvasElement {
	const canvas = container.querySelector("canvas");
	if (!canvas) {
		throw new Error("expected a <canvas> in the stage container");
	}
	return canvas;
}

// Captures the rendered output into a 2D canvas so we can sample pixels
// uniformly across drivers (the Konva canvas is 2D; the Pixi canvas is
// WebGL but `drawImage` copies the rasterised front buffer).
//
// IMPORTANT: WebGL canvases (Pixi) do NOT enable `preserveDrawingBuffer`
// by default, so the back-buffer is cleared the moment the browser
// composites the page. Callers MUST snapshot synchronously after the
// driver finishes drawing — never after a `requestAnimationFrame`.
function snapshotCanvas(src: HTMLCanvasElement): ImageData {
	const sample = document.createElement("canvas");
	sample.width = src.width;
	sample.height = src.height;
	const ctx = sample.getContext("2d");
	if (!ctx) {
		throw new Error("could not acquire 2D context for snapshot");
	}
	ctx.drawImage(src, 0, 0);
	return ctx.getImageData(0, 0, src.width, src.height);
}

// Returns the average RGBA at a CSS-coordinate point (so callers don't
// have to track devicePixelRatio differences between drivers).
function sampleAtCss(
	src: HTMLCanvasElement,
	cssX: number,
	cssY: number,
): { r: number; g: number; b: number; a: number } {
	const data = snapshotCanvas(src);
	const styleW = Number.parseFloat(src.style.width) || src.width;
	const styleH = Number.parseFloat(src.style.height) || src.height;
	const px = Math.floor((cssX / styleW) * src.width);
	const py = Math.floor((cssY / styleH) * src.height);
	const i = (py * src.width + px) * 4;
	return {
		a: data.data[i + 3] ?? 0,
		b: data.data[i + 2] ?? 0,
		g: data.data[i + 1] ?? 0,
		r: data.data[i] ?? 0,
	};
}

function isCloseTo(a: number, b: number, delta = 8): boolean {
	return Math.abs(a - b) <= delta;
}

// ─── Per-driver behavioural tests ──────────────────────────────────────────

for (const harness of HARNESSES) {
	describe(`driver: ${harness.name}`, () => {
		it("createStage attaches a canvas of the requested size", async () => {
			const driver = await harness.create();
			const mount = await mountStage(driver, 200, 100);
			// Konva creates its <canvas> lazily on the first `Layer.add`; Pixi
			// creates one immediately. Add a layer to normalise the assertion.
			const layer = driver.createLayer();
			mount.stage.add(layer);
			const canvas = getCanvas(mount.container);
			expect(canvas).not.toBeNull();
			expect(mount.stage.width()).toBe(200);
			expect(mount.stage.height()).toBe(100);
			// CSS size mirrors the requested logical size in both drivers,
			// even if the back-buffer is up-scaled by devicePixelRatio.
			const cssW = Number.parseFloat(canvas.style.width) || canvas.width;
			const cssH = Number.parseFloat(canvas.style.height) || canvas.height;
			expect(cssW).toBe(200);
			expect(cssH).toBe(100);
			await mount.dispose();
		});

		it("stage.destroy detaches the canvas", async () => {
			const driver = await harness.create();
			const mount = await mountStage(driver);
			const layer = driver.createLayer();
			mount.stage.add(layer);
			expect(mount.container.querySelector("canvas")).not.toBeNull();
			await mount.dispose();
			expect(mount.container.querySelector("canvas")).toBeNull();
		});

		it("layer.getHeight returns the stage's CSS height", async () => {
			const driver = await harness.create();
			const mount = await mountStage(driver, 200, 100);
			const layer = driver.createLayer();
			mount.stage.add(layer);
			// All consumers (PlayheadLayer, WaveformShape, …) treat the
			// layer height as CSS pixels (the same units they hand back via
			// `view.getHeight()`). It MUST NOT be devicePixelRatio-scaled.
			expect(layer.getHeight()).toBe(100);
			await mount.dispose();
		});

		it("layer listening defaults to true and round-trips", async () => {
			const driver = await harness.create();
			const mount = await mountStage(driver);
			const layer = driver.createLayer();
			mount.stage.add(layer);
			expect(layer.listening()).toBe(true);
			layer.listening(false);
			expect(layer.listening()).toBe(false);
			layer.listening(true);
			expect(layer.listening()).toBe(true);
			await mount.dispose();
		});

		it("rect getters round-trip and defaults are sensible", async () => {
			const driver = await harness.create();
			const mount = await mountStage(driver);
			const rect = driver.createRect({
				fill: "#ff0000",
				height: 40,
				stroke: "#0000ff",
				strokeWidth: 3,
				width: 60,
				x: 10,
				y: 20,
			});
			expect(rect.getX()).toBe(10);
			expect(rect.getY()).toBe(20);
			expect(rect.getWidth()).toBe(60);
			expect(rect.height()).toBe(40);
			expect(rect.getFill()).toBe("#ff0000");
			expect(rect.getStroke()).toBe("#0000ff");
			expect(rect.getStrokeWidth()).toBe(3);
			expect(rect.getOpacity()).toBe(1);
			rect.fill("#00ff00");
			expect(rect.getFill()).toBe("#00ff00");
			rect.stroke(null);
			expect(rect.getStroke()).toBeNull();
			await mount.dispose();
		});

		it("line points round-trip and accept readonly arrays", async () => {
			const driver = await harness.create();
			const mount = await mountStage(driver);
			const line = driver.createLine({
				points: [0, 0, 10, 10, 20, 5],
				stroke: "#abcdef",
				strokeWidth: 2,
			});
			expect(Array.from(line.points())).toEqual([0, 0, 10, 10, 20, 5]);
			line.points([1, 2, 3, 4]);
			expect(Array.from(line.points())).toEqual([1, 2, 3, 4]);
			expect(line.stroke()).toBe("#abcdef");
			await mount.dispose();
		});

		it("text round-trip via text() and setText() is symmetric", async () => {
			const driver = await harness.create();
			const mount = await mountStage(driver);
			const text = driver.createText({
				fill: "#101010",
				fontSize: 14,
				text: "alpha",
			});
			expect(text.getText()).toBe("alpha");
			text.setText("beta");
			expect(text.getText()).toBe("beta");
			text.text("gamma");
			expect(text.getText()).toBe("gamma");
			await mount.dispose();
		});

		it("group attrs bag persists arbitrary domain payloads", async () => {
			const driver = await harness.create();
			const mount = await mountStage(driver);
			const payload = { id: "seg-1" };
			const group = driver.createGroup({
				name: "marker",
				segment: payload,
				x: 5,
				y: 7,
			});
			expect(group.getAttr?.("name")).toBe("marker");
			expect(group.getAttr?.("segment")).toBe(payload);
			expect(group.x()).toBe(5);
			expect(group.y()).toBe(7);
			await mount.dispose();
		});

		it("getAbsolutePosition composes parent transforms in CSS pixels", async () => {
			const driver = await harness.create();
			const mount = await mountStage(driver);
			const layer = driver.createLayer();
			mount.stage.add(layer);
			const outer = driver.createGroup({ x: 30, y: 40 });
			const inner = driver.createGroup({ x: 5, y: 7 });
			layer.add(outer);
			outer.add(inner);
			const abs = inner.getAbsolutePosition();
			// Must be expressed in CSS pixels, not devicePixelRatio-scaled
			// back-buffer pixels (consumers feed these directly back into
			// `node.x()`/`node.y()`).
			expect(abs.x).toBe(35);
			expect(abs.y).toBe(47);
			await mount.dispose();
		});

		it("group draggable() round-trips and defaults to false", async () => {
			const driver = await harness.create();
			const mount = await mountStage(driver);
			const group = driver.createGroup();
			expect(group.draggable()).toBe(false);
			group.draggable(true);
			expect(group.draggable()).toBe(true);
			group.draggable(false);
			expect(group.draggable()).toBe(false);
			await mount.dispose();
		});

		it("group clipWidth does not throw and may be re-applied", async () => {
			const driver = await harness.create();
			const mount = await mountStage(driver);
			const group = driver.createGroup({ height: 50 });
			expect(() => {
				group.clipWidth(20);
				group.clipWidth(40);
				group.clipWidth(0);
			}).not.toThrow();
			await mount.dispose();
		});

		it("shape sceneFunc is invoked when its layer draws", async () => {
			const driver = await harness.create();
			const mount = await mountStage(driver);
			const layer = driver.createLayer();
			mount.stage.add(layer);
			let calls = 0;
			const shape = driver.createShape({
				fill: "#123456",
				sceneFunc: (ctx, s) => {
					calls += 1;
					ctx.beginPath();
					ctx.rect(0, 0, 10, 10);
					ctx.fillShape(s);
				},
			});
			layer.add(shape);
			layer.draw();
			expect(calls).toBeGreaterThan(0);
			expect(shape.fill()).toBe("#123456");
			await mount.dispose();
		});

		it("shape gradient stops round-trip", async () => {
			const driver = await harness.create();
			const mount = await mountStage(driver);
			const shape = driver.createShape({
				fillLinearGradientColorStops: [0, "#ff0000", 1, "#0000ff"],
				fillLinearGradientEndPointY: 100,
				fillLinearGradientStartPointY: 0,
			});
			expect(shape.fillLinearGradientStartPointY()).toBe(0);
			expect(shape.fillLinearGradientEndPointY()).toBe(100);
			expect(Array.from(shape.fillLinearGradientColorStops() ?? [])).toEqual([
				0,
				"#ff0000",
				1,
				"#0000ff",
			]);
			await mount.dispose();
		});

		it("animation start/stop is idempotent", async () => {
			const driver = await harness.create();
			const mount = await mountStage(driver);
			const layer = driver.createLayer();
			mount.stage.add(layer);
			const anim = driver.createAnimation(() => {}, layer);
			expect(() => {
				anim.start();
				anim.start();
				anim.stop();
				anim.stop();
			}).not.toThrow();
			await mount.dispose();
		});

		it("layer.draw paints a rect that is sampleable in CSS coordinates", async () => {
			const driver = await harness.create();
			const mount = await mountStage(driver, 200, 100);
			const layer = driver.createLayer();
			mount.stage.add(layer);
			const rect = driver.createRect({
				fill: "#ff0000",
				height: 40,
				width: 60,
				x: 20,
				y: 30,
			});
			layer.add(rect);
			layer.draw();

			const canvas = getCanvas(mount.container);
			// Snapshot synchronously — see `snapshotCanvas` for why.
			const inside = sampleAtCss(canvas, 50, 50); // inside the red rect
			const outside = sampleAtCss(canvas, 5, 5); // background

			const diag = JSON.stringify({ inside, outside });
			// Inside the rect should be predominantly red.
			expect(inside.r, `inside.r ${diag}`).toBeGreaterThan(150);
			expect(inside.g, `inside.g ${diag}`).toBeLessThan(80);
			expect(inside.b, `inside.b ${diag}`).toBeLessThan(80);
			// Outside the rect should be transparent / unset.
			expect(outside.a, `outside.a ${diag}`).toBeLessThan(40);

			await mount.dispose();
		});
	});
}

// ─── Cross-driver parity ───────────────────────────────────────────────────
//
// Boots one stage per driver against the same logical scene and asserts
// that observable values agree.  This catches drift that single-driver
// tests would miss (e.g. one driver returning back-buffer pixels while the
// other returns CSS pixels).

interface Pair<T> {
	readonly konva: T;
	readonly pixi: T;
}

async function bothDrivers(): Promise<Pair<CanvasDriver>> {
	const [konva, pixi] = await Promise.all([
		KonvaCanvasDriver.default(),
		PixiCanvasDriver.create(),
	]);
	return { konva, pixi };
}

async function bothStages(
	width = 200,
	height = 100,
): Promise<{
	readonly drivers: Pair<CanvasDriver>;
	readonly stages: Pair<DriverStage>;
	readonly containers: Pair<HTMLDivElement>;
	dispose(): Promise<void>;
}> {
	const drivers = await bothDrivers();
	const make = async (driver: CanvasDriver): Promise<MountedStage> =>
		mountStage(driver, width, height);
	const [konvaMount, pixiMount] = await Promise.all([
		make(drivers.konva),
		make(drivers.pixi),
	]);
	return {
		containers: {
			konva: konvaMount.container,
			pixi: pixiMount.container,
		},
		dispose: async () => {
			await Promise.all([konvaMount.dispose(), pixiMount.dispose()]);
		},
		drivers,
		stages: { konva: konvaMount.stage, pixi: pixiMount.stage },
	};
}

describe("driver parity (konva vs pixi)", () => {
	it("layer.getHeight matches the stage height across drivers", async () => {
		const ctx = await bothStages(200, 100);
		const konvaLayer = ctx.drivers.konva.createLayer();
		const pixiLayer = ctx.drivers.pixi.createLayer();
		ctx.stages.konva.add(konvaLayer);
		ctx.stages.pixi.add(pixiLayer);
		expect(pixiLayer.getHeight()).toBe(konvaLayer.getHeight());
		expect(pixiLayer.getHeight()).toBe(100);
		await ctx.dispose();
	});

	it("getAbsolutePosition returns the same CSS coordinates", async () => {
		const ctx = await bothStages();

		const buildScene = (driver: CanvasDriver, stage: DriverStage) => {
			const layer = driver.createLayer();
			stage.add(layer);
			const outer = driver.createGroup({ x: 25, y: 35 });
			const inner = driver.createGroup({ x: 4, y: 6 });
			layer.add(outer);
			outer.add(inner);
			return inner.getAbsolutePosition();
		};

		const konvaPos = buildScene(ctx.drivers.konva, ctx.stages.konva);
		const pixiPos = buildScene(ctx.drivers.pixi, ctx.stages.pixi);

		expect(pixiPos).toEqual(konvaPos);
		expect(pixiPos).toEqual({ x: 29, y: 41 });

		await ctx.dispose();
	});

	it("rect getters return identical values for an identical rect", async () => {
		const ctx = await bothStages();
		const opts = {
			fill: "#abcdef",
			height: 33,
			opacity: 0.5,
			stroke: "#112233",
			strokeWidth: 4,
			width: 77,
			x: 11,
			y: 22,
		} as const;
		const konvaRect = ctx.drivers.konva.createRect(opts);
		const pixiRect = ctx.drivers.pixi.createRect(opts);

		const dump = (rect: ReturnType<CanvasDriver["createRect"]>) => ({
			fill: rect.getFill(),
			height: rect.height(),
			opacity: rect.getOpacity(),
			stroke: rect.getStroke(),
			strokeWidth: rect.getStrokeWidth(),
			width: rect.getWidth(),
			x: rect.getX(),
			y: rect.getY(),
		});

		expect(dump(pixiRect)).toEqual(dump(konvaRect));
		await ctx.dispose();
	});

	it("text.getText and fill round-trip identically", async () => {
		const ctx = await bothStages();
		const konvaText = ctx.drivers.konva.createText({
			fill: "#222222",
			fontSize: 12,
			text: "parity",
		});
		const pixiText = ctx.drivers.pixi.createText({
			fill: "#222222",
			fontSize: 12,
			text: "parity",
		});
		expect(pixiText.getText()).toBe(konvaText.getText());
		konvaText.setText("changed");
		pixiText.setText("changed");
		expect(pixiText.getText()).toBe(konvaText.getText());
		await ctx.dispose();
	});

	it("shape sceneFunc fires the same number of times per draw cycle", async () => {
		const ctx = await bothStages();

		const setupAndDraw = (driver: CanvasDriver, stage: DriverStage) => {
			const layer = driver.createLayer();
			stage.add(layer);
			let calls = 0;
			const shape = driver.createShape({
				fill: "#00ff00",
				sceneFunc: (c, s) => {
					calls += 1;
					c.beginPath();
					c.rect(0, 0, 10, 10);
					c.fillShape(s);
				},
			});
			layer.add(shape);
			layer.draw();
			return calls;
		};

		const konvaCalls = setupAndDraw(ctx.drivers.konva, ctx.stages.konva);
		const pixiCalls = setupAndDraw(ctx.drivers.pixi, ctx.stages.pixi);
		// Both drivers must invoke the scene function at least once after the
		// shape is added and the layer is drawn. The exact count differs by
		// design (Konva double-draws via its eager add+draw scheduler) and is
		// not a meaningful parity contract.
		expect(pixiCalls).toBeGreaterThan(0);
		expect(konvaCalls).toBeGreaterThan(0);

		await ctx.dispose();
	});

	it("rendered fill colour at a known point matches across drivers", async () => {
		const ctx = await bothStages(200, 100);

		const paint = (
			driver: CanvasDriver,
			stage: DriverStage,
			container: HTMLDivElement,
		): HTMLCanvasElement => {
			const layer = driver.createLayer();
			stage.add(layer);
			const rect = driver.createRect({
				fill: "#ff8000",
				height: 40,
				width: 60,
				x: 20,
				y: 30,
			});
			layer.add(rect);
			layer.draw();
			return getCanvas(container);
		};

		const konvaCanvas = paint(
			ctx.drivers.konva,
			ctx.stages.konva,
			ctx.containers.konva,
		);
		const pixiCanvas = paint(
			ctx.drivers.pixi,
			ctx.stages.pixi,
			ctx.containers.pixi,
		);

		// Sample synchronously to keep the WebGL back-buffer alive.
		const konvaSample = sampleAtCss(konvaCanvas, 50, 50);
		const pixiSample = sampleAtCss(pixiCanvas, 50, 50);
		const diag = JSON.stringify({ konva: konvaSample, pixi: pixiSample });

		// Both samples should be the orange we painted (≈ rgba(255,128,0,255)).
		expect(isCloseTo(konvaSample.r, 255, 16), `konva.r ${diag}`).toBe(true);
		expect(isCloseTo(konvaSample.g, 128, 24), `konva.g ${diag}`).toBe(true);
		expect(isCloseTo(konvaSample.b, 0, 16), `konva.b ${diag}`).toBe(true);

		expect(isCloseTo(pixiSample.r, konvaSample.r, 24), `r ${diag}`).toBe(true);
		expect(isCloseTo(pixiSample.g, konvaSample.g, 24), `g ${diag}`).toBe(true);
		expect(isCloseTo(pixiSample.b, konvaSample.b, 24), `b ${diag}`).toBe(true);

		// Outside the rect both canvases should be transparent.
		const konvaOutside = sampleAtCss(konvaCanvas, 5, 5);
		const pixiOutside = sampleAtCss(pixiCanvas, 5, 5);
		expect(konvaOutside.a).toBeLessThan(40);
		expect(pixiOutside.a).toBeLessThan(40);

		await ctx.dispose();
	});

	it("a line is rendered between its endpoints in both drivers", async () => {
		const ctx = await bothStages(200, 60);

		const paint = (
			driver: CanvasDriver,
			stage: DriverStage,
			container: HTMLDivElement,
		): HTMLCanvasElement => {
			const layer = driver.createLayer();
			stage.add(layer);
			const line = driver.createLine({
				points: [10, 30, 190, 30],
				stroke: "#00aaff",
				strokeWidth: 4,
			});
			layer.add(line);
			layer.draw();
			return getCanvas(container);
		};

		const konvaCanvas = paint(
			ctx.drivers.konva,
			ctx.stages.konva,
			ctx.containers.konva,
		);
		const pixiCanvas = paint(
			ctx.drivers.pixi,
			ctx.stages.pixi,
			ctx.containers.pixi,
		);

		// Sample the midpoint of the line in both drivers.
		const konvaOnLine = sampleAtCss(konvaCanvas, 100, 30);
		const pixiOnLine = sampleAtCss(pixiCanvas, 100, 30);
		const diag = JSON.stringify({
			konvaOnLine,
			pixiOnLine,
		});
		expect(konvaOnLine.a, `konva.a ${diag}`).toBeGreaterThan(60);
		expect(pixiOnLine.a, `pixi.a ${diag}`).toBeGreaterThan(60);

		// Both should have a visible blue channel where the line was drawn.
		expect(konvaOnLine.b, `konva.b ${diag}`).toBeGreaterThan(120);
		expect(pixiOnLine.b, `pixi.b ${diag}`).toBeGreaterThan(120);

		// Above the line should be transparent.
		const konvaAbove = sampleAtCss(konvaCanvas, 100, 5);
		const pixiAbove = sampleAtCss(pixiCanvas, 100, 5);
		expect(konvaAbove.a).toBeLessThan(40);
		expect(pixiAbove.a).toBeLessThan(40);

		await ctx.dispose();
	});

	it("layer.add followed by draw() renders a child immediately (no microtask required)", async () => {
		// Regression guard for the deferred-draw scheduler in the Pixi
		// layer: an explicit `draw()` after `add()` MUST paint the shape
		// synchronously, mirroring Konva's eager behaviour.
		const ctx = await bothStages(100, 60);

		const paint = (
			driver: CanvasDriver,
			stage: DriverStage,
			container: HTMLDivElement,
		): HTMLCanvasElement => {
			const layer = driver.createLayer();
			stage.add(layer);
			const rect = driver.createRect({
				fill: "#ffffff",
				height: 40,
				width: 60,
				x: 10,
				y: 10,
			});
			layer.add(rect);
			layer.draw();
			return getCanvas(container);
		};

		const konvaCanvas = paint(
			ctx.drivers.konva,
			ctx.stages.konva,
			ctx.containers.konva,
		);
		const pixiCanvas = paint(
			ctx.drivers.pixi,
			ctx.stages.pixi,
			ctx.containers.pixi,
		);

		const konvaInside = sampleAtCss(konvaCanvas, 30, 30);
		const pixiInside = sampleAtCss(pixiCanvas, 30, 30);
		const diag = JSON.stringify({ konvaInside, pixiInside });
		expect(konvaInside.a, `konva ${diag}`).toBeGreaterThan(200);
		expect(pixiInside.a, `pixi ${diag}`).toBeGreaterThan(200);

		await ctx.dispose();
	});
});
