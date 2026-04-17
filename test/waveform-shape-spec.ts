import WaveformShape from "../src/waveform-shape";

describe("WaveformShape", () => {
	describe("scaleY", () => {
		describe("with default scale", () => {
			it("should scale the maximum amplitude value", () => {
				expect(WaveformShape.scaleY(127, 500, 1.0)).to.equal(0);
			});

			it("should scale the minimum amplitude value", () => {
				expect(WaveformShape.scaleY(-128, 500, 1.0)).to.equal(499);
			});
		});

		describe("with half scale", () => {
			it("should scale the maximum amplitude value", () => {
				expect(WaveformShape.scaleY(127, 500, 0.5)).to.equal(124);
			});

			it("should scale the minimum amplitude value", () => {
				expect(WaveformShape.scaleY(-128, 500, 0.5)).to.equal(373);
			});
		});

		describe("with double scale", () => {
			it("should scale and clamp the maximum amplitude value", () => {
				expect(WaveformShape.scaleY(127, 500, 2.0)).to.equal(0);
			});

			it("should scale and clamp the minimum amplitude value", () => {
				expect(WaveformShape.scaleY(-128, 500, 2.0)).to.equal(499);
			});
		});
	});
});
