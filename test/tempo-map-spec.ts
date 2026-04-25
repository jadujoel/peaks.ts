import {
	gridTimes,
	snapTime,
	stepDurationSeconds,
	TempoMap,
	tempoSectionAt,
} from "../src/tempo-map";

describe("TempoMap", () => {
	describe("from", () => {
		it("rejects empty sections", () => {
			const result = TempoMap.from({ sections: [] });
			expect(result.isErr()).to.equal(true);
		});

		it("rejects when first section is not at 0", () => {
			const result = TempoMap.from({
				sections: [{ bpm: 120, time: 1 }],
			});
			expect(result.isErr()).to.equal(true);
		});

		it("rejects non-ascending sections", () => {
			const result = TempoMap.from({
				sections: [
					{ bpm: 120, time: 0 },
					{ bpm: 140, time: 0 },
				],
			});
			expect(result.isErr()).to.equal(true);
		});

		it("rejects bpm <= 0", () => {
			const result = TempoMap.from({
				sections: [{ bpm: 0, time: 0 }],
			});
			expect(result.isErr()).to.equal(true);
		});

		it("accepts valid sorted sections", () => {
			const result = TempoMap.from({
				sections: [
					{ bpm: 120, time: 0 },
					{ bpm: 150, time: 10 },
				],
			});
			expect(result.isOk()).to.equal(true);
		});
	});

	describe("constant", () => {
		it("creates a single-section map", () => {
			const map = TempoMap.constant({ bpm: 120 });
			expect(map.sections.length).to.equal(1);
			expect(map.sections[0]?.bpm).to.equal(120);
		});
	});

	describe("tempoSectionAt", () => {
		const map = TempoMap.constant({ bpm: 120 });

		it("returns first section for time 0", () => {
			expect(tempoSectionAt(map, 0).bpm).to.equal(120);
		});

		it("binary-searches multi-section maps", () => {
			const multi = TempoMap.from({
				sections: [
					{ bpm: 120, time: 0 },
					{ bpm: 150, time: 10 },
					{ bpm: 90, time: 20 },
				],
			})._unsafeUnwrap();
			expect(tempoSectionAt(multi, 5).bpm).to.equal(120);
			expect(tempoSectionAt(multi, 10).bpm).to.equal(150);
			expect(tempoSectionAt(multi, 19.999).bpm).to.equal(150);
			expect(tempoSectionAt(multi, 20).bpm).to.equal(90);
			expect(tempoSectionAt(multi, 1000).bpm).to.equal(90);
		});
	});

	describe("stepDurationSeconds", () => {
		const section = { bpm: 120, time: 0 };

		it("returns 0.5s for 1/4 at 120 BPM (4/4)", () => {
			expect(stepDurationSeconds(section, "1/4")).to.be.closeTo(0.5, 1e-9);
		});

		it("returns 0.25s for 1/8 at 120 BPM", () => {
			expect(stepDurationSeconds(section, "1/8")).to.be.closeTo(0.25, 1e-9);
		});

		it("supports triplets", () => {
			expect(
				stepDurationSeconds(section, { denominator: 4, tuplet: "triplet" }),
			).to.be.closeTo((0.5 * 2) / 3, 1e-9);
		});

		it("supports dotted", () => {
			expect(
				stepDurationSeconds(section, { denominator: 4, tuplet: "dotted" }),
			).to.be.closeTo(0.5 * 1.5, 1e-9);
		});

		it("respects time signature denominator", () => {
			expect(
				stepDurationSeconds(
					{
						bpm: 120,
						signature: { denominator: 8, numerator: 6 },
						time: 0,
					},
					"1/8",
				),
			).to.be.closeTo(0.5, 1e-9);
		});
	});

	describe("snapTime", () => {
		const map = TempoMap.constant({ bpm: 120 }); // step 1/4 = 0.5s

		it("returns input when no map", () => {
			expect(snapTime(undefined, "1/4", 1.234)).to.equal(1.234);
		});

		it("rounds to nearest grid", () => {
			expect(snapTime(map, "1/4", 0.6)).to.be.closeTo(0.5, 1e-9);
			expect(snapTime(map, "1/4", 0.3)).to.be.closeTo(0.5, 1e-9);
			expect(snapTime(map, "1/4", 0.24)).to.be.closeTo(0, 1e-9);
		});

		it("snaps within active section after tempo change", () => {
			const multi = TempoMap.from({
				sections: [
					{ bpm: 120, time: 0 },
					{ bpm: 150, time: 10 },
				],
			})._unsafeUnwrap();
			// At 150 BPM, 1/4 = 0.4s; section starts at 10, so grid = 10, 10.4, 10.8...
			expect(snapTime(multi, "1/4", 10.5)).to.be.closeTo(10.4, 1e-9);
			expect(snapTime(multi, "1/4", 10.7)).to.be.closeTo(10.8, 1e-9);
		});

		it("handles negative times by clamping section lookup", () => {
			expect(snapTime(map, "1/4", -0.1)).to.be.closeTo(0, 1e-9);
		});
	});

	describe("gridTimes", () => {
		const map = TempoMap.constant({ bpm: 120 });

		it("yields grid times in window", () => {
			const times = [...gridTimes(map, "1/4", 0, 1.5)].map((g) => g.time);
			expect(times).to.deep.equal([0, 0.5, 1, 1.5]);
		});

		it("respects start of window", () => {
			const times = [...gridTimes(map, "1/4", 0.5, 1.5)].map((g) => g.time);
			expect(times[0]).to.be.closeTo(0.5, 1e-9);
		});

		it("crosses tempo sections", () => {
			const multi = TempoMap.from({
				sections: [
					{ bpm: 120, time: 0 }, // 1/4 = 0.5s
					{ bpm: 60, time: 1 }, // 1/4 = 1.0s
				],
			})._unsafeUnwrap();
			const times = [...gridTimes(multi, "1/4", 0, 3)].map((g) =>
				Number(g.time.toFixed(3)),
			);
			expect(times).to.include.members([0, 0.5, 1, 2, 3]);
		});

		it("yields nothing for inverted window", () => {
			const out = [...gridTimes(map, "1/4", 5, 1)];
			expect(out.length).to.equal(0);
		});
	});
});
