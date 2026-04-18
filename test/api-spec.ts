import Konva from "konva";
import sinon, { type SinonSpy } from "sinon";
import Peaks from "../src/main";
import Scrollbar from "../src/scrollbar";
import WaveformOverview from "../src/waveform-overview";
import WaveformZoomView from "../src/waveform-zoomview";
import sampleJsonData from "./data/sample.json";

const TestAudioContext = window.AudioContext;

const externalPlayer = {
	init: () => Promise.resolve(),
	destroy: () => {},
	play: () => Promise.resolve(),
	pause: () => {},
	seek: () => {},
	isPlaying: () => false,
	isSeeking: () => false,
	getCurrentTime: () => 0,
	getDuration: () => 0,
};

type InternalPlayheadLayer = {
	_playheadColor: string;
	_playheadTextColor: string;
	_playheadText?: object;
};

type InternalAxis = {
	_axisLabelColor: string;
	_axisGridlineColor: string;
};

type InternalHighlightLayer = {
	_offset: number;
	_color: string;
	_strokeColor: string;
	_opacity: number;
	_cornerRadius: number;
};

type InternalView = {
	_playheadLayer: InternalPlayheadLayer;
	drawWaveformLayer?: () => void;
	_formatPlayheadTime?: (time: number) => string;
	_axis: InternalAxis;
	_highlightLayer: InternalHighlightLayer;
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
			p.destroy();
			p = null;
		}
	});

	describe("init", () => {
		it("should throw if called without a callback", () => {
			expect(() => {
				(Peaks.init as unknown as (options: unknown) => unknown)({
					overview: {
						container: document.getElementById("overview-container"),
					},
					zoomview: {
						container: document.getElementById("zoomview-container"),
					},
					mediaElement: document.getElementById("media"),
					dataUri: { arraybuffer: "/base/test/data/sample.dat" },
				});
			}).to.throw(Error, /callback/);
		});

		describe("with valid options", () => {
			it("should invoke callback when initialised", (done: DoneCallback) => {
				Peaks.init(
					{
						overview: {
							container: document.getElementById("overview-container"),
						},
						zoomview: {
							container: document.getElementById("zoomview-container"),
						},
						mediaElement: document.getElementById("media"),
						dataUri: { arraybuffer: "/base/test/data/sample.dat" },
					},
					(err, instance) => {
						expect(err).to.equal(null);
						expect(instance).to.be.an.instanceOf(Peaks);
						instance?.destroy();
						done();
					},
				);
			});

			it("should return undefined", (done: DoneCallback) => {
				const result = Peaks.init(
					{
						overview: {
							container: document.getElementById("overview-container"),
						},
						zoomview: {
							container: document.getElementById("zoomview-container"),
						},
						mediaElement: document.getElementById("media"),
						dataUri: { arraybuffer: "/base/test/data/sample.dat" },
					},
					(err, instance) => {
						expect(err).to.equal(null);
						expect(instance).to.be.an.instanceOf(Peaks);
						expect(result).to.equal(undefined);
						instance?.destroy();
						done();
					},
				);
			});

			it("should resolve a Peaks instance with fromOptionsAsync", async () => {
				p = await Peaks.fromOptionsAsync({
					overview: {
						container: document.getElementById("overview-container")!,
					},
					zoomview: {
						container: document.getElementById("zoomview-container")!,
					},
					mediaElement: document.getElementById("media") as HTMLMediaElement,
					dataUri: { arraybuffer: "/base/test/data/sample.dat" },
				});

				expect(p).to.be.an.instanceOf(Peaks);
			});

			it("should reject fromOptionsAsync when initialization fails", async () => {
				try {
					await Peaks.fromOptionsAsync({
						zoomview: {},
						overview: {},
						mediaElement: document.getElementById("media"),
						dataUri: { arraybuffer: "/base/test/data/sample.dat" },
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
							overview: {
								container: document.getElementById("overview-container"),
							},
							zoomview: {
								container: document.getElementById("zoomview-container"),
							},
							mediaElement: document.getElementById("media"),
							dataUri: { arraybuffer: "/base/test/data/sample.dat" },
						},
						(err, instance) => {
							expect(err).to.equal(null);
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
							overview: {
								container: document.getElementById("overview-container"),
							},
							mediaElement: document.getElementById("media"),
							dataUri: { arraybuffer: "/base/test/data/sample.dat" },
						},
						(err, instance) => {
							expect(err).to.equal(null);
							expect(instance).to.be.an.instanceof(Peaks);
							expect(instance?.views.getView("overview")).to.be.an.instanceOf(
								WaveformOverview,
							);
							expect(instance?.views.getView("zoomview")).to.equal(null);
							done();
						},
					);
				});

				it("should construct a Peaks object with a zoomable waveform only", (done: DoneCallback) => {
					Peaks.init(
						{
							zoomview: {
								container: document.getElementById("zoomview-container"),
							},
							mediaElement: document.getElementById("media"),
							dataUri: { arraybuffer: "/base/test/data/sample.dat" },
						},
						(err, instance) => {
							expect(err).to.equal(null);
							expect(instance).to.be.an.instanceof(Peaks);
							expect(instance?.views.getView("overview")).to.equal(null);
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
							zoomview: {},
							overview: {},
							mediaElement: document.getElementById("media"),
							dataUri: { arraybuffer: "/base/test/data/sample.dat" },
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
							overview: {
								container: document.getElementById("overview-container"),
								playheadColor: "#ff0000",
								playheadTextColor: "#00ff00",
								showPlayheadTime: true,
								formatPlayheadTime: overviewFormatPlayheadTime,
								axisLabelColor: "#0000ff",
								axisGridlineColor: "#000000",
								highlightColor: "#808080",
								highlightOffset: 2,
								highlightStrokeColor: "#404040",
								highlightOpacity: 0.5,
								highlightCornerRadius: 5,
							},
							zoomview: {
								container: document.getElementById("zoomview-container"),
								playheadColor: "#00ff00",
								playheadTextColor: "#0000ff",
								showPlayheadTime: false,
								formatPlayheadTime: zoomviewFormatPlayheadTime,
								axisLabelColor: "#ff0000",
								axisGridlineColor: "#808080",
							},
							mediaElement: document.getElementById("media"),
							dataUri: { arraybuffer: "/base/test/data/sample.dat" },
						},
						(err, instance) => {
							expect(err).to.equal(null);
							expect(instance).to.be.an.instanceof(Peaks);

							const overview = instance?.views.getView(
								"overview",
							) as unknown as InternalView;
							const zoomview = instance?.views.getView(
								"zoomview",
							) as unknown as InternalView;

							expect(overview._playheadLayer._playheadColor).to.equal(
								"#ff0000",
							);
							expect(zoomview._playheadLayer._playheadColor).to.equal(
								"#00ff00",
							);
							expect(overview._playheadLayer._playheadTextColor).to.equal(
								"#00ff00",
							);
							expect(zoomview._playheadLayer._playheadTextColor).to.equal(
								"#0000ff",
							);
							expect(overview._playheadLayer._playheadText).to.be.an.instanceOf(
								Konva.Text,
							);
							expect(zoomview._playheadLayer._playheadText).to.equal(undefined);
							expect(overview._formatPlayheadTime).to.equal(
								overviewFormatPlayheadTime,
							);
							expect(zoomview._formatPlayheadTime).to.equal(
								zoomviewFormatPlayheadTime,
							);
							expect(overview._axis._axisLabelColor).to.equal("#0000ff");
							expect(zoomview._axis._axisLabelColor).to.equal("#ff0000");
							expect(overview._axis._axisGridlineColor).to.equal("#000000");
							expect(zoomview._axis._axisGridlineColor).to.equal("#808080");
							expect(overview._highlightLayer._offset).to.equal(2);
							expect(overview._highlightLayer._color).to.equal("#808080");
							expect(overview._highlightLayer._strokeColor).to.equal("#404040");
							expect(overview._highlightLayer._opacity).to.equal(0.5);
							expect(overview._highlightLayer._cornerRadius).to.equal(5);
							done();
						},
					);
				});

				it("should use global options", (done: DoneCallback) => {
					Peaks.init(
						{
							overview: {
								container: document.getElementById("overview-container"),
							},
							zoomview: {
								container: document.getElementById("zoomview-container"),
							},
							mediaElement: document.getElementById("media"),
							dataUri: { arraybuffer: "/base/test/data/sample.dat" },
							playheadColor: "#ff0000",
							playheadTextColor: "#00ff00",
							showPlayheadTime: true,
							axisLabelColor: "#0000ff",
							axisGridlineColor: "#000000",
							highlightColor: "#808080",
							highlightOffset: 2,
							highlightStrokeColor: "#404040",
							highlightOpacity: 0.5,
							highlightCornerRadius: 5,
						},
						(err, instance) => {
							expect(err).to.equal(null);
							expect(instance).to.be.an.instanceof(Peaks);

							const overview = instance?.views.getView(
								"overview",
							) as unknown as InternalView;
							const zoomview = instance?.views.getView(
								"zoomview",
							) as unknown as InternalView;

							expect(overview._playheadLayer._playheadColor).to.equal(
								"#ff0000",
							);
							expect(zoomview._playheadLayer._playheadColor).to.equal(
								"#ff0000",
							);
							expect(overview._playheadLayer._playheadTextColor).to.equal(
								"#00ff00",
							);
							expect(zoomview._playheadLayer._playheadTextColor).to.equal(
								"#00ff00",
							);
							expect(overview._playheadLayer._playheadText).to.equal(undefined);
							expect(zoomview._playheadLayer._playheadText).to.be.an.instanceOf(
								Konva.Text,
							);
							expect(overview._axis._axisLabelColor).to.equal("#0000ff");
							expect(zoomview._axis._axisLabelColor).to.equal("#0000ff");
							expect(overview._axis._axisGridlineColor).to.equal("#000000");
							expect(zoomview._axis._axisGridlineColor).to.equal("#000000");
							expect(overview._highlightLayer._offset).to.equal(2);
							expect(overview._highlightLayer._color).to.equal("#808080");
							expect(overview._highlightLayer._strokeColor).to.equal("#404040");
							expect(overview._highlightLayer._opacity).to.equal(0.5);
							expect(overview._highlightLayer._cornerRadius).to.equal(5);
							done();
						},
					);
				});

				it("should use default options", (done: DoneCallback) => {
					Peaks.init(
						{
							overview: {
								container: document.getElementById("overview-container"),
							},
							zoomview: {
								container: document.getElementById("zoomview-container"),
							},
							mediaElement: document.getElementById("media"),
							dataUri: { arraybuffer: "/base/test/data/sample.dat" },
						},
						(err, instance) => {
							expect(err).to.equal(null);
							expect(instance).to.be.an.instanceof(Peaks);

							const overview = instance?.views.getView(
								"overview",
							) as unknown as InternalView;
							const zoomview = instance?.views.getView(
								"zoomview",
							) as unknown as InternalView;

							expect(overview._playheadLayer._playheadColor).to.equal(
								"#111111",
							);
							expect(zoomview._playheadLayer._playheadColor).to.equal(
								"#111111",
							);
							expect(overview._playheadLayer._playheadTextColor).to.equal(
								"#aaaaaa",
							);
							expect(zoomview._playheadLayer._playheadTextColor).to.equal(
								"#aaaaaa",
							);
							expect(overview._playheadLayer._playheadText).to.equal(undefined);
							expect(overview._playheadLayer._playheadText).to.equal(undefined);
							expect(overview._axis._axisLabelColor).to.equal("#aaaaaa");
							expect(zoomview._axis._axisLabelColor).to.equal("#aaaaaa");
							expect(overview._axis._axisGridlineColor).to.equal("#cccccc");
							expect(zoomview._axis._axisGridlineColor).to.equal("#cccccc");
							expect(overview._highlightLayer._offset).to.equal(11);
							expect(overview._highlightLayer._color).to.equal("#aaaaaa");
							expect(overview._highlightLayer._strokeColor).to.equal(
								"transparent",
							);
							expect(overview._highlightLayer._opacity).to.equal(0.3);
							expect(overview._highlightLayer._cornerRadius).to.equal(2);
							done();
						},
					);
				});
			});

			describe("with scrollbar option", () => {
				it("should construct a Peaks object with scrollbar", (done: DoneCallback) => {
					Peaks.init(
						{
							overview: {
								container: document.getElementById("overview-container"),
							},
							zoomview: {
								container: document.getElementById("zoomview-container"),
							},
							scrollbar: {
								container: document.getElementById("scrollbar-container"),
							},
							mediaElement: document.getElementById("media"),
							dataUri: { arraybuffer: "/base/test/data/sample.dat" },
						},
						(err, instance) => {
							expect(err).to.equal(null);
							expect(instance).to.be.an.instanceof(Peaks);
							const viewController = instance?.views as unknown as {
								_scrollbar: unknown;
							};
							expect(viewController._scrollbar).to.be.an.instanceOf(Scrollbar);
							done();
						},
					);
				});
			});

			describe("with precomputed stereo waveform data", () => {
				it("should initialise correctly", (done: DoneCallback) => {
					Peaks.init(
						{
							overview: {
								container: document.getElementById("overview-container"),
							},
							zoomview: {
								container: document.getElementById("zoomview-container"),
							},
							mediaElement: document.getElementById("media"),
							dataUri: { arraybuffer: "/base/test/data/07023003-2channel.dat" },
						},
						(err, instance) => {
							expect(err).to.equal(null);
							const peaks = expectPresent(instance);
							const waveformData = expectPresent(peaks.getWaveformData());
							expect(peaks).to.be.an.instanceOf(Peaks);
							expect(waveformData.channels).to.equal(2);
							peaks.destroy();
							done();
						},
					);
				});
			});

			describe("with valid JSON waveform data", () => {
				it("should initialise correctly", (done: DoneCallback) => {
					Peaks.init(
						{
							overview: {
								container: document.getElementById("overview-container"),
							},
							zoomview: {
								container: document.getElementById("zoomview-container"),
							},
							mediaElement: document.getElementById("media"),
							waveformData: {
								json: sampleJsonData,
							},
						},
						(err, instance) => {
							expect(err).to.equal(null);
							const peaks = expectPresent(instance);
							const waveformData = expectPresent(peaks.getWaveformData());
							expect(peaks).to.be.an.instanceOf(Peaks);
							expect(waveformData.channels).to.equal(1);
							peaks.destroy();
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
									overview: {
										container: document.getElementById("overview-container"),
									},
									zoomview: {
										container: document.getElementById("zoomview-container"),
									},
									mediaElement: document.getElementById("media"),
									waveformData: {
										arraybuffer: buffer,
									},
								},
								(err, instance) => {
									expect(err).to.equal(null);
									const peaks = expectPresent(instance);
									const waveformData = expectPresent(peaks.getWaveformData());
									expect(peaks).to.be.an.instanceOf(Peaks);
									expect(waveformData.channels).to.equal(1);
									peaks.destroy();
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
							overview: {
								container: document.getElementById("overview-container"),
							},
							zoomview: {
								container: document.getElementById("zoomview-container"),
							},
							mediaElement: document.getElementById("media"),
							webAudio: {
								audioContext: new TestAudioContext(),
								multiChannel: true,
							},
						},
						(err, instance) => {
							expect(err).to.equal(null);
							const peaks = expectPresent(instance);
							const waveformData = expectPresent(peaks.getWaveformData());
							expect(peaks).to.be.an.instanceOf(Peaks);
							expect(waveformData.channels).to.equal(2);
							peaks.destroy();
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
									overview: {
										container: document.getElementById("overview-container"),
									},
									zoomview: {
										container: document.getElementById("zoomview-container"),
									},
									mediaElement: document.getElementById("media"),
									webAudio: {
										audioBuffer: audioBuffer,
										multiChannel: true,
									},
									zoomLevels: [128, 256],
								},
								(err, instance) => {
									expect(err).to.equal(null);
									const peaks = expectPresent(instance);
									const waveformData = expectPresent(peaks.getWaveformData());
									expect(peaks).to.be.an.instanceOf(Peaks);
									expect(waveformData.channels).to.equal(2);
									peaks.destroy();
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
							overview: {
								container: document.getElementById("overview-container"),
							},
							zoomview: {
								container: document.getElementById("zoomview-container"),
							},
							mediaUrl: "invalid",
							waveformData: {
								json: sampleJsonData,
							},
							player: externalPlayer,
						},
						(err, instance) => {
							expect(err).to.equal(null);
							const peaks = expectPresent(instance);
							expect(peaks).to.be.an.instanceOf(Peaks);
							peaks.destroy();
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
							overview: {
								container: document.getElementById("overview-container"),
							},
							zoomview: {
								container: document.getElementById("zoomview-container"),
							},
							mediaElement: document.getElementById(
								"adpcm",
							) as HTMLMediaElement,
							dataUri: { arraybuffer: "/base/test/data/sample.dat" },
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
						overview: {
							container: document.getElementById("overview-container"),
						},
						zoomview: {
							container: document.getElementById("zoomview-container"),
						},
						dataUri: { arraybuffer: "/base/test/data/sample.dat" },
					},
					(err, instance) => {
						const error = expectPresent(err);
						expect(error).to.be.an.instanceOf(Error);
						expect(error.message).to.match(/Missing mediaElement option/);
						expect(instance).to.equal(undefined);
						done();
					},
				);
			});

			it("should invoke callback with an error if mediaElement is not an HTMLMediaElement", (done: DoneCallback) => {
				Peaks.init(
					{
						overview: {
							container: document.getElementById("overview-container"),
						},
						zoomview: {
							container: document.getElementById("zoomview-container"),
						},
						mediaElement: document.createElement(
							"div",
						) as unknown as HTMLMediaElement,
						dataUri: { arraybuffer: "/base/test/data/sample.dat" },
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
						overview: {
							container: document.getElementById("overview-container"),
						},
						zoomview: {
							container: document.getElementById("zoomview-container"),
						},
						mediaElement: document.getElementById("media"),
						dataUri: { arraybuffer: "/base/test/data/sample.dat" },
						webAudio: {
							audioContext: new TestAudioContext(),
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
						overview: {
							container: document.getElementById("overview-container"),
						},
						zoomview: {
							container: document.getElementById("zoomview-container"),
						},
						mediaElement: document.getElementById("media"),
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
						overview: {
							container: document.getElementById("overview-container"),
						},
						zoomview: {
							container: document.getElementById("zoomview-container"),
						},
						mediaElement: document.getElementById("media"),
						dataUri: true as unknown as Record<string, string>,
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
						overview: {
							container: document.getElementById("overview-container"),
						},
						zoomview: {
							container: document.getElementById("zoomview-container"),
						},
						mediaElement: document.getElementById("media"),
						waveformData: {
							json: { data: "foo" },
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
								overview: {
									container: document.getElementById("overview-container"),
								},
								zoomview: {
									container: document.getElementById("zoomview-container"),
								},
								mediaElement: document.getElementById("media"),
								waveformData: {
									arraybuffer: buffer,
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
						mediaElement: document.getElementById("media"),
						dataUri: { arraybuffer: "/base/test/data/sample.dat" },
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
						overview: {
							container: document.getElementById("overview-container"),
						},
						zoomview: {
							container: document.getElementById("zoomview-container"),
						},
						mediaElement: document.getElementById("media"),
						dataUri: {
							arraybuffer: "base/test/data/sample.dat",
						},
						logger: "foo" as unknown as typeof console.error,
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
						overview: {
							container: document.getElementById("overview-container"),
						},
						zoomview: {
							container: document.getElementById("zoomview-container"),
						},
						mediaElement: document.getElementById("media"),
						dataUri: {
							arraybuffer: "base/test/data/sample.dat",
						},
						zoomLevels: null as unknown as number[],
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
						overview: {
							container: document.getElementById("overview-container"),
						},
						zoomview: {
							container: document.getElementById("zoomview-container"),
						},
						mediaElement: document.getElementById("media"),
						dataUri: {
							arraybuffer: "base/test/data/sample.dat",
						},
						zoomLevels: [],
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
						overview: {
							container: document.getElementById("overview-container"),
						},
						zoomview: {
							container: document.getElementById("zoomview-container"),
						},
						mediaElement: document.getElementById("media"),
						dataUri: {
							arraybuffer: "base/test/data/sample.dat",
						},
						zoomLevels: [1024, 512],
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
					zoomview: {
						container: container,
					},
					mediaElement: document.getElementById("media"),
					dataUri: {
						arraybuffer: "base/test/data/sample.dat",
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
					zoomview: {
						container: container,
					},
					mediaElement: document.getElementById("media"),
					dataUri: {
						arraybuffer: "base/test/data/sample.dat",
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
					overview: {
						container: container,
					},
					mediaElement: document.getElementById("media"),
					dataUri: {
						arraybuffer: "base/test/data/sample.dat",
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
					overview: {
						container: container,
					},
					mediaElement: document.getElementById("media"),
					dataUri: {
						arraybuffer: "base/test/data/sample.dat",
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
					zoomview: {
						container: container,
					},
					mediaElement: document.getElementById("media"),
					dataUri: {
						arraybuffer: "base/test/data/sample.dat",
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
					overview: {
						container: container,
					},
					mediaElement: document.getElementById("media"),
					dataUri: {
						arraybuffer: "base/test/data/sample.dat",
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
				overview: {
					container: document.getElementById("overview-container"),
				},
				zoomview: {
					container: document.getElementById("zoomview-container"),
				},
				mediaElement: document.getElementById("media"),
				dataUri: { arraybuffer: "/base/test/data/sample.dat" },
				zoomLevels: [512, 1024, 2048],
			};

			Peaks.init(options, (err, instance) => {
				expect(err).to.equal(null);

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
					mediaUrl: "/base/test/data/unknown.mp3",
					dataUri: {
						arraybuffer: "/base/test/data/unknown.dat",
					},
				};

				getActivePeaks().setSource(options, (error) => {
					expect(error).to.be.an.instanceOf(MediaError);
					done();
				});
			});

			it("should preserve existing event handlers", (done: DoneCallback) => {
				const options = {
					mediaUrl: "/base/test/data/unknown.mp3",
					dataUri: {
						arraybuffer: "/base/test/data/unknown.dat",
					},
				};

				function onError() {
					// Nothing
				}

				const peaks = getActivePeaks();
				peaks.on("player.error", onError);

				peaks.setSource(options, (error) => {
					expect(error).to.be.an.instanceOf(MediaError);
					expect(peaks.listeners("player.error").length).to.equal(1);
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
					mediaUrl: "/base/test/data/sample.mp3",
					dataUri: {
						arraybuffer: "/base/test/data/sample.dat",
					},
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
					mediaUrl: "/base/test/data/07023003.mp3",
					dataUri: {
						arraybuffer: "/base/test/data/07023003-2channel.dat",
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
					overview: {
						container: document.getElementById("overview-container"),
					},
					zoomview: {
						container: document.getElementById("zoomview-container"),
					},
					mediaElement: document.getElementById("media"),
					webAudio: {
						audioContext: new TestAudioContext(),
					},
				},
				(err, instance) => {
					expect(err).to.equal(null);

					setTimeout(() => {
						expectPresent(instance).destroy();

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
					overview: {
						container: document.getElementById("overview-container"),
					},
					zoomview: {
						container: document.getElementById("zoomview-container"),
					},
					scrollbar: {
						container: document.getElementById("scrollbar-container"),
					},
					mediaElement: document.getElementById("media"),
					dataUri: { arraybuffer: "/base/test/data/sample.dat" },
				},
				(err, peaks) => {
					expect(err).to.equal(null);

					const instance = expectPresent(peaks);
					instance.destroy();
					instance.destroy();

					done();
				},
			);
		});
	});
});
