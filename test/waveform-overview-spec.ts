import { Peaks } from "../src/main";

import { InputController } from "./helpers/input-controller";

describe("WaveformOverview", () => {
	describe("constructor", () => {
		describe("with waveform longer than the container width", () => {
			it("should rescale the waveform to fit the container width", (done: DoneCallback) => {
				const container = document.getElementById("overview-container");

				const options = {
					dataUri: { arraybuffer: "/base/test/data/sample.dat" },
					mediaElement: document.getElementById("media"),
					overview: {
						container: container,
					},
				};

				Peaks.init(options, (err, instance) => {
					if (err) {
						done(err);
						return;
					}

					const overview = instance.views.getView("overview");
					expect(overview.data).to.be.ok;

					// TODO: Resampling by width isn't precise
					const diff = Math.abs(overview.data.length - container.offsetWidth);
					expect(diff).to.be.lessThan(2);

					done();
				});
			});
		});

		describe("with waveform shorter than the container width", () => {
			it("should use default waveform scale", (done: DoneCallback) => {
				const options = {
					dataUri: { arraybuffer: "/base/test/data/STAT3S3.dat" },
					mediaElement: document.getElementById("media"),
					overview: {
						container: document.getElementById("overview-container"),
					},
				};

				Peaks.init(options, (err, instance) => {
					if (err) {
						done(err);
						return;
					}

					const view = instance.views.getView();
					expect(view.data).to.be.ok;
					expect(view.data.scale).to.equal(32);
					done();
				});
			});
		});
	});

	describe("enableSeek", () => {
		let p = null;
		let inputController = null;

		beforeEach((done: DoneCallback) => {
			const options = {
				dataUri: { arraybuffer: "/base/test/data/sample.dat" },
				mediaElement: document.getElementById("media"),
				overview: {
					container: document.getElementById("overview-container"),
				},
			};

			Peaks.init(options, (err, instance) => {
				if (err) {
					done(err);
					return;
				}

				p = instance;

				inputController = new InputController("overview-container");

				done();
			});
		});

		afterEach(() => {
			if (p) {
				p.destroy();
				p = null;
			}
		});

		describe("when enabled", () => {
			describe("when clicking on the waveform", () => {
				it("should set the playback position", () => {
					inputController.mouseDown({ x: 100, y: 50 });
					inputController.mouseUp({ x: 100, y: 50 });

					const view = p.views.getView("overview");

					expect(p.player.getCurrentTime()).to.be.closeTo(
						view.pixelsToTime(100),
						0.01,
					);
				});
			});

			describe("when dragging the waveform to the left", () => {
				it("should set the playback position", () => {
					const distance = -50;

					inputController.mouseDown({ x: 50, y: 50 });
					inputController.mouseMove({ x: 50 + distance, y: 50 });
					inputController.mouseUp({ x: 50 + distance, y: 50 });

					expect(p.player.getCurrentTime()).to.equal(0);
				});

				it("should not scroll beyond the start of the waveform", () => {
					const distance = -200;

					inputController.mouseDown({ x: 50, y: 50 });
					inputController.mouseMove({ x: 50 + distance, y: 50 });
					inputController.mouseUp({ x: 50 + distance, y: 50 });

					expect(p.player.getCurrentTime()).to.equal(0);
				});
			});

			describe("when dragging the waveform to the right", () => {
				it("should set the playback position", () => {
					const distance = 100;

					inputController.mouseDown({ x: 100, y: 50 });
					inputController.mouseMove({ x: 100 + distance, y: 50 });
					inputController.mouseUp({ x: 100 + distance, y: 50 });

					const view = p.views.getView("overview");

					expect(p.player.getCurrentTime()).to.be.closeTo(
						view.pixelsToTime(200),
						0.01,
					);
				});

				it("should limit the playback position to the end of the waveform", () => {
					const distance = 1200;

					inputController.mouseDown({ x: 50, y: 50 });
					inputController.mouseMove({ x: 50 + distance, y: 50 });
					inputController.mouseUp({ x: 50 + distance, y: 50 });

					expect(p.player.getCurrentTime()).to.equal(p.player.getDuration());
				});
			});
		});

		describe("when disabled", () => {
			beforeEach(() => {
				const view = p.views.getView("overview");
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

			describe("when dragging the waveform", () => {
				it("should not change the playback position", () => {
					const distance = 100;
					const time = p.player.getCurrentTime();

					inputController.mouseDown({ x: 100, y: 50 });
					inputController.mouseMove({ x: 100 + distance, y: 50 });
					inputController.mouseUp({ x: 100 + distance, y: 50 });

					expect(p.player.getCurrentTime()).to.equal(time);
				});
			});
		});
	});
});
