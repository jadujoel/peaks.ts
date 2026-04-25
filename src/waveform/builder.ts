import { errAsync, okAsync, ResultAsync } from "neverthrow";
import WaveformData from "waveform-data";
import type { PeaksEvents } from "../events";
import type { Logger, WebAudioOptions } from "../types";
import type { Writable } from "../utils";
import { isArrayBuffer, isObject } from "../utils";

export interface WaveformBuilderOptions {
	readonly dataUri?: Record<string, string> | string;
	readonly waveformData?: Record<string, unknown>;
	readonly webAudio?: WebAudioOptions;
	readonly zoomLevels?: readonly number[];
}

export type FetchResponseType = "arraybuffer" | "json";

export type WaveformBuilderPeaksLike = {
	readonly options: {
		mediaElement?: HTMLMediaElement;
	};
	readonly logger?: Logger;
	readonly events?: PeaksEvents;
};

export interface WaveformBuilderFromOptions {
	readonly peaks: WaveformBuilderPeaksLike;
}

export function hasValidContentRangeHeader(contentRange?: string): boolean {
	if (!contentRange) {
		return false;
	}

	const matches = contentRange.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
	if (!matches) {
		return false;
	}
	const [, firstStr, lastStr, lengthStr] = matches;
	if (!firstStr || !lastStr || !lengthStr) {
		return false;
	}

	const firstPos = parseInt(firstStr, 10);
	const lastPos = parseInt(lastStr, 10);
	const length = parseInt(lengthStr, 10);

	if (firstPos !== 0) {
		return false;
	}

	if (lastPos + 1 !== length) {
		return false;
	}

	return true;
}

export class WaveformBuilder {
	private constructor(
		private readonly peaks: WaveformBuilderPeaksLike,
		private controller: AbortController | undefined = undefined,
	) {}

	static from(options: WaveformBuilderFromOptions): WaveformBuilder {
		return new WaveformBuilder(options.peaks);
	}

	init(options: WaveformBuilderOptions): ResultAsync<WaveformData, Error> {
		if (
			(options.dataUri && options.webAudio) ||
			(options.waveformData && options.webAudio) ||
			(options.dataUri && options.waveformData)
		) {
			return errAsync(
				new TypeError(
					"You may only pass one source (webAudio, dataUri, or waveformData) to render waveform data.",
				),
			);
		}

		if (options.dataUri) {
			return this.getRemoteWaveformData(options);
		}
		if (options.waveformData) {
			return this.buildWaveformFromLocalData(options);
		}
		if (options.webAudio) {
			if (options.webAudio.buffer) {
				return this.buildWaveformDataFromAudioBuffer(options);
			}
			return this.buildWaveformDataUsingWebAudio(options);
		}
		return errAsync(
			new Error(
				"You must pass an audioContext, or dataUri, or waveformData to render waveform data",
			),
		);
	}

	private getRemoteWaveformData(
		options: WaveformBuilderOptions,
	): ResultAsync<WaveformData, Error> {
		if (!isObject(options.dataUri)) {
			return errAsync(new TypeError("The dataUri option must be an object"));
		}

		const dataUri = options.dataUri;

		const candidates: ReadonlyArray<{
			readonly globalName: string;
			readonly type: FetchResponseType;
		}> = [
			{ globalName: "ArrayBuffer", type: "arraybuffer" },
			{ globalName: "JSON", type: "json" },
		];

		let url: string | undefined;
		let requestType: FetchResponseType | undefined;

		for (const candidate of candidates) {
			if (candidate.globalName in window) {
				const candidateUrl = dataUri[candidate.type];
				if (candidateUrl) {
					requestType = candidate.type;
					url = candidateUrl;
					break;
				}
			}
		}

		if (!url || !requestType) {
			return errAsync(
				new Error(
					"Unable to determine a compatible dataUri format for this browser",
				),
			);
		}

		return this.fetchData(url, requestType).andThen((data) => {
			this.controller = undefined;
			return createWaveformData(data as ArrayBuffer);
		});
	}

	private buildWaveformFromLocalData(
		options: WaveformBuilderOptions,
	): ResultAsync<WaveformData, Error> {
		if (!isObject(options.waveformData)) {
			return errAsync(
				new Error("The waveformData option must be an object"),
			);
		}

		const waveformData = options.waveformData;
		let data: unknown;

		if (isObject(waveformData.json)) {
			data = waveformData.json;
		} else if (isArrayBuffer(waveformData.arraybuffer)) {
			data = waveformData.arraybuffer;
		}

		if (!data) {
			return errAsync(
				new Error(
					"Unable to determine a compatible waveformData format",
				),
			);
		}

		return ResultAsync.fromPromise(
			Promise.resolve().then(() => WaveformData.create(data as ArrayBuffer)),
			(err) => (err instanceof Error ? err : new Error(String(err))),
		).andThen((created) => validateWaveformData(created, ""));
	}

	private buildWaveformDataUsingWebAudio(
		options: WaveformBuilderOptions,
	): ResultAsync<WaveformData, Error> {
		if (!(options.webAudio?.context instanceof AudioContext)) {
			return errAsync(
				new TypeError(
					"The webAudio.audioContext option must be a valid AudioContext",
				),
			);
		}

		const webAudioOptions = options.webAudio;

		const firstZoomLevel = options.zoomLevels?.[0];
		if (
			firstZoomLevel !== undefined &&
			webAudioOptions.scale !== firstZoomLevel
		) {
			(webAudioOptions as Writable<WebAudioOptions>).scale = firstZoomLevel;
		}

		// If the media element has already selected which source to play, its
		// currentSrc attribute will contain the source media URL. Otherwise,
		// we wait for a canplay event to tell us when the media is ready.
		const mediaSourceUrl = this.peaks.options.mediaElement?.currentSrc;

		if (mediaSourceUrl) {
			return this.requestAudioAndBuildWaveformData(
				mediaSourceUrl,
				webAudioOptions,
			);
		}

		return ResultAsync.fromPromise(
			new Promise<string>((resolve) => {
				this.peaks.events?.addEventListener(
					"player.canplay",
					() => {
						resolve(this.peaks.options.mediaElement?.currentSrc ?? "");
					},
					{ once: true },
				);
			}),
			(err) => (err instanceof Error ? err : new Error(String(err))),
		).andThen((url) =>
			this.requestAudioAndBuildWaveformData(url, webAudioOptions),
		);
	}

