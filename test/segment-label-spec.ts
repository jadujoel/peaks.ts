import { createSegmentLabel } from "../src/marker-factories";
import type { CreateSegmentLabelOptions } from "../src/types";

interface RecordedText {
	attrs: Record<string, unknown>;
}

function createFakeLayer(): {
	layer: CreateSegmentLabelOptions["layer"];
	recorded: RecordedText[];
} {
	const recorded: RecordedText[] = [];
	const driver = {
		createText: (attrs: Record<string, unknown>) => {
			recorded.push({ attrs });
			let xValue = (attrs.x as number) ?? 0;
			let yValue = (attrs.y as number) ?? 0;
			return {
				on: () => {},
				text: () => "",
				x: (value?: number) => {
					if (value !== undefined) xValue = value;
					return xValue;
				},
				y: (value?: number) => {
					if (value !== undefined) yValue = value;
					return yValue;
				},
			};
		},
	};
	const layer = {
		getDriver: () => driver,
	} as unknown as CreateSegmentLabelOptions["layer"];
	return { layer, recorded };
}

describe("createSegmentLabel", () => {
	it("defaults the label fill to white", () => {
		const { layer, recorded } = createFakeLayer();
		createSegmentLabel({
			fontFamily: "sans-serif",
			fontSize: 12,
			fontStyle: "normal",
			layer,
			segment: { labelText: "hello" } as never,
			view: "zoomview",
		});
		expect(recorded[0].attrs.fill).to.equal("#ffffff");
	});

	it("honours a custom color option", () => {
		const { layer, recorded } = createFakeLayer();
		createSegmentLabel({
			color: "#ff00ff",
			fontFamily: "sans-serif",
			fontSize: 12,
			fontStyle: "normal",
			layer,
			segment: { labelText: "hello" } as never,
			view: "zoomview",
		});
		expect(recorded[0].attrs.fill).to.equal("#ff00ff");
	});

	it("creates the label at x=0 so SegmentShape can position it", () => {
		const { layer, recorded } = createFakeLayer();
		createSegmentLabel({
			fontFamily: "sans-serif",
			fontSize: 12,
			fontStyle: "normal",
			layer,
			segment: { labelText: "hello" } as never,
			view: "zoomview",
		});
		expect(recorded[0].attrs.x).to.equal(0);
	});
});
