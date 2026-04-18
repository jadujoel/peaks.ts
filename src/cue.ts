export class Cue {
	static readonly POINT = 0;
	static readonly SEGMENT_START = 1;
	static readonly SEGMENT_END = 2;

	static sorter(a: Cue, b: Cue): number {
		return a.time - b.time;
	}

	constructor(
		public time: number,
		public type: number,
		public id: string,
	) {}
}
