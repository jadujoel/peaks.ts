describe("TypeScript migration", () => {
	it("keeps handwritten JavaScript files out of source, tests, and custom marker demos", () => {
		const allowedGeneratedFiles = ["../demo/custom-markers/custom-markers.js"];
		const javascriptFiles = Object.keys(
			import.meta.glob([
				"../src/**/*.js",
				"../test/**/*.js",
				"../demo/custom-markers/**/*.js",
			]),
		).filter((filePath) => !allowedGeneratedFiles.includes(filePath));

		expect(javascriptFiles).toEqual([]);
	});
});
