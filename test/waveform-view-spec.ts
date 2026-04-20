import Konva from "konva";
import sinon from "sinon";
import { Peaks } from "../src/main";
import { Point } from "../src/point";
import { Segment } from "../src/segment";
import type { PeaksInitOptions } from "../src/types";
import { InputController } from "./helpers/input-controller";
import { getEmitCalls } from "./helpers/utils";

type InternalPlayheadText = {
	getText(): string;
};

type InternalWaveformView = {
	_waveformShape: { _color: string };
	_playedWaveformShape: { _color: string } | null;
	_playheadLayer: { _playheadText?: InternalPlayheadText };
	setPlayedWaveformColor(color: string | null): void;
	showPlayheadTime(show: boolean): void;
	setTimeLabelPrecision(precision: number): void;
};

function initOptions(
	view: string,
	viewOptions: Record<string, unknown>,
): PeaksInitOptions {
	const options: PeaksInitOptions = {
		dataUri: {
			arraybuffer: "base/test/data/sample.dat",
		},
		mediaElement: document.getElementById("media"),
	};

	options[view] = viewOptions;

	return options;
}

[
	{
		container: "zoomview-container",
		name: "WaveformZoomview",
		view: "zoomview",
	},
	{
		container: "overview-container",
		name: "WaveformOverview",
		view: "overview",
	},
].forEach((test) => {
	describe(test.name, () => {
		describe("playedWaveformColor option", () => {
			describe("with a valid color", () => {
				it("should create a played waveform shape", (done: DoneCallback) => {
					const options = initOptions(test.view, {
						container: document.getElementById(test.container),
						playedWaveformColor: "#0f0",
						waveformColor: "#f00",
					});

					Peaks.init(options, (err, instance) => {
						expect(err).to.equal(undefined);

						const view = instance.views.getView(
							test.view,
						) as unknown as InternalWaveformView;
						expect(view).to.be.ok;

						expect(view.waveformShape.color).to.equal("#f00");
						expect(view.playedWaveformShape.color).to.equal("#0f0");

						done();
					});
				});
			});
		});

		describe("setPlayedWaveformColor", () => {
			describe("with a valid color", () => {
				it("should create a played waveform shape", (done: DoneCallback) => {
					const options = initOptions(test.view, {
						container: document.getElementById(test.container),
						waveformColor: "#f00",
					});

					Peaks.init(options, (err, instance) => {
						expect(err).to.equal(undefined);

						const view = instance.views.getView(
							test.view,
						) as unknown as InternalWaveformView;
						expect(view).to.be.ok;

						view.setPlayedWaveformColor("#0f0");

						expect(view.waveformShape.color).to.equal("#f00");
						expect(view.playedWaveformShape.color).to.equal("#0f0");

						done();
					});
				});
			});

			describe("with null", () => {
				it("should remove the played waveform shape", (done: DoneCallback) => {
					const options = initOptions(test.view, {
						container: document.getElementById(test.container),
						playedWaveformColor: "#0f0",
						waveformColor: "#f00",
					});

					Peaks.init(options, (err, instance) => {
						expect(err).to.equal(undefined);

						const view = instance.views.getView(
							test.view,
						) as unknown as InternalWaveformView;
						expect(view).to.be.ok;

						view.setPlayedWaveformColor(null);

						expect(view.waveformShape.color).to.equal("#f00");
						expect(view.playedWaveformShape).to.equal(undefined);

						done();
					});
				});
			});
		});

		describe("showPlayheadTime option", () => {
			describe("with default options", () => {
				it("should not show the playhead time", (done: DoneCallback) => {
					const options = initOptions(test.view, {
						container: document.getElementById(test.container),
					});

					Peaks.init(options, (err, instance) => {
						expect(err).to.equal(undefined);

						const view = instance.views.getView(
							test.view,
						) as unknown as InternalWaveformView;
						expect(view).to.be.ok;

						expect(view.playheadLayer.playheadText).to.equal(undefined);

						done();
					});
				});
			});
			describe("when the global option is true", () => {
				it("should show playhead time in the zoomview only", (done: DoneCallback) => {
					const options = initOptions(test.view, {
						container: document.getElementById(test.container),
					});

					options.showPlayheadTime = true;

					Peaks.init(options, (err, instance) => {
						expect(err).to.equal(undefined);

						const view = instance.views.getView(
							test.view,
						) as unknown as InternalWaveformView;
						expect(view).to.be.ok;

						if (test.view === "zoomview") {
							expect(view.playheadLayer.playheadText).to.be.ok;
							expect(view.playheadLayer.playheadText.getText()).to.equal(
								"00:00.00",
							);
						} else {
							expect(view.playheadLayer.playheadText).to.equal(undefined);
						}

						done();
					});
				});
			});

			describe("when the global option is false", () => {
				it("should not show playhead time", (done: DoneCallback) => {
					const options = initOptions(test.view, {
						container: document.getElementById(test.container),
					});

					options.showPlayheadTime = false;

					Peaks.init(options, (err, instance) => {
						expect(err).to.equal(undefined);

						const view = instance.views.getView(
							test.view,
						) as unknown as InternalWaveformView;
						expect(view).to.be.ok;

						expect(view.playheadLayer.playheadText).to.equal(undefined);

						done();
					});
				});
			});

			describe("when the view-specific option is true", () => {
				it("should show the current playback position next to the playhead", (done: DoneCallback) => {
					const options = initOptions(test.view, {
						container: document.getElementById(test.container),
						showPlayheadTime: true,
					});

					Peaks.init(options, (err, instance) => {
						expect(err).to.equal(undefined);

						const view = instance.views.getView(
							test.view,
						) as unknown as InternalWaveformView;
						expect(view).to.be.ok;

						expect(view.playheadLayer.playheadText).to.be.ok;
						expect(view.playheadLayer.playheadText.getText()).to.equal(
							"00:00.00",
						);

						done();
					});
				});
			});

			describe("when the view-specific option is false", () => {
				it("should not show the current playback position next to the playhead", (done: DoneCallback) => {
					const options = initOptions(test.view, {
						container: document.getElementById(test.container),
						showPlayheadTime: false,
					});

					Peaks.init(options, (err, instance) => {
						expect(err).to.equal(undefined);

						const view = instance.views.getView(
							test.view,
						) as unknown as InternalWaveformView;
						expect(view).to.be.ok;

						expect(view.playheadLayer.playheadText).to.equal(undefined);

						done();
					});
				});
			});
		});

		describe("showPlayheadTime", () => {
			describe("when enabled", () => {
				it("should show the current playback position next to the playhead", (done: DoneCallback) => {
					const options = initOptions(test.view, {
						container: document.getElementById(test.container),
						showPlayheadTime: false,
					});

					Peaks.init(options, (err, instance) => {
						expect(err).to.equal(undefined);

						const view = instance.views.getView(
							test.view,
						) as unknown as InternalWaveformView;
						expect(view).to.be.ok;

						view.showPlayheadTime(true);

						expect(view.playheadLayer.playheadText).to.be.ok;
						expect(view.playheadLayer.playheadText.getText()).to.equal(
							"00:00.00",
						);

						done();
					});
				});
			});

			describe("when disabled", () => {
				it("should not show the current playback position next to the playhead", (done: DoneCallback) => {
					const options = initOptions(test.view, {
						container: document.getElementById(test.container),
						showPlayheadTime: false,
					});

					Peaks.init(options, (err, instance) => {
						expect(err).to.equal(undefined);

						const view = instance.views.getView(
							test.view,
						) as unknown as InternalWaveformView;
						expect(view).to.be.ok;

						view.showPlayheadTime(false);

						expect(view.playheadLayer.playheadText).to.equal(undefined);

						done();
					});
				});
			});
		});

		describe("timeLabelPrecision option", () => {
			describe("with default options", () => {
				it("should use 2 decimal places for the current playback time", (done: DoneCallback) => {
					const options = initOptions(test.view, {
						container: document.getElementById(test.container),
						showPlayheadTime: true,
					});

					Peaks.init(options, (err, instance) => {
						expect(err).to.equal(undefined);

						const view = instance.views.getView(
							test.view,
						) as unknown as InternalWaveformView;
						expect(view).to.be.ok;

						expect(view.playheadLayer.playheadText).to.be.ok;
						expect(view.playheadLayer.playheadText.getText()).to.equal(
							"00:00.00",
						);

						done();
					});
				});
			});

			describe("with zero", () => {
				it("should set the number of decimal places for the current playback time", (done: DoneCallback) => {
					const options = initOptions(test.view, {
						container: document.getElementById(test.container),
						showPlayheadTime: true,
						timeLabelPrecision: 0,
					});

					Peaks.init(options, (err, instance) => {
						expect(err).to.equal(undefined);

						const view = instance.views.getView(
							test.view,
						) as unknown as InternalWaveformView;
						expect(view).to.be.ok;

						expect(view.playheadLayer.playheadText).to.be.ok;
						expect(view.playheadLayer.playheadText.getText()).to.equal("00:00");

						done();
					});
				});
			});

			describe("with non-zero", () => {
				it("should set the number of decimal places for the current playback time", (done: DoneCallback) => {
					const options = initOptions(test.view, {
						container: document.getElementById(test.container),
						showPlayheadTime: true,
						timeLabelPrecision: 3,
					});

					Peaks.init(options, (err, instance) => {
						expect(err).to.equal(undefined);

						const view = instance.views.getView(
							test.view,
						) as unknown as InternalWaveformView;
						expect(view).to.be.ok;

						expect(view.playheadLayer.playheadText).to.be.ok;
						expect(view.playheadLayer.playheadText.getText()).to.equal(
							"00:00.000",
						);

						done();
					});
				});
			});
		});

		describe("setTimeLabelPrecision", () => {
			describe("with zero", () => {
				it("should set the number of decimal places for the current playback time", (done: DoneCallback) => {
					const options = initOptions(test.view, {
						container: document.getElementById(test.container),
						showPlayheadTime: true,
					});

					Peaks.init(options, (err, instance) => {
						expect(err).to.equal(undefined);

						const view = instance.views.getView(
							test.view,
						) as unknown as InternalWaveformView;
						expect(view).to.be.ok;

						view.setTimeLabelPrecision(0);

						expect(view.playheadLayer.playheadText).to.be.ok;
						expect(view.playheadLayer.playheadText.getText()).to.equal("00:00");

						done();
					});
				});
			});

			describe("with non-zero", () => {
				it("should set the number of decimal places for the current playback time", (done: DoneCallback) => {
					const options = initOptions(test.view, {
						container: document.getElementById(test.container),
						showPlayheadTime: true,
					});

					Peaks.init(options, (err, instance) => {
						expect(err).to.equal(undefined);

						const view = instance.views.getView(
							test.view,
						) as unknown as InternalWaveformView;
						expect(view).to.be.ok;

						view.setTimeLabelPrecision(3);

						expect(view.playheadLayer.playheadText).to.be.ok;
						expect(view.playheadLayer.playheadText.getText()).to.equal(
							"00:00.000",
						);

						done();
					});
				});
			});
		});

		describe("click events", () => {
			let p = null;
			let inputController = null;

			beforeEach((done: DoneCallback) => {
				// TODO: Konva.js uses global state to handle double click timing.
				// Instead of adding time delays, we just reset Konva's internal
				// flag here.
				(
					Konva as typeof Konva & {
						_mouseInDblClickWindow: boolean;
					}
				)._mouseInDblClickWindow = false;

				const options = initOptions(test.view, {
					container: document.getElementById(test.container),
				});

				Peaks.init(options, (err, instance) => {
					if (err) {
						done(err);
						return;
					}

					p = instance;

					inputController = new InputController(test.container);

					done();
				});
			});

			afterEach(() => {
				if (p) {
					p.destroy();
					p = null;
				}
			});

			describe("when clicking on the waveform", () => {
				it(`should emit a ${test.view}.click event`, () => {
					const emit = sinon.spy(p, "emit");

					const x = test.view === "overview" ? 40 : 100;

					inputController.mouseDown({ x: x, y: 50 });
					inputController.mouseUp({ x: x, y: 50 });

					const calls = getEmitCalls(emit, new RegExp(test.view));

					expect(calls.length).to.equal(1);

					expect(calls[0].args[0]).to.equal(`${test.view}.click`);
					expect(calls[0].args[1].evt).to.be.an.instanceOf(MouseEvent);
					expect(calls[0].args[1].time).to.be.a("number");
				});

				it(`should emit a ${test.view}.dblclick event`, () => {
					const emit = sinon.spy(p, "emit");

					const x = test.view === "overview" ? 40 : 100;

					inputController.mouseDown({ x: x, y: 50 });
					inputController.mouseUp({ x: x, y: 50 });
					inputController.mouseDown({ x: x, y: 50 });
					inputController.mouseUp({ x: x, y: 50 });

					const calls = getEmitCalls(emit, new RegExp(test.view));

					expect(calls.length).to.equal(3);

					expect(calls[0].args[0]).to.equal(`${test.view}.click`);
					expect(calls[1].args[0]).to.equal(`${test.view}.click`);
					expect(calls[2].args[0]).to.equal(`${test.view}.dblclick`);

					expect(calls[0].args[1].evt).to.be.an.instanceOf(MouseEvent);
					expect(calls[0].args[1].time).to.be.a("number");
				});
			});

			["scroll", "insert-segment"].forEach((waveformDragMode) => {
				describe(`with waveformDragMode(${waveformDragMode})`, () => {
					["no-overlap", "compress"].forEach((segmentDragMode) => {
						describe(`with segmentDragMode(${segmentDragMode})`, () => {
							describe("when clicking on a segment", () => {
								beforeEach((done: DoneCallback) => {
									if (test.view === "zoomview") {
										const view = p.views.getView("zoomview");
										view.setWaveformDragMode(waveformDragMode);
										view.setSegmentDragMode(segmentDragMode);
									}

									p.segments.add({
										editable: true,
										endTime: 2.0,
										id: "segment1",
										startTime: 1.0,
									});
									setTimeout(done, 50);
								});

								it(
									"should emit both a " +
										test.view +
										".click and a segments.click event",
									() => {
										const emit = sinon.spy(p, "emit");

										const x = test.view === "overview" ? 40 : 100;

										inputController.mouseDown({ x: x, y: 50 });
										inputController.mouseUp({ x: x, y: 50 });

										const calls = getEmitCalls(
											emit,
											new RegExp(`${test.view}|segments`),
										);

										expect(calls.length).to.equal(4);

										expect(calls[0].args[0]).to.equal("segments.mousedown");
										expect(calls[0].args[1].evt).to.be.an.instanceOf(
											MouseEvent,
										);
										expect(calls[0].args[1].segment).to.be.an.instanceOf(
											Segment,
										);
										expect(calls[0].args[1].segment.id).to.equal("segment1");

										expect(calls[1].args[0]).to.equal("segments.mouseup");
										expect(calls[1].args[1].evt).to.be.an.instanceOf(
											MouseEvent,
										);
										expect(calls[1].args[1].segment).to.be.an.instanceOf(
											Segment,
										);
										expect(calls[1].args[1].segment.id).to.equal("segment1");

										expect(calls[2].args[0]).to.equal("segments.click");
										expect(calls[2].args[1].evt).to.be.an.instanceOf(
											MouseEvent,
										);
										expect(calls[2].args[1].segment).to.be.an.instanceOf(
											Segment,
										);
										expect(calls[2].args[1].segment.id).to.equal("segment1");

										expect(calls[3].args[0]).to.equal(`${test.view}.click`);
										expect(calls[3].args[1].evt).to.be.an.instanceOf(
											MouseEvent,
										);
										expect(calls[3].args[1].time).to.be.a("number");
									},
								);

								it(
									"should emit both a " +
										test.view +
										".dblclick and a segments.dblclick event",
									() => {
										const emit = sinon.spy(p, "emit");

										const x = test.view === "overview" ? 40 : 100;

										inputController.mouseDown({ x: x, y: 50 });
										inputController.mouseUp({ x: x, y: 50 });
										inputController.mouseDown({ x: x, y: 50 });
										inputController.mouseUp({ x: x, y: 50 });

										const calls = getEmitCalls(
											emit,
											new RegExp(`${test.view}|segments`),
										);

										expect(calls.length).to.equal(10);

										expect(calls[0].args[0]).to.equal("segments.mousedown");
										expect(calls[0].args[1].evt).to.be.an.instanceOf(
											MouseEvent,
										);
										expect(calls[0].args[1].segment).to.be.an.instanceOf(
											Segment,
										);
										expect(calls[0].args[1].segment.id).to.equal("segment1");

										expect(calls[1].args[0]).to.equal("segments.mouseup");
										expect(calls[1].args[1].evt).to.be.an.instanceOf(
											MouseEvent,
										);
										expect(calls[1].args[1].segment).to.be.an.instanceOf(
											Segment,
										);
										expect(calls[1].args[1].segment.id).to.equal("segment1");

										expect(calls[2].args[0]).to.equal("segments.click");
										expect(calls[2].args[1].evt).to.be.an.instanceOf(
											MouseEvent,
										);
										expect(calls[2].args[1].segment).to.be.an.instanceOf(
											Segment,
										);
										expect(calls[2].args[1].segment.id).to.equal("segment1");

										expect(calls[3].args[0]).to.equal(`${test.view}.click`);
										expect(calls[3].args[1].evt).to.be.an.instanceOf(
											MouseEvent,
										);
										expect(calls[3].args[1].time).to.be.a("number");

										expect(calls[4].args[0]).to.equal("segments.mousedown");
										expect(calls[4].args[1].evt).to.be.an.instanceOf(
											MouseEvent,
										);
										expect(calls[4].args[1].segment).to.be.an.instanceOf(
											Segment,
										);
										expect(calls[4].args[1].segment.id).to.equal("segment1");

										expect(calls[5].args[0]).to.equal("segments.mouseup");
										expect(calls[5].args[1].evt).to.be.an.instanceOf(
											MouseEvent,
										);
										expect(calls[5].args[1].segment).to.be.an.instanceOf(
											Segment,
										);
										expect(calls[5].args[1].segment.id).to.equal("segment1");

										expect(calls[6].args[0]).to.equal("segments.click");
										expect(calls[6].args[1].evt).to.be.an.instanceOf(
											MouseEvent,
										);
										expect(calls[6].args[1].segment).to.be.an.instanceOf(
											Segment,
										);
										expect(calls[6].args[1].segment.id).to.equal("segment1");

										expect(calls[7].args[0]).to.equal(`${test.view}.click`);
										expect(calls[7].args[1].evt).to.be.an.instanceOf(
											MouseEvent,
										);
										expect(calls[7].args[1].time).to.be.a("number");

										expect(calls[8].args[0]).to.equal("segments.dblclick");
										expect(calls[8].args[1].evt).to.be.an.instanceOf(
											MouseEvent,
										);
										expect(calls[8].args[1].segment).to.be.an.instanceOf(
											Segment,
										);
										expect(calls[8].args[1].segment.id).to.equal("segment1");

										expect(calls[9].args[0]).to.equal(`${test.view}.dblclick`);
										expect(calls[9].args[1].evt).to.be.an.instanceOf(
											MouseEvent,
										);
										expect(calls[9].args[1].time).to.be.a("number");
									},
								);

								it(`should allow the user to prevent the ${test.view}.click event`, () => {
									const emit = sinon.spy(p, "emit");

									p.on("segments.click", (event) => {
										event.preventViewEvent();
									});

									const x = test.view === "overview" ? 40 : 100;

									inputController.mouseDown({ x: x, y: 50 });
									inputController.mouseUp({ x: x, y: 50 });

									const calls = getEmitCalls(
										emit,
										new RegExp(`${test.view}|segments`),
									);

									expect(calls.length).to.equal(3);

									expect(calls[0].args[0]).to.equal("segments.mousedown");
									expect(calls[0].args[1].evt).to.be.an.instanceOf(MouseEvent);
									expect(calls[0].args[1].segment).to.be.an.instanceOf(Segment);
									expect(calls[0].args[1].segment.id).to.equal("segment1");

									expect(calls[1].args[0]).to.equal("segments.mouseup");
									expect(calls[1].args[1].evt).to.be.an.instanceOf(MouseEvent);
									expect(calls[1].args[1].segment).to.be.an.instanceOf(Segment);
									expect(calls[1].args[1].segment.id).to.equal("segment1");

									expect(calls[2].args[0]).to.equal("segments.click");
									expect(calls[2].args[1].evt).to.be.an.instanceOf(MouseEvent);
									expect(calls[2].args[1].segment).to.be.an.instanceOf(Segment);
									expect(calls[2].args[1].segment.id).to.equal("segment1");
								});

								it(`should allow the user to prevent the ${test.view}.dblclick event`, () => {
									const emit = sinon.spy(p, "emit");

									p.on("segments.dblclick", (event) => {
										event.preventViewEvent();
									});

									const x = test.view === "overview" ? 40 : 100;

									inputController.mouseDown({ x: x, y: 50 });
									inputController.mouseUp({ x: x, y: 50 });
									inputController.mouseDown({ x: x, y: 50 });
									inputController.mouseUp({ x: x, y: 50 });

									const calls = getEmitCalls(
										emit,
										new RegExp(`${test.view}|segments`),
									);

									expect(calls.length).to.equal(9);

									expect(calls[0].args[0]).to.equal("segments.mousedown");
									expect(calls[0].args[1].evt).to.be.an.instanceOf(MouseEvent);
									expect(calls[0].args[1].segment).to.be.an.instanceOf(Segment);
									expect(calls[0].args[1].segment.id).to.equal("segment1");

									expect(calls[1].args[0]).to.equal("segments.mouseup");
									expect(calls[1].args[1].evt).to.be.an.instanceOf(MouseEvent);
									expect(calls[1].args[1].segment).to.be.an.instanceOf(Segment);
									expect(calls[1].args[1].segment.id).to.equal("segment1");

									expect(calls[2].args[0]).to.equal("segments.click");
									expect(calls[2].args[1].evt).to.be.an.instanceOf(MouseEvent);
									expect(calls[2].args[1].segment).to.be.an.instanceOf(Segment);
									expect(calls[2].args[1].segment.id).to.equal("segment1");

									expect(calls[3].args[0]).to.equal(`${test.view}.click`);
									expect(calls[3].args[1].evt).to.be.an.instanceOf(MouseEvent);
									expect(calls[3].args[1].time).to.be.a("number");

									expect(calls[4].args[0]).to.equal("segments.mousedown");
									expect(calls[4].args[1].evt).to.be.an.instanceOf(MouseEvent);
									expect(calls[4].args[1].segment).to.be.an.instanceOf(Segment);
									expect(calls[4].args[1].segment.id).to.equal("segment1");

									expect(calls[5].args[0]).to.equal("segments.mouseup");
									expect(calls[5].args[1].evt).to.be.an.instanceOf(MouseEvent);
									expect(calls[5].args[1].segment).to.be.an.instanceOf(Segment);
									expect(calls[5].args[1].segment.id).to.equal("segment1");

									expect(calls[6].args[0]).to.equal("segments.click");
									expect(calls[6].args[1].evt).to.be.an.instanceOf(MouseEvent);
									expect(calls[6].args[1].segment).to.be.an.instanceOf(Segment);
									expect(calls[6].args[1].segment.id).to.equal("segment1");

									expect(calls[7].args[0]).to.equal(`${test.view}.click`);
									expect(calls[7].args[1].evt).to.be.an.instanceOf(MouseEvent);
									expect(calls[7].args[1].time).to.be.a("number");

									expect(calls[8].args[0]).to.equal("segments.dblclick");
									expect(calls[8].args[1].evt).to.be.an.instanceOf(MouseEvent);
									expect(calls[8].args[1].segment).to.be.an.instanceOf(Segment);
									expect(calls[8].args[1].segment.id).to.equal("segment1");
								});
							});
						});
					});
				});
			});

			describe("when clicking on a point", () => {
				beforeEach((done: DoneCallback) => {
					p.points.add({ editable: true, id: "point1", time: 1.0 });
					setTimeout(done, 50);
				});

				it(`should emit both a ${test.view}.click and a points.click event`, () => {
					const emit = sinon.spy(p, "emit");

					const x = test.view === "overview" ? 30 : 86;

					inputController.mouseDown({ x: x, y: 50 });
					inputController.mouseUp({ x: x, y: 50 });

					const calls = getEmitCalls(emit, new RegExp(`${test.view}|points`));

					expect(calls.length).to.equal(2);

					// expect(calls[0].args[0]).to.equal('points.mousedown');
					// expect(calls[0].args[1].evt).to.be.an.instanceOf(MouseEvent);
					// expect(calls[0].args[1].point).to.be.an.instanceOf(Point);
					// expect(calls[0].args[1].point.id).to.equal('point1');

					// expect(calls[1].args[0]).to.equal('points.mouseup');
					// expect(calls[1].args[1].evt).to.be.an.instanceOf(MouseEvent);
					// expect(calls[1].args[1].point).to.be.an.instanceOf(Point);
					// expect(calls[1].args[1].point.id).to.equal('point1');

					expect(calls[0].args[0]).to.equal("points.click");
					expect(calls[0].args[1].evt).to.be.an.instanceOf(MouseEvent);
					expect(calls[0].args[1].point).to.be.an.instanceOf(Point);
					expect(calls[0].args[1].point.id).to.equal("point1");

					expect(calls[1].args[0]).to.equal(`${test.view}.click`);
					expect(calls[1].args[1].evt).to.be.an.instanceOf(MouseEvent);
					expect(calls[1].args[1].time).to.be.a("number");
				});

				it(`should emit both a ${test.view}.dblclick and a points.dblclick event`, () => {
					const emit = sinon.spy(p, "emit");

					const x = test.view === "overview" ? 30 : 86;

					inputController.mouseDown({ x: x, y: 50 });
					inputController.mouseUp({ x: x, y: 50 });
					inputController.mouseDown({ x: x, y: 50 });
					inputController.mouseUp({ x: x, y: 50 });

					const calls = getEmitCalls(emit, new RegExp(`${test.view}|points`));

					expect(calls.length).to.equal(6);

					// expect(calls[0].args[0]).to.equal('points.mousedown');
					// expect(calls[0].args[1].evt).to.be.an.instanceOf(MouseEvent);
					// expect(calls[0].args[1].point).to.be.an.instanceOf(Point);
					// expect(calls[0].args[1].point.id).to.equal('segment1');

					// expect(calls[1].args[0]).to.equal('points.mouseup');
					// expect(calls[1].args[1].evt).to.be.an.instanceOf(MouseEvent);
					// expect(calls[1].args[1].point).to.be.an.instanceOf(Point);
					// expect(calls[1].args[1].point.id).to.equal('segment1');

					expect(calls[0].args[0]).to.equal("points.click");
					expect(calls[0].args[1].evt).to.be.an.instanceOf(MouseEvent);
					expect(calls[0].args[1].point).to.be.an.instanceOf(Point);
					expect(calls[0].args[1].point.id).to.equal("point1");

					expect(calls[1].args[0]).to.equal(`${test.view}.click`);
					expect(calls[1].args[1].evt).to.be.an.instanceOf(MouseEvent);
					expect(calls[1].args[1].time).to.be.a("number");

					// expect(calls[4].args[0]).to.equal('points.mousedown');
					// expect(calls[4].args[1].evt).to.be.an.instanceOf(MouseEvent);
					// expect(calls[4].args[1].point).to.be.an.instanceOf(Point);
					// expect(calls[4].args[1].point.id).to.equal('point1');

					// expect(calls[5].args[0]).to.equal('points.mouseup');
					// expect(calls[5].args[1].evt).to.be.an.instanceOf(MouseEvent);
					// expect(calls[5].args[1].point).to.be.an.instanceOf(Point);
					// expect(calls[5].args[1].point.id).to.equal('point1');

					expect(calls[2].args[0]).to.equal("points.click");
					expect(calls[2].args[1].evt).to.be.an.instanceOf(MouseEvent);
					expect(calls[2].args[1].point).to.be.an.instanceOf(Point);
					expect(calls[2].args[1].point.id).to.equal("point1");

					expect(calls[3].args[0]).to.equal(`${test.view}.click`);
					expect(calls[3].args[1].evt).to.be.an.instanceOf(MouseEvent);
					expect(calls[3].args[1].time).to.be.a("number");

					expect(calls[4].args[0]).to.equal("points.dblclick");
					expect(calls[4].args[1].evt).to.be.an.instanceOf(MouseEvent);
					expect(calls[4].args[1].point).to.be.an.instanceOf(Point);
					expect(calls[4].args[1].point.id).to.equal("point1");

					expect(calls[5].args[0]).to.equal(`${test.view}.dblclick`);
					expect(calls[5].args[1].evt).to.be.an.instanceOf(MouseEvent);
					expect(calls[5].args[1].time).to.be.a("number");
				});

				it(`should allow the user to prevent the ${test.view}.click event`, () => {
					const emit = sinon.spy(p, "emit");

					p.on("points.click", (event) => {
						event.preventViewEvent();
					});

					const x = test.view === "overview" ? 30 : 86;

					inputController.mouseDown({ x: x, y: 50 });
					inputController.mouseUp({ x: x, y: 50 });

					const calls = getEmitCalls(emit, new RegExp(`${test.view}|points`));

					expect(calls.length).to.equal(1);

					// expect(calls[0].args[0]).to.equal('points.mousedown');
					// expect(calls[0].args[1].evt).to.be.an.instanceOf(MouseEvent);
					// expect(calls[0].args[1].point).to.be.an.instanceOf(Point);
					// expect(calls[0].args[1].point.id).to.equal('point1');

					// expect(calls[1].args[0]).to.equal('points.mouseup');
					// expect(calls[1].args[1].evt).to.be.an.instanceOf(MouseEvent);
					// expect(calls[1].args[1].point).to.be.an.instanceOf(Point);
					// expect(calls[1].args[1].point.id).to.equal('point1');

					expect(calls[0].args[0]).to.equal("points.click");
					expect(calls[0].args[1].evt).to.be.an.instanceOf(MouseEvent);
					expect(calls[0].args[1].point).to.be.an.instanceOf(Point);
					expect(calls[0].args[1].point.id).to.equal("point1");
				});

				it(`should allow the user to prevent the ${test.view}.dblclick event`, () => {
					const emit = sinon.spy(p, "emit");

					p.on("points.dblclick", (event) => {
						event.preventViewEvent();
					});

					const x = test.view === "overview" ? 30 : 86;

					inputController.mouseDown({ x: x, y: 50 });
					inputController.mouseUp({ x: x, y: 50 });
					inputController.mouseDown({ x: x, y: 50 });
					inputController.mouseUp({ x: x, y: 50 });

					const calls = getEmitCalls(emit, new RegExp(`${test.view}|points`));

					expect(calls.length).to.equal(5);

					// expect(calls[0].args[0]).to.equal('points.mousedown');
					// expect(calls[0].args[1].evt).to.be.an.instanceOf(MouseEvent);
					// expect(calls[0].args[1].point).to.be.an.instanceOf(Point);
					// expect(calls[0].args[1].point.id).to.equal('point1');

					// expect(calls[1].args[0]).to.equal('points.mouseup');
					// expect(calls[1].args[1].evt).to.be.an.instanceOf(MouseEvent);
					// expect(calls[1].args[1].point).to.be.an.instanceOf(Point);
					// expect(calls[1].args[1].point.id).to.equal('point1');

					expect(calls[0].args[0]).to.equal("points.click");
					expect(calls[0].args[1].evt).to.be.an.instanceOf(MouseEvent);
					expect(calls[0].args[1].point).to.be.an.instanceOf(Point);
					expect(calls[0].args[1].point.id).to.equal("point1");

					expect(calls[1].args[0]).to.equal(`${test.view}.click`);
					expect(calls[1].args[1].evt).to.be.an.instanceOf(MouseEvent);
					expect(calls[1].args[1].time).to.be.a("number");

					// expect(calls[4].args[0]).to.equal('points.mousedown');
					// expect(calls[4].args[1].evt).to.be.an.instanceOf(MouseEvent);
					// expect(calls[4].args[1].point).to.be.an.instanceOf(Point);
					// expect(calls[4].args[1].point.id).to.equal('point1');

					// expect(calls[5].args[0]).to.equal('points.mouseup');
					// expect(calls[5].args[1].evt).to.be.an.instanceOf(MouseEvent);
					// expect(calls[5].args[1].point).to.be.an.instanceOf(Point);
					// expect(calls[5].args[1].point.id).to.equal('point1');

					expect(calls[2].args[0]).to.equal("points.click");
					expect(calls[2].args[1].evt).to.be.an.instanceOf(MouseEvent);
					expect(calls[2].args[1].point).to.be.an.instanceOf(Point);
					expect(calls[2].args[1].point.id).to.equal("point1");

					expect(calls[3].args[0]).to.equal(`${test.view}.click`);
					expect(calls[3].args[1].evt).to.be.an.instanceOf(MouseEvent);
					expect(calls[3].args[1].time).to.be.a("number");

					expect(calls[4].args[0]).to.equal("points.dblclick");
					expect(calls[4].args[1].evt).to.be.an.instanceOf(MouseEvent);
					expect(calls[4].args[1].point).to.be.an.instanceOf(Point);
					expect(calls[4].args[1].point.id).to.equal("point1");
				});
			});
		});
	});
});
