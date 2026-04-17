import Peaks from "../src/main";

describe("SegmentsLayer", () => {
	let p;

	beforeEach((done) => {
		const options = {
			overview: {
				container: document.getElementById("overview-container"),
			},
			zoomview: {
				container: document.getElementById("zoomview-container"),
			},
			mediaElement: document.getElementById("media"),
			dataUri: {
				json: "base/test/data/sample.json",
			},
		};

		Peaks.init(options, (err, instance) => {
			expect(err).to.equal(null);
			p = instance;
			done();
		});
	});

	afterEach(() => {
		if (p) {
			p.destroy();
			p = null;
		}
	});

	context("when adding a segment", () => {
		it("should create a segment shape if the segment is visible", () => {
			const zoomview = p.views.getView("zoomview");
			expect(zoomview).to.be.ok;

			const spy = sinon.spy(zoomview._segmentsLayer, "_createSegmentShape");

			p.segments.add({
				startTime: 0,
				endTime: 10,
				editable: true,
				id: "segment1",
			});

			expect(spy.callCount).to.equal(1);
		});

		it("should not create a segment shape if the segment is not visible", () => {
			const zoomview = p.views.getView("zoomview");
			expect(zoomview).to.be.ok;

			const spy = sinon.spy(zoomview._segmentsLayer, "_createSegmentShape");

			p.segments.add({
				startTime: 30,
				endTime: 40,
				editable: true,
				id: "segment2",
			});

			expect(spy.callCount).to.equal(0);
		});
	});

	context("when updating a segment", () => {
		it("should move the segment start marker if its time has changed", () => {
			const zoomview = p.views.getView("zoomview");
			expect(zoomview).to.be.ok;

			const segment = p.segments.add({
				startTime: 0.0,
				endTime: 2.0,
				editable: true,
			});

			const segmentShape = zoomview._segmentsLayer.getSegmentShape(segment);
			expect(segmentShape).to.be.ok;

			expect(segmentShape._startMarker.getX()).to.equal(0);
			expect(segmentShape._endMarker.getX()).to.equal(
				Math.floor((2.0 * 44100) / p.zoom.getZoomLevel()),
			);

			const startMarkerUpdate = sinon.spy(segmentShape._startMarker, "update");
			const endMarkerUpdate = sinon.spy(segmentShape._endMarker, "update");

			segment.update({ startTime: 1.0 });

			expect(segmentShape._startMarker.getX()).to.equal(
				Math.floor((1.0 * 44100) / p.zoom.getZoomLevel()),
			);
			expect(segmentShape._endMarker.getX()).to.equal(
				Math.floor((2.0 * 44100) / p.zoom.getZoomLevel()),
			);

			expect(startMarkerUpdate).calledOnceWithExactly({ startTime: 1.0 });
			expect(endMarkerUpdate).calledOnceWithExactly({ startTime: 1.0 });
		});

		it("should move the segment end marker if its time has changed", () => {
			const zoomview = p.views.getView("zoomview");
			expect(zoomview).to.be.ok;

			const segment = p.segments.add({
				startTime: 0.0,
				endTime: 2.0,
				editable: true,
			});

			const segmentShape = zoomview._segmentsLayer.getSegmentShape(segment);
			expect(segmentShape).to.be.ok;

			expect(segmentShape._startMarker.getX()).to.equal(0);

			const startMarkerUpdate = sinon.spy(segmentShape._startMarker, "update");
			const endMarkerUpdate = sinon.spy(segmentShape._endMarker, "update");

			segment.update({ endTime: 3.0 });

			expect(segmentShape._endMarker.getX()).to.equal(
				Math.floor((3.0 * 44100) / p.zoom.getZoomLevel()),
			);

			expect(startMarkerUpdate).calledOnceWithExactly({ endTime: 3.0 });
			expect(endMarkerUpdate).calledOnceWithExactly({ endTime: 3.0 });
		});

		it("should update the segment if it is visible", () => {
			const zoomview = p.views.getView("zoomview");
			expect(zoomview).to.be.ok;

			const createSegmentShape = sinon.spy(
				zoomview._segmentsLayer,
				"_createSegmentShape",
			);

			const segment = p.segments.add({
				startTime: 0,
				endTime: 10,
				editable: true,
				id: "segment1",
			});

			const segmentShape = zoomview._segmentsLayer.getSegmentShape(segment);
			expect(segmentShape).to.be.ok;

			const startMarkerUpdate = sinon.spy(segmentShape._startMarker, "update");
			const endMarkerUpdate = sinon.spy(segmentShape._endMarker, "update");

			segment.update({ labelText: "test" });

			expect(createSegmentShape.callCount).to.equal(1);
			expect(startMarkerUpdate.callCount).to.equal(1);
			expect(endMarkerUpdate.callCount).to.equal(1);
		});

		it("should add the segment if it has become visible", () => {
			const zoomview = p.views.getView("zoomview");
			expect(zoomview).to.be.ok;

			const createSegmentShape = sinon.spy(
				zoomview._segmentsLayer,
				"_createSegmentShape",
			);

			const segment = p.segments.add({
				startTime: 30,
				endTime: 40,
				editable: true,
			});

			expect(createSegmentShape.callCount).to.equal(0);

			const segmentShape = zoomview._segmentsLayer.getSegmentShape(segment);
			expect(segmentShape).to.equal(undefined);

			segment.update({ startTime: 0, endTime: 10 });

			expect(createSegmentShape.callCount).to.equal(1);
		});

		it("should remove the segment if it is no longer visible", () => {
			const zoomview = p.views.getView("zoomview");
			expect(zoomview).to.be.ok;

			const createSegmentShape = sinon.spy(
				zoomview._segmentsLayer,
				"_createSegmentShape",
			);
			const removeSegment = sinon.spy(
				zoomview._segmentsLayer,
				"_removeSegment",
			);

			const segment = p.segments.add({
				startTime: 0,
				endTime: 10,
				editable: true,
			});

			const segmentShape = zoomview._segmentsLayer.getSegmentShape(segment);
			expect(segmentShape).to.be.ok;

			const startMarkerDestroy = sinon.spy(
				segmentShape._startMarker,
				"destroy",
			);
			const endMarkerDestroy = sinon.spy(segmentShape._endMarker, "destroy");

			segment.update({ startTime: 30, endTime: 40 });

			expect(createSegmentShape.callCount).to.equal(1);
			expect(removeSegment.callCount).to.equal(1);
			expect(startMarkerDestroy.callCount).to.equal(1);
			expect(endMarkerDestroy.callCount).to.equal(1);
		});
	});
});
