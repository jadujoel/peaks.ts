/**
 * Discriminated union describing every supported way to provide
 * waveform data to peaks.ts. One of:
 *
 * - `uri` — fetch a precomputed waveform-data file (binary or JSON).
 * - `arraybuffer` — decode an in-memory binary waveform-data buffer.
 * - `json` — decode an in-memory JSON waveform-data object.
 * - `webaudio` — compute waveform data on the fly using the Web Audio
 *   API from an `AudioBuffer` or an `HTMLMediaElement`.
 */
export interface DataSourceUri {
	readonly type: "uri";
	readonly arraybuffer?: string;
	readonly json?: string;
}

export interface DataSourceArrayBuffer {
	readonly type: "arraybuffer";
	readonly arraybuffer: ArrayBuffer;
}

export interface DataSourceJson {
	readonly type: "json";
	readonly json: Record<string, unknown>;
}

export interface DataSourceWebAudio {
	readonly type: "webaudio";
	readonly context?: AudioContext;
	readonly buffer?: AudioBuffer;
	readonly element?: HTMLMediaElement;
	readonly stereo?: boolean;
	readonly scale?: number;
}

export interface DataSourceMediaElement {
	readonly type: "mediaelement";
	readonly element: HTMLMediaElement;
	readonly url: string;
}

export interface DataSourceBaseOptions {
	readonly stereo?: boolean;
	readonly scale?: number;
}

export type DataSourceOptions = DataSourceBaseOptions &
	(DataSourceUri | DataSourceArrayBuffer | DataSourceJson | DataSourceWebAudio);
