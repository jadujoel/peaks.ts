import { runLeakCheck } from "./leak-checker";

await runLeakCheck({
	allowedDir: new URL("../src/driver/pixi/", import.meta.url),
	leakPattern: /from\s+["']pixi\.js["']/,
	packageName: "Pixi",
	srcRoot: new URL("../src/", import.meta.url),
});
