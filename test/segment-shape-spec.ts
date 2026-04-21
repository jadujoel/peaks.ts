import sinon from "sinon";
import { Peaks } from "../src/main";
import { SegmentShape } from "../src/segment-shape";
import { extend } from "../src/utils";
import { WaveformShape } from "../src/waveform/shape";

describe("SegmentShape", () => {
	let p = null;

	function createPeaksInstance(options, done) {
		const opts = {
			dataUri: {
				json: "base/test/data/sample.json",
			},
			mediaElement: document.getElementById("media"),
			overview: {
				container: document.getElementById("overview-container"),
				segmentOptions: {},
			},
			segmentOptions: {},
			zoomview: {
				container: document.getElementById("zoomview-container"),
				segmentOptions: {},
			},
		};

		extend(opts.segmentOptions, options.segmentOptions);

		if (options.overview) {
			extend(opts.overview.segmentOptions, options.overview.segmentOptions);
		}

		if (options.zoomview) {
			extend(opts.zoomview.segmentOptions, options.zoomview.segmentOptions);
		}

		Peaks.init(opts, (err, instance) => {
			expect(err).to.equal(undefined);
			p = instance;
			done();
		});
	}

	afterEach(() => {
		if (p) {
			p.dispose();
			p = null;
		}
	});

	describe("with marker style segments", () => {
		[
			{ editable: true, name: "editable" },
			{ editable: false, name: "non-editable" },
		].forEach((test) => {
			describe(`with ${test.name} segments`, () => {
				it("should create marker handles", (done: DoneCallback) => {
					createPeaksInstance(
						{
							segmentOptions: {
								markers: true,
								overlay: false,
							},
						},
						() => {
							const spy = sinon.spy(p.options, "createSegmentMarker");

							p.segments.add({
								editable: test.editable,
								endTime: 10,
								id: "segment1",
								startTime: 0,
							});

							// Two markers in both zoomview and overview
							expect(spy.callCount).to.equal(4);

							let call = spy.getCall(0);

							expect(call.args).to.have.lengthOf(1);
							expect(call.args[0].segment.startTime).to.equal(0);
							expect(call.args[0].segment.endTime).to.equal(10);
							expect(call.args[0].segment.editable).to.equal(test.editable);
							expect(call.args[0].segment.id).to.equal("segment1");
							expect(call.args[0].editable).to.equal(test.editable);
							expect(call.args[0].startMarker).to.equal(true);
							expect(call.args[0].color).to.equal("#aaaaaa");
							expect(call.args[0]).to.have.property("layer");
							expect(call.args[0].view).to.equal("zoomview");

							call = spy.getCall(1);

							expect(call.args).to.have.lengthOf(1);
							expect(call.args[0].segment.startTime).to.equal(0);
							expect(call.args[0].segment.endTime).to.equal(10);
							expect(call.args[0].segment.editable).to.equal(test.editable);
							expect(call.args[0].segment.id).to.equal("segment1");
							expect(call.args[0].editable).to.equal(test.editable);
							expect(call.args[0].startMarker).to.equal(false);
							expect(call.args[0].color).to.equal("#aaaaaa");
							expect(call.args[0]).to.have.property("layer");
							expect(call.args[0].view).to.equal("zoomview");

							call = spy.getCall(2);

							expect(call.args).to.have.lengthOf(1);
							expect(call.args[0].segment.startTime).to.equal(0);
							expect(call.args[0].segment.endTime).to.equal(10);
							expect(call.args[0].segment.editable).to.equal(test.editable);
							expect(call.args[0].segment.id).to.equal("segment1");
							expect(call.args[0].editable).to.equal(false);
							expect(call.args[0].startMarker).to.equal(true);
							expect(call.args[0].color).to.equal("#aaaaaa");
							expect(call.args[0]).to.have.property("layer");
							expect(call.args[0].view).to.equal("overview");

							call = spy.getCall(3);

							expect(call.args).to.have.lengthOf(1);
							expect(call.args[0].segment.startTime).to.equal(0);
							expect(call.args[0].segment.endTime).to.equal(10);
							expect(call.args[0].segment.editable).to.equal(test.editable);
							expect(call.args[0].segment.id).to.equal("segment1");
							expect(call.args[0].editable).to.equal(false);
							expect(call.args[0].startMarker).to.equal(false);
							expect(call.args[0].color).to.equal("#aaaaaa");
							expect(call.args[0]).to.have.property("layer");
							expect(call.args[0].view).to.equal("overview");

							done();
						},
					);
				});
			});
		});

		describe("with no given waveform color", () => {
			it("should use the default color", (done: DoneCallback) => {
				createPeaksInstance(
					{
						segmentOptions: {
							markers: true,
							overlay: false,
						},
					},
					() => {
						const segment = p.segments.add({
							editable: true,
							endTime: 10,
							id: "segment1",
							startTime: 0,
						});

						const zoomview = p.views.getView("zoomview");

						const segmentShape =
							zoomview.segmentsLayer.getSegmentShape(segment);

						expect(segmentShape).to.be.an.instanceOf(SegmentShape);

						expect(segmentShape.waveformShape).to.be.an.instanceOf(
							WaveformShape,
						);
						expect(segmentShape.waveformShape.color).to.equal("#0074d9");
						done();
					},
				);
			});
		});

		describe("with a given waveform color", () => {
			it("should create a waveform segment", (done: DoneCallback) => {
				createPeaksInstance(
					{
						segmentOptions: {
							markers: true,
							overlay: false,
							waveformColor: "#f00",
						},
					},
					() => {
						const segment = p.segments.add({
							color: "#0f0",
							editable: true,
							endTime: 10,
							id: "segment1",
							startTime: 0,
						});

						const zoomview = p.views.getView("zoomview");

						const segmentShape =
							zoomview.segmentsLayer.getSegmentShape(segment);

						expect(segmentShape).to.be.an.instanceOf(SegmentShape);
						expect(segmentShape.waveformShape).to.be.an.instanceOf(
							WaveformShape,
						);
						expect(segmentShape.waveformShape.color).to.equal("#0f0");
						done();
					},
				);
			});
		});

		it("should use view specific segment options", (done: DoneCallback) => {
			createPeaksInstance(
				{
					segmentOptions: {
						markers: true,
						overlay: false,
					},
					zoomview: {
						segmentOptions: {
							endMarkerColor: "#080",
							startMarkerColor: "#0f0",
						},
					},
				},
				() => {
					const segment = p.segments.add({
						editable: true,
						endTime: 10,
						id: "segment1",
						startTime: 0,
					});

					const zoomview = p.views.getView("zoomview");

					const segmentShape = zoomview.segmentsLayer.getSegmentShape(segment);

					expect(segmentShape).to.be.an.instanceOf(SegmentShape);
					expect(
						segmentShape.startMarkerInstance.marker.options.color,
					).to.equal("#0f0");
					expect(segmentShape.endMarkerInstance.marker.options.color).to.equal(
						"#080",
					);

					// Note: We don't test overview-specific options here, as marker style
					// segments in the overview waveform aren't editable, so don't have handles
					done();
				},
			);
		});
	});

	describe("with overlay style segments", () => {
		it("should not create marker handles", (done: DoneCallback) => {
			createPeaksInstance(
				{
					segmentOptions: {
						markers: false,
						overlay: true,
					},
				},
				() => {
					const spy = sinon.spy(p.options, "createSegmentMarker");

					p.segments.add({
						editable: true,
						endTime: 10,
						id: "segment1",
						startTime: 0,
					});

					expect(spy.callCount).to.equal(0);

					done();
				},
			);
		});

		it("should not create a waveform segment", (done: DoneCallback) => {
			createPeaksInstance(
				{
					segmentOptions: {
						markers: false,
						overlay: true,
					},
				},
				() => {
					const segment = p.segments.add({
						editable: true,
						endTime: 10,
						id: "segment1",
						startTime: 0,
					});

					const zoomview = p.views.getView("zoomview");

					const segmentShape = zoomview.segmentsLayer.getSegmentShape(segment);

					expect(segmentShape).to.be.an.instanceOf(SegmentShape);
					expect(segmentShape.waveformShape).to.equal(undefined);
					done();
				},
			);
		});

		it("should create an overlay with default attributes", (done: DoneCallback) => {
			createPeaksInstance(
				{
					segmentOptions: {
						markers: false,
						overlay: true,
					},
				},
				() => {
					const segment = p.segments.add({
						editable: true,
						endTime: 10,
						id: "segment1",
						startTime: 0,
					});

					const zoomview = p.views.getView("zoomview");

					const segmentShape = zoomview.segmentsLayer.getSegmentShape(segment);

					expect(segmentShape).to.be.an.instanceOf(SegmentShape);
					expect(segmentShape.overlayRect.getStroke()).to.equal("#ff0000");
					expect(segmentShape.overlayRect.getStrokeWidth()).to.equal(2);
					expect(segmentShape.overlayRect.getFill()).to.equal("#ff0000");
					expect(segmentShape.overlayRect.getOpacity()).to.equal(0.3);
					expect(segmentShape.overlayRect.getCornerRadius()).to.equal(5);
					done();
				},
			);
		});

		it("should create an overlay with given color", (done: DoneCallback) => {
			createPeaksInstance(
				{
					segmentOptions: {
						markers: false,
						overlay: true,
					},
				},
				() => {
					const segment = p.segments.add({
						borderColor: "#00ff00",
						color: "#0000ff",
						editable: true,
						endTime: 10,
						id: "segment1",
						startTime: 0,
					});

					const zoomview = p.views.getView("zoomview");

					const segmentShape = zoomview.segmentsLayer.getSegmentShape(segment);

					expect(segmentShape).to.be.an.instanceOf(SegmentShape);
					expect(segmentShape.overlayRect.getStroke()).to.equal("#00ff00");
					expect(segmentShape.overlayRect.getStrokeWidth()).to.equal(2);
					expect(segmentShape.overlayRect.getFill()).to.equal("#0000ff");
					expect(segmentShape.overlayRect.getOpacity()).to.equal(0.3);
					expect(segmentShape.overlayRect.getCornerRadius()).to.equal(5);
					done();
				},
			);
		});

		it("should use view specific segment options", (done: DoneCallback) => {
			createPeaksInstance(
				{
					overview: {
						segmentOptions: {
							overlayOffset: 10,
						},
					},
					segmentOptions: {
						markers: false,
						overlay: true,
					},
					zoomview: {
						segmentOptions: {
							overlayOffset: 20,
						},
					},
				},
				() => {
					const segment = p.segments.add({
						editable: true,
						endTime: 10,
						id: "segment1",
						startTime: 0,
					});

					const zoomview = p.views.getView("zoomview");
					const overview = p.views.getView("overview");

					let segmentShape = zoomview.segmentsLayer.getSegmentShape(segment);

					expect(segmentShape).to.be.an.instanceOf(SegmentShape);
					expect(segmentShape.overlayOffset).to.equal(20);

					segmentShape = overview.segmentsLayer.getSegmentShape(segment);

					expect(segmentShape).to.be.an.instanceOf(SegmentShape);
					expect(segmentShape.overlayOffset).to.equal(10);
					done();
				},
			);
		});

		it("should use global color and border color options", (done: DoneCallback) => {
			createPeaksInstance(
				{
					overview: {
						segmentOptions: {
							overlayBorderColor: "#aaa",
							overlayColor: "#888",
						},
					},
					segmentOptions: {
						markers: false,
						overlay: true,
						overlayBorderColor: "#222",
						overlayColor: "#444",
					},
					zoomview: {
						segmentOptions: {
							overlayBorderColor: "#aaa",
							overlayColor: "#888",
						},
					},
				},
				() => {
					const segment = p.segments.add({
						editable: true,
						endTime: 10,
						id: "segment1",
						startTime: 0,
					});

					const zoomview = p.views.getView("zoomview");
					const overview = p.views.getView("overview");

					let segmentShape = zoomview.segmentsLayer.getSegmentShape(segment);

					expect(segmentShape).to.be.an.instanceOf(SegmentShape);
					expect(segmentShape.overlayRect.getStroke()).to.equal("#222");
					expect(segmentShape.overlayRect.getFill()).to.equal("#444");

					segmentShape = overview.segmentsLayer.getSegmentShape(segment);

					expect(segmentShape).to.be.an.instanceOf(SegmentShape);
					expect(segmentShape.overlayRect.getStroke()).to.equal("#222");
					expect(segmentShape.overlayRect.getFill()).to.equal("#444");
					done();
				},
			);
		});
	});
});
