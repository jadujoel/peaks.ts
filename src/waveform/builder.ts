import WaveformData from "waveform-data";
import type {
	Logger,
	WaveformBuilderCallback,
	WebAudioOptions,
} from "../types";
import type { Writable } from "../utils";
import { isArrayBuffer, isObject } from "../utils";

export interface WaveformBuilderOptions {
	readonly dataUri?: Record<string, string> | string;
	readonly waveformData?: Record<string, unknown>;
	readonly webAudio?: WebAudioOptions;
	readonly audioContext?: AudioContext;
	readonly withCredentials?: boolean;
	readonly zoomLevels?: readonly number[];
}

const isXhr2 = "withCredentials" in new XMLHttpRequest();

export function hasValidContentRangeHeader(xhr: XMLHttpRequest): boolean {
	const contentRange = xhr.getResponseHeader("content-range");

	if (!contentRange) {
		return false;
	}

	const matches = contentRange.match(/^bytes (\d+)-(\d+)\/(\d+)$/);

	if (matches && matches.length === 4) {
		const firstPos = parseInt(matches[1] as string, 10);
		const lastPos = parseInt(matches[2] as string, 10);
		const length = parseInt(matches[3] as string, 10);

		if (firstPos === 0 && lastPos + 1 === length) {
			return true;
		}

		return false;
	}

	return false;
}

export type WaveformBuilderPeaksLike = {
	readonly options: {
		mediaElement?: HTMLMediaElement;
	};
	readonly logger?: Logger;
	readonly once?: (eventName: string, listener: () => void) => void;
};

export interface WaveformBuilderFromOptions {
	readonly peaks: WaveformBuilderPeaksLike;
}

export class WaveformBuilder {
	private constructor(
		public readonly peaks: WaveformBuilderPeaksLike,
		private xhr: XMLHttpRequest | undefined = undefined,
	) {}

	static from(options: WaveformBuilderFromOptions): WaveformBuilder {
		return new WaveformBuilder(options.peaks);
	}

	init(
		options: WaveformBuilderOptions,
		callback: WaveformBuilderCallback,
	): void {
		if (
			(options.dataUri && (options.webAudio || options.audioContext)) ||
			(options.waveformData && (options.webAudio || options.audioContext)) ||
			(options.dataUri && options.waveformData)
		) {
			callback(
				new TypeError(
					"Peaks.init(): You may only pass one source (webAudio, dataUri, or waveformData) to render waveform data.",
				),
				undefined,
			);
			return;
		}

		if (options.audioContext) {
			this.peaks.logger?.(
				"Peaks.init(): The audioContext option is deprecated, please pass a webAudio object instead",
			);

			(options as Writable<WaveformBuilderOptions>).webAudio = {
				audioContext: options.audioContext,
			};
		}

		if (options.dataUri) {
			this.getRemoteWaveformData(options, callback);
		} else if (options.waveformData) {
			this.buildWaveformFromLocalData(options, callback);
		} else if (options.webAudio) {
			if (options.webAudio.audioBuffer) {
				this.buildWaveformDataFromAudioBuffer(options, callback);
			} else {
				this.buildWaveformDataUsingWebAudio(options, callback);
			}
		} else {
			callback(
				new Error(
					"Peaks.init(): You must pass an audioContext, or dataUri, or waveformData to render waveform data",
				),
				undefined,
			);
		}
	}