	private buildWaveformDataFromAudioBuffer(
		options: WaveformBuilderOptions,
	): ResultAsync<WaveformData, Error> {
		const webAudioOptions = options.webAudio;

		if (!webAudioOptions) {
			return errAsync(new TypeError("Missing webAudio options"));
		}

		const firstZoomLevel = options.zoomLevels?.[0];
		if (
			firstZoomLevel !== undefined &&
			webAudioOptions.scale !== firstZoomLevel
		) {
			(webAudioOptions as Writable<WebAudioOptions>).scale = firstZoomLevel;
		}

		if (!webAudioOptions.buffer) {
			return errAsync(
				new TypeError("Missing webAudio.audioBuffer"),
			);
		}

		const builderOptions: {
			audio_buffer: AudioBuffer;
			split_channels: boolean;
			scale?: number;
			disable_worker: boolean;
		} = {
			audio_buffer: webAudioOptions.buffer,
			disable_worker: true,
			split_channels: webAudioOptions.multiChannel ?? false,
		};

		if (webAudioOptions.scale !== undefined) {
			builderOptions.scale = webAudioOptions.scale;
		}

		return createFromAudio(builderOptions);
	}

	private requestAudioAndBuildWaveformData(
		url: string,
		webAudio: WebAudioOptions,
	): ResultAsync<WaveformData, Error> {
		if (!url) {
			this.peaks.logger?.("The mediaElement src is invalid");
			return errAsync(
				new Error("The mediaElement src is invalid"),
			);
		}

		return this.fetchData(url, "arraybuffer").andThen((data) => {
			this.controller = undefined;

			if (!webAudio.context) {
				return errAsync<WaveformData, Error>(new Error("Missing audioContext"));
			}

			const builderOptions: {
				audio_context: AudioContext;
				array_buffer: ArrayBuffer;
				split_channels: boolean;
				scale?: number;
			} = {
				array_buffer: data as ArrayBuffer,
				audio_context: webAudio.context,
				split_channels: webAudio.multiChannel ?? false,
			};

			if (webAudio.scale !== undefined) {
				builderOptions.scale = webAudio.scale;
			}

			return createFromAudio(builderOptions);
		});
	}

	abort(): void {
		this.controller?.abort();
	}

	private fetchData(
		url: string,
		requestType: FetchResponseType,
	): ResultAsync<ArrayBuffer | unknown, Error> {
		const controller = new AbortController();
		this.controller = controller;

		return ResultAsync.fromPromise(
			fetch(url, { signal: controller.signal }),
			(err) => {
				this.controller = undefined;
				if (err instanceof DOMException && err.name === "AbortError") {
					return new Error("Request aborted");
				}
				return new Error("Request failed");
			},
		).andThen((response) => {
			// See https://github.com/bbc/peaks.js/issues/491
			if (
				response.status !== 200 &&
				!(
					response.status === 206 &&
					hasValidContentRangeHeader(
						response.headers.get("content-range") ?? undefined,
					)
				)
			) {
				return errAsync<ArrayBuffer | unknown, Error>(
					new Error(
						`Unable to fetch remote data. HTTP status ${response.status}`,
					),
				);
			}

			const body =
				requestType === "json" ? response.json() : response.arrayBuffer();
			return ResultAsync.fromPromise(
				body as Promise<ArrayBuffer | unknown>,
				(err) => (err instanceof Error ? err : new Error(String(err))),
			);
		});
	}
}

function validateWaveformData(
	waveformData: WaveformData,
	prefix: string,
): ResultAsync<WaveformData, Error> {
	if (waveformData.channels !== 1 && waveformData.channels !== 2) {
		return errAsync(
			new Error(
				`${prefix}Only mono or stereo waveforms are currently supported`,
			),
		);
	}
	if (waveformData.bits !== 8) {
		return errAsync(
			new Error(`${prefix}16-bit waveform data is not supported`),
		);
	}
	return okAsync(waveformData);
}

function createWaveformData(
	data: ArrayBuffer,
): ResultAsync<WaveformData, Error> {
	return ResultAsync.fromPromise(
		Promise.resolve().then(() => WaveformData.create(data)),
		(err) => (err instanceof Error ? err : new Error(String(err))),
	).andThen((created) => validateWaveformData(created, ""));
}

function createFromAudio(
	options:
		| {
				audio_buffer: AudioBuffer;
				split_channels: boolean;
				scale?: number;
				disable_worker: boolean;
		  }
		| {
				audio_context: AudioContext;
				array_buffer: ArrayBuffer;
				split_channels: boolean;
				scale?: number;
		  },
): ResultAsync<WaveformData, Error> {
	return ResultAsync.fromPromise(
		new Promise<WaveformData>((resolve, reject) => {
			WaveformData.createFromAudio(options, (err, data) => {
				if (err) {
					reject(err);
					return;
				}
				resolve(data);
			});
		}),
		(err) => (err instanceof Error ? err : new Error(String(err))),
	);
}
