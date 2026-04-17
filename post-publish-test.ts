import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const packOutput = execFileSync("npm", ["pack", "--json"], {
	encoding: "utf8",
}).trim();
const [{ filename }] = JSON.parse(packOutput);
const tempDir = mkdtempSync(join(tmpdir(), "peaks-package-"));

try {
	execFileSync("tar", ["-xzf", filename, "-C", tempDir], { stdio: "inherit" });

	const requiredFiles = [
		"package/package.json",
		"package/dist/esm/main.d.ts",
		"package/dist/peaks.esm.js",
		"package/dist/peaks.min.js",
	];

	for (const relativePath of requiredFiles) {
		const absolutePath = join(tempDir, relativePath);

		if (!existsSync(absolutePath)) {
			throw new Error(`Tarball smoke test failed: missing ${relativePath}`);
		}
	}

	console.log("Tarball smoke test passed");
} finally {
	rmSync(tempDir, { force: true, recursive: true });
	rmSync(filename, { force: true });
}
