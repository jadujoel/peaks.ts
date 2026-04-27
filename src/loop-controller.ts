import type { Segment } from "./segment";
import type { PeaksInstance } from "./types";

/**
 * Tracked loop state. `kind: "none"` means nothing is currently looping
 * (or playback was stopped); `kind: "file"` is whole-source looping;
 * `kind: "segment"` references the segment currently looping by id.
 */
export type LoopState =
	| { readonly kind: "none" }
	| { readonly kind: "file" }
	| { readonly kind: "segment"; readonly id: string };

export interface LoopControllerFromOptions {
	readonly peaks: PeaksInstance;
	/**
	 * Optional change callback invoked with a human-readable label every
	 * time {@link LoopController} transitions to a new state. The label is
	 * convenient for binding to a status output without writing extra
	 * formatting code.
	 */
	readonly onChange?: (label: string) => void;
}

/**
 * Coordinates loop state for a Peaks instance. Supports:
 *   • whole-file loop  — delegates to `peaks.player.playLooped()`.
 *   • single-segment loop — `loopSegment(segment)`.
 *   • clearing the loop — `stop()` pauses playback and resets state.
 *
 * Held state is observable via {@link LoopController.state} and
 * {@link LoopController.currentSegmentId} so consumers can, for example,
 * stop the loop when the segment that's currently looping is removed.
 */
export class LoopController {
	private constructor(
		private readonly peaks: PeaksInstance,
		private readonly onChange: (label: string) => void,
		private currentState: LoopState,
	) {}

	static from(options: LoopControllerFromOptions): LoopController {
		return new LoopController(options.peaks, options.onChange ?? noop, {
			kind: "none",
		});
	}

	/**
	 * Plays the entire source on a loop. Resolves once the underlying
	 * driver has started playback. Resolves to a no-op when the source has
	 * no positive duration.
	 */
	loopFile = (): Promise<void> => {
		const duration = this.peaks.player.getDuration();
		if (!Number.isFinite(duration) || duration <= 0) {
			return Promise.resolve();
		}
		this.currentState = { kind: "file" };
		this.onChange("entire file");
		return this.peaks.player.playLooped();
	};

	/**
	 * Plays the supplied segment on a loop.
	 */
	loopSegment = (segment: Segment): Promise<void> => {
		this.currentState = { id: segment.id, kind: "segment" };
		this.onChange(formatSegmentLabel(segment));
		return this.peaks.player.playSegment(segment, true);
	};

	/**
	 * Pauses playback and clears loop state.
	 */
	stop = (): void => {
		this.currentState = { kind: "none" };
		this.peaks.player.pause();
		this.onChange("(none)");
	};

	state(): LoopState {
		return this.currentState;
	}

	currentSegmentId(): string | undefined {
		return this.currentState.kind === "segment"
			? this.currentState.id
			: undefined;
	}
}

function noop(): void {
	// intentional
}

function formatSegmentLabel(segment: Segment): string {
	const label = segment.labelText.length > 0 ? segment.labelText : segment.id;
	return `${label} (${segment.startTime.toFixed(2)}s – ${segment.endTime.toFixed(2)}s)`;
}
