import WaveformData from "waveform-data";
import type { Logger, WaveformBuilderCallback, WebAudioOptions } from "./types";
import { isArrayBuffer, isObject } from "./utils";

interface WaveformBuilderOptions {
	dataUri?: Record<string, string> | string | null;
	waveformData?: Record<string, unknown> | null;
	webAudio?: WebAudioOptions | null;
	audioContext?: AudioContext;
	withCredentials?: boolean;
	zoomLevels?: number[];
	[key: string]: unknown;
}

const isXhr2 = "withCredentials" in new XMLHttpRequest();

function hasValidContentRangeHeader(xhr: XMLHttpRequest): boolean {
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
		mediaElement?: HTMLMediaElement | null;
	};
	readonly _logger?: Logger;
	readonly once?: (eventName: string, listener: () => void) => void;
};

class WaveformBuilder {
	_peaks: WaveformBuilderPeaksLike;
	_xhr: XMLHttpRequest | null = null;

	constructor(peaks: WaveformBuilderPeaksLike) {
		this._peaks = peaks;
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
			this._peaks._logger?.(
				"Peaks.init(): The audioContext option is deprecated, please pass a webAudio object instead",
			);

			options.webAudio = {
				audioContext: options.audioContext,
			};
		}

		if (options.dataUri) {
			this._getRemoteWaveformData(options, callback);
		} else if (options.waveformData) {
			this._buildWaveformFromLocalData(options, callback);
		} else if (options.webAudio) {
			if (options.webAudio.audioBuffer) {
				this._buildWaveformDataFromAudioBuffer(options, callback);
			} else {
				this._buildWaveformDataUsingWebAudio(options, callback);
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

	private _getRemoteWaveformData(
		options: WaveformBuilderOptions,
		callback: WaveformBuilderCallback,
	): void {
		const self = this;

		let dataUri: Record<string, string> | null = null;
		let requestType: string | null = null;
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

		self._xhr = self._createXHR(
			url,
			requestType,
			options.withCredentials ?? false,
			function (this: XMLHttpRequest, _event: ProgressEvent<EventTarget>) {
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

				self._xhr = null;

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

		self._xhr.send();
	}

	private _buildWaveformFromLocalData(
		options: WaveformBuilderOptions,
		callback: WaveformBuilderCallback,
	): void {
		let waveformData: Record<string, unknown> | null = null;
		let data: unknown = null;

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

	private _buildWaveformDataUsingWebAudio(
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
			webAudioOptions.scale = firstZoomLevel;
		}

		// If the media element has already selected which source to play, its
		// currentSrc attribute will contain the source media URL. Otherwise,
		// we wait for a canplay event to tell us when the media is ready.

		const mediaSourceUrl = this._peaks.options.mediaElement?.currentSrc;

		if (mediaSourceUrl) {
			this._requestAudioAndBuildWaveformData(
				mediaSourceUrl,
				webAudioOptions,
				options.withCredentials ?? false,
				callback,
			);
		} else {
			this._peaks.once?.("player.canplay", () => {
				this._requestAudioAndBuildWaveformData(
					this._peaks.options.mediaElement?.currentSrc ?? "",
					webAudioOptions,
					options.withCredentials ?? false,
					callback,
				);
			});
		}
	}

	private _buildWaveformDataFromAudioBuffer(
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
			webAudioOptions.scale = firstZoomLevel;
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
			split_channels: webAudioOptions.multiChannel ?? false,
			disable_worker: true,
		};

		if (webAudioOptions.scale !== undefined) {
			webAudioBuilderOptions.scale = webAudioOptions.scale;
		}

		WaveformData.createFromAudio(webAudioBuilderOptions, (err, data) => {
			if (err) {
				callback(err, undefined);
				return;
			}
			callback(err, data);
		});
	}

	private _requestAudioAndBuildWaveformData(
		url: string,
		webAudio: WebAudioOptions,
		withCredentials: boolean,
		callback: WaveformBuilderCallback,
	): void {
		const self = this;

		if (!url) {
			self._peaks._logger?.("Peaks.init(): The mediaElement src is invalid");
			return;
		}

		self._xhr = self._createXHR(
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

				self._xhr = null;

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
					audio_context: webAudio.audioContext,
					array_buffer: this.response as ArrayBuffer,
					split_channels: webAudio.multiChannel ?? false,
				};

				if (webAudio.scale !== undefined) {
					webAudioBuilderOptions.scale = webAudio.scale;
				}

				WaveformData.createFromAudio(webAudioBuilderOptions, (err, data) => {
					if (err === undefined) {
						callback(undefined, data);
						return;
					}
					if (data === undefined) {
						callback(err, data);
						return;
					}
					callback(
						new Error("Unexpected result from WaveformData.createFromAudio"),
						undefined,
					);
				});
			},
			() => {
				callback(new Error("XHR failed"), undefined);
			},
			() => {
				callback(new Error("XHR aborted"), undefined);
			},
		);

		self._xhr.send();
	}

	abort(): void {
		if (this._xhr) {
			this._xhr.abort();
		}
	}

	_createXHR(
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

export default WaveformBuilder;
