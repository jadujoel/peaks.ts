import sinon from "sinon";
import { Peaks } from "../src/main";
import { WaveformOverview } from "../src/waveform/overview";
import { WaveformZoomView } from "../src/waveform/zoomview";

describe("Peaks.views", () => {
	let p = null;

	afterEach(() => {
		if (p) {
			p.destroy();
		}
	});

	describe("createZoomview", () => {
		describe("with existing zoomview", () => {
			beforeEach((done: DoneCallback) => {
				const options = {
					dataUri: {
						json: "base/test/data/sample.json",
					},
					mediaElement: document.getElementById("media"),
					zoomview: {
						container: document.getElementById("zoomview-container"),
					},
				};

				Peaks.init(options, (err, instance) => {
					expect(err).to.equal(undefined);
					p = instance;
					done();
				});
			});

			it("should return the existing zoomview instance", () => {
				const view = p.views.getView("zoomview");

				expect(view).to.be.an.instanceOf(WaveformZoomView);

				const zoomviewContainer = document.getElementById("zoomview-container");

				expect(p.views.createZoomview(zoomviewContainer)).to.equal(view);
			});
		});

		describe("without existing zoomview", () => {
			beforeEach((done: DoneCallback) => {
				const options = {
					dataUri: {
						json: "base/test/data/sample.json",
					},
					mediaElement: document.getElementById("media"),
					overview: {
						container: document.getElementById("overview-container"),
					},
				};

				Peaks.init(options, (err, instance) => {
					expect(err).to.equal(undefined);
					p = instance;
					done();
				});
			});

			it("should return a new zoomview instance", () => {
				expect(p.views.getView("zoomview")).to.equal(undefined);

				const zoomviewContainer = document.getElementById("zoomview-container");

				const view = p.views.createZoomview(zoomviewContainer);

				expect(view).to.be.an.instanceOf(WaveformZoomView);

				expect(p.views.getView("zoomview")).to.equal(view);
			});
		});
	});

	describe("createOverview", () => {
		describe("with existing overview", () => {
			beforeEach((done: DoneCallback) => {
				const options = {
					dataUri: {
						json: "base/test/data/sample.json",
					},
					mediaElement: document.getElementById("media"),
					overview: {
						container: document.getElementById("overview-container"),
					},
				};

				Peaks.init(options, (err, instance) => {
					expect(err).to.equal(undefined);
					p = instance;
					done();
				});
			});

			it("should return the existing overview instance", () => {
				const view = p.views.getView("overview");

				expect(view).to.be.an.instanceOf(WaveformOverview);

				const overviewContainer = document.getElementById("overview-container");

				expect(p.views.createOverview(overviewContainer)).to.equal(view);
			});
		});

		describe("without existing overview", () => {
			beforeEach((done: DoneCallback) => {
				const options = {
					dataUri: {
						json: "base/test/data/sample.json",
					},
					mediaElement: document.getElementById("media"),
					zoomview: {
						container: document.getElementById("zoomview-container"),
					},
				};

				Peaks.init(options, (err, instance) => {
					expect(err).to.equal(undefined);
					p = instance;
					done();
				});
			});

			it("should return a new overview instance", () => {
				expect(p.views.getView("overview")).to.equal(undefined);

				const overviewContainer = document.getElementById("overview-container");

				const view = p.views.createOverview(overviewContainer);

				expect(view).to.be.an.instanceOf(WaveformOverview);

				expect(p.views.getView("overview")).to.equal(view);
			});
		});
	});

	describe("getView", () => {
		describe("with zoomview and overview containers", () => {
			beforeEach((done: DoneCallback) => {
				const options = {
					dataUri: {
						json: "base/test/data/sample.json",
					},
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
					done();
				});
			});

			it("should return the zoomview", () => {
				const view = p.views.getView("zoomview");
				expect(view).to.be.an.instanceOf(WaveformZoomView);
			});

			it("should return the overview", () => {
				const view = p.views.getView("overview");
				expect(view).to.be.an.instanceOf(WaveformOverview);
			});

			it("should return null if given no view name", () => {
				const view = p.views.getView();
				expect(view).to.equal(undefined);
			});

			it("should return null if given an invalid view name", () => {
				const view = p.views.getView("unknown");
				expect(view).to.equal(undefined);
			});
		});

		describe("with only a zoomview container", () => {
			beforeEach((done: DoneCallback) => {
				const options = {
					dataUri: {
						json: "base/test/data/sample.json",
					},
					mediaElement: document.getElementById("media"),
					zoomview: {
						container: document.getElementById("zoomview-container"),
					},
				};

				Peaks.init(options, (err, instance) => {
					expect(err).to.equal(undefined);
					p = instance;
					done();
				});
			});

			it("should return the zoomview", () => {
				const view = p.views.getView("zoomview");
				expect(view).to.be.an.instanceOf(WaveformZoomView);
			});

			it("should return null if given the overview view name", () => {
				const view = p.views.getView("overview");
				expect(view).to.equal(undefined);
			});

			it("should return the zoomview if given no view name", () => {
				const view = p.views.getView();
				expect(view).to.be.an.instanceOf(WaveformZoomView);
			});

			it("should return null if given an invalid view name", () => {
				const view = p.views.getView("unknown");
				expect(view).to.equal(undefined);
			});
		});

		describe("with only an overview container", () => {
			beforeEach((done: DoneCallback) => {
				const options = {
					dataUri: {
						json: "base/test/data/sample.json",
					},
					mediaElement: document.getElementById("media"),
					overview: {
						container: document.getElementById("overview-container"),
					},
				};

				Peaks.init(options, (err, instance) => {
					expect(err).to.equal(undefined);
					p = instance;
					done();
				});
			});

			it("should return null if given the zoomview view name", () => {
				const view = p.views.getView("zoomview");
				expect(view).to.equal(undefined);
			});

			it("should return the overview", () => {
				const view = p.views.getView("overview");
				expect(view).to.be.an.instanceOf(WaveformOverview);
			});

			it("should return the overview if given no view name", () => {
				const view = p.views.getView();
				expect(view).to.be.an.instanceOf(WaveformOverview);
			});

			it("should return null if given an invalid view name", () => {
				const view = p.views.getView("unknown");
				expect(view).to.equal(undefined);
			});
		});
	});

	describe("destroyZoomview", () => {
		describe("with zoomview and overview containers", () => {
			beforeEach((done: DoneCallback) => {
				const options = {
					dataUri: {
						json: "base/test/data/sample.json",
					},
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
					done();
				});
			});

			it("should destroy the zoomview", () => {
				const view = p.views.getView("zoomview");
				const spy = sinon.spy(view, "destroy");

				p.views.destroyZoomview();

				expect(p.views.getView("zoomview")).to.equal(undefined);
				expect(spy.callCount).to.equal(1);
			});
		});

		describe("with only a zoomview", () => {
			beforeEach((done: DoneCallback) => {
				const options = {
					dataUri: {
						json: "base/test/data/sample.json",
					},
					mediaElement: document.getElementById("media"),
					zoomview: {
						container: document.getElementById("zoomview-container"),
					},
				};

				Peaks.init(options, (err, instance) => {
					expect(err).to.equal(undefined);
					p = instance;
					done();
				});
			});

			it("should not destroy the zoomview", () => {
				p.views.destroyZoomview();

				expect(p.views.getView("zoomview")).to.be.an.instanceOf(
					WaveformZoomView,
				);
			});
		});

		describe("with no zoomview", () => {
			beforeEach((done: DoneCallback) => {
				const options = {
					dataUri: {
						json: "base/test/data/sample.json",
					},
					mediaElement: document.getElementById("media"),
					overview: {
						container: document.getElementById("overview-container"),
					},
				};

				Peaks.init(options, (err, instance) => {
					expect(err).to.equal(undefined);
					p = instance;
					done();
				});
			});

			it("should do nothing", () => {
				p.views.destroyZoomview();

				expect(p.views.getView("zoomview")).to.equal(undefined);
			});
		});
	});

	describe("destroyOverview", () => {
		describe("with zoomview and overview containers", () => {
			beforeEach((done: DoneCallback) => {
				const options = {
					dataUri: {
						json: "base/test/data/sample.json",
					},
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
					done();
				});
			});

			it("should destroy the overview", () => {
				const view = p.views.getView("overview");
				const spy = sinon.spy(view, "destroy");

				p.views.destroyOverview();

				expect(p.views.getView("overview")).to.equal(undefined);
				expect(spy.callCount).to.equal(1);
			});
		});

		describe("with only an overview", () => {
			beforeEach((done: DoneCallback) => {
				const options = {
					dataUri: {
						json: "base/test/data/sample.json",
					},
					mediaElement: document.getElementById("media"),
					overview: {
						container: document.getElementById("overview-container"),
					},
				};

				Peaks.init(options, (err, instance) => {
					expect(err).to.equal(undefined);
					p = instance;
					done();
				});
			});

			it("should not destroy the overview", () => {
				p.views.destroyOverview();

				expect(p.views.getView("overview")).to.be.an.instanceOf(
					WaveformOverview,
				);
			});
		});

		describe("with no overview", () => {
			beforeEach((done: DoneCallback) => {
				const options = {
					dataUri: {
						json: "base/test/data/sample.json",
					},
					mediaElement: document.getElementById("media"),
					zoomview: {
						container: document.getElementById("zoomview-container"),
					},
				};

				Peaks.init(options, (err, instance) => {
					expect(err).to.equal(undefined);
					p = instance;
					done();
				});
			});

			it("should do nothing", () => {
				p.views.destroyOverview();

				expect(p.views.getView("overview")).to.equal(undefined);
			});
		});
	});
});
