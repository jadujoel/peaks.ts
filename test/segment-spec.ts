import sinon from "sinon";
import { Peaks } from "../src/main";
import { Segment } from "../src/segment";

describe("Segment", () => {
	describe("update", () => {
		let p = null;

		beforeEach((done: DoneCallback) => {
			const options = {
				dataUri: { arraybuffer: "base/test/data/sample.dat" },
				mediaElement: document.getElementById("media"),
				overview: {
					container: document.getElementById("overview-container"),
				},
				zoomview: {
					container: document.getElementById("zoomview-container"),
				},
			};

			Peaks.init(options, (err, instance) => {
				expect(err).to.equal(undefined);
				p = instance;
				done();
			});
		});

		afterEach(() => {
			if (p) {
				p.destroy();
			}
		});

		it("should be possible to update all properties programatically", () => {
			p.segments.add({
				borderColor: "#00ff00",
				color: "#ff0000",
				editable: true,
				endTime: 10,
				labelText: "label text",
				startTime: 0,
			});

			const emit = sinon.spy(p, "emit");

			const segment = p.segments.getSegments()[0];

			segment.update({
				borderColor: "#008000",
				color: "#800000",
				editable: false,
				endTime: 9,
				labelText: "new label text",
				startTime: 2,
			});

			expect(segment.startTime).to.equal(2);
			expect(segment.endTime).to.equal(9);
			expect(segment.editable).to.equal(false);
			expect(segment.color).to.equal("#800000");
			expect(segment.borderColor).to.equal("#008000");
			expect(segment.labelText).to.equal("new label text");

			expect(emit.callCount).to.equal(1);
			expect(emit).to.have.been.calledWith("segments.update", segment);
		});

		it("should not allow startTime to be greater than endTime", () => {
			p.segments.add({ endTime: 10, labelText: "test", startTime: 0 });

			const segment = p.segments.getSegments()[0];

			expect(() => {
				segment.update({ endTime: 3, startTime: 8 });
			}).to.throw(RangeError);
		});

		it("should not allow startTime to be invalid", () => {
			p.segments.add({ endTime: 10, labelText: "test", startTime: 0 });

			const segment = p.segments.getSegments()[0];

			expect(() => {
				segment.update({ startTime: NaN });
			}).to.throw(TypeError);
		});

		it("should not allow endTime to be invalid", () => {
			p.segments.add({ endTime: 10, labelText: "test", startTime: 0 });

			const segment = p.segments.getSegments()[0];

			expect(() => {
				segment.update({ endTime: NaN });
			}).to.throw(TypeError);
		});

		it("should not allow id to be null", () => {
			p.segments.add({ endTime: 10, labelText: "test", startTime: 0 });

			const segment = p.segments.getSegments()[0];

			expect(() => {
				segment.update({ id: null });
			}).to.throw(TypeError);
		});

		it("should not allow id to be undefined", () => {
			p.segments.add({ endTime: 10, labelText: "test", startTime: 0 });

			const segment = p.segments.getSegments()[0];

			expect(() => {
				segment.update({ id: undefined });
			}).to.throw(TypeError);
		});

		it("should not update any attributes if invalid", () => {
			p.segments.add({
				borderColor: "#00ff00",
				color: "#ff0000",
				editable: true,
				endTime: 10,
				labelText: "A segment",
				startTime: 0,
			});

			const emit = sinon.spy(p, "emit");

			const segment = p.segments.getSegments()[0];

			expect(() => {
				segment.update({
					borderColor: "#0000ff",
					color: "#000000",
					editable: false,
					endTime: 0,
					labelText: "Updated",
					startTime: 10,
				});
			}).to.throw(RangeError);

			expect(segment.startTime).to.equal(0);
			expect(segment.endTime).to.equal(10);
			expect(segment.editable).to.equal(true);
			expect(segment.color).to.equal("#ff0000");
			expect(segment.borderColor).to.equal("#00ff00");
			expect(segment.labelText).to.equal("A segment");

			expect(emit.callCount).to.equal(0);
		});

		it("should allow the segment id to be updated", () => {
			const segment = p.segments.add({
				borderColor: "#00ff00",
				color: "#ff0000",
				editable: true,
				endTime: 10,
				id: "segment1",
				labelText: "label text",
				startTime: 0,
			});

			expect(p.segments.getSegment("segment1")).to.be.ok;
			expect(p.segments.getSegment("segment2")).to.equal(undefined);

			segment.update({
				id: "segment2",
			});

			expect(p.segments.getSegment("segment1")).to.equal(undefined);
			expect(p.segments.getSegment("segment2")).to.be.ok;
		});

		it("should not allow the segment id to be updated to be a duplicate", () => {
			const segment = p.segments.add({
				borderColor: "#00ff00",
				color: "#ff0000",
				editable: true,
				endTime: 10,
				id: "segment1",
				labelText: "label text",
				startTime: 0,
			});

			p.segments.add({
				borderColor: "#00ff00",
				color: "#ff0000",
				editable: true,
				endTime: 20,
				id: "segment2",
				labelText: "label text",
				startTime: 10,
			});

			expect(() => {
				segment.update({
					id: "segment2",
				});
			}).to.throw(Error);
		});

		it("should not allow the overlay attribute to be updated", () => {
			p.segments.add({ endTime: 10, labelText: "test", startTime: 0 });

			const segment = p.segments.getSegments()[0];

			expect(() => {
				segment.update({ overlay: false });
			}).to.throw(TypeError);
		});

		it("should not allow the markers attribute to be updated", () => {
			p.segments.add({ endTime: 10, labelText: "test", startTime: 0 });

			const segment = p.segments.getSegments()[0];

			expect(() => {
				segment.update({ markers: false });
			}).to.throw(TypeError);
		});

		it("should allow a user data attribute to be created", () => {
			const peaks = { emit: () => {} };
			const pid = 0;

			const segment = Segment.from({
				options: {
					editable: true,
					endTime: 10.0,
					id: "segment.1",
					labelText: "",
					startTime: 0.0,
				},
				peaks,
				pid,
			});

			segment.update({ data: "test" });

			expect(segment.data).to.equal("test");
		});

		it("should allow a user data attribute to be updated", () => {
			const peaks = { emit: () => {} };
			const pid = 0;

			const segment = Segment.from({
				options: {
					data: "test",
					editable: true,
					endTime: 10.0,
					id: "segment.1",
					labelText: "",
					startTime: 0.0,
				},
				peaks,
				pid,
			});

			segment.update({ data: "updated" });

			expect(segment.data).to.equal("updated");
		});

		[
			"update",
			"isVisible",
			"peaks",
			"pid",
			"_id",
			"_pid",
			"_startTime",
			"_endTime",
			"_labelText",
			"_color",
			"_borderColor",
			"_overlay",
			"_markers",
			"_editable",
		].forEach((name) => {
			it(`should not allow an invalid user data attribute name: ${name}`, () => {
				expect(() => {
					const peaks = { emit: () => {} };
					const pid = 0;

					const segment = Segment.from({
						options: {
							editable: true,
							endTime: 10.0,
							id: "segment.1",
							labelText: "",
							startTime: 0.0,
						},
						peaks,
						pid,
					});

					const attributes = {};

					attributes[name] = "test";

					segment.update(attributes);
				}).to.throw(Error);
			});
		});
	});

	describe("isVisible", () => {
		it("should return false if segment is before visible range", () => {
			const peaks = { emit: () => {} };
			const pid = 0;

			const segment = Segment.from({
				options: {
					editable: true,
					endTime: 10.0,
					id: "segment.1",
					labelText: "",
					startTime: 0.0,
				},
				peaks,
				pid,
			});

			expect(segment.isVisible(10.0, 20.0)).to.equal(false);
		});

		it("should return false if segment is after visible range", () => {
			const peaks = { emit: () => {} };
			const pid = 0;

			const segment = Segment.from({
				options: {
					editable: true,
					endTime: 30.0,
					id: "segment.1",
					labelText: "",
					startTime: 20.0,
				},
				peaks,
				pid,
			});

			expect(segment.isVisible(10.0, 20.0)).to.equal(false);
		});

		it("should return true if segment is within visible range", () => {
			const peaks = { emit: () => {} };
			const pid = 0;

			const segment = Segment.from({
				options: {
					editable: true,
					endTime: 18.0,
					id: "segment.1",
					labelText: "",
					startTime: 12.0,
				},
				peaks,
				pid,
			});

			expect(segment.isVisible(10.0, 20.0)).to.equal(true);
		});

		it("should return true if segment starts before and ends within visible range", () => {
			const peaks = { emit: () => {} };
			const pid = 0;

			const segment = Segment.from({
				options: {
					editable: true,
					endTime: 19.0,
					id: "segment.1",
					labelText: "",
					startTime: 9.0,
				},
				peaks,
				pid,
			});

			expect(segment.isVisible(10.0, 20.0)).to.equal(true);
		});

		it("should return true if segment starts before and ends at end of visible range", () => {
			const peaks = { emit: () => {} };
			const pid = 0;

			const segment = Segment.from({
				options: {
					editable: true,
					endTime: 20.0,
					id: "segment.1",
					labelText: "",
					startTime: 9.0,
				},
				peaks,
				pid,
			});

			expect(segment.isVisible(10.0, 20.0)).to.equal(true);
		});

		it("should return true if segment starts after and ends after visible range", () => {
			const peaks = { emit: () => {} };
			const pid = 0;

			const segment = Segment.from({
				options: {
					editable: true,
					endTime: 21.0,
					id: "segment.1",
					labelText: "",
					startTime: 11.0,
				},
				peaks,
				pid,
			});

			expect(segment.isVisible(10.0, 20.0)).to.equal(true);
		});

		it("should return true if segment starts after and ends at the end of visible range", () => {
			const peaks = { emit: () => {} };
			const pid = 0;

			const segment = Segment.from({
				options: {
					editable: true,
					endTime: 20.0,
					id: "segment.1",
					labelText: "",
					startTime: 11.0,
				},
				peaks,
				pid,
			});

			expect(segment.isVisible(10.0, 20.0)).to.equal(true);
		});

		it("should return true if segment is same as visible range", () => {
			const peaks = { emit: () => {} };
			const pid = 0;

			const segment = Segment.from({
				options: {
					editable: true,
					endTime: 20.0,
					id: "segment.1",
					labelText: "",
					startTime: 10.0,
				},
				peaks,
				pid,
			});

			expect(segment.isVisible(10.0, 20.0)).to.equal(true);
		});

		it("should return true if segment contains visible range", () => {
			const peaks = { emit: () => {} };
			const pid = 0;

			const segment = Segment.from({
				options: {
					editable: true,
					endTime: 21.0,
					id: "segment.1",
					labelText: "",
					startTime: 9.0,
				},
				peaks,
				pid,
			});

			expect(segment.isVisible(10.0, 20.0)).to.equal(true);
		});

		it("should return true if segment starts at time zero and has zero end time", () => {
			const peaks = { emit: () => {} };
			const pid = 0;

			const segment = Segment.from({
				options: {
					editable: true,
					endTime: 0.0,
					id: "segment.1",
					labelText: "",
					startTime: 0.0,
				},
				peaks,
				pid,
			});

			expect(segment.isVisible(0.0, 10.0)).to.equal(true);
		});
	});
});
