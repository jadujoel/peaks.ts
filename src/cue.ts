export default class Cue {
	static readonly POINT = 0;
	static readonly SEGMENT_START = 1;
	static readonly SEGMENT_END = 2;

	static sorter(a: Cue, b: Cue): number {
		return a.time - b.time;
	}

	time: number;
	type: number;
	id: string;

	constructor(time: number, type: number, id: string) {
		this.time = time;
		this.type = type;
		this.id = id;
	}
}
