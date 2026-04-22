import Konva from "konva";
import sinon, { type SinonSpy } from "sinon";
import { Peaks } from "../src/main";
import { Scrollbar } from "../src/scrollbar";
import { WaveformOverview } from "../src/waveform/overview";
import { WaveformZoomView } from "../src/waveform/zoomview";
import sampleJsonData from "./data/sample.json";

const TestAudioContext = window.AudioContext;

const externalPlayer = {
	destroy: () => {},
	dispose: () => {},
	getCurrentTime: () => 0,
	getDuration: () => 0,
	init: () => Promise.resolve(),
	isPlaying: () => false,
	isSeeking: () => false,
	pause: () => {},
	play: () => Promise.resolve(),
	seek: () => {},
};

type InternalPlayheadLayer = {
	playheadColor: string;
	playheadTextColor: string;
	playheadText?: object;
};

type InternalAxis = {
	labelColor: string;
	gridlineColor: string;
};

type InternalHighlightLayer = {
	offset: number;
	color: string;
	strokeColor: string;
	opacity: number;
	cornerRadius: number;
};

type InternalView = {
	playheadLayer: InternalPlayheadLayer;
	drawWaveformLayer?: () => void;
	formatPlayheadTimeFn?: (time: number) => string;
	axis: InternalAxis;
	highlightLayer: InternalHighlightLayer;
};

function expectPresent<T>(value: T | null | undefined): NonNullable<T> {
	expect(value).to.not.equal(null);
	expect(value).to.not.equal(undefined);

	return value as NonNullable<T>;
}

