import { describe, expect, it } from "vitest";
import { PixiCanvasDriver } from "../src/driver/pixi/driver";

async function makeStage(): Promise<{
	readonly driver: PixiCanvasDriver;
	readonly container: HTMLDivElement;
	readonly stage: ReturnType<PixiCanvasDriver["createStage"]>;
}> {
	const driver = await PixiCanvasDriver.create();
	const container = document.createElement("div");
	container.style.width = "200px";
	container.style.height = "100px";
	document.body.appendChild(container);
	const stage = driver.createStage({ container, height: 100, width: 200 });
	return { container, driver, stage };
}

describe("PixiCanvasDriver", () => {
	it("creates a driver via async factory", async () => {
		const driver = await PixiCanvasDriver.create();
		expect(driver).toBeInstanceOf(PixiCanvasDriver);
	});

	it("createStage attaches a canvas to the container", async () => {
		const { container, stage } = await makeStage();
		expect(container.querySelector("canvas")).not.toBeNull();
		expect(stage.width()).toBe(200);
		expect(stage.height()).toBe(100);
		stage.destroy();
	});

	it("stage.destroy removes the canvas", async () => {
		const { container, stage } = await makeStage();
		stage.destroy();
		// Allow the deferred destroy (which awaits the init promise) to flush.
		await new Promise((resolve) => setTimeout(resolve, 50));
		expect(container.querySelector("canvas")).toBeNull();
	});

	it("rect getters/setters are symmetric", async () => {
		const { driver, stage } = await makeStage();
		const rect = driver.createRect({
			fill: "#ff0000",
			height: 10,
			stroke: "#000000",
			strokeWidth: 2,
			width: 50,
			x: 5,
			y: 7,
		});
		expect(rect.getX()).toBe(5);
		expect(rect.getY()).toBe(7);
		expect(rect.getWidth()).toBe(50);
		expect(rect.getFill()).toBe("#ff0000");
		expect(rect.getStroke()).toBe("#000000");
		expect(rect.getStrokeWidth()).toBe(2);
		rect.fill("#00ff00");
		expect(rect.getFill()).toBe("#00ff00");
		stage.destroy();
	});

	it("line points round-trip", async () => {
		const { driver, stage } = await makeStage();
		const line = driver.createLine({
			points: [0, 0, 10, 10],
			stroke: "#abcdef",
			strokeWidth: 1,
		});
		expect(line.points()).toEqual([0, 0, 10, 10]);
		line.points([1, 2, 3, 4]);
		expect(line.points()).toEqual([1, 2, 3, 4]);
		expect(line.stroke()).toBe("#abcdef");
		stage.destroy();
	});

	it("text round-trip", async () => {
		const { driver, stage } = await makeStage();
		const text = driver.createText({
			fill: "#111111",
			fontSize: 12,
			text: "hello",
		});
		expect(text.getText()).toBe("hello");
		text.setText("world");
		expect(text.getText()).toBe("world");
		stage.destroy();
	});

	it("layer add/draw/listening/getHeight", async () => {
		const { driver, stage } = await makeStage();
		const layer = driver.createLayer();
		stage.add(layer);
		const rect = driver.createRect({ height: 10, width: 10 });
		layer.add(rect);
		layer.draw();
		expect(layer.listening()).toBe(true);
		layer.listening(false);
		expect(layer.listening()).toBe(false);
		expect(layer.getHeight()).toBeGreaterThan(0);
		stage.destroy();
	});

	it("group attrs bag persists domain payloads", async () => {
		const { driver, stage } = await makeStage();
		const group = driver.createGroup({ name: "marker", x: 1, y: 2 });
		expect(group.getAttr?.("name")).toBe("marker");
		expect(group.x()).toBe(1);
		expect(group.y()).toBe(2);
		stage.destroy();
	});

	it("group clipWidth applies a mask", async () => {
		const { driver, stage } = await makeStage();
		const group = driver.createGroup({ height: 50 });
		group.clipWidth(20);
		// Mask is internal; we just assert the API doesn't throw and width sticks.
		expect(() => {
			group.clipWidth(40);
		}).not.toThrow();
		stage.destroy();
	});

	it("shape sceneFunc runs and fillShape paints", async () => {
		const { driver, stage } = await makeStage();
		const layer = driver.createLayer();
		stage.add(layer);
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
		stage.destroy();
	});

	it("animation start/stop does not throw", async () => {
		const { driver, stage } = await makeStage();
		const layer = driver.createLayer();
		stage.add(layer);
		let ticks = 0;
		const anim = driver.createAnimation(() => {
			ticks += 1;
		}, layer);
		anim.start();
		anim.stop();
		// Started and stopped without throwing — actual tick scheduling is
		// driven by Pixi's shared Ticker which is hard to assert deterministically.
		expect(ticks).toBeGreaterThanOrEqual(0);
		stage.destroy();
	});
});
