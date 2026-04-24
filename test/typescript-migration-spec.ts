describe("TypeScript migration", () => {
	it("keeps handwritten JavaScript files out of source and tests", () => {
		const javascriptFiles = Object.keys(
			import.meta.glob(["../src/**/*.js", "../test/**/*.js"]),
		);

		expect(javascriptFiles).toEqual([]);
	});
});
