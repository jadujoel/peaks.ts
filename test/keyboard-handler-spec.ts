import { Peaks } from "../src/main";

import { InputController } from "./helpers/input-controller";

describe("KeyboardHandler", () => {
	let p = null;
	let zoomview = null;
	let inputController = null;

	beforeEach((done: DoneCallback) => {
		const options = {
			dataUri: {
				arraybuffer: "base/test/data/sample.dat",
			},
			keyboard: true,
			mediaElement: document.getElementById("media"),
			overview: {
				container: document.getElementById("overview-container"),
			},
			zoomview: {
				container: document.getElementById("zoomview-container"),
			},
		};

		Peaks.init(options, (err, instance) => {
			expect(err).to.equal(undefined);

			p = instance;
			zoomview = instance.views.getView("zoomview");
			expect(zoomview).to.be.ok;

			inputController = new InputController("zoomview-container");

			done();
		});
	});

	afterEach(() => {
		if (p) {
			p.destroy();
			p = null;
			zoomview = null;
			inputController = null;
		}
	});

	describe("when the right arrow key is pressed", () => {
		it("should scroll the waveform to the right", () => {
			inputController.keyUp("ArrowRight", false);

			expect(zoomview.getStartTime()).to.be.closeTo(1.0, 0.01);
		});
	});

	describe("when the right arrow key is pressed (shifted)", () => {
		it("should scroll the waveform to the right", () => {
			inputController.keyUp("ArrowRight", true);

			expect(zoomview.getStartTime()).to.equal(
				zoomview.pixelsToTime(zoomview.getWidth()),
			);
		});
	});

	describe("when the left arrow key is pressed", () => {
		it("should scroll the waveform to the left", () => {
			zoomview.setStartTime(10.0);

			inputController.keyUp("ArrowLeft", false);

			expect(zoomview.getStartTime()).to.be.closeTo(9.0, 0.01);
		});
	});

	describe("when the left arrow key is pressed (shifted)", () => {
		it("should scroll the waveform to the left", () => {
			zoomview.setStartTime(20.0);

			inputController.keyUp("ArrowLeft", true);

			expect(zoomview.getStartTime()).to.be.closeTo(
				20.0 - zoomview.pixelsToTime(zoomview.getWidth()),
				0.1,
			);
		});
	});
});
