import sinon from "sinon";
import { Peaks } from "../src/main";

describe("WaveformView", () => {
	let p = null;
	let drawWaveformLayer = null;
	let logger = null;

	beforeEach((done: DoneCallback) => {
		logger = sinon.spy();

		const options = {
			dataUri: {
				arraybuffer: "base/test/data/sample.dat",
			},
			logger: logger,
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

			const zoomview = instance.views.getView("zoomview");
			expect(zoomview).to.be.ok;
			drawWaveformLayer = sinon.spy(zoomview, "drawWaveformLayer");

			done();
		});
	});

	afterEach(() => {
		if (p) {
			p.destroy();
			p = null;
		}
	});

	describe("setAmplitudeScale", () => {
		["zoomview", "overview"].forEach((viewName) => {
			describe(viewName, () => {
				it("should set the amplitude scale to default", () => {
					const view = p.views.getView(viewName);

					expect(() => {
						view.setAmplitudeScale(1.2);
					}).to.not.throw();

					expect(view.getAmplitudeScale()).to.equal(1.2);
				});

				it("should throw if no scale is given", () => {
					const view = p.views.getView(viewName);

					expect(() => {
						view.setAmplitudeScale();
					}).to.throw(/Scale must be a valid number/);
				});

				it("should throw if an invalid scale is given", () => {
					const view = p.views.getView(viewName);

					expect(() => {
						view.setAmplitudeScale("test");
					}).to.throw(/Scale must be a valid number/);
				});

				it("should throw if an invalid number is given", () => {
					const view = p.views.getView(viewName);

					expect(() => {
						view.setAmplitudeScale(Infinity);
					}).to.throw(/Scale must be a valid number/);
				});
			});
		});
	});

	describe("setWaveformColor", () => {
		["zoomview", "overview"].forEach((viewName) => {
			describe(viewName, () => {
				it("should set the waveform color", () => {
					const view = p.views.getView(viewName);

					view.setWaveformColor("#ff0000");

					expect(view.waveformShape.shape.fill()).to.equal("#ff0000");
				});

				it("should set the waveform to a linear gradient color", () => {
					const view = p.views.getView(viewName);

					view.setWaveformColor({
						linearGradientColorStops: [
							"hsl(180, 78%, 46%)",
							"hsl(180, 78%, 16%)",
						],
						linearGradientEnd: 60,
						linearGradientStart: 20,
					});

					expect(
						view.waveformShape.shape.fillLinearGradientStartPointY(),
					).to.equal(20);
					expect(
						view.waveformShape.shape.fillLinearGradientEndPointY(),
					).to.equal(60);
					expect(
						view.waveformShape.shape.fillLinearGradientColorStops().length,
					).to.equal(4);
				});
			});
		});
	});

	describe("setPlayedWaveformColor", () => {
		["zoomview", "overview"].forEach((viewName) => {
			describe(viewName, () => {
				it("should set the color of the waveform behind the playhead", () => {
					const view = p.views.getView(viewName);

					view.setPlayedWaveformColor("#ff0000");

					expect(view.playedWaveformShape.shape.fill()).to.equal("#ff0000");
				});
			});
		});
	});

	describe("setAxisLabelColor", () => {
		["zoomview", "overview"].forEach((viewName) => {
			describe(viewName, () => {
				it("should set the color of the waveform axis labels", () => {
					const view = p.views.getView(viewName);

					view.setAxisLabelColor("#ff0000");

					expect(view.axis.axisLabelColor).to.equal("#ff0000");
				});
			});
		});
	});

	describe("setAxisGridlineColor", () => {
		["zoomview", "overview"].forEach((viewName) => {
			describe(viewName, () => {
				it("should set the color of the waveform axis gridlines", () => {
					const view = p.views.getView(viewName);

					view.setAxisGridlineColor("#ff0000");

					expect(view.axis.axisGridlineColor).to.equal("#ff0000");
				});
			});
		});
	});

	describe("scrollWaveform", () => {
		describe("zoomview", () => {
			let zoomview = null;

			beforeEach(() => {
				zoomview = p.views.getView("zoomview");
			});

			it("should scroll the waveform to the right by the given number of seconds", () => {
				zoomview.scrollWaveform({ seconds: 2.0 });

				expect(drawWaveformLayer.callCount).to.equal(1);
				expect(zoomview.getStartTime()).to.equal(1.9969160997732427);
			});

			it("should scroll the waveform to the left by the given number of seconds", () => {
				zoomview.scrollWaveform({ seconds: 2.0 });
				zoomview.scrollWaveform({ seconds: -2.0 });

				expect(drawWaveformLayer.callCount).to.equal(2);
				expect(zoomview.getStartTime()).to.equal(0);
			});

			it("should scroll the waveform to the right by the given number of pixels", () => {
				zoomview.scrollWaveform({ pixels: 100 });

				expect(drawWaveformLayer.callCount).to.equal(1);
				expect(zoomview.getStartTime()).to.equal(1.1609977324263039);
			});

			it("should scroll the waveform to the left by the given number of pixels", () => {
				zoomview.scrollWaveform({ pixels: 100 });
				zoomview.scrollWaveform({ pixels: -100 });

				expect(drawWaveformLayer.callCount).to.equal(2);
				expect(zoomview.getStartTime()).to.equal(0);
			});

			it("should throw if not given a number of pixels or seconds", () => {
				expect(() => {
					zoomview.scrollWaveform(100);
				}).to.throw(TypeError);
			});
		});
	});

	describe("showAxisLabels", () => {
		["zoomview", "overview"].forEach((viewName) => {
			describe(viewName, () => {
				it("should hide the time axis labels", () => {
					const view = p.views.getView(viewName);
					const axisLayerDraw = sinon.spy(view.axisLayer, "draw");

					view.showAxisLabels(false);

					expect(axisLayerDraw.callCount).to.equal(1);
				});
			});
		});
	});

	describe("setZoom", () => {
		describe("zoomview", () => {
			describe("with scale option", () => {
				describe("with target scale greater than the original waveform data", () => {
					it("should set the new zoom level", () => {
						const view = p.views.getView("zoomview");

						view.setZoom({ scale: 512 });

						expect(view.scale).to.equal(512);
						expect(logger.notCalled).to.equal(true);
					});
				});

				describe("with target scale lower than the original waveform data", () => {
					it("should log an error and not change the zoom level", () => {
						const view = p.views.getView("zoomview");

						view.setZoom({ scale: 128 });

						expect(view.scale).to.equal(256);
						expect(logger.calledOnce).to.equal(true);
					});
				});

				describe("with non-integer scale", () => {
					it("should round the scale down to an integer value", () => {
						const view = p.views.getView("zoomview");

						const resampleData = sinon.spy(view, "resampleData");

						view.setZoom({ scale: 500.5 });

						expect(resampleData.callCount).to.equal(1);
						expect(resampleData).calledWithExactly({ scale: 500 });
						expect(view.scale).to.equal(500);
					});
				});

				describe("with auto option", () => {
					it("should fit the waveform to the width of the view", () => {
						const view = p.views.getView("zoomview");

						view.setZoom({ scale: "auto" });

						// TODO: resampling doesn't give requested length exactly
						expect(view.data.length).to.equal(1001);
					});
				});
			});

			describe("with seconds option", () => {
				describe("with target scale greater than the original waveform data", () => {
					it("should set the new zoom level", () => {
						const view = p.views.getView("zoomview");

						view.setZoom({ seconds: 10.0 });

						expect(view.scale).to.equal(441);
						expect(logger.notCalled).to.equal(true);
					});
				});

				describe("with target scale lower than the original waveform data", () => {
					it("should log an error and not change the zoom level", () => {
						const view = p.views.getView("zoomview");

						view.setZoom({ seconds: 1.0 });

						expect(view.scale).to.equal(256);
						expect(logger.calledOnce).to.equal(true);
					});
				});

				describe("with auto option", () => {
					it("should fit the waveform to the width of the view", () => {
						const view = p.views.getView("zoomview");

						view.setZoom({ seconds: "auto" });

						// TODO: resampling doesn't give requested length exactly
						expect(view.data.length).to.equal(1001);
					});
				});
			});
		});
	});
});
