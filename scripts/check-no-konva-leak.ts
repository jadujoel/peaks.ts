import { runLeakCheck } from "./leak-checker";

await runLeakCheck({
	allowedDir: new URL("../src/driver/konva/", import.meta.url),
	leakPattern:
		/from\s+["']konva|konva\/lib|new Konva\.|KonvaEventObject|KonvaMouseEvent|KonvaWheelEvent|KonvaTouchEvent|KonvaPointerEvent/,
	packageName: "Konva",
	srcRoot: new URL("../src/", import.meta.url),
});
