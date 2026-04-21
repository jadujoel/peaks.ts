import sinon from "sinon";
import { Peaks } from "../src/main";
import { InputController } from "./helpers/input-controller";

describe("Scrollbar", () => {
	let p = null;
	let inputController = null;
	let zoomview = null;

	describe("with only a zoomview waveform", () => {
		beforeEach((done: DoneCallback) => {
			const options = {
				dataUri: {
					arraybuffer: "base/test/data/sample.dat",
				},
				mediaElement: document.getElementById("media"),
				scrollbar: {
					container: document.getElementById("scrollbar-container"),
				},
				zoomview: {
					container: document.getElementById("zoomview-container"),
				},
			};

			Peaks.init(options, (err, instance) => {
				if (err) {
					done(err);
					return;
				}

				p = instance;
				inputController = new InputController("scrollbar-container");
				zoomview = p.views.getView("zoomview");

				done();
			});
		});

		afterEach(() => {
			if (p) {
				p.dispose();
				p = null;
			}
		});

		describe("when dragging the scrollbox to the right", () => {
			it("should update the scroll position", () => {
				const distance = 50;

				const updateWaveform = sinon.spy(zoomview, "updateWaveform");

				inputController.mouseDown({ x: 50, y: 8 });
				inputController.mouseMove({ x: 50 + distance, y: 8 });
				inputController.mouseUp({ x: 50 + distance, y: 8 });

				expect(updateWaveform.callCount).to.equal(1);
				expect(updateWaveform).calledWithExactly(141);
			});
		});

		describe("when dragging the scrollbox to the left", () => {
			beforeEach(() => {
				zoomview.updateWaveform(1000);
			});

			it("should update the scroll position", () => {
				const distance = -50;

				const updateWaveform = sinon.spy(zoomview, "updateWaveform");

				inputController.mouseDown({ x: 500, y: 8 });
				inputController.mouseMove({ x: 500 + distance, y: 8 });
				inputController.mouseUp({ x: 500 + distance, y: 8 });

				expect(updateWaveform.callCount).to.equal(1);
				expect(updateWaveform).calledWithExactly(857);
			});
		});

		describe("when clicking to the left of the scrollbox", () => {
			beforeEach(() => {
				zoomview.updateWaveform(1000);
			});

			it("should update the scroll position", () => {
				const updateWaveform = sinon.spy(zoomview, "updateWaveform");

				inputController.mouseDown({ x: 50, y: 8 });
				inputController.mouseUp({ x: 50, y: 8 });

				expect(updateWaveform.callCount).to.equal(1);
				expect(updateWaveform).calledWithExactly(0);
			});
		});

		describe("when clicking to the right of the scrollbox", () => {
			beforeEach(() => {
				zoomview.updateWaveform(1000);
			});

			it("should update the scroll position", () => {
				const updateWaveform = sinon.spy(zoomview, "updateWaveform");

				inputController.mouseDown({ x: 900, y: 8 });
				inputController.mouseUp({ x: 900, y: 8 });

				expect(updateWaveform.callCount).to.equal(1);
				expect(updateWaveform).calledWithExactly(2040);
			});
		});
	});

	describe("with only an overview waveform", () => {
		beforeEach((done: DoneCallback) => {
			const options = {
				dataUri: {
					arraybuffer: "base/test/data/sample.dat",
				},
				mediaElement: document.getElementById("media"),
				overview: {
					container: document.getElementById("overview-container"),
				},
				scrollbar: {
					container: document.getElementById("scrollbar-container"),
				},
			};

			Peaks.init(options, (err, instance) => {
				if (err) {
					done(err);
					return;
				}

				p = instance;

				done();
			});
		});

		afterEach(() => {
			if (p) {
				p.dispose();
				p = null;
			}
		});

		it("should set the scrollbox width to the maximum width", () => {
			const scrollbar = p.views.scrollbar;

			expect(scrollbar.scrollboxRect.getX()).to.equal(0);
			expect(scrollbar.scrollboxRect.getWidth()).to.equal(1000);
		});

		describe("when a zoomview is created", () => {
			it("should update the scrollbar state", () => {
				const container = document.getElementById("zoomview-container");
				p.views.createZoomview(container);

				const scrollbar = p.views.scrollbar;

				expect(scrollbar.scrollboxRect.getX()).to.equal(0);
				expect(scrollbar.scrollboxRect.getWidth()).to.equal(353);
			});
		});
	});
});
