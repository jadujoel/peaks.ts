// AudioDriver abstraction. The high-level peaks.ts code consumes only this
// interface; concrete implementations (e.g. ClipNode, MediaElement) live
// under `src/driver/audio/<name>/` and the test double under
// `src/driver/audio/test/`.

import type { PeaksEvents } from "../../events";
import type { Segment } from "../../segment";
import type { WebAudioOptions } from "../../types";

/**
 * Context passed to {@link AudioDriver.init}. Exposes the events bus a
 * driver dispatches `player.*` events on.
 */
export interface AudioDriverContext {
	readonly events: PeaksEvents;
}

/**
 * Source payload for {@link AudioDriver.setSource}. Every driver accepts
 * the same DTO, but is free to reject if a field it needs is missing
 * (e.g. `MediaElementAudioDriver.setSource({ webAudio })` rejects).
 */
export interface AudioSource {
	readonly mediaUrl?: string;
	readonly mediaElement?: HTMLMediaElement;
	readonly dataUri?: Record<string, string>;
	readonly waveformData?: Record<string, unknown>;
	readonly webAudio?: WebAudioOptions;
	readonly withCredentials?: boolean;
}

/**
 * Options for {@link AudioDriver.playSegment}.
 */
export interface PlaySegmentOptions {
	readonly segment: Segment;
	readonly loop: boolean;
}

/**
 * Unified audio playback driver. Every method is required — no optional
 * `playSegment`, `setSource`, or `dispose`. Drivers that cannot natively
 * implement a segment loop compose with `PollingSegmentPlayer` from
 * `./segment-polling`.
 */
export interface AudioDriver {
	init(ctx: AudioDriverContext): Promise<void>;
	dispose(): void;
	play(): Promise<void>;
	pause(): void;
	isPlaying(): boolean;
	isSeeking(): boolean;
	getCurrentTime(): number;
	getDuration(): number;
	seek(time: number): void;
	playSegment(options: PlaySegmentOptions): Promise<void>;
	setSource(source: AudioSource): Promise<void>;
}
