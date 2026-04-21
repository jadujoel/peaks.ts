export type CueType =
	| typeof Cue.POINT
	| typeof Cue.SEGMENT_START
	| typeof Cue.SEGMENT_END;

export interface CueFromOptions {
	readonly time: number;
	readonly type: CueType;
	readonly id: string;
}

export class Cue {
	static readonly POINT = 0 as const;
	static readonly SEGMENT_START = 1 as const;
	static readonly SEGMENT_END = 2 as const;

	private constructor(
		public readonly time: number,
		public readonly type: CueType,
		public readonly id: string,
	) {}

	static from(options: CueFromOptions): Cue {
		return new Cue(options.time, options.type, options.id);
	}

	static sorter(a: Cue, b: Cue): number {
		return a.time - b.time;
	}
}
