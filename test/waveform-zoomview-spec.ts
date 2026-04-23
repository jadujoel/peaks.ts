import sinon from "sinon";
import type { Peaks } from "../src/main";
import { Point } from "../src/point";
import { Segment } from "../src/segment";
import type { WaveformZoomView } from "../src/waveform/zoomview";
import { initPeaks } from "./helpers/init-peaks";
import { InputController } from "./helpers/input-controller";
import { getEmitCalls } from "./helpers/utils";

describe("WaveformZoomView", () => {
	describe("setStartTime", () => {
		let p: Peaks | null = null;
		let zoomview: WaveformZoomView | null = null;

		beforeEach((done: DoneCallback) => {
			const options = {
				dataUri: {
					arraybuffer: "base/test/data/sample.dat",
				},
				mediaElement: document.getElementById("media"),
				overview: {
					container: document.getElementById("overview-container"),
				},
				zoomview: {
					container: document.getElementById("zoomview-container"),
				},
			};

			initPeaks(options, (err, instance) => {
				expect(err).to.equal(undefined);
				p = instance;
				zoomview =
					(instance?.views.getView("zoomview") as
						| WaveformZoomView
						| undefined) ?? null;
				expect(zoomview).to.be.ok;

				done();
			});
		});

		afterEach(() => {
			if (p) {
				p.dispose();
				p = null;
				zoomview = null;
			}
		});

		describe("with a fixed zoom level", () => {
			it("should update the waveform start position", () => {
				const pointsLayerUpdate = sinon.spy(
					zoomview.pointsLayer,
					"updatePoints",
				);
				const segmentsLayerUpdate = sinon.spy(
					zoomview.segmentsLayer,
					"updateSegments",
				);

				zoomview.setStartTime(5.0);

				const startTime = zoomview.pixelsToTime(zoomview.timeToPixels(5.0));
				const endTime = zoomview.pixelsToTime(
					zoomview.timeToPixels(5.0) + 1000,
				);

				expect(zoomview.getStartTime()).to.equal(startTime);

				expect(pointsLayerUpdate).to.be.calledOnceWithExactly(
					startTime,
					endTime,
				);
				expect(segmentsLayerUpdate).to.be.calledOnceWithExactly(
					startTime,
					endTime,
				);
			});

			it("should limit the start time to zero", () => {
				zoomview.setStartTime(-1.0);

				expect(zoomview.getStartTime()).to.equal(0.0);
			});

			it("should emit a zoomview.update event if the start time has changed", () => {
				const spy = sinon.spy();

				p.events.addEventListener("zoomview.update", spy);

				zoomview.setStartTime(5.0);

				expect(spy.callCount).to.equal(1);
				expect(spy.getCall(0).args[0].startTime).to.equal(
					zoomview.pixelsToTime(zoomview.timeToPixels(5.0)),
				);
			});

			it("should not emit a zoomview.update event if the start time has not changed", () => {
				const spy = sinon.spy();

				p.events.addEventListener("zoomview.update", spy);

				zoomview.setStartTime(-1.0);

				expect(spy.callCount).to.equal(0);
			});
		});

		describe("with auto zoom level", () => {
			beforeEach(() => {
				zoomview.setZoom({ seconds: "auto" });
			});

			it("should keep the waveform start position at zero", () => {
				zoomview.setStartTime(5.0);

				expect(zoomview.getStartTime()).to.equal(0.0);
			});

			it("should not emit a zoomview.update event", () => {
				const spy = sinon.spy();

				p.events.addEventListener("zoomview.update", spy);

				zoomview.setStartTime(5.0);

				expect(spy.callCount).to.equal(0);
			});
		});
	});

	describe("enableSegmentDragging", () => {
		let p = null;
		let zoomview = null;
		let inputController = null;

		beforeEach((done: DoneCallback) => {
			const options = {
				dataUri: {
					json: "base/test/data/sample.json",
				},
				mediaElement: document.getElementById("media"),
				overview: {
					container: document.getElementById("overview-container"),
				},
				segments: [
					{ editable: true, endTime: 2.0, id: "segment1", startTime: 1.0 },
					{ editable: true, endTime: 4.0, id: "segment2", startTime: 3.0 },
					{ editable: true, endTime: 12.0, id: "segment3", startTime: 11.0 },
					{ editable: true, endTime: 14.0, id: "segment4", startTime: 13.0 },
				],
				zoomview: {
					container: document.getElementById("zoomview-container"),
				},
			};

			initPeaks(options, (err, instance) => {
				expect(err).to.equal(undefined);

				p = instance;
				zoomview = instance.views.getView("zoomview");
				expect(zoomview).to.be.ok;

				inputController = new InputController("zoomview-container");

				setTimeout(done, 50);
			});
		});

		afterEach(() => {
			if (p) {
				p.dispose();
				p = null;
				zoomview = null;
				inputController = null;
			}
		});

		describe("when enabled", () => {
			beforeEach(() => {
				zoomview.enableSegmentDragging(true);
				zoomview.setWaveformDragMode("scroll");
			});

			describe("when dragging a segment", () => {
				it("should move the segment to the right", () => {
					const distance = 50;

					inputController.mouseDown({ x: 100, y: 50 });
					inputController.mouseMove({ x: 100 + distance, y: 50 });
					inputController.mouseUp({ x: 100 + distance, y: 50 });

					const view = p.views.getView("zoomview");
					const segment = p.segments.getSegment("segment1");

					expect(segment.startTime).to.equal(1.0 + view.pixelsToTime(distance));
					expect(segment.endTime).to.equal(2.0 + view.pixelsToTime(distance));
				});

				it("should move the segment to the left", () => {
					const distance = -50;

					inputController.mouseDown({ x: 100, y: 50 });
					inputController.mouseMove({ x: 100 + distance, y: 50 });
					inputController.mouseUp({ x: 100 + distance, y: 50 });

					const view = p.views.getView("zoomview");
					const segment = p.segments.getSegment("segment1");

					expect(segment.startTime).to.equal(1.0 + view.pixelsToTime(distance));
					expect(segment.endTime).to.equal(2.0 + view.pixelsToTime(distance));
				});

				it("should prevent the start time from becoming less than zero", () => {
					const distance = -100;

					inputController.mouseDown({ x: 100, y: 50 });
					inputController.mouseMove({ x: 100 + distance, y: 50 });
					inputController.mouseUp({ x: 100 + distance, y: 50 });

					const segment = p.segments.getSegment("segment1");

					expect(segment.startTime).to.equal(0.0);
					expect(segment.endTime).to.equal(1.0);
				});

				it("should emit a segments.dragged event", () => {
					const view = p.views.getView("zoomview");
					const emit = sinon.spy(p.events, "dispatch");

					const distance = 50;

					inputController.mouseDown({ x: 100, y: 50 });
					inputController.mouseMove({ x: 100 + distance, y: 50 });
					inputController.mouseUp({ x: 100 + distance, y: 50 });

					const calls = getEmitCalls(emit, "segments.dragged");
					expect(calls.length).to.equal(1);

					expect(calls[0].args[1].segment).to.be.an.instanceof(Segment);
					expect(calls[0].args[1].marker).to.equal(false);
					expect(calls[0].args[1].segment.startTime).to.equal(
						1.0 + view.pixelsToTime(distance),
					);
					expect(calls[0].args[1].segment.endTime).to.equal(
						2.0 + view.pixelsToTime(distance),
					);
				});
			});

			describe("when dragging the waveform", () => {
				it("should scroll the waveform to the right", () => {
					const distance = -50;

					inputController.mouseDown({ x: 50, y: 50 });
					inputController.mouseMove({ x: 50 + distance, y: 50 });
					inputController.mouseUp({ x: 50 + distance, y: 50 });

					const view = p.views.getView("zoomview");

					expect(zoomview.getFrameOffset()).to.equal(50);
					expect(zoomview.getStartTime()).to.equal(view.pixelsToTime(50));
				});

				it("should scroll the waveform to the left", () => {
					zoomview.updateWaveform(500);

					const spy = sinon.spy();

					p.events.addEventListener("zoomview.update", spy);

					const distance = 100;

					inputController.mouseDown({ x: 100, y: 50 });
					inputController.mouseMove({ x: 100 + distance, y: 50 });
					inputController.mouseUp({ x: 100 + distance, y: 50 });

					const view = p.views.getView("zoomview");

					expect(zoomview.getFrameOffset()).to.equal(400);
					expect(zoomview.getStartTime()).to.equal(view.pixelsToTime(400));

					expect(spy.callCount).to.equal(1);
					expect(spy.getCall(0).args[0].startTime).to.equal(
						view.pixelsToTime(400),
					);
				});

				it("should not scroll beyond the start of the waveform", () => {
					const spy = sinon.spy();

					p.events.addEventListener("zoomview.update", spy);

					const distance = 200;

					inputController.mouseDown({ x: 50, y: 50 });
					inputController.mouseMove({ x: 50 + distance, y: 50 });
					inputController.mouseUp({ x: 50 + distance, y: 50 });

					expect(zoomview.getFrameOffset()).to.equal(0);
					expect(zoomview.getStartTime()).to.equal(0);

					expect(spy.callCount).to.equal(0);
				});

				it("should not scroll beyond the end of the waveform", () => {
					zoomview.setStartTime(20);

					const distance = -200;

					inputController.mouseDown({ x: 50, y: 50 });
					inputController.mouseMove({ x: 50 + distance, y: 50 });
					inputController.mouseUp({ x: 50 + distance, y: 50 });

					const view = p.views.getView("zoomview");

					expect(zoomview.getFrameOffset()).to.equal(1826);
					expect(zoomview.getStartTime()).to.equal(view.pixelsToTime(1826));
				});
			});
		});

		describe("when disabled", () => {
			beforeEach(() => {
				zoomview.enableSegmentDragging(false);
			});

			describe("when dragging the waveform view", () => {
				it("should scroll the waveform to the right", () => {
					const spy = sinon.spy();

					p.events.addEventListener("zoomview.update", spy);

					const distance = 100;

					inputController.mouseDown({ x: 100, y: 50 });
					inputController.mouseMove({ x: 100 - distance, y: 50 });
					inputController.mouseUp({ x: 100 - distance, y: 50 });

					const view = p.views.getView("zoomview");

					expect(zoomview.getFrameOffset()).to.equal(100);
					expect(zoomview.getStartTime()).to.equal(view.pixelsToTime(distance));

					expect(spy.callCount).to.equal(1);
					expect(spy.getCall(0).args[0].startTime).to.equal(
						view.pixelsToTime(distance),
					);
				});

				it("should scroll the waveform to the left", () => {
					zoomview.updateWaveform(500);

					const spy = sinon.spy();

					p.events.addEventListener("zoomview.update", spy);

					const distance = 100;

					inputController.mouseDown({ x: 100, y: 50 });
					inputController.mouseMove({ x: 100 + distance, y: 50 });
					inputController.mouseUp({ x: 100 + distance, y: 50 });

					const view = p.views.getView("zoomview");

					expect(zoomview.getFrameOffset()).to.equal(400);
					expect(zoomview.getStartTime()).to.equal(view.pixelsToTime(400));

					expect(spy.callCount).to.equal(1);
					expect(spy.getCall(0).args[0].startTime).to.equal(
						view.pixelsToTime(400),
					);
				});

				it("should prevent the start time from becoming less than zero", () => {
					zoomview.updateWaveform(100);

					const spy = sinon.spy();

					p.events.addEventListener("zoomview.update", spy);

					const distance = 150;

					inputController.mouseDown({ x: 100, y: 50 });
					inputController.mouseMove({ x: 100 + distance, y: 50 });
					inputController.mouseUp({ x: 100 + distance, y: 50 });

					expect(zoomview.getFrameOffset()).to.equal(0);
					expect(zoomview.getStartTime()).to.equal(0);

					expect(spy.callCount).to.equal(1);
					expect(spy.getCall(0).args[0].startTime).to.equal(
						zoomview.pixelsToTime(0),
					);
				});
			});
		});
	});

	describe("setSegmentDragMode", () => {
		[
			{ markers: true, name: "with marker segments", overlay: false },
			{ markers: false, name: "with overlay segments", overlay: true },
		].forEach((test) => {
			describe(test.name, () => {
				let p = null;
				let zoomview = null;
				let inputController = null;

				beforeEach((done: DoneCallback) => {
					const options = {
						dataUri: {
							json: "base/test/data/sample.json",
						},
						mediaElement: document.getElementById("media"),
						overview: {
							container: document.getElementById("overview-container"),
						},
						points: [{ editable: true, id: "point1", time: 7.0 }],
						segmentOptions: {
							markers: test.markers,
							overlay: test.overlay,
						},
						segments: [
							{ editable: true, endTime: 2.0, id: "segment1", startTime: 1.0 },
							{ editable: true, endTime: 4.0, id: "segment2", startTime: 3.0 },
							{
								editable: true,
								endTime: 12.0,
								id: "segment3",
								startTime: 11.0,
							},
							{
								editable: true,
								endTime: 14.0,
								id: "segment4",
								startTime: 13.0,
							},
						],
						zoomview: {
							container: document.getElementById("zoomview-container"),
						},
					};

					initPeaks(options, (err, instance) => {
						expect(err).to.equal(undefined);

						p = instance;
						zoomview = instance.views.getView("zoomview");
						expect(zoomview).to.be.ok;

						zoomview.enableSegmentDragging(true);

						inputController = new InputController("zoomview-container");

						setTimeout(done, 50);
					});
				});

				afterEach(() => {
					if (p) {
						p.dispose();
						p = null;
						zoomview = null;
						inputController = null;
					}
				});

				describe("overlap", () => {
					beforeEach(() => {
						zoomview.setSegmentDragMode("overlap");
					});

					describe("when dragging a segment over the next segment", () => {
						it("should emit a segments.dragged event", () => {
							const view = p.views.getView("zoomview");
							const emit = sinon.spy(p.events, "dispatch");

							const distance = 150;

							inputController.mouseDown({ x: 100, y: 50 });
							inputController.mouseMove({ x: 100 + distance, y: 50 });
							inputController.mouseUp({ x: 100 + distance, y: 50 });

							const calls = getEmitCalls(emit, "segments.dragged");
							expect(calls.length).to.equal(1);

							expect(calls[0].args[1].segment).to.be.an.instanceof(Segment);
							expect(calls[0].args[1].segment.id).to.equal("segment1");
							expect(calls[0].args[1].segment.startTime).to.equal(
								1.0 + view.pixelsToTime(distance),
							);
							expect(calls[0].args[1].segment.endTime).to.equal(
								2.0 + view.pixelsToTime(distance),
							);
						});

						it("should not move the next segment", () => {
							const distance = 150;

							inputController.mouseDown({ x: 100, y: 50 });
							inputController.mouseMove({ x: 100 + distance, y: 50 });
							inputController.mouseUp({ x: 100 + distance, y: 50 });

							const nextSegment = p.segments.getSegment("segment2");

							expect(nextSegment.startTime).to.equal(3.0);
							expect(nextSegment.endTime).to.equal(4.0);
						});
					});

					describe("when dragging a segment over the previous segment", () => {
						it("should emit a segments.dragged event", () => {
							const view = p.views.getView("zoomview");
							const emit = sinon.spy(p.events, "dispatch");

							const distance = -150;

							inputController.mouseDown({ x: 300, y: 50 });
							inputController.mouseMove({ x: 300 + distance, y: 50 });
							inputController.mouseUp({ x: 300 + distance, y: 50 });

							const calls = getEmitCalls(emit, "segments.dragged");
							expect(calls.length).to.equal(1);

							expect(calls[0].args[1].segment).to.be.an.instanceof(Segment);
							expect(calls[0].args[1].segment.id).to.equal("segment2");
							expect(calls[0].args[1].segment.startTime).to.equal(
								3.0 + view.pixelsToTime(distance),
							);
							expect(calls[0].args[1].segment.endTime).to.equal(
								4.0 + view.pixelsToTime(distance),
							);
						});

						it("should not move the previous segment", () => {
							const distance = -150;

							inputController.mouseDown({ x: 300, y: 50 });
							inputController.mouseMove({ x: 300 + distance, y: 50 });
							inputController.mouseUp({ x: 300 + distance, y: 50 });

							const previousSegment = p.segments.getSegment("segment1");

							expect(previousSegment.startTime).to.equal(1.0);
							expect(previousSegment.endTime).to.equal(2.0);
						});
					});

					describe("when dragging a segment start marker", () => {
						it("should not move the start marker beyond the end marker", () => {
							const clickX = 86;
							const distance = 150;

							inputController.mouseDown({ x: clickX, y: 50 });
							inputController.mouseMove({ x: clickX + distance, y: 50 });
							inputController.mouseUp({ x: clickX + distance, y: 50 });

							const segment = p.segments.getSegment("segment1");

							expect(segment.startTime).to.equal(segment.endTime);
						});

						it("should not move the start marker beyond the visible time range", () => {
							const clickX = 86;
							const distance = -150;

							inputController.mouseDown({ x: clickX, y: 50 });
							inputController.mouseMove({ x: clickX + distance, y: 50 });
							inputController.mouseUp({ x: clickX + distance, y: 50 });

							const segment = p.segments.getSegment("segment1");

							expect(segment.startTime).to.equal(0.0);
						});

						it("should not move the previous segment", () => {
							const clickX = 258;
							const distance = -150;

							inputController.mouseDown({ x: clickX, y: 50 });
							inputController.mouseMove({ x: clickX + distance, y: 50 });
							inputController.mouseUp({ x: clickX + distance, y: 50 });

							const segment = p.segments.getSegment("segment2");

							const view = p.views.getView("zoomview");

							expect(segment.startTime).to.equal(
								view.pixelsToTime(view.timeToPixels(3.0) + distance),
							);
							expect(segment.endTime).to.equal(4.0);

							const previousSegment = p.segments.getSegment("segment1");

							expect(previousSegment.startTime).to.equal(1.0);
							expect(previousSegment.endTime).to.equal(2.0);
						});

						it("should not move the start marker beyond the waveform view", () => {
							const clickX = 86;
							const distance = -100;

							inputController.mouseDown({ x: clickX, y: 50 });
							inputController.mouseMove({ x: clickX + distance, y: 50 });
							inputController.mouseUp({ x: clickX + distance, y: 50 });

							const segment = p.segments.getSegment("segment1");

							expect(segment.startTime).to.equal(0);
						});

						describe("and the segment overlaps the end of the waveform view", () => {
							it("should not move the start marker beyond the waveform view", () => {
								const clickX = 947;
								const distance = 100;

								inputController.mouseDown({ x: clickX, y: 50 });
								inputController.mouseMove({ x: clickX + distance, y: 50 });
								inputController.mouseUp({ x: clickX + distance, y: 50 });

								const view = p.views.getView("zoomview");
								const segment = p.segments.getSegment("segment3");

								expect(segment.startTime).to.equal(
									view.pixelsToTime(view.getWidth()),
								);
							});
						});
					});

					describe("when a segment start marker has been dragged over the previous segment", () => {
						it("should be possible to drag the previous segment end marker", () => {
							const firstClickX = 258;
							const firstDistance = -150;

							inputController.mouseDown({ x: firstClickX, y: 50 });
							inputController.mouseMove({
								x: firstClickX + firstDistance,
								y: 50,
							});
							inputController.mouseUp({
								x: firstClickX + firstDistance,
								y: 50,
							});

							const secondClickX = 172;
							const secondDistance = 150;

							inputController.mouseDown({ x: secondClickX, y: 50 });
							inputController.mouseMove({
								x: secondClickX + secondDistance,
								y: 50,
							});
							inputController.mouseUp({
								x: secondClickX + secondDistance,
								y: 50,
							});

							const view = p.views.getView("zoomview");
							const segment1 = p.segments.getSegment("segment1");
							const segment2 = p.segments.getSegment("segment2");

							expect(segment1.startTime).to.equal(1.0);
							expect(segment1.endTime).to.equal(
								view.pixelsToTime(view.timeToPixels(2.0) + secondDistance),
							);
							expect(segment2.startTime).to.equal(
								view.pixelsToTime(view.timeToPixels(3.0) + firstDistance),
							);
							expect(segment2.endTime).to.equal(4.0);
						});
					});

					describe("when dragging a segment end marker", () => {
						it("should not move the end marker beyond the start marker", () => {
							const clickX = 172;
							const distance = -150;

							inputController.mouseDown({ x: clickX, y: 50 });
							inputController.mouseMove({ x: clickX + distance, y: 50 });
							inputController.mouseUp({ x: clickX + distance, y: 50 });

							const segment = p.segments.getSegment("segment1");

							expect(segment.endTime).to.equal(segment.startTime);
						});

						it("should move the end marker", () => {
							const clickX = 172;
							const distance = 150;

							inputController.mouseDown({ x: clickX, y: 50 });
							inputController.mouseMove({ x: clickX + distance, y: 50 });
							inputController.mouseUp({ x: clickX + distance, y: 50 });

							const view = p.views.getView("zoomview");
							const segment = p.segments.getSegment("segment1");

							expect(segment.startTime).to.equal(1.0);
							expect(segment.endTime).to.equal(
								view.pixelsToTime(clickX + distance),
							);
						});

						it("should not move the next segment", () => {
							const clickX = 172;
							const distance = 150;

							inputController.mouseDown({ x: clickX, y: 50 });
							inputController.mouseMove({ x: clickX + distance, y: 50 });
							inputController.mouseUp({ x: clickX + distance, y: 50 });

							const nextSegment = p.segments.getSegment("segment2");

							expect(nextSegment.startTime).to.equal(3.0);
							expect(nextSegment.endTime).to.equal(4.0);
						});

						it("should not move the end marker beyond the waveform view", () => {
							const clickX = 172;
							const distance = 1000;

							inputController.mouseDown({ x: clickX, y: 50 });
							inputController.mouseMove({ x: clickX + distance, y: 50 });
							inputController.mouseUp({ x: clickX + distance, y: 50 });

							const view = p.views.getView("zoomview");
							const segment = p.segments.getSegment("segment1");

							expect(segment.endTime).to.equal(
								view.pixelsToTime(view.getWidth()),
							);
						});

						describe("and the segment overlaps the start of the waveform view", () => {
							beforeEach((done: DoneCallback) => {
								zoomview.setStartTime(1.5);
								setTimeout(done, 50);
							});

							it("should not move the end marker beyond the start of the waveform view", () => {
								const clickX = 43;
								const distance = -100;

								inputController.mouseDown({ x: clickX, y: 50 });
								inputController.mouseMove({ x: clickX + distance, y: 50 });
								inputController.mouseUp({ x: clickX + distance, y: 50 });

								const view = p.views.getView("zoomview");
								const segment = p.segments.getSegment("segment1");

								expect(segment.endTime).to.equal(
									view.pixelsToTime(view.getFrameOffset()),
								);
							});
						});
					});

					describe("when a segment end marker has been dragged over the next segment", () => {
						it("should be possible to drag the next segment start marker", () => {
							const firstClickX = 172;
							const firstDistance = 150;

							inputController.mouseDown({ x: firstClickX, y: 50 });
							inputController.mouseMove({
								x: firstClickX + firstDistance,
								y: 50,
							});
							inputController.mouseUp({
								x: firstClickX + firstDistance,
								y: 50,
							});

							const secondClickX = 258;
							const secondDistance = -150;

							inputController.mouseDown({ x: secondClickX, y: 50 });
							inputController.mouseMove({
								x: secondClickX + secondDistance,
								y: 50,
							});
							inputController.mouseUp({
								x: secondClickX + secondDistance,
								y: 50,
							});

							const view = p.views.getView("zoomview");
							const segment1 = p.segments.getSegment("segment1");
							const segment2 = p.segments.getSegment("segment2");

							expect(segment1.startTime).to.equal(1.0);
							expect(segment1.endTime).to.equal(
								view.pixelsToTime(view.timeToPixels(2.0) + firstDistance),
							);
							expect(segment2.startTime).to.equal(
								view.pixelsToTime(view.timeToPixels(3.0) + secondDistance),
							);
							expect(segment2.endTime).to.equal(4.0);
						});
					});
				});

				describe("no-overlap", () => {
					beforeEach(() => {
						zoomview.setSegmentDragMode("no-overlap");
					});

					describe("when dragging a segment over the next segment", () => {
						it("should move the segment adjacent to the next segment", () => {
							const emit = sinon.spy(p.events, "dispatch");

							const distance = 150;

							inputController.mouseDown({ x: 100, y: 50 });
							inputController.mouseMove({ x: 100 + distance, y: 50 });
							inputController.mouseUp({ x: 100 + distance, y: 50 });

							const calls = getEmitCalls(emit, "segments.dragged");
							expect(calls.length).to.equal(1);

							expect(calls[0].args[1].segment).to.be.an.instanceof(Segment);
							expect(calls[0].args[1].segment.id).to.equal("segment1");
							expect(calls[0].args[1].segment.startTime).to.equal(2.0);
							expect(calls[0].args[1].segment.endTime).to.equal(3.0);
						});

						it("should not move the next segment", () => {
							const distance = 150;

							inputController.mouseDown({ x: 100, y: 50 });
							inputController.mouseMove({ x: 100 + distance, y: 50 });
							inputController.mouseUp({ x: 100 + distance, y: 50 });

							const nextSegment = p.segments.getSegment("segment2");

							expect(nextSegment.startTime).to.equal(3.0);
							expect(nextSegment.endTime).to.equal(4.0);
						});
					});

					describe("when dragging a segment over the previous segment", () => {
						it("should move the segment adjacent to the previous segment", () => {
							const emit = sinon.spy(p.events, "dispatch");

							const distance = -150;

							inputController.mouseDown({ x: 300, y: 50 });
							inputController.mouseMove({ x: 300 + distance, y: 50 });
							inputController.mouseUp({ x: 300 + distance, y: 50 });

							const calls = getEmitCalls(emit, "segments.dragged");
							expect(calls.length).to.equal(1);

							expect(calls[0].args[1].segment).to.be.an.instanceof(Segment);
							expect(calls[0].args[1].segment.id).to.equal("segment2");
							expect(calls[0].args[1].segment.startTime).to.equal(2.0);
							expect(calls[0].args[1].segment.endTime).to.equal(3.0);
						});

						it("should not move the previous segment", () => {
							const distance = -150;

							inputController.mouseDown({ x: 300, y: 50 });
							inputController.mouseMove({ x: 300 + distance, y: 50 });
							inputController.mouseUp({ x: 300 + distance, y: 50 });

							const previousSegment = p.segments.getSegment("segment1");

							expect(previousSegment.startTime).to.equal(1.0);
							expect(previousSegment.endTime).to.equal(2.0);
						});
					});

					describe("when dragging a segment end marker", () => {
						describe("and the end marker does not overlap the next segment", () => {
							it("should move the segment end marker", () => {
								const clickX = 172;
								const distance = 50;

								inputController.mouseDown({ x: clickX, y: 50 });
								inputController.mouseMove({ x: clickX + distance, y: 50 });
								inputController.mouseUp({ x: clickX + distance, y: 50 });

								const view = p.views.getView("zoomview");
								const segment = p.segments.getSegment("segment1");
								const nextSegment = p.segments.getSegment("segment2");

								expect(segment.startTime).to.equal(1.0);
								expect(segment.endTime).to.equal(
									view.pixelsToTime(view.timeToPixels(2.0) + distance),
								);
								expect(nextSegment.startTime).to.equal(3.0);
								expect(nextSegment.endTime).to.equal(4.0);
							});
						});

						describe("and the end marker overlaps the next segment", () => {
							it("should move the segment end marker adjacent to the next segment", () => {
								const clickX = 172;
								const distance = 150;

								inputController.mouseDown({ x: clickX, y: 50 });
								inputController.mouseMove({ x: clickX + distance, y: 50 });
								inputController.mouseUp({ x: clickX + distance, y: 50 });

								const segment = p.segments.getSegment("segment1");
								const nextSegment = p.segments.getSegment("segment2");

								expect(segment.startTime).to.equal(1.0);
								expect(segment.endTime).to.equal(nextSegment.startTime);
								expect(nextSegment.startTime).to.equal(3.0);
								expect(nextSegment.endTime).to.equal(4.0);
							});
						});
					});

					describe("when dragging a segment start marker", () => {
						describe("and the start marker does not overlap the previous segment", () => {
							it("should move the segment start marker", () => {
								const clickX = 258;
								const distance = -50;

								inputController.mouseDown({ x: clickX, y: 50 });
								inputController.mouseMove({ x: clickX + distance, y: 50 });
								inputController.mouseUp({ x: clickX + distance, y: 50 });

								const view = p.views.getView("zoomview");
								const segment = p.segments.getSegment("segment2");
								const previousSegment = p.segments.getSegment("segment1");

								expect(previousSegment.startTime).to.equal(1.0);
								expect(previousSegment.endTime).to.equal(2.0);
								expect(segment.startTime).to.equal(
									view.pixelsToTime(view.timeToPixels(3.0) + distance),
								);
								expect(segment.endTime).to.equal(4.0);
							});
						});

						describe("and the start marker overlaps the previous segment", () => {
							it("should move the segment start marker adjacent to the previous segment", () => {
								const clickX = 258;
								const distance = -150;

								inputController.mouseDown({ x: clickX, y: 50 });
								inputController.mouseMove({ x: clickX + distance, y: 50 });
								inputController.mouseUp({ x: clickX + distance, y: 50 });

								const segment = p.segments.getSegment("segment2");
								const previousSegment = p.segments.getSegment("segment1");

								expect(previousSegment.startTime).to.equal(1.0);
								expect(previousSegment.endTime).to.equal(2.0);
								expect(segment.startTime).to.equal(previousSegment.endTime);
								expect(segment.endTime).to.equal(4.0);
							});
						});
					});
				});

				describe("compress", () => {
					beforeEach(() => {
						zoomview.setSegmentDragMode("compress");
						zoomview.setMinSegmentDragWidth(20);
					});

					describe("when dragging a segment over the next segment", () => {
						describe("and does not reach the minimum width of the next segment", () => {
							it("should move the next segment start time", () => {
								const view = p.views.getView("zoomview");
								const emit = sinon.spy(p.events, "dispatch");

								const distance = 150;

								inputController.mouseDown({ x: 100, y: 50 });
								inputController.mouseMove({ x: 100 + distance, y: 50 });
								inputController.mouseUp({ x: 100 + distance, y: 50 });

								const calls = getEmitCalls(emit, "segments.dragged");
								expect(calls.length).to.equal(2);

								expect(calls[0].args[1].segment).to.be.an.instanceof(Segment);
								expect(calls[0].args[1].segment.id).to.equal("segment1");
								expect(calls[0].args[1].segment.startTime).to.equal(
									1.0 + view.pixelsToTime(distance),
								);
								expect(calls[0].args[1].segment.endTime).to.equal(
									2.0 + view.pixelsToTime(distance),
								);

								expect(calls[1].args[1].segment).to.be.an.instanceof(Segment);
								expect(calls[1].args[1].segment.id).to.equal("segment2");
								expect(calls[1].args[1].segment.startTime).to.equal(
									2.0 + view.pixelsToTime(distance),
								);
								expect(calls[1].args[1].segment.endTime).to.equal(4.0);
							});
						});

						describe("and reaches the minimum width of the next segment", () => {
							it("should compress the next segment to a minimum width", () => {
								const view = p.views.getView("zoomview");
								const emit = sinon.spy(p.events, "dispatch");

								const distance = 300;

								inputController.mouseDown({ x: 100, y: 50 });
								inputController.mouseMove({ x: 100 + distance, y: 50 });
								inputController.mouseUp({ x: 100 + distance, y: 50 });

								const calls = getEmitCalls(emit, "segments.dragged");
								expect(calls.length).to.equal(2);

								expect(calls[0].args[1].segment).to.be.an.instanceof(Segment);
								expect(calls[0].args[1].segment.id).to.equal("segment1");
								expect(calls[0].args[1].segment.startTime).to.equal(
									3.0 - view.pixelsToTime(20),
								);
								expect(calls[0].args[1].segment.endTime).to.equal(
									4.0 - view.pixelsToTime(20),
								);

								expect(calls[1].args[1].segment).to.be.an.instanceof(Segment);
								expect(calls[1].args[1].segment.id).to.equal("segment2");
								expect(calls[1].args[1].segment.startTime).to.equal(
									4.0 - view.pixelsToTime(20),
								);
								expect(calls[1].args[1].segment.endTime).to.equal(4.0);
							});
						});
					});

					describe("when dragging a segment over the previous segment", () => {
						describe("and does not reach the minimum width of the previous segment", () => {
							it("should move the previous segment end time", () => {
								const view = p.views.getView("zoomview");
								const emit = sinon.spy(p.events, "dispatch");

								const distance = -150;

								inputController.mouseDown({ x: 300, y: 50 });
								inputController.mouseMove({ x: 300 + distance, y: 50 });
								inputController.mouseUp({ x: 300 + distance, y: 50 });

								const calls = getEmitCalls(emit, "segments.dragged");
								expect(calls.length).to.equal(2);

								expect(calls[0].args[1].segment).to.be.an.instanceof(Segment);
								expect(calls[0].args[1].segment.id).to.equal("segment2");
								expect(calls[0].args[1].segment.startTime).to.equal(
									3.0 + view.pixelsToTime(distance),
								);
								expect(calls[0].args[1].segment.endTime).to.equal(
									4.0 + view.pixelsToTime(distance),
								);

								expect(calls[1].args[1].segment).to.be.an.instanceof(Segment);
								expect(calls[1].args[1].segment.id).to.equal("segment1");
								expect(calls[1].args[1].segment.startTime).to.equal(1.0);
								expect(calls[1].args[1].segment.endTime).to.equal(
									3.0 + view.pixelsToTime(distance),
								);
							});
						});

						describe("and reaches the minimum width of the previous segment", () => {
							it("should compress the previous segment to a minimum width", () => {
								const view = p.views.getView("zoomview");
								const emit = sinon.spy(p.events, "dispatch");

								const distance = -300;

								inputController.mouseDown({ x: 300, y: 50 });
								inputController.mouseMove({ x: 300 + distance, y: 50 });
								inputController.mouseUp({ x: 300 + distance, y: 50 });

								const calls = getEmitCalls(emit, "segments.dragged");
								expect(calls.length).to.equal(2);

								expect(calls[0].args[1].segment).to.be.an.instanceof(Segment);
								expect(calls[0].args[1].segment.id).to.equal("segment2");
								expect(calls[0].args[1].segment.startTime).to.equal(
									1.0 + view.pixelsToTime(20),
								);
								expect(calls[0].args[1].segment.endTime).to.be.closeTo(
									2.0 + view.pixelsToTime(20),
									1e-15,
								); // TODO

								expect(calls[1].args[1].segment).to.be.an.instanceof(Segment);
								expect(calls[1].args[1].segment.id).to.equal("segment1");
								expect(calls[1].args[1].segment.startTime).to.equal(1.0);
								expect(calls[1].args[1].segment.endTime).to.equal(
									1.0 + view.pixelsToTime(20),
								);
							});
						});
					});

					describe("when dragging a segment end marker over the next segment", () => {
						describe("and does not reach the minimum width of the next segment", () => {
							it("should move the next segment start time", () => {
								const clickX = 172;
								const distance = 100;

								inputController.mouseDown({ x: clickX, y: 50 });
								inputController.mouseMove({ x: clickX + distance, y: 50 });
								inputController.mouseUp({ x: clickX + distance, y: 50 });

								const view = p.views.getView("zoomview");
								const segment = p.segments.getSegment("segment1");
								const nextSegment = p.segments.getSegment("segment2");

								expect(segment.startTime).to.equal(1.0);
								expect(segment.endTime).to.equal(
									view.pixelsToTime(view.timeToPixels(2.0) + distance),
								);
								expect(nextSegment.startTime).to.equal(segment.endTime);
								expect(nextSegment.endTime).to.equal(4.0);
							});
						});

						describe("and reaches the minimum width of the next segment", () => {
							it("should compress the next segment to a minimum width", () => {
								const clickX = 172;
								const distance = 200;

								inputController.mouseDown({ x: clickX, y: 50 });
								inputController.mouseMove({ x: clickX + distance, y: 50 });
								inputController.mouseUp({ x: clickX + distance, y: 50 });

								const view = p.views.getView("zoomview");
								const segment = p.segments.getSegment("segment1");
								const nextSegment = p.segments.getSegment("segment2");

								expect(segment.startTime).to.equal(1.0);
								expect(segment.endTime).to.equal(
									view.pixelsToTime(view.timeToPixels(4.0) - 50),
								);
								expect(nextSegment.startTime).to.equal(segment.endTime);
								expect(nextSegment.endTime).to.equal(4.0);
							});
						});
					});

					describe("when dragging a segment start marker over the previous segment", () => {
						describe("and does not reach the minimum width of the previous segment", () => {
							it("should move the previous segment end time", () => {
								const clickX = 254;
								const distance = -100;

								inputController.mouseDown({ x: clickX, y: 50 });
								inputController.mouseMove({ x: clickX + distance, y: 50 });
								inputController.mouseUp({ x: clickX + distance, y: 50 });

								const view = p.views.getView("zoomview");
								const segment = p.segments.getSegment("segment2");
								const previousSegment = p.segments.getSegment("segment1");

								expect(segment.startTime).to.equal(
									view.pixelsToTime(view.timeToPixels(3.0) + distance),
								);
								expect(segment.endTime).to.equal(4.0);
								expect(previousSegment.startTime).to.equal(1.0);
								expect(previousSegment.endTime).to.equal(segment.startTime);
							});
						});

						describe("and reaches the minimum width of the previous segment", () => {
							it("should compress the previous segment to the minimum width", () => {
								const clickX = 254;
								const distance = -200;

								inputController.mouseDown({ x: clickX, y: 50 });
								inputController.mouseMove({ x: clickX + distance, y: 50 });
								inputController.mouseUp({ x: clickX + distance, y: 50 });

								const view = p.views.getView("zoomview");
								const segment = p.segments.getSegment("segment2");
								const previousSegment = p.segments.getSegment("segment1");

								expect(segment.startTime).to.equal(
									view.pixelsToTime(view.timeToPixels(1.0) + 50),
								);
								expect(segment.endTime).to.equal(4.0);
								expect(previousSegment.startTime).to.equal(1.0);
								expect(previousSegment.endTime).to.equal(segment.startTime);
							});
						});
					});
				});
			});
		});
	});

	describe("setWaveformDragMode", () => {
		describe("insert-segment", () => {
			let p = null;
			let zoomview = null;
			let inputController = null;

			beforeEach((done: DoneCallback) => {
				const options = {
					dataUri: {
						json: "base/test/data/sample.json",
					},
					mediaElement: document.getElementById("media"),
					overview: {
						container: document.getElementById("overview-container"),
					},
					points: [{ editable: true, id: "point1", time: 7.0 }],
					segments: [
						{ editable: true, endTime: 2.0, id: "segment1", startTime: 1.0 },
						{ editable: true, endTime: 4.0, id: "segment2", startTime: 3.0 },
						{ editable: true, endTime: 12.0, id: "segment3", startTime: 11.0 },
						{ editable: true, endTime: 14.0, id: "segment4", startTime: 13.0 },
					],
					zoomview: {
						container: document.getElementById("zoomview-container"),
					},
				};

				initPeaks(options, (err, instance) => {
					expect(err).to.equal(undefined);

					p = instance;
					zoomview = instance.views.getView("zoomview");
					expect(zoomview).to.be.ok;

					zoomview.enableSegmentDragging(true);
					zoomview.setWaveformDragMode("insert-segment");

					inputController = new InputController("zoomview-container");

					done();
				});
			});

			afterEach(() => {
				if (p) {
					p.dispose();
					p = null;
					zoomview = null;
					inputController = null;
				}
			});

			describe("when dragging the waveform to the right", () => {
				it("should insert a new segment", () => {
					const clickX = 430;
					const distance = 172;

					const segments = p.segments.getSegments();
					expect(segments.length).to.equal(4);

					inputController.mouseDown({ x: clickX, y: 50 });
					inputController.mouseMove({ x: clickX + distance, y: 50 });
					inputController.mouseUp({ x: clickX + distance, y: 50 });

					const view = p.views.getView("zoomview");

					expect(segments.length).to.equal(5);

					const segment = p.segments.getSegment("peaks.segment.0");

					expect(segment.startTime).to.equal(view.pixelsToTime(430));
					expect(segment.endTime).to.equal(view.pixelsToTime(430 + 172));
				});

				it("should emit a segments.add event when the segment is added", (done: DoneCallback) => {
					const clickX = 430;
					const distance = 172;

					const segments = p.segments.getSegments();
					expect(segments.length).to.equal(4);

					p.events.addEventListener("segments.add", (event) => {
						const view = p.views.getView("zoomview");

						expect(event.insert).to.equal(true);
						expect(event.segments[0]).to.be.an.instanceOf(Segment);
						expect(event.segments[0].startTime).to.equal(
							view.pixelsToTime(430),
						);
						expect(event.segments[0].endTime).to.equal(view.pixelsToTime(430));
						done();
					});

					inputController.mouseDown({ x: clickX, y: 50 });
					inputController.mouseMove({ x: clickX + distance, y: 50 });
					inputController.mouseUp({ x: clickX + distance, y: 50 });
				});

				it("should emit a segments.insert event when the drag operation ends", (done: DoneCallback) => {
					const clickX = 430;
					const distance = 172;

					const segments = p.segments.getSegments();
					expect(segments.length).to.equal(4);

					p.events.addEventListener("segments.insert", (event) => {
						const view = p.views.getView("zoomview");

						expect(event.segment).to.be.an.instanceOf(Segment);
						expect(event.segment.startTime).to.equal(view.pixelsToTime(430));
						expect(event.segment.endTime).to.equal(
							view.pixelsToTime(430 + 172),
						);
						done();
					});

					inputController.mouseDown({ x: clickX, y: 50 });
					inputController.mouseMove({ x: clickX + distance, y: 50 });
					inputController.mouseUp({ x: clickX + distance, y: 50 });
				});
			});

			describe("when dragging the waveform over an existing segment", () => {
				it("should insert a new segment", () => {
					const clickX = 129; // Click within segment1
					const distance = 172;

					const segments = p.segments.getSegments();
					expect(segments.length).to.equal(4);

					inputController.mouseDown({ x: clickX, y: 50 });
					inputController.mouseMove({ x: clickX + distance, y: 50 });
					inputController.mouseUp({ x: clickX + distance, y: 50 });

					const view = p.views.getView("zoomview");

					expect(segments.length).to.equal(5);

					const segment = p.segments.getSegment("peaks.segment.0");

					expect(segment.startTime).to.equal(view.pixelsToTime(129));
					expect(segment.endTime).to.equal(view.pixelsToTime(129 + 172));
				});

				it("should not move the existing segment", () => {
					const clickX = 129; // Click within segment1
					const distance = 172;

					const segments = p.segments.getSegments();
					expect(segments.length).to.equal(4);

					inputController.mouseDown({ x: clickX, y: 50 });
					inputController.mouseMove({ x: clickX + distance, y: 50 });
					inputController.mouseUp({ x: clickX + distance, y: 50 });

					const segment = p.segments.getSegment("segment1");

					expect(segment.startTime).to.equal(1.0);
					expect(segment.endTime).to.equal(2.0);
				});
			});

			describe("when dragging the waveform from to the left", () => {
				it("should insert a new segment with zero width", () => {
					const clickX = 430;
					const distance = -172;

					const segments = p.segments.getSegments();
					expect(segments.length).to.equal(4);

					inputController.mouseDown({ x: clickX, y: 50 });
					inputController.mouseMove({ x: clickX + distance, y: 50 });
					inputController.mouseUp({ x: clickX + distance, y: 50 });

					const view = p.views.getView("zoomview");

					expect(segments.length).to.equal(5);

					const segment = p.segments.getSegments()[4];

					expect(segment.startTime).to.equal(view.pixelsToTime(clickX));
					expect(segment.endTime).to.equal(segment.startTime);
				});
			});
		});
	});

	describe("enableSeek", () => {
		let p: Peaks | undefined;
		let inputController: InputController | undefined;

		beforeEach((done: DoneCallback) => {
			const options = {
				dataUri: { arraybuffer: "/base/test/data/sample.dat" },
				mediaElement: document.getElementById("media"),
				segments: [
					{ editable: true, endTime: 2.0, id: "segment1", startTime: 1.0 },
					{ editable: false, endTime: 4.0, id: "segment2", startTime: 3.0 },
				],
				zoomview: {
					container: document.getElementById("zoomview-container"),
				},
			};

			initPeaks(options, (err, instance) => {
				if (err) {
					done(err);
					return;
				}

				p = instance;

				inputController = new InputController("zoomview-container");

				done();
			});
		});

		afterEach(() => {
			if (p) {
				p.dispose();
				p = undefined;
				inputController = undefined;
			}
		});

		describe("when enabled", () => {
			describe("when clicking on the waveform", () => {
				it("should set the playback position", () => {
					inputController?.mouseDown({ x: 100, y: 50 });
					inputController?.mouseUp({ x: 100, y: 50 });

					const view = p?.views.getView("zoomview");

					expect(p?.player.getCurrentTime()).to.be.closeTo(
						view!.pixelsToTime(100),
						0.01,
					);
				});
			});

			describe("when dragging the playhead", () => {
				beforeEach(() => {
					const view = p?.views.getView("zoomview") as
						| WaveformZoomView
						| undefined;
					view?.enableSegmentDragging(true);
				});

				describe("when the playhead is not over a segment", () => {
					it("should set the playback position", (done: DoneCallback) => {
						const view = p!.views.getView("zoomview");

						p!.events.addEventListener(
							"player.timeupdate",
							() => {
								const x = view!.timeToPixels(2.5);
								const distance = 100;

								inputController?.mouseDown({ x: x, y: 50 });
								inputController?.mouseMove({ x: x + distance, y: 50 });
								inputController?.mouseUp({ x: x + distance, y: 50 });

								expect(p!.player.getCurrentTime()).to.be.closeTo(
									view!.pixelsToTime(x + distance),
									0.01,
								);
								done();
							},
							{ once: true },
						);

						p.player.seek(2.5);
					});
				});

				describe("when the playhead is over a draggable segment", () => {
					it("should set the playback position and not move the segment", (done: DoneCallback) => {
						const view = p!.views.getView("zoomview") as WaveformZoomView;

						p!.events.addEventListener(
							"player.timeupdate",
							() => {
								const x = view!.timeToPixels(1.5);
								const distance = 100;

								inputController!.mouseDown({ x: x, y: 50 });
								inputController!.mouseMove({ x: x + distance, y: 50 });
								inputController!.mouseUp({ x: x + distance, y: 50 });

								expect(p!.player.getCurrentTime()).to.be.closeTo(
									view.pixelsToTime(x + distance),
									0.01,
								);

								const segment = p!.segments.getSegment("segment1");

								expect(segment!.startTime).to.equal(1.0);
								expect(segment!.endTime).to.equal(2.0);

								done();
							},
							{ once: true },
						);

						p!.player.seek(1.5);
					});
				});

				describe("when the playhead is over a non-draggable segment", () => {
					it("should set the playback position and not move the segment", (done: DoneCallback) => {
						const view = p!.views.getView("zoomview");

						p!.events.addEventListener(
							"player.timeupdate",
							() => {
								const x = view.timeToPixels(3.5);
								const distance = 100;

								inputController.mouseDown({ x: x, y: 50 });
								inputController.mouseMove({ x: x + distance, y: 50 });
								inputController.mouseUp({ x: x + distance, y: 50 });

								expect(p.player.getCurrentTime()).to.be.closeTo(
									view.pixelsToTime(x + distance),
									0.01,
								);

								const segment = p.segments.getSegment("segment2");

								expect(segment.startTime).to.equal(3.0);
								expect(segment.endTime).to.equal(4.0);

								done();
							},
							{ once: true },
						);

						p.player.seek(3.5);
					});
				});
			});
		});

		describe("when disabled", () => {
			beforeEach(() => {
				const view = p.views.getView("zoomview");
				view.enableSeek(false);
			});

			describe("when clicking on the waveform", () => {
				it("should not change the playback position", () => {
					const time = p.player.getCurrentTime();

					inputController.mouseDown({ x: 100, y: 50 });
					inputController.mouseUp({ x: 100, y: 50 });

					expect(p.player.getCurrentTime()).to.equal(time);
				});
			});
		});
	});

	describe("when dragging a point", () => {
		let p = null;
		let zoomview = null;
		let inputController = null;

		beforeEach((done: DoneCallback) => {
			const options = {
				dataUri: {
					json: "base/test/data/sample.json",
				},
				mediaElement: document.getElementById("media"),
				overview: {
					container: document.getElementById("overview-container"),
				},
				points: [{ editable: true, id: "point1", time: 7.0 }],
				segments: [
					{ editable: true, endTime: 2.0, id: "segment1", startTime: 1.0 },
					{ editable: true, endTime: 4.0, id: "segment2", startTime: 3.0 },
					{ editable: true, endTime: 12.0, id: "segment3", startTime: 11.0 },
					{ editable: true, endTime: 14.0, id: "segment4", startTime: 13.0 },
				],
				zoomview: {
					container: document.getElementById("zoomview-container"),
				},
			};

			initPeaks(options, (err, instance) => {
				expect(err).to.equal(undefined);

				p = instance;
				zoomview =
					(instance?.views.getView("zoomview") as
						| WaveformZoomView
						| undefined) ?? null;
				expect(zoomview).to.be.ok;

				inputController = new InputController("zoomview-container");

				setTimeout(done, 50);
			});
		});

		afterEach(() => {
			if (p) {
				p.dispose();
				p = null;
				zoomview = null;
				inputController = null;
			}
		});

		it("should move the point", () => {
			const view = p.views.getView("zoomview");
			view.enableSeek(false);

			const x = view.timeToPixels(7.0);
			const distance = 100;

			inputController.mouseDown({ x: x, y: 50 });
			inputController.mouseMove({ x: x + distance, y: 50 });
			inputController.mouseUp({ x: x + distance, y: 50 });

			const point = p.points.getPoint("point1");

			expect(point.time).to.equal(view.pixelsToTime(x + distance));
		});

		it("should emit point drag events", () => {
			const emit = sinon.spy(p.events, "dispatch");

			const view = p.views.getView("zoomview");
			view.enableSeek(false);
			const x = view.timeToPixels(7.0);
			const distance = 100;

			inputController.mouseDown({ x: x, y: 50 });
			inputController.mouseMove({ x: x + distance, y: 50 });
			inputController.mouseUp({ x: x + distance, y: 50 });

			const calls = getEmitCalls(emit, /points/);

			expect(calls.length).to.equal(3);

			expect(calls[0].args[0]).to.equal("points.dragstart");
			expect(calls[0].args[1].point).to.be.an.instanceOf(Point);
			expect(calls[0].args[1].point.id).to.equal("point1");

			expect(calls[1].args[0]).to.equal("points.dragmove");
			expect(calls[1].args[1].point).to.be.an.instanceOf(Point);
			expect(calls[1].args[1].point.id).to.equal("point1");

			expect(calls[2].args[0]).to.equal("points.dragend");
			expect(calls[2].args[1].point).to.be.an.instanceOf(Point);
			expect(calls[2].args[1].point.id).to.equal("point1");
		});
	});
});
