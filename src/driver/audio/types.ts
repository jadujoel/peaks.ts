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
	/**
	 * Asynchronously initializes the driver with runtime context (e.g. the
	 * peaks events bus). Called once by {@link Player.init} before any
	 * playback method. Implementations may load worklet modules, attach
	 * media element listeners, etc.
	 */
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
	/**
	 * Optional accessor used by Peaks to auto-fill `webAudio.buffer` (and
	 * other source fields) so callers don't have to pass the same buffer
	 * twice — once to construct the driver, once to configure the
	 * WaveformBuilder. Drivers that don't own a buffer return `undefined`.
	 */
	getSource?(): AudioSource | undefined;
	/**
	 * Optional hook to update the active loop's bounds without restarting
	 * playback. Called when a looping segment's endpoints change live (for
	 * example, the user drags one of its markers). Drivers that drive
	 * looping by polling a mutable {@link Segment} reference can leave
	 * this unimplemented; native-loop drivers (e.g. `ClipNode`) implement
	 * it to update their loop boundary properties in place.
	 */
	setLoopBounds?(startTime: number, endTime: number): void;
	/**
	 * Optional hook to enable or disable looping on the underlying
	 * playback node without changing playback state. Used by the loop
	 * controller's `stop()` so subsequent `play()` calls don't reuse the
	 * previously configured loop. Polling-based drivers can ignore this.
	 */
	setLooped?(loop: boolean): void;
}
