import { DefaultPointMarker } from "../src/default-point-marker";
import { DefaultSegmentMarker } from "../src/default-segment-marker";
import type { PeaksGroup } from "../src/peaks-group";

interface RecordedAttrs {
	addText: Array<Record<string, unknown>>;
	addRect: Array<Record<string, unknown>>;
	addLine: Array<Record<string, unknown>>;
}

function fakeNode() {
	return {
		getWidth: () => 0,
		hide: () => {},
		on: () => {},
		points: () => {},
		show: () => {},
		x: () => 0,
		y: () => 0,
	};
}

function createFakeGroup(): { group: PeaksGroup; recorded: RecordedAttrs } {
	const recorded: RecordedAttrs = {
		addLine: [],
		addRect: [],
		addText: [],
	};
	const fake = {
		addLine: (attrs: Record<string, unknown>) => {
			recorded.addLine.push(attrs);
			return fakeNode();
		},
		addRect: (attrs: Record<string, unknown>) => {
			recorded.addRect.push(attrs);
			return fakeNode();
		},
		addText: (attrs: Record<string, unknown>) => {
			recorded.addText.push(attrs);
			return fakeNode();
		},
		on: () => {},
	};
	return { group: fake as unknown as PeaksGroup, recorded };
}

const layerStub = { formatTime: () => "00:00", getHeight: () => 100 };

describe("default marker label colors", () => {
	it("DefaultPointMarker label and time text default to white", () => {
		const { group, recorded } = createFakeGroup();
		const marker = DefaultPointMarker.from({
			options: {
				layer: layerStub,
				point: { labelText: "p", time: 0 },
			} as never,
		});
		marker.init(group);

		expect(recorded.addText.length).to.equal(2);
		expect(recorded.addText[0].fill).to.equal("#fff");
		expect(recorded.addText[1].fill).to.equal("#fff");
	});

	it("DefaultSegmentMarker label defaults to white", () => {
		const { group, recorded } = createFakeGroup();
		const marker = DefaultSegmentMarker.from({
			options: {
				layer: layerStub,
				segment: { endTime: 1, startTime: 0 },
				startMarker: true,
			} as never,
		});
		marker.init(group);

		expect(recorded.addText.length).to.be.greaterThan(0);
		expect(recorded.addText[0].fill).to.equal("#fff");
	});
});