	private getRemoteWaveformData(
		options: WaveformBuilderOptions,
		callback: WaveformBuilderCallback,
	): void {
		const self = this;

		let dataUri: Record<string, string> | undefined;
		let requestType: string | undefined;
		let url: string | undefined;

		if (isObject(options.dataUri)) {
			dataUri = options.dataUri;
		} else {
			callback(
				new TypeError("Peaks.init(): The dataUri option must be an object"),
				undefined,
			);
			return;
		}

		["ArrayBuffer", "JSON"].some((connector) => {
			if (connector in window) {
				requestType = connector.toLowerCase();
				url = dataUri?.[requestType] ?? undefined;

				return Boolean(url);
			}

			return false;
		});

		if (!url || !requestType) {
			callback(
				new Error(
					"Peaks.init(): Unable to determine a compatible dataUri format for this browser",
				),
				undefined,
			);
			return;
		}

		self.xhr = self.createXHR(
			url,
			requestType,
			options.withCredentials ?? false,
			function (this: XMLHttpRequest, _event: ProgressEvent<EventTarget>) {
				if (this.readyState !== 4) {
					return;
				}

				if (
					this.status !== 200 &&
					!(this.status === 206 && hasValidContentRangeHeader(this))
				) {
					callback(
						new Error(
							`Unable to fetch remote data. HTTP status ${this.status}`,
						),
						undefined,
					);

					return;
				}

				self.xhr = undefined;

				const waveformData = WaveformData.create(this.response as ArrayBuffer);

				if (waveformData.channels !== 1 && waveformData.channels !== 2) {
					callback(
						new Error(
							"Peaks.init(): Only mono or stereo waveforms are currently supported",
						),
						undefined,
					);
					return;
				} else if (waveformData.bits !== 8) {
					callback(
						new Error("Peaks.init(): 16-bit waveform data is not supported"),
						undefined,
					);
					return;
				}

				callback(undefined, waveformData);
			},
			() => {
				callback(new Error("XHR failed"), undefined);
			},
			() => {
				callback(new Error("XHR aborted"), undefined);
			},
		);

		self.xhr.send();
	}

	private buildWaveformFromLocalData(
		options: WaveformBuilderOptions,
		callback: WaveformBuilderCallback,
	): void {
		let waveformData: Record<string, unknown> | undefined;
		let data: unknown;

		if (isObject(options.waveformData)) {
			waveformData = options.waveformData;
		} else {
			callback(
				new Error("Peaks.init(): The waveformData option must be an object"),
				undefined,
			);
			return;
		}

		if (isObject(waveformData.json)) {
			data = waveformData.json;
		} else if (isArrayBuffer(waveformData.arraybuffer)) {
			data = waveformData.arraybuffer;
		}

		if (!data) {
			callback(
				new Error(
					"Peaks.init(): Unable to determine a compatible waveformData format",
				),
				undefined,
			);
			return;
		}

		try {
			const createdWaveformData = WaveformData.create(data as ArrayBuffer);

			if (
				createdWaveformData.channels !== 1 &&
				createdWaveformData.channels !== 2
			) {
				callback(
					new Error(
						"Peaks.init(): Only mono or stereo waveforms are currently supported",
					),
					undefined,
				);
				return;
			} else if (createdWaveformData.bits !== 8) {
				callback(
					new Error("Peaks.init(): 16-bit waveform data is not supported"),
					undefined,
				);
				return;
			}

			callback(undefined, createdWaveformData);
		} catch (err) {
			callback(err instanceof Error ? err : new Error(String(err)), undefined);
		}
	}