describe("Peaks", () => {
	let p: Peaks | null = null;

	afterEach(() => {
		if (p) {
			p.dispose();
			p = null;
		}
	});

	describe("init", () => {
		it("should throw if called without a callback", () => {
			expect(() => {
				(Peaks.init as unknown as (options: unknown) => unknown)({
					dataUri: { arraybuffer: "/base/test/data/sample.dat" },
					mediaElement: document.getElementById("media"),
					overview: {
						container: document.getElementById("overview-container"),
					},
					zoomview: {
						container: document.getElementById("zoomview-container"),
					},
				});
			}).to.throw(Error, /callback/);
		});

		describe("with valid options", () => {
			it("should invoke callback when initialised", (done: DoneCallback) => {
				Peaks.init(
					{
						dataUri: { arraybuffer: "/base/test/data/sample.dat" },
						mediaElement: document.getElementById("media"),
						overview: {
							container: document.getElementById("overview-container"),
						},
						zoomview: {
							container: document.getElementById("zoomview-container"),
						},
					},
					(err, instance) => {
						expect(err).to.equal(undefined);
						expect(instance).to.be.an.instanceOf(Peaks);
						instance?.dispose();
						done();
					},
				);
			});

			it("should return undefined", (done: DoneCallback) => {
				const result = Peaks.init(
					{
						dataUri: { arraybuffer: "/base/test/data/sample.dat" },
						mediaElement: document.getElementById("media"),
						overview: {
							container: document.getElementById("overview-container"),
						},
						zoomview: {
							container: document.getElementById("zoomview-container"),
						},
					},
					(err, instance) => {
						expect(err).to.equal(undefined);
						expect(instance).to.be.an.instanceOf(Peaks);
						expect(result).to.equal(undefined);
						instance?.dispose();
						done();
					},
				);
			});

			it("should resolve a Peaks instance with fromOptionsAsync", async () => {
				p = await Peaks.fromOptionsAsync({
					dataUri: { arraybuffer: "/base/test/data/sample.dat" },
					mediaElement: document.getElementById("media") as HTMLMediaElement,
					overview: {
						container: document.getElementById("overview-container")!,
					},
					zoomview: {
						container: document.getElementById("zoomview-container")!,
					},
				});

				expect(p).to.be.an.instanceOf(Peaks);
			});

			it("should reject fromOptionsAsync when initialization fails", async () => {
				try {
					await Peaks.fromOptionsAsync({
						dataUri: { arraybuffer: "/base/test/data/sample.dat" },
						mediaElement: document.getElementById("media"),
						overview: {},
						zoomview: {},
					});
					expect.fail("Expected fromOptionsAsync to reject");
				} catch (error) {
					expect(error).to.be.an.instanceOf(TypeError);
					expect((error as Error).message).to.match(
						/must be valid HTML elements/,
					);
				}
			});

			describe("with zoomview and overview options", () => {
				it("should construct a Peaks object with overview and zoomable waveforms", (done: DoneCallback) => {
					Peaks.init(
						{
							dataUri: { arraybuffer: "/base/test/data/sample.dat" },
							mediaElement: document.getElementById("media"),
							overview: {
								container: document.getElementById("overview-container"),
							},
							zoomview: {
								container: document.getElementById("zoomview-container"),
							},
						},
						(err, instance) => {
							expect(err).to.equal(undefined);
							expect(instance).to.be.an.instanceof(Peaks);
							expect(instance?.views.getView("overview")).to.be.an.instanceOf(
								WaveformOverview,
							);
							expect(instance?.views.getView("zoomview")).to.be.an.instanceOf(
								WaveformZoomView,
							);
							done();
						},
					);
				});

				it("should construct a Peaks object with an overview waveform only", (done: DoneCallback) => {
					Peaks.init(
						{
							dataUri: { arraybuffer: "/base/test/data/sample.dat" },
							mediaElement: document.getElementById("media"),
							overview: {
								container: document.getElementById("overview-container"),
							},
						},
						(err, instance) => {
							expect(err).to.equal(undefined);
							expect(instance).to.be.an.instanceof(Peaks);
							expect(instance?.views.getView("overview")).to.be.an.instanceOf(
								WaveformOverview,
							);
							expect(instance?.views.getView("zoomview")).to.equal(undefined);
							done();
						},
					);
				});

				it("should construct a Peaks object with a zoomable waveform only", (done: DoneCallback) => {
					Peaks.init(
						{
							dataUri: { arraybuffer: "/base/test/data/sample.dat" },
							mediaElement: document.getElementById("media"),
							zoomview: {
								container: document.getElementById("zoomview-container"),
							},
						},
						(err, instance) => {
							expect(err).to.equal(undefined);
							expect(instance).to.be.an.instanceof(Peaks);
							expect(instance?.views.getView("overview")).to.equal(undefined);
							expect(instance?.views.getView("zoomview")).to.be.an.instanceOf(
								WaveformZoomView,
							);

							done();
						},
					);
				});

				it("should return an error if no containers are given", (done: DoneCallback) => {
					Peaks.init(
						{
							dataUri: { arraybuffer: "/base/test/data/sample.dat" },
							mediaElement: document.getElementById("media"),
							overview: {},
							zoomview: {},
						},
						(err, instance) => {
							expect(err).to.be.an.instanceOf(TypeError);
							expect(err?.message).to.match(/must be valid HTML elements/);
							expect(instance).to.equal(undefined);
							done();
						},
					);
				});

				it("should use view-specific options", (done: DoneCallback) => {
					function overviewFormatPlayheadTime(): string {
						return "overview";
					}
					function zoomviewFormatPlayheadTime(): string {
						return "zoomview";
					}

					Peaks.init(
						{
							dataUri: { arraybuffer: "/base/test/data/sample.dat" },
							mediaElement: document.getElementById("media"),
							overview: {
								axisGridlineColor: "#000000",
								axisLabelColor: "#0000ff",
								container: document.getElementById("overview-container"),
								formatPlayheadTime: overviewFormatPlayheadTime,
								highlightColor: "#808080",
								highlightCornerRadius: 5,
								highlightOffset: 2,
								highlightOpacity: 0.5,
								highlightStrokeColor: "#404040",
								playheadColor: "#ff0000",
								playheadTextColor: "#00ff00",
								showPlayheadTime: true,
							},
							zoomview: {
								axisGridlineColor: "#808080",
								axisLabelColor: "#ff0000",
								container: document.getElementById("zoomview-container"),
								formatPlayheadTime: zoomviewFormatPlayheadTime,
								playheadColor: "#00ff00",
								playheadTextColor: "#0000ff",
								showPlayheadTime: false,
							},
						},
						(err, instance) => {
							expect(err).to.equal(undefined);
							expect(instance).to.be.an.instanceof(Peaks);

							const overview = instance?.views.getView(
								"overview",
							) as unknown as InternalView;
							const zoomview = instance?.views.getView(
								"zoomview",
							) as unknown as InternalView;

							expect(overview.playheadLayer.playheadColor).to.equal("#ff0000");
							expect(zoomview.playheadLayer.playheadColor).to.equal("#00ff00");
							expect(overview.playheadLayer.playheadTextColor).to.equal(
								"#00ff00",
							);
							expect(zoomview.playheadLayer.playheadTextColor).to.equal(
								"#0000ff",
							);
							expect(overview.playheadLayer.playheadText).to.be.an.instanceOf(
								Konva.Text,
							);
							expect(zoomview.playheadLayer.playheadText).to.equal(undefined);
							expect(overview.formatPlayheadTimeFn).to.equal(
								overviewFormatPlayheadTime,
							);
							expect(zoomview.formatPlayheadTimeFn).to.equal(
								zoomviewFormatPlayheadTime,
							);
							expect(overview.axis.labelColor).to.equal("#0000ff");
							expect(zoomview.axis.labelColor).to.equal("#ff0000");
							expect(overview.axis.gridlineColor).to.equal("#000000");
							expect(zoomview.axis.gridlineColor).to.equal("#808080");
							expect(overview.highlightLayer.offset).to.equal(2);
							expect(overview.highlightLayer.color).to.equal("#808080");
							expect(overview.highlightLayer.strokeColor).to.equal("#404040");
							expect(overview.highlightLayer.opacity).to.equal(0.5);
							expect(overview.highlightLayer.cornerRadius).to.equal(5);
							done();
						},
					);
				});

				it("should use global options", (done: DoneCallback) => {
					Peaks.init(
						{
							axisGridlineColor: "#000000",
							axisLabelColor: "#0000ff",
							dataUri: { arraybuffer: "/base/test/data/sample.dat" },
							highlightColor: "#808080",
							highlightCornerRadius: 5,
							highlightOffset: 2,
							highlightOpacity: 0.5,
							highlightStrokeColor: "#404040",
							mediaElement: document.getElementById("media"),
							overview: {
								container: document.getElementById("overview-container"),
							},
							playheadColor: "#ff0000",
							playheadTextColor: "#00ff00",
							showPlayheadTime: true,
							zoomview: {
								container: document.getElementById("zoomview-container"),
							},
						},
						(err, instance) => {
							expect(err).to.equal(undefined);
							expect(instance).to.be.an.instanceof(Peaks);

							const overview = instance?.views.getView(
								"overview",
							) as unknown as InternalView;
							const zoomview = instance?.views.getView(
								"zoomview",
							) as unknown as InternalView;

							expect(overview.playheadLayer.playheadColor).to.equal("#ff0000");
							expect(zoomview.playheadLayer.playheadColor).to.equal("#ff0000");
							expect(overview.playheadLayer.playheadTextColor).to.equal(
								"#00ff00",
							);
							expect(zoomview.playheadLayer.playheadTextColor).to.equal(
								"#00ff00",
							);
							expect(overview.playheadLayer.playheadText).to.equal(undefined);
							expect(zoomview.playheadLayer.playheadText).to.be.an.instanceOf(
								Konva.Text,
							);
							expect(overview.axis.labelColor).to.equal("#0000ff");
							expect(zoomview.axis.labelColor).to.equal("#0000ff");
							expect(overview.axis.gridlineColor).to.equal("#000000");
							expect(zoomview.axis.gridlineColor).to.equal("#000000");
							expect(overview.highlightLayer.offset).to.equal(2);
							expect(overview.highlightLayer.color).to.equal("#808080");
							expect(overview.highlightLayer.strokeColor).to.equal("#404040");
							expect(overview.highlightLayer.opacity).to.equal(0.5);
							expect(overview.highlightLayer.cornerRadius).to.equal(5);
							done();
						},
					);
				});

				it("should use default options", (done: DoneCallback) => {
					Peaks.init(
						{
							dataUri: { arraybuffer: "/base/test/data/sample.dat" },
							mediaElement: document.getElementById("media"),
							overview: {
								container: document.getElementById("overview-container"),
							},
							zoomview: {
								container: document.getElementById("zoomview-container"),
							},
						},
						(err, instance) => {
							expect(err).to.equal(undefined);
							expect(instance).to.be.an.instanceof(Peaks);

							const overview = instance?.views.getView(
								"overview",
							) as unknown as InternalView;
							const zoomview = instance?.views.getView(
								"zoomview",
							) as unknown as InternalView;

							expect(overview.playheadLayer.playheadColor).to.equal("#111111");
							expect(zoomview.playheadLayer.playheadColor).to.equal("#111111");
							expect(overview.playheadLayer.playheadTextColor).to.equal(
								"#aaaaaa",
							);
							expect(zoomview.playheadLayer.playheadTextColor).to.equal(
								"#aaaaaa",
							);
							expect(overview.playheadLayer.playheadText).to.equal(undefined);
							expect(overview.playheadLayer.playheadText).to.equal(undefined);
							expect(overview.axis.labelColor).to.equal("#aaaaaa");
							expect(zoomview.axis.labelColor).to.equal("#aaaaaa");
							expect(overview.axis.gridlineColor).to.equal("#cccccc");
							expect(zoomview.axis.gridlineColor).to.equal("#cccccc");
							expect(overview.highlightLayer.offset).to.equal(11);
							expect(overview.highlightLayer.color).to.equal("#aaaaaa");
							expect(overview.highlightLayer.strokeColor).to.equal(
								"transparent",
							);
							expect(overview.highlightLayer.opacity).to.equal(0.3);
							expect(overview.highlightLayer.cornerRadius).to.equal(2);
							done();
						},
					);
				});
			});

			describe("with scrollbar option", () => {
				it("should construct a Peaks object with scrollbar", (done: DoneCallback) => {
					Peaks.init(
						{
							dataUri: { arraybuffer: "/base/test/data/sample.dat" },
							mediaElement: document.getElementById("media"),
							overview: {
								container: document.getElementById("overview-container"),
							},
							scrollbar: {
								container: document.getElementById("scrollbar-container"),
							},
							zoomview: {
								container: document.getElementById("zoomview-container"),
							},
						},
						(err, instance) => {
							expect(err).to.equal(undefined);
							expect(instance).to.be.an.instanceof(Peaks);
							const viewController = instance?.views as unknown as {
								scrollbar: unknown;
							};
							expect(viewController.scrollbar).to.be.an.instanceOf(Scrollbar);
							done();
						},
					);
				});
			});

			describe("with precomputed stereo waveform data", () => {
				it("should initialise correctly", (done: DoneCallback) => {
					Peaks.init(
						{
							dataUri: { arraybuffer: "/base/test/data/07023003-2channel.dat" },
							mediaElement: document.getElementById("media"),
							overview: {
								container: document.getElementById("overview-container"),
							},
							zoomview: {
								container: document.getElementById("zoomview-container"),
							},
						},
						(err, instance) => {
							expect(err).to.equal(undefined);
							const peaks = expectPresent(instance);
							const waveformData = expectPresent(peaks.getWaveformData());
							expect(peaks).to.be.an.instanceOf(Peaks);
							expect(waveformData.channels).to.equal(2);
							peaks.dispose();
							done();
						},
					);
				});
			});

			describe("with valid JSON waveform data", () => {
				it("should initialise correctly", (done: DoneCallback) => {
					Peaks.init(
						{
							mediaElement: document.getElementById("media"),
							overview: {
								container: document.getElementById("overview-container"),
							},
							waveformData: {
								json: sampleJsonData,
							},
							zoomview: {
								container: document.getElementById("zoomview-container"),
							},
						},
						(err, instance) => {
							expect(err).to.equal(undefined);
							const peaks = expectPresent(instance);
							const waveformData = expectPresent(peaks.getWaveformData());
							expect(peaks).to.be.an.instanceOf(Peaks);
							expect(waveformData.channels).to.equal(1);
							peaks.dispose();
							done();
						},
					);
				});
			});

			describe("with valid binary waveform data", () => {
				it("should initialise correctly", (done: DoneCallback) => {
					fetch("/base/test/data/sample.dat")
						.then((response) => response.arrayBuffer())
						.then((buffer) => {
							Peaks.init(
								{
									mediaElement: document.getElementById("media"),
									overview: {
										container: document.getElementById("overview-container"),
									},
									waveformData: {
										arraybuffer: buffer,
									},
									zoomview: {
										container: document.getElementById("zoomview-container"),
									},
								},
								(err, instance) => {
									expect(err).to.equal(undefined);
									const peaks = expectPresent(instance);
									const waveformData = expectPresent(peaks.getWaveformData());
									expect(peaks).to.be.an.instanceOf(Peaks);
									expect(waveformData.channels).to.equal(1);
									peaks.dispose();
									done();
								},
							);
						});
				});
			});

			describe("with audioContext and multiChannel enabled", () => {
				it("should initialise correctly", (done: DoneCallback) => {
					Peaks.init(
						{
							mediaElement: document.getElementById("media"),
							overview: {
								container: document.getElementById("overview-container"),
							},
							webAudio: {
								audioContext: new TestAudioContext(),
								multiChannel: true,
							},
							zoomview: {
								container: document.getElementById("zoomview-container"),
							},
						},
						(err, instance) => {
							expect(err).to.equal(undefined);
							const peaks = expectPresent(instance);
							const waveformData = expectPresent(peaks.getWaveformData());
							expect(peaks).to.be.an.instanceOf(Peaks);
							expect(waveformData.channels).to.equal(2);
							peaks.dispose();
							done();
						},
					);
				});
			});

			describe("with audioBuffer", () => {
				it("should initialise correctly", (done: DoneCallback) => {
					const audioContext = new TestAudioContext();

					fetch("/base/test/data/sample.mp3")
						.then((response) => response.arrayBuffer())
						.then((buffer) => audioContext.decodeAudioData(buffer))
						.then((audioBuffer) => {
							Peaks.init(
								{
									mediaElement: document.getElementById("media"),
									overview: {
										container: document.getElementById("overview-container"),
									},
									webAudio: {
										audioBuffer: audioBuffer,
										multiChannel: true,
									},
									zoomLevels: [128, 256],
									zoomview: {
										container: document.getElementById("zoomview-container"),
									},
								},
								(err, instance) => {
									expect(err).to.equal(undefined);
									const peaks = expectPresent(instance);
									const waveformData = expectPresent(peaks.getWaveformData());
									expect(peaks).to.be.an.instanceOf(Peaks);
									expect(waveformData.channels).to.equal(2);
									peaks.dispose();
									done();
								},
							);
						});
				});
			});

			describe("with external player", () => {
				it("should ignore mediaUrl if using an external player", (done: DoneCallback) => {
					Peaks.init(
						{
							mediaUrl: "invalid",
							overview: {
								container: document.getElementById("overview-container"),
							},
							player: externalPlayer,
							waveformData: {
								json: sampleJsonData,
							},
							zoomview: {
								container: document.getElementById("zoomview-container"),
							},
						},
						(err, instance) => {
							expect(err).to.equal(undefined);
							const peaks = expectPresent(instance);
							expect(peaks).to.be.an.instanceOf(Peaks);
							peaks.dispose();
							done();
						},
					);
				});
			});

			describe("with audio element in error state", () => {
				let mediaElement: HTMLAudioElement | null = null;

				beforeEach(() => {
					mediaElement = document.createElement("audio");
					mediaElement.id = "adpcm";
					mediaElement.src = "/base/test/data/adpcm.wav";
					mediaElement.muted = true;
					document.body.appendChild(mediaElement);
				});

				afterEach(() => {
					document.body.removeChild(expectPresent(mediaElement));
					mediaElement = null;
				});

				it("should invoke callback with an error", (done: DoneCallback) => {
					Peaks.init(
						{
							dataUri: { arraybuffer: "/base/test/data/sample.dat" },
							mediaElement: document.getElementById(
								"adpcm",
							) as HTMLMediaElement,
							overview: {
								container: document.getElementById("overview-container"),
							},
							zoomview: {
								container: document.getElementById("zoomview-container"),
							},
						},
						(err, instance) => {
							expect(err).to.be.an.instanceOf(MediaError);
							expect((err as unknown as MediaError).code).to.equal(
								MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED,
							);
							expect(instance).to.equal(undefined);
							done();
						},
					);
				});
			});
		});

		describe("with invalid options", () => {
			it("should invoke callback with an error if options is not an object", (done: DoneCallback) => {
				Peaks.init([] as unknown as never, (err, instance) => {
					const error = expectPresent(err);
					expect(error).to.be.an.instanceOf(Error);
					expect(error.message).to.match(/should be an object/);
					expect(instance).to.equal(undefined);
					done();
				});
			});

			it("should invoke callback with an error if no mediaElement is provided", (done: DoneCallback) => {
				Peaks.init(
					{
						dataUri: { arraybuffer: "/base/test/data/sample.dat" },
						overview: {
							container: document.getElementById("overview-container"),
						},
						zoomview: {
							container: document.getElementById("zoomview-container"),
						},
					},
					(err, instance) => {
						const error = expectPresent(err);
						expect(error).to.be.an.instanceOf(Error);
						expect(error.message).to.match(
							/Provide one of: mediaElement, player, or audioContext/,
						);
						expect(instance).to.equal(undefined);
						done();
					},
				);
			});

			it("should invoke callback with an error if mediaElement is not an HTMLMediaElement", (done: DoneCallback) => {
				Peaks.init(
					{
						dataUri: { arraybuffer: "/base/test/data/sample.dat" },
						mediaElement: document.createElement(
							"div",
						) as unknown as HTMLMediaElement,
						overview: {
							container: document.getElementById("overview-container"),
						},
						zoomview: {
							container: document.getElementById("zoomview-container"),
						},
					},
					(err, instance) => {
						const error = expectPresent(err);
						expect(error).to.be.an.instanceOf(TypeError);
						expect(error.message).to.match(/HTMLMediaElement/);
						expect(instance).to.equal(undefined);
						done();
					},
				);
			});

			it("should invoke callback with an error if both a dataUri and audioContext are provided", (done: DoneCallback) => {
				Peaks.init(
					{
						dataUri: { arraybuffer: "/base/test/data/sample.dat" },
						mediaElement: document.getElementById("media"),
						overview: {
							container: document.getElementById("overview-container"),
						},
						webAudio: {
							audioContext: new TestAudioContext(),
						},
						zoomview: {
							container: document.getElementById("zoomview-container"),
						},
					},
					(err, instance) => {
						const error = expectPresent(err);
						expect(error).to.be.an.instanceOf(TypeError);
						expect(error.message).to.match(/only pass one/);
						expect(instance).to.equal(undefined);
						done();
					},
				);
			});

			it("should invoke callback with an error if neither a dataUri nor an audioContext are provided", (done: DoneCallback) => {
				Peaks.init(
					{
						mediaElement: document.getElementById("media"),
						overview: {
							container: document.getElementById("overview-container"),
						},
						zoomview: {
							container: document.getElementById("zoomview-container"),
						},
					},
					(err, instance) => {
						const error = expectPresent(err);
						expect(error).to.be.an.instanceOf(Error);
						expect(error.message).to.match(
							/audioContext, or dataUri, or waveformData/,
						);
						expect(instance).to.equal(undefined);
						done();
					},
				);
			});

			it("should invoke callback with an error if the dataUri is not an object", (done: DoneCallback) => {
				Peaks.init(
					{
						dataUri: true as unknown as Record<string, string>,
						mediaElement: document.getElementById("media"),
						overview: {
							container: document.getElementById("overview-container"),
						},
						zoomview: {
							container: document.getElementById("zoomview-container"),
						},
					},
					(err, instance) => {
						const error = expectPresent(err);
						expect(error).to.be.an.instanceOf(TypeError);
						expect(error.message).to.match(/dataUri/);
						expect(instance).to.equal(undefined);
						done();
					},
				);
			});

			it("should invoke callback with an error if the provided JSON waveform data is invalid", (done: DoneCallback) => {
				Peaks.init(
					{
						mediaElement: document.getElementById("media"),
						overview: {
							container: document.getElementById("overview-container"),
						},
						waveformData: {
							json: { data: "foo" },
						},
						zoomview: {
							container: document.getElementById("zoomview-container"),
						},
					},
					(err, instance) => {
						expect(err).to.be.an.instanceOf(Error);
						expect(instance).to.equal(undefined);
						done();
					},
				);
			});

			it("should invoke callback with an error if provided binary waveform data is invalid", (done: DoneCallback) => {
				fetch("/base/test/data/unknown.dat")
					.then((response) => response.arrayBuffer())
					.then((buffer) => {
						Peaks.init(
							{
								mediaElement: document.getElementById("media"),
								overview: {
									container: document.getElementById("overview-container"),
								},
								waveformData: {
									arraybuffer: buffer,
								},
								zoomview: {
									container: document.getElementById("zoomview-container"),
								},
							},
							(err, instance) => {
								expect(err).to.be.an.instanceOf(Error);
								expect(instance).to.equal(undefined);
								done();
							},
						);
					});
			});

			it("should invoke callback with an error if no zoomview or overview options are provided", (done: DoneCallback) => {
				Peaks.init(
					{
						dataUri: { arraybuffer: "/base/test/data/sample.dat" },
						mediaElement: document.getElementById("media"),
					},
					(err, instance) => {
						const error = expectPresent(err);
						expect(error).to.be.an.instanceOf(Error);
						expect(error.message).to.match(/must be valid HTML elements/);
						expect(instance).to.equal(undefined);
						done();
					},
				);
			});

			it("should invoke callback with an error if the logger is defined and not a function", (done: DoneCallback) => {
				Peaks.init(
					{
						dataUri: {
							arraybuffer: "base/test/data/sample.dat",
						},
						logger: "foo" as unknown as typeof console.error,
						mediaElement: document.getElementById("media"),
						overview: {
							container: document.getElementById("overview-container"),
						},
						zoomview: {
							container: document.getElementById("zoomview-container"),
						},
					},
					(err, instance) => {
						const error = expectPresent(err);
						expect(error).to.be.an.instanceOf(TypeError);
						expect(error.message).to.match(/logger/);
						expect(instance).to.equal(undefined);
						done();
					},
				);
			});

			it("should invoke callback with an error if the zoomLevels option is missing", (done: DoneCallback) => {
				Peaks.init(
					{
						dataUri: {
							arraybuffer: "base/test/data/sample.dat",
						},
						mediaElement: document.getElementById("media"),
						overview: {
							container: document.getElementById("overview-container"),
						},
						zoomLevels: null as unknown as number[],
						zoomview: {
							container: document.getElementById("zoomview-container"),
						},
					},
					(err, instance) => {
						const error = expectPresent(err);
						expect(error).to.be.an.instanceOf(Error);
						expect(error.message).to.match(/zoomLevels/);
						expect(instance).to.equal(undefined);
						done();
					},
				);
			});

			it("should invoke callback with an error if the zoomLevels option is empty", (done: DoneCallback) => {
				Peaks.init(
					{
						dataUri: {
							arraybuffer: "base/test/data/sample.dat",
						},
						mediaElement: document.getElementById("media"),
						overview: {
							container: document.getElementById("overview-container"),
						},
						zoomLevels: [],
						zoomview: {
							container: document.getElementById("zoomview-container"),
						},
					},
					(err, instance) => {
						const error = expectPresent(err);
						expect(error).to.be.an.instanceOf(Error);
						expect(error.message).to.match(/zoomLevels/);
						expect(instance).to.equal(undefined);
						done();
					},
				);
			});

			it("should invoke callback with an error if the zoomLevels option is not in ascending order", (done: DoneCallback) => {
				Peaks.init(
					{
						dataUri: {
							arraybuffer: "base/test/data/sample.dat",
						},
						mediaElement: document.getElementById("media"),
						overview: {
							container: document.getElementById("overview-container"),
						},
						zoomLevels: [1024, 512],
						zoomview: {
							container: document.getElementById("zoomview-container"),
						},
					},
					(err, instance) => {
						const error = expectPresent(err);
						expect(error).to.be.an.instanceOf(Error);
						expect(error.message).to.match(/zoomLevels/);
						expect(instance).to.equal(undefined);
						done();
					},
				);
			});

			it("should invoke callback with an error if the zoomview container element has zero width", (done: DoneCallback) => {
				const container = document.getElementById("zoomview-container");
				container.style.width = "0px";

				const options = {
					dataUri: {
						arraybuffer: "base/test/data/sample.dat",
					},
					mediaElement: document.getElementById("media"),
					zoomview: {
						container: container,
					},
				};

				Peaks.init(options, (err, instance) => {
					const error = expectPresent(err);
					expect(error).to.be.an.instanceOf(Error);
					expect(error.message).to.match(/width/);
					expect(instance).to.equal(undefined);
					done();
				});
			});

			it("should invoke callback with an error if the zoomview container element has zero height", (done: DoneCallback) => {
				const container = document.getElementById("zoomview-container");
				container.style.height = "0px";

				const options = {
					dataUri: {
						arraybuffer: "base/test/data/sample.dat",
					},
					mediaElement: document.getElementById("media"),
					zoomview: {
						container: container,
					},
				};

				Peaks.init(options, (err, instance) => {
					const error = expectPresent(err);
					expect(error).to.be.an.instanceOf(Error);
					expect(error.message).to.match(/height/);
					expect(instance).to.equal(undefined);
					done();
				});
			});

			it("should invoke callback with an error if the overview container element has zero width", (done: DoneCallback) => {
				const container = document.getElementById("overview-container");
				container.style.width = "0px";

				const options = {
					dataUri: {
						arraybuffer: "base/test/data/sample.dat",
					},
					mediaElement: document.getElementById("media"),
					overview: {
						container: container,
					},
				};

				Peaks.init(options, (err, instance) => {
					const error = expectPresent(err);
					expect(error).to.be.an.instanceOf(Error);
					expect(error.message).to.match(/width/);
					expect(instance).to.equal(undefined);
					done();
				});
			});

			it("should invoke callback with an error if the overview container element has zero height", (done: DoneCallback) => {
				const container = document.getElementById("overview-container");
				container.style.height = "0px";

				const options = {
					dataUri: {
						arraybuffer: "base/test/data/sample.dat",
					},
					mediaElement: document.getElementById("media"),
					overview: {
						container: container,
					},
				};

				Peaks.init(options, (err, instance) => {
					const error = expectPresent(err);
					expect(error).to.be.an.instanceOf(Error);
					expect(error.message).to.match(/height/);
					expect(instance).to.equal(undefined);
					done();
				});
			});

			it("should invoke callback with an error if the zoomview container element has zero height after initialisation", (done: DoneCallback) => {
				const container = document.getElementById("zoomview-container");

				const options = {
					dataUri: {
						arraybuffer: "base/test/data/sample.dat",
					},
					mediaElement: document.getElementById("media"),
					zoomview: {
						container: container,
					},
				};

				Peaks.init(options, (err, instance) => {
					const error = expectPresent(err);
					expect(error).to.be.an.instanceOf(Error);
					expect(error.message).to.match(/height/);
					expect(instance).to.equal(undefined);
					done();
				});

				container.style.height = "0px";
			});

			it("should invoke callback with an error if the overview container element has zero height after initialisation", (done: DoneCallback) => {
				const container = document.getElementById("overview-container");

				const options = {
					dataUri: {
						arraybuffer: "base/test/data/sample.dat",
					},
					mediaElement: document.getElementById("media"),
					overview: {
						container: container,
					},
				};

				Peaks.init(options, (err, instance) => {
					const error = expectPresent(err);
					expect(error).to.be.an.instanceOf(Error);
					expect(error.message).to.match(/height/);
					expect(instance).to.equal(undefined);
					done();
				});

				container.style.height = "0px";
			});
		});
	});

	describe("setSource", () => {
		let drawWaveformLayer: SinonSpy | null = null;

		function getActivePeaks(): Peaks {
			return expectPresent(p);
		}

		function getDrawWaveformLayer(): SinonSpy {
			return expectPresent(drawWaveformLayer);
		}

		beforeEach((done: DoneCallback) => {
			const options = {
				dataUri: { arraybuffer: "/base/test/data/sample.dat" },
				mediaElement: document.getElementById("media"),
				overview: {
					container: document.getElementById("overview-container"),
				},
				zoomLevels: [512, 1024, 2048],
				zoomview: {
					container: document.getElementById("zoomview-container"),
				},
			};

			Peaks.init(options, (err, instance) => {
				expect(err).to.equal(undefined);

				p = expectPresent(instance);

				const zoomview = p.views.getView("zoomview") as unknown as InternalView;
				expect(zoomview).to.be.ok;
				expectPresent(zoomview.drawWaveformLayer);

				drawWaveformLayer = sinon.spy(zoomview, "drawWaveformLayer");
				done();
			});
		});

		describe("with invalid media url", () => {
			it("should return an error", (done: DoneCallback) => {
				const options = {
					dataUri: {
						arraybuffer: "/base/test/data/unknown.dat",
					},
					mediaUrl: "/base/test/data/unknown.mp3",
				};

				getActivePeaks().setSource(options, (error) => {
					expect(error).to.be.an.instanceOf(MediaError);
					done();
				});
			});

			it("should preserve existing event handlers", (done: DoneCallback) => {
				const options = {
					dataUri: {
						arraybuffer: "/base/test/data/unknown.dat",
					},
					mediaUrl: "/base/test/data/unknown.mp3",
				};

				function onError() {
					// Nothing
				}

				const peaks = getActivePeaks();
				peaks.events.addEventListener("player.error", onError);

				peaks.setSource(options, (error) => {
					expect(error).to.be.an.instanceOf(MediaError);
					expect(peaks.events.map.get("player.error")?.length ?? 0).to.equal(1);
					done();
				});
			});
		});

		describe("with invalid json waveform data", () => {
			it("should return an error", (done: DoneCallback) => {
				const options = {
					mediaUrl: "/base/test/data/sample.mp3",
					waveformData: {
						json: { data: "foo" },
					},
				};

				getActivePeaks().setSource(options, (error) => {
					expect(error).to.be.an.instanceOf(Error);
					done();
				});
			});
		});

		describe("with valid json waveform data", () => {
			it("should update the waveform", (done: DoneCallback) => {
				const options = {
					mediaUrl: "/base/test/data/sample.mp3",
					waveformData: {
						json: sampleJsonData,
					},
				};

				getActivePeaks().setSource(options, (error) => {
					expect(error).to.be.undefined;
					expect(getDrawWaveformLayer().callCount).to.equal(1);
					done();
				});
			});
		});

		describe("with waveform data url", () => {
			it("should update the waveform", (done: DoneCallback) => {
				const options = {
					dataUri: {
						arraybuffer: "/base/test/data/sample.dat",
					},
					mediaUrl: "/base/test/data/sample.mp3",
				};

				getActivePeaks().setSource(options, (error) => {
					expect(error).to.be.undefined;
					expect(getDrawWaveformLayer().callCount).to.equal(1);
					done();
				});
			});
		});

		describe("with audioContext", () => {
			it("should update the waveform", (done: DoneCallback) => {
				const options = {
					mediaUrl: "/base/test/data/sample.mp3",
					webAudio: {
						audioContext: new TestAudioContext(),
					},
				};

				getActivePeaks().setSource(options, (error) => {
					expect(error).to.be.undefined;
					expect(getDrawWaveformLayer().callCount).to.equal(1);
					done();
				});
			});
		});

		describe("with audioBuffer", () => {
			it("should update the waveform", (done: DoneCallback) => {
				const audioContext = new TestAudioContext();

				fetch("/base/test/data/sample.mp3")
					.then((response) => response.arrayBuffer())
					.then((buffer) => audioContext.decodeAudioData(buffer))
					.then((audioBuffer) => {
						const options = {
							mediaUrl: "/base/test/data/sample.mp3",
							webAudio: {
								audioBuffer: audioBuffer,
								multiChannel: true,
							},
						};

						getActivePeaks().setSource(options, (error) => {
							expect(error).to.be.undefined;
							expect(getDrawWaveformLayer().callCount).to.equal(1);
							done();
						});
					});
			});
		});

		describe("with binary waveform data", () => {
			it("should update the waveform", (done: DoneCallback) => {
				fetch("/base/test/data/sample.dat")
					.then((response) => response.arrayBuffer())
					.then((buffer) => {
						const options = {
							mediaUrl: "/base/test/data/sample.mp3",
							waveformData: {
								arraybuffer: buffer,
							},
						};

						getActivePeaks().setSource(options, (error) => {
							expect(error).to.be.undefined;
							expect(getDrawWaveformLayer().callCount).to.equal(1);
							done();
						});
					});
			});
		});

		describe("with invalid binary waveform data", () => {
			it("should return an error", (done: DoneCallback) => {
				fetch("/base/test/data/unknown.dat")
					.then((response) => response.arrayBuffer())
					.then((buffer) => {
						const options = {
							mediaUrl: "/base/test/data/sample.mp3",
							waveformData: {
								arraybuffer: buffer,
							},
						};

						getActivePeaks().setSource(options, (error) => {
							expect(error).to.be.an.instanceOf(Error);
							done();
						});
					});
			});
		});

		describe("with zoom levels", () => {
			it("should update the instance zoom levels", (done: DoneCallback) => {
				const options = {
					mediaUrl: "/base/test/data/sample.mp3",
					webAudio: {
						audioContext: new TestAudioContext(),
					},
					zoomLevels: [128, 256],
				};

				getActivePeaks().setSource(options, (error) => {
					expect(error).to.be.undefined;
					expect(getActivePeaks().zoom.getZoomLevel()).to.equal(128);
					expect(getDrawWaveformLayer().callCount).to.equal(1);
					done();
				});
			});
		});

		describe("with stereo waveform", () => {
			it("should update the waveform", (done: DoneCallback) => {
				const options = {
					dataUri: {
						arraybuffer: "/base/test/data/07023003-2channel.dat",
					},
					mediaUrl: "/base/test/data/07023003.mp3",
					zoomLevels: [128, 256],
				};

				getActivePeaks().setSource(options, (error) => {
					expect(error).to.be.undefined;
					expect(getActivePeaks().zoom.getZoomLevel()).to.equal(128);
					expect(getDrawWaveformLayer().callCount).to.equal(1);
					done();
				});
			});
		});

		describe("with missing mediaUrl", () => {
			it("should return an error", (done: DoneCallback) => {
				const options = {
					webAudio: {
						audioContext: new TestAudioContext(),
					},
				};

				getActivePeaks().setSource(options, (error) => {
					const setSourceError = expectPresent(error);
					expect(setSourceError).to.be.an.instanceOf(Error);
					expect(setSourceError.message).to.match(
						/options must contain a mediaUrl/,
					);
					done();
				});
			});
		});
	});

	describe("destroy", () => {
		it("should clean up event listeners", (done: DoneCallback) => {
			const errorSpy = sinon.spy().named("window.onerror");
			const oldOnError = window.onerror;
			window.onerror = errorSpy;

			Peaks.init(
				{
					mediaElement: document.getElementById("media"),
					overview: {
						container: document.getElementById("overview-container"),
					},
					webAudio: {
						audioContext: new TestAudioContext(),
					},
					zoomview: {
						container: document.getElementById("zoomview-container"),
					},
				},
				(err, instance) => {
					expect(err).to.equal(undefined);

					setTimeout(() => {
						expectPresent(instance).dispose();

						const e = document.createEvent("HTMLEvents");
						e.initEvent("resize", true, false);
						window.dispatchEvent(e);

						setTimeout(() => {
							window.onerror = oldOnError;
							expect(errorSpy).to.not.have.been.called;
							done();
						}, 600);
					}, 1);
				},
			);
		});

		it("should be safe to call more than once", (done: DoneCallback) => {
			Peaks.init(
				{
					dataUri: { arraybuffer: "/base/test/data/sample.dat" },
					mediaElement: document.getElementById("media"),
					overview: {
						container: document.getElementById("overview-container"),
					},
					scrollbar: {
						container: document.getElementById("scrollbar-container"),
					},
					zoomview: {
						container: document.getElementById("zoomview-container"),
					},
				},
				(err, peaks) => {
					expect(err).to.equal(undefined);

					const instance = expectPresent(peaks);
					instance.dispose();
					instance.dispose();

					done();
				},
			);
		});
	});
});
