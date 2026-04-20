import sinon from "sinon";
import { Peaks } from "../src/main";
import { Point } from "../src/point";

describe("Point", () => {
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
			p.points.add({
				color: "#ff0000",
				editable: true,
				labelText: "A point",
				time: 10,
			});

			const emit = sinon.spy(p, "emit");

			const point = p.points.getPoints()[0];

			point.update({
				color: "#800000",
				editable: false,
				labelText: "new label text",
				time: 12,
			});

			expect(point.time).to.equal(12);
			expect(point.editable).to.equal(false);
			expect(point.color).to.equal("#800000");
			expect(point.labelText).to.equal("new label text");

			expect(emit.callCount).to.equal(1);
			expect(emit).to.have.been.calledWith("points.update", point);
		});

		it("should not allow the point time to be invalid", () => {
			p.points.add({
				color: "#ff0000",
				editable: true,
				labelText: "A point",
				time: 10,
			});

			const point = p.points.getPoints()[0];

			expect(() => {
				point.update({ time: NaN });
			}).to.throw(TypeError);
		});

		it("should not allow the point time to be negative", () => {
			p.points.add({
				color: "#ff0000",
				editable: true,
				labelText: "A point",
				time: 10,
			});

			const point = p.points.getPoints()[0];

			expect(() => {
				point.update({ time: -10 });
			}).to.throw(RangeError);
		});

		it("should not allow labelText to be undefined", () => {
			p.points.add({
				color: "#ff0000",
				editable: true,
				labelText: "A point",
				time: 10,
			});

			const point = p.points.getPoints()[0];

			expect(() => {
				point.update({ labelText: undefined });
			}).to.throw(TypeError);
		});

		it("should not allow id to be null", () => {
			p.points.add({
				color: "#ff0000",
				editable: true,
				labelText: "A point",
				time: 10,
			});

			const point = p.points.getPoints()[0];

			expect(() => {
				point.update({ id: null });
			}).to.throw(TypeError);
		});

		it("should not allow id to be undefined", () => {
			p.points.add({
				color: "#ff0000",
				editable: true,
				labelText: "A point",
				time: 10,
			});

			const point = p.points.getPoints()[0];

			expect(() => {
				point.update({ id: undefined });
			}).to.throw(TypeError);
		});

		it("should not update any attributes if invalid", () => {
			p.points.add({
				color: "#ff0000",
				editable: true,
				labelText: "A point",
				time: 10,
			});

			const emit = sinon.spy(p, "emit");

			const point = p.points.getPoints()[0];

			expect(() => {
				point.update({
					color: "#000000",
					editable: false,
					labelText: "Updated",
					time: NaN,
				});
			}).to.throw(TypeError);

			expect(point.time).to.equal(10);
			expect(point.editable).to.equal(true);
			expect(point.color).to.equal("#ff0000");
			expect(point.labelText).to.equal("A point");

			expect(emit.callCount).to.equal(0);
		});

		it("should allow the point id to be updated", () => {
			const point = p.points.add({
				color: "#ff0000",
				editable: true,
				id: "point1",
				labelText: "label text",
				time: 10,
			});

			expect(p.points.getPoint("point1")).to.be.ok;
			expect(p.points.getPoint("point2")).to.equal(undefined);

			point.update({
				id: "point2",
			});

			expect(p.points.getPoint("point1")).to.equal(undefined);
			expect(p.points.getPoint("point2")).to.be.ok;
		});

		it("should not allow the point id to be updated to be a duplicate", () => {
			const point = p.points.add({
				color: "#ff0000",
				editable: true,
				id: "point1",
				labelText: "label text",
				time: 10,
			});

			p.points.add({
				color: "#ff0000",
				editable: true,
				id: "point2",
				labelText: "label text",
				time: 11,
			});

			expect(() => {
				point.update({
					id: "point2",
				});
			}).to.throw(Error);
		});

		it("should allow a user data attribute to be created", () => {
			const peaks = { emit: () => {} };
			const pid = 0;

			const point = Point.from({
				options: {
					color: "#000000",
					editable: false,
					id: "point.1",
					labelText: "",
					time: 0.0,
				},
				peaks,
				pid,
			});

			point.update({ data: "test" });

			expect(point.data).to.equal("test");
		});

		it("should allow a user data attribute to be updated", () => {
			const peaks = { emit: () => {} };
			const pid = 0;

			const point = Point.from({
				options: {
					color: "#000000",
					data: "test",
					editable: false,
					id: "point.1",
					labelText: "",
					time: 0.0,
				},
				peaks,
				pid,
			});

			point.update({ data: "updated" });

			expect(point.data).to.equal("updated");
		});

		[
			"update",
			"isVisible",
			"peaks",
			"_id",
			"_pid",
			"_time",
			"_labelText",
			"_color",
			"_editable",
		].forEach((name) => {
			it(`should not allow an invalid user data attribute name: ${name}`, () => {
				expect(() => {
					const peaks = { emit: () => {} };
					const pid = 0;

					const point = Point.from({
						options: {
							color: "#000000",
							editable: false,
							id: "point.1",
							labelText: "",
							time: 0.0,
						},
						peaks,
						pid,
					});

					const attributes = {};

					attributes[name] = "test";

					point.update(attributes);
				}).to.throw(Error);
			});
		});
	});

	describe("isVisible", () => {
		it("should return false if point is before visible range", () => {
			const peaks = { emit: () => {} };
			const pid = 0;

			const point = Point.from({
				options: {
					editable: true,
					id: "point.1",
					labelText: "",
					time: 9.0,
				},
				peaks,
				pid,
			});

			expect(point.isVisible(10.0, 20.0)).to.equal(false);
		});

		it("should return false if point is after visible range", () => {
			const peaks = { emit: () => {} };
			const pid = 0;

			const point = Point.from({
				options: {
					editable: true,
					id: "point.1",
					labelText: "",
					time: 20.0,
				},
				peaks,
				pid,
			});

			expect(point.isVisible(10.0, 20.0)).to.equal(false);
		});

		it("should return true if point is within visible range", () => {
			const peaks = { emit: () => {} };
			const pid = 0;

			const point = Point.from({
				options: {
					editable: true,
					id: "point.1",
					labelText: "",
					time: 10.0,
				},
				peaks,
				pid,
			});

			expect(point.isVisible(10.0, 20.0)).to.equal(true);
		});
	});
});