	private buildWaveformDataUsingWebAudio(
		options: WaveformBuilderOptions,
		callback: WaveformBuilderCallback,
	): void {
		if (!(options.webAudio?.audioContext instanceof AudioContext)) {
			callback(
				new TypeError(
					"Peaks.init(): The webAudio.audioContext option must be a valid AudioContext",
				),
				undefined,
			);
			return;
		}

		const webAudioOptions = options.webAudio;

		if (!webAudioOptions) {
			callback(
				new TypeError("Peaks.init(): Missing webAudio options"),
				undefined,
			);
			return;
		}

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
			this.requestAudioAndBuildWaveformData(
				mediaSourceUrl,
				webAudioOptions,
				options.withCredentials ?? false,
				callback,
			);
		} else {
			this.peaks.once?.("player.canplay", () => {
				this.requestAudioAndBuildWaveformData(
					this.peaks.options.mediaElement?.currentSrc ?? "",
					webAudioOptions,
					options.withCredentials ?? false,
					callback,
				);
			});
		}
	}

	private buildWaveformDataFromAudioBuffer(
		options: WaveformBuilderOptions,
		callback: WaveformBuilderCallback,
	): void {
		const webAudioOptions = options.webAudio;

		if (!webAudioOptions) {
			callback(
				new TypeError("Peaks.init(): Missing webAudio options"),
				undefined,
			);
			return;
		}

		const firstZoomLevel = options.zoomLevels?.[0];
		if (
			firstZoomLevel !== undefined &&
			webAudioOptions.scale !== firstZoomLevel
		) {
			(webAudioOptions as Writable<WebAudioOptions>).scale = firstZoomLevel;
		}

		if (!webAudioOptions.audioBuffer) {
			callback(
				new TypeError("Peaks.init(): Missing webAudio.audioBuffer"),
				undefined,
			);
			return;
		}

		const webAudioBuilderOptions: {
			audio_buffer: AudioBuffer;
			split_channels: boolean;
			scale?: number;
			disable_worker: boolean;
		} = {
			audio_buffer: webAudioOptions.audioBuffer,
			disable_worker: true,
			split_channels: webAudioOptions.multiChannel ?? false,
		};

		if (webAudioOptions.scale !== undefined) {
			webAudioBuilderOptions.scale = webAudioOptions.scale;
		}

		WaveformData.createFromAudio(webAudioBuilderOptions, (err, data) => {
			if (err) {
				callback(err, undefined);
				return;
			}

			callback(undefined, data);
		});
	}

	private requestAudioAndBuildWaveformData(
		url: string,
		webAudio: WebAudioOptions,
		withCredentials: boolean,
		callback: WaveformBuilderCallback,
	): void {
		const self = this;

		if (!url) {
			self.peaks.logger?.("Peaks.init(): The mediaElement src is invalid");
			return;
		}

		self.xhr = self.createXHR(
			url,
			"arraybuffer",
			withCredentials,
			function (this: XMLHttpRequest) {
				if (this.readyState !== 4) {
					return;
				}

				// See https://github.com/bbc/peaks.js/issues/491

				if (
					this.status !== 200 &&
					!(this.status === 206 && hasValidContentRangeHeader(this))
				) {
					callback(
						new Error(
							`Unable to fetch remote data. HTTP status ${this.status}`,
						),
						undefined,
					);

					return;
				}

				self.xhr = undefined;

				if (!webAudio.audioContext) {
					callback(new Error("Missing audioContext"), undefined);
					return;
				}

				const webAudioBuilderOptions: {
					audio_context: AudioContext;
					array_buffer: ArrayBuffer;
					split_channels: boolean;
					scale?: number;
				} = {
					array_buffer: this.response as ArrayBuffer,
					audio_context: webAudio.audioContext,
					split_channels: webAudio.multiChannel ?? false,
				};

				if (webAudio.scale !== undefined) {
					webAudioBuilderOptions.scale = webAudio.scale;
				}

				WaveformData.createFromAudio(webAudioBuilderOptions, (err, data) => {
					if (!err) {
						callback(undefined, data);
						return;
					}

					callback(err, undefined);
				});
			},
			() => {
				callback(new Error("XHR failed"), undefined);
			},
			() => {
				callback(new Error("XHR aborted"), undefined);
			},
		);

		self.xhr.send();
	}

	abort(): void {
		if (this.xhr) {
			this.xhr.abort();
		}
	}

	private createXHR(
		url: string,
		requestType: string,
		withCredentials: boolean,
		onLoad: (this: XMLHttpRequest, event: ProgressEvent<EventTarget>) => void,
		onError: () => void,
		onAbort: () => void,
	): XMLHttpRequest {
		const xhr = new XMLHttpRequest();

		// open an XHR request to the data source file
		xhr.open("GET", url, true);

		if (isXhr2) {
			try {
				xhr.responseType = requestType as XMLHttpRequestResponseType;
			} catch {
				// Some browsers like Safari 6 do handle XHR2 but not the json
				// response type, doing only a try/catch fails in IE9
			}
		}

		xhr.onload = onLoad;
		xhr.onerror = onError;

		if (isXhr2 && withCredentials) {
			xhr.withCredentials = true;
		}

		xhr.addEventListener("abort", onAbort);

		return xhr;
	}
}
