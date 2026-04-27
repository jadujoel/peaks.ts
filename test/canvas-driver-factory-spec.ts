import { describe, expect, it } from "vitest";
import { createCanvasDriver } from "../src/driver/factory";

describe("createCanvasDriver", () => {
	it("returns a CanvasDriver for kind=konva", async () => {
		const driver = await createCanvasDriver({ kind: "konva" });
		expect(typeof driver.createStage).toBe("function");
		expect(typeof driver.createLayer).toBe("function");
		expect(typeof driver.createGroup).toBe("function");
	});

	it("returns a CanvasDriver for kind=pixi", async () => {
		const driver = await createCanvasDriver({ kind: "pixi" });
		expect(typeof driver.createStage).toBe("function");
		expect(typeof driver.createLayer).toBe("function");
		expect(typeof driver.createGroup).toBe("function");
	});

	it("throws on an unknown kind", async () => {
		await expect(
			createCanvasDriver({ kind: "svg" as unknown as "konva" }),
		).rejects.toThrow(/unknown kind/);
	});
});
