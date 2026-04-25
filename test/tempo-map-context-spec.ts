import { TempoMap } from "../src/tempo-map";
import { TempoMapContext } from "../src/tempo-map-context";

describe("TempoMapContext", () => {
	describe("from", () => {
		it("defaults to 1/4 grid step", () => {
			const ctx = TempoMapContext.from();
			expect(ctx.getGridStep()).to.equal("1/4");
		});

		it("defaults all snap flags to false", () => {
			const ctx = TempoMapContext.from();
			expect(ctx.isSnapEnabled("segments")).to.equal(false);
			expect(ctx.isSnapEnabled("segmentMarkers")).to.equal(false);
			expect(ctx.isSnapEnabled("points")).to.equal(false);
			expect(ctx.isSnapEnabled("insertSegment")).to.equal(false);
		});
	});

	describe("snapTimeFor", () => {
		const map = TempoMap.constant({ bpm: 120 }); // step 0.5s

		it("returns rawTime when no map", () => {
			const ctx = TempoMapContext.from({
				snapFlags: { segments: true },
			});
			expect(ctx.snapTimeFor("segments", 1.234)).to.equal(1.234);
		});

		it("returns rawTime when snap disabled", () => {
			const ctx = TempoMapContext.from({ tempoMap: map });
			expect(ctx.snapTimeFor("segments", 1.234)).to.equal(1.234);
		});

		it("snaps when enabled", () => {
			const ctx = TempoMapContext.from({
				snapFlags: { segments: true },
				tempoMap: map,
			});
			expect(ctx.snapTimeFor("segments", 0.6)).to.be.closeTo(0.5, 1e-9);
		});

		it("respects per-entity override true", () => {
			const ctx = TempoMapContext.from({ tempoMap: map });
			expect(ctx.snapTimeFor("segments", 0.6, true)).to.be.closeTo(0.5, 1e-9);
		});

		it("respects per-entity override false", () => {
			const ctx = TempoMapContext.from({
				snapFlags: { segments: true },
				tempoMap: map,
			});
			expect(ctx.snapTimeFor("segments", 0.6, false)).to.equal(0.6);
		});
	});

	describe("listeners", () => {
		const map = TempoMap.constant({ bpm: 120 });

		it("notifies change listeners on setters", () => {
			let count = 0;
			const ctx = TempoMapContext.from();
			ctx.addChangeListener(() => {
				count++;
			});
			ctx.setTempoMap(map);
			ctx.setGridStep("1/8");
			ctx.setSnapStep("1/16");
			expect(count).to.equal(3);
		});

		it("notifies snap listeners only when value changes", () => {
			const events: number[] = [];
			const ctx = TempoMapContext.from({
				snapFlags: { segments: true },
				tempoMap: map,
			});
			ctx.addSnapListener((event) => {
				events.push(event.snappedTime);
			});
			ctx.snapTimeFor("segments", 0.6);
			ctx.snapTimeFor("segments", 0.5); // already on grid
			expect(events.length).to.equal(1);
			expect(events[0]).to.be.closeTo(0.5, 1e-9);
		});
	});

	describe("setSnapStep", () => {
		it("falls back to grid step when undefined", () => {
			const ctx = TempoMapContext.from({ gridStep: "1/8" });
			expect(ctx.getSnapStep()).to.equal("1/8");
			ctx.setSnapStep("1/16");
			expect(ctx.getSnapStep()).to.equal("1/16");
			ctx.setSnapStep(undefined);
			expect(ctx.getSnapStep()).to.equal("1/8");
		});
	});
});
