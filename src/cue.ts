export interface CueFromOptions {
	readonly time: number;
	readonly type: number;
	readonly id: string;
}

export class Cue {
	static readonly POINT = 0;
	static readonly SEGMENT_START = 1;
	static readonly SEGMENT_END = 2;

	static sorter(a: Cue, b: Cue): number {
		return a.time - b.time;
	}

	static from(options: CueFromOptions): Cue {
		return new Cue(options.time, options.type, options.id);
	}

	private constructor(
		public readonly time: number,
		public readonly type: number,
		public readonly id: string,
	) {}
}
