import type { ResultAsync } from "neverthrow";
import sinon from "sinon";
import WaveformData from "waveform-data";
import {
	type FetchResponseType,
	WaveformBuilder,
} from "../src/waveform/builder";
import sampleJsonData from "./data/sample.json";

const TestAudioContext = window.AudioContext;

// `fetchData` is `private` in the production type but is spied on in tests
// to assert request URL behaviour. Cast through this shape so
// `sinon.spy(builder, "fetchData")` keeps a precise return type.
type WaveformBuilderWithFetch = WaveformBuilder & {
	fetchData: (
		url: string,
		requestType: FetchResponseType,
	) => ResultAsync<ArrayBuffer | unknown, Error>;
};
const exposeFetch = (builder: WaveformBuilder): WaveformBuilderWithFetch =>
	builder as WaveformBuilderWithFetch;

describe("WaveformBuilder", () => {
	describe("init", () => {
		it("should not accept a string as dataUri", (done) => {
			const peaks = {
				options: {
					dataUri: "base/test/data/sample.json",
					mediaElement: document.getElementById("media"),
				},
			};

			const waveformBuilder = WaveformBuilder.from({ peaks });

			waveformBuilder.init(peaks.options).match(
				() => done(new Error("expected error")),
				(err) => {
					expect(err).to.be.an.instanceOf(Error);
					done();
				},
			);
		});

		it("should invoke callback with an error if the data handling fails", (done) => {
			const peaks = {
				options: {
					dataUri: {
						json: "base/test/data/404-file.json",
					},
					mediaElement: document.getElementById("media"),
				},
			};

			const waveformBuilder = WaveformBuilder.from({ peaks });

			waveformBuilder.init(peaks.options).match(
				() => done(new Error("expected error")),
				(err) => {
					expect(err).to.be.an.instanceOf(Error);
					done();
				},
			);
		});

		it("should invoke callback with an error if the data handling fails due to a network error", (done) => {
			const peaks = {
				options: {
					dataUri: {
						json: "file:///test.json",
					},
					mediaElement: document.getElementById("media"),
				},
			};

			const waveformBuilder = WaveformBuilder.from({ peaks });

			waveformBuilder.init(peaks.options).match(
				() => done(new Error("expected error")),
				(err) => {
					expect(err).to.be.an.instanceof(Error);
					expect(err.message).to.equal("Request failed");
					done();
				},
			);
		});

		it("should fetch JSON format waveform data", (done) => {
			const peaks = {
				options: {
					dataUri: {
						json: "base/test/data/sample.json",
					},
					mediaElement: document.getElementById("media"),
				},
			};

			const waveformBuilder = WaveformBuilder.from({ peaks });

			const fetchData = sinon.spy(exposeFetch(waveformBuilder), "fetchData");

			waveformBuilder.init(peaks.options).match(
				(waveformData) => {
					expect(waveformData).to.be.an.instanceOf(WaveformData);

					const url = fetchData.getCall(0).args[0];
					expect(url).to.equal(peaks.options.dataUri.json);

					done();
				},
				(err) => done(err),
			);
		});

		it("should fetch binary format waveform data", (done) => {
			const peaks = {
				options: {
					dataUri: {
						arraybuffer: "base/test/data/sample.dat",
					},
					mediaElement: document.getElementById("media"),
				},
			};

			const waveformBuilder = WaveformBuilder.from({ peaks });

			const fetchData = sinon.spy(exposeFetch(waveformBuilder), "fetchData");

			waveformBuilder.init(peaks.options).match(
				(waveformData) => {
					expect(waveformData).to.be.an.instanceOf(WaveformData);

					const url = fetchData.getCall(0).args[0];
					expect(url).to.equal(peaks.options.dataUri.arraybuffer);

					done();
				},
				(err) => done(err),
			);
		});

		it("should use the waveformData json data connector", (done) => {
			const peaks = {
				options: {
					mediaElement: document.getElementById("media"),
					waveformData: {
						json: sampleJsonData,
					},
				},
			};

			const waveformBuilder = WaveformBuilder.from({ peaks });

			waveformBuilder.init(peaks.options).match(
				(waveformData) => {
					expect(waveformData).to.be.an.instanceOf(WaveformData);
					done();
				},
				(err) => done(err),
			);
		});

		it("should throw if waveformData json data is invalid", (done) => {
			const peaks = {
				options: {
					mediaElement: document.getElementById("media"),
					waveformData: {
						json: { test: "foo" },
					},
				},
			};

			const waveformBuilder = WaveformBuilder.from({ peaks });

			waveformBuilder.init(peaks.options).match(
				() => done(new Error("expected error")),
				(err) => {
					expect(err).to.be.an.instanceOf(Error);
					done();
				},
			);
		});

		it("should prefer binary waveform data over JSON", (done) => {
			const peaks = {
				options: {
					dataUri: {
						arraybuffer: "base/test/data/sample.dat",
						json: "base/test/data/sample.json",
					},
					mediaElement: document.getElementById("media"),
				},
			};

			const waveformBuilder = WaveformBuilder.from({ peaks });

			const fetchData = sinon.spy(exposeFetch(waveformBuilder), "fetchData");

			waveformBuilder.init(peaks.options).match(
				(waveformData) => {
					expect(waveformData).to.be.an.instanceOf(WaveformData);

					const url = fetchData.getCall(0).args[0];
					const expectedDataUri = window.ArrayBuffer
						? peaks.options.dataUri.arraybuffer
						: peaks.options.dataUri.json;

					expect(url).to.equal(expectedDataUri);

					done();
				},
				(err) => done(err),
			);
		});

		it("should return an error given 16-bit waveform data", (done) => {
			const peaks = {
				options: {
					dataUri: {
						arraybuffer: "base/test/data/sample_16bit.dat",
					},
					mediaElement: document.getElementById("media"),
				},
			};

			const waveformBuilder = WaveformBuilder.from({ peaks });

			waveformBuilder.init(peaks.options).match(
				() => done(new Error("expected error")),
				(err) => {
					expect(err).to.be.an.instanceOf(Error);
					expect(err.message).to.match(/16-bit waveform data is not supported/);
					done();
				},
			);
		});

		it("should build using WebAudio if the API is available and audioContext is provided", (done) => {
			const peaks = {
				options: {
					mediaElement: document.getElementById("media"),
					webAudio: {
						context: new TestAudioContext(),
						scale: 512,
					},
					zoomLevels: [512, 1024, 2048, 4096],
				},
			};

			const waveformBuilder = WaveformBuilder.from({ peaks });

			waveformBuilder.init(peaks.options).match(
				(waveformData) => {
					expect(waveformData).to.be.an.instanceOf(WaveformData);
					done();
				},
				(err) => done(err),
			);
		});
	});

	describe("abort", () => {
		it("should abort an HTTP request for waveform data", (done) => {
			const peaks = {
				options: {
					dataUri: {
						json: "base/test/data/sample.json",
					},
					mediaElement: document.getElementById("media"),
				},
			};

			const waveformBuilder = WaveformBuilder.from({ peaks });

			waveformBuilder.init(peaks.options).match(
				() => done(new Error("expected error")),
				(err) => {
					expect(err).to.be.an.instanceOf(Error);
					done();
				},
			);
			waveformBuilder.abort();
		});

		it("should abort an HTTP request for audio data", (done) => {
			const peaks = {
				options: {
					mediaElement: document.getElementById("media"),
					webAudio: {
						context: new TestAudioContext(),
						scale: 512,
					},
					zoomLevels: [512, 1024, 2048, 4096],
				},
			};

			const waveformBuilder = WaveformBuilder.from({ peaks });

			waveformBuilder.init(peaks.options).match(
				() => done(new Error("expected error")),
				(err) => {
					expect(err).to.be.an.instanceOf(Error);
					done();
				},
			);
			waveformBuilder.abort();
		});

		it("should do nothing if the HTTP request has not yet been sent", (done) => {
			const peaks = {
				options: {
					dataUri: {
						json: "base/test/data/sample.json",
					},
					mediaElement: document.getElementById("media"),
				},
			};

			const waveformBuilder = WaveformBuilder.from({ peaks });
			waveformBuilder.abort();

			waveformBuilder.init(peaks.options).match(
				(waveformData) => {
					expect(waveformData).to.be.an.instanceOf(WaveformData);
					done();
				},
				(err) => done(err),
			);
		});

		it("should do nothing if the HTTP request has completed", (done) => {
			const peaks = {
				options: {
					dataUri: {
						json: "base/test/data/sample.json",
					},
					mediaElement: document.getElementById("media"),
				},
			};

			const waveformBuilder = WaveformBuilder.from({ peaks });

			waveformBuilder.init(peaks.options).match(
				(waveformData) => {
					waveformBuilder.abort();
					expect(waveformData).to.be.an.instanceOf(WaveformData);
					done();
				},
				(err) => done(err),
			);
		});
	});

	describe("hasValidContentRangeHeader (regression)", () => {
		it("should return false for undefined", async () => {
			const { hasValidContentRangeHeader } = await import(
				"../src/waveform/builder"
			);
			expect(hasValidContentRangeHeader(undefined)).to.equal(false);
			expect(hasValidContentRangeHeader("")).to.equal(false);
			expect(hasValidContentRangeHeader("not-a-range")).to.equal(false);
			expect(hasValidContentRangeHeader("bytes 1-9/10")).to.equal(false);
			expect(hasValidContentRangeHeader("bytes 0-8/10")).to.equal(false);
			expect(hasValidContentRangeHeader("bytes 0-9/10")).to.equal(true);
		});
	});
});
