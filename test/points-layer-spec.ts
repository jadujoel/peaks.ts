import sinon from "sinon";
import { Peaks } from "../src/main";

describe("PointsLayer", () => {
	let p = null;

	beforeEach((done: DoneCallback) => {
		const options = {
			dataUri: {
				json: "base/test/data/sample.json",
			},
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
			p.dispose();
			p = null;
		}
	});

	describe("when adding a point", () => {
		it("should create a point marker if the point is visible", () => {
			const zoomview = p.views.getView("zoomview");
			expect(zoomview).to.be.ok;

			const createPointMarker = sinon.spy(
				zoomview.pointsLayer,
				"createPointMarker",
			);

			p.points.add({ editable: true, time: 0 });

			expect(createPointMarker.callCount).to.equal(1);
		});

		it("should not create a point marker if the point is not visible", () => {
			const zoomview = p.views.getView("zoomview");
			expect(zoomview).to.be.ok;

			const createPointMarker = sinon.spy(
				zoomview.pointsLayer,
				"createPointMarker",
			);

			p.points.add({ editable: true, time: 30 });

			expect(createPointMarker.callCount).to.equal(0);
		});
	});

	describe("when updating a point", () => {
		it("should move the point marker if its time has changed", () => {
			const zoomview = p.views.getView("zoomview");
			expect(zoomview).to.be.ok;

			const overview = p.views.getView("overview");
			expect(overview).to.be.ok;

			const point = p.points.add({ editable: true, time: 0 });

			const zoomviewPointMarker = zoomview.pointsLayer.getPointMarker(point);
			expect(zoomviewPointMarker).to.be.ok;

			expect(zoomviewPointMarker.getX()).to.equal(0);

			const overviewPointMarker = overview.pointsLayer.getPointMarker(point);
			expect(overviewPointMarker).to.be.ok;

			expect(overviewPointMarker.getX()).to.equal(0);

			const zoomviewPointMarkerUpdate = sinon.spy(
				zoomviewPointMarker,
				"update",
			);
			const overviewPointMarkerUpdate = sinon.spy(
				overviewPointMarker,
				"update",
			);

			point.update({ time: 5.0 });

			expect(zoomviewPointMarker.getX()).to.equal(
				Math.floor((5.0 * 44100) / p.zoom.getZoomLevel()),
			);
			expect(zoomviewPointMarkerUpdate).calledOnceWithExactly({ time: 5.0 });

			expect(overviewPointMarker.getX()).to.equal(
				Math.floor((5.0 * 44100) / overview.data.scale),
			);
			expect(overviewPointMarkerUpdate).calledOnceWithExactly({ time: 5.0 });
		});

		it("should remove the point marker if its time has changed and is no longer visible", () => {
			const zoomview = p.views.getView("zoomview");
			expect(zoomview).to.be.ok;

			const createPointMarker = sinon.spy(
				zoomview.pointsLayer,
				"createPointMarker",
			);
			const removePoint = sinon.spy(zoomview.pointsLayer, "removePoint");

			const point = p.points.add({ editable: true, time: 0 });

			const pointMarker = zoomview.pointsLayer.getPointMarker(point);
			expect(pointMarker).to.be.ok;

			const pointMarkerDispose = sinon.spy(pointMarker, "dispose");

			point.update({ time: 30.0 });

			expect(createPointMarker.callCount).to.equal(1);
			expect(removePoint.callCount).to.equal(1);
			expect(pointMarkerDispose.callCount).to.equal(1);
		});

		it("should update the point marker if it is visible", () => {
			const zoomview = p.views.getView("zoomview");
			expect(zoomview).to.be.ok;

			const createPointMarker = sinon.spy(
				zoomview.pointsLayer,
				"createPointMarker",
			);

			const point = p.points.add({ editable: true, time: 0 });

			const pointMarker = zoomview.pointsLayer.getPointMarker(point);
			expect(pointMarker).to.be.ok;

			const pointMarkerUpdate = sinon.spy(pointMarker, "update");

			point.update({ labelText: "test" });

			expect(createPointMarker.callCount).to.equal(1);
			expect(pointMarkerUpdate.callCount).to.equal(1);
		});

		it("should add the point marker if it has become visible", () => {
			const zoomview = p.views.getView("zoomview");
			expect(zoomview).to.be.ok;

			const createPointMarker = sinon.spy(
				zoomview.pointsLayer,
				"createPointMarker",
			);

			const point = p.points.add({ editable: true, time: 30 });

			expect(createPointMarker.callCount).to.equal(0);

			const pointMarker = zoomview.pointsLayer.getPointMarker(point);
			expect(pointMarker).to.equal(undefined);

			point.update({ labelText: "test", time: 0 });

			expect(createPointMarker.callCount).to.equal(1);
		});

		it("should remove the pointMarker if it is no longer visible", () => {
			const zoomview = p.views.getView("zoomview");
			expect(zoomview).to.be.ok;

			const createPointMarker = sinon.spy(
				zoomview.pointsLayer,
				"createPointMarker",
			);
			const removePoint = sinon.spy(zoomview.pointsLayer, "removePoint");

			const point = p.points.add({ editable: true, time: 0 });

			const pointMarker = zoomview.pointsLayer.getPointMarker(point);
			expect(pointMarker).to.be.ok;

			const pointMarkerDispose = sinon.spy(pointMarker, "dispose");

			point.update({ labelText: "test", time: 30 });

			expect(createPointMarker.callCount).to.equal(1);
			expect(removePoint.callCount).to.equal(1);
			expect(pointMarkerDispose.callCount).to.equal(1);
		});
	});
});
