import { errAsync, okAsync, ResultAsync } from "neverthrow";
import WaveformData from "waveform-data";
import type {
	DataSourceArrayBuffer,
	DataSourceJson,
	DataSourceOptions,
	DataSourceUri,
	DataSourceWebAudio,
} from "../data-source";
import type { PeaksEvents } from "../events";
import type { Logger } from "../types";
import { isArrayBuffer, isObject } from "../utils";

export type {
	DataSourceArrayBuffer,
	DataSourceJson,
	DataSourceOptions,
	DataSourceUri,
	DataSourceWebAudio,
} from "../data-source";

export interface WaveformBuilderOptions {
	readonly data?: DataSourceOptions;
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
		const data = options.data;

		if (!data) {
			return errAsync(
				new Error(
					"You must pass a data source (uri, arraybuffer, json, or webaudio) to render waveform data",
				),
			);
		}

		switch (data.type) {
			case "uri":
				return this.buildFromRemoteUri(data);
			case "arraybuffer":
				return this.buildFromArrayBuffer(data);
			case "json":
				return this.buildFromJson(data);
			case "webaudio":
				return this.buildFromWebAudio(data, options.zoomLevels);
		}
	}

	private buildFromRemoteUri(
		data: DataSourceUri,
	): ResultAsync<WaveformData, Error> {
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
				const candidateUrl = data[candidate.type];
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
					"Unable to determine a compatible data.uri format for this browser",
				),
			);
		}

		return this.fetchData(url, requestType).andThen((fetched) => {
			this.controller = undefined;
			return createWaveformData(fetched as ArrayBuffer);
		});
	}

	private buildFromArrayBuffer(
		data: DataSourceArrayBuffer,
	): ResultAsync<WaveformData, Error> {
		if (!isArrayBuffer(data.arraybuffer)) {
			return errAsync(new TypeError("data.arraybuffer must be an ArrayBuffer"));
		}
		return ResultAsync.fromPromise(
			Promise.resolve().then(() => WaveformData.create(data.arraybuffer)),
			(err) => (err instanceof Error ? err : new Error(String(err))),
		).andThen((created) => validateWaveformData(created, ""));
	}

	private buildFromJson(
		data: DataSourceJson,
	): ResultAsync<WaveformData, Error> {
		if (!isObject(data.json)) {
			return errAsync(new TypeError("data.json must be an object"));
		}
		return ResultAsync.fromPromise(
			Promise.resolve().then(() =>
				WaveformData.create(data.json as unknown as ArrayBuffer),
			),
			(err) => (err instanceof Error ? err : new Error(String(err))),
		).andThen((created) => validateWaveformData(created, ""));
	}

	private buildFromWebAudio(
		data: DataSourceWebAudio,
		zoomLevels?: readonly number[],
	): ResultAsync<WaveformData, Error> {
		if (!(data.context instanceof AudioContext)) {
			return errAsync(
				new TypeError("data.context must be a valid AudioContext"),
			);
		}

		const scale = zoomLevels?.[0] ?? data.scale;
		const multiChannel = data.multiChannel ?? false;

		if (data.buffer) {
			const builderOptions: {
				audio_buffer: AudioBuffer;
				split_channels: boolean;
				scale?: number;
				disable_worker: boolean;
			} = {
				audio_buffer: data.buffer,
				disable_worker: true,
				split_channels: multiChannel,
			};
			if (scale !== undefined) {
				builderOptions.scale = scale;
			}
			return createFromAudio(builderOptions);
		}

		// Fall back to fetching the bytes off the media element source.
		const context = data.context;
		const element = data.element ?? this.peaks.options.mediaElement;
		const mediaSourceUrl = element?.currentSrc;

		if (mediaSourceUrl) {
			return this.requestAudioAndBuildWaveformData(
				mediaSourceUrl,
				context,
				multiChannel,
				scale,
			);
		}

		return ResultAsync.fromPromise(
			new Promise<string>((resolve) => {
				this.peaks.events?.addEventListener(
					"player.canplay",
					() => {
						resolve(
							(element ?? this.peaks.options.mediaElement)?.currentSrc ?? "",
						);
					},
					{ once: true },
				);
			}),
			(err) => (err instanceof Error ? err : new Error(String(err))),
		).andThen((url) =>
			this.requestAudioAndBuildWaveformData(url, context, multiChannel, scale),
		);
	}

	private requestAudioAndBuildWaveformData(
		url: string,
		context: AudioContext,
		multiChannel: boolean,
		scale?: number,
	): ResultAsync<WaveformData, Error> {
		if (!url) {
			this.peaks.logger?.("The mediaElement src is invalid");
			return errAsync(new Error("The mediaElement src is invalid"));
		}

		return this.fetchData(url, "arraybuffer").andThen((fetched) => {
			this.controller = undefined;

			const builderOptions: {
				audio_context: AudioContext;
				array_buffer: ArrayBuffer;
				split_channels: boolean;
				scale?: number;
			} = {
				array_buffer: fetched as ArrayBuffer,
				audio_context: context,
				split_channels: multiChannel,
			};
			if (scale !== undefined) {
				builderOptions.scale = scale;
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
