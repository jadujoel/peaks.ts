import Peaks from "../src/main";
import WaveformOverview from "../src/waveform-overview";
import WaveformZoomView from "../src/waveform-zoomview";

describe("Peaks.views", () => {
	let p;

	afterEach(() => {
		if (p) {
			p.destroy();
		}
	});

	describe("createZoomview", () => {
		context("with existing zoomview", () => {
			beforeEach((done) => {
				const options = {
					zoomview: {
						container: document.getElementById("zoomview-container"),
					},
					mediaElement: document.getElementById("media"),
					dataUri: {
						json: "base/test/data/sample.json",
					},
				};

				Peaks.init(options, (err, instance) => {
					expect(err).to.equal(null);
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

		context("without existing zoomview", () => {
			beforeEach((done) => {
				const options = {
					overview: {
						container: document.getElementById("overview-container"),
					},
					mediaElement: document.getElementById("media"),
					dataUri: {
						json: "base/test/data/sample.json",
					},
				};

				Peaks.init(options, (err, instance) => {
					expect(err).to.equal(null);
					p = instance;
					done();
				});
			});

			it("should return a new zoomview instance", () => {
				expect(p.views.getView("zoomview")).to.equal(null);

				const zoomviewContainer = document.getElementById("zoomview-container");

				const view = p.views.createZoomview(zoomviewContainer);

				expect(view).to.be.an.instanceOf(WaveformZoomView);

				expect(p.views.getView("zoomview")).to.equal(view);
			});
		});
	});

	describe("createOverview", () => {
		context("with existing overview", () => {
			beforeEach((done) => {
				const options = {
					overview: {
						container: document.getElementById("overview-container"),
					},
					mediaElement: document.getElementById("media"),
					dataUri: {
						json: "base/test/data/sample.json",
					},
				};

				Peaks.init(options, (err, instance) => {
					expect(err).to.equal(null);
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

		context("without existing overview", () => {
			beforeEach((done) => {
				const options = {
					zoomview: {
						container: document.getElementById("zoomview-container"),
					},
					mediaElement: document.getElementById("media"),
					dataUri: {
						json: "base/test/data/sample.json",
					},
				};

				Peaks.init(options, (err, instance) => {
					expect(err).to.equal(null);
					p = instance;
					done();
				});
			});

			it("should return a new overview instance", () => {
				expect(p.views.getView("overview")).to.equal(null);

				const overviewContainer = document.getElementById("overview-container");

				const view = p.views.createOverview(overviewContainer);

				expect(view).to.be.an.instanceOf(WaveformOverview);

				expect(p.views.getView("overview")).to.equal(view);
			});
		});
	});

	describe("getView", () => {
		context("with zoomview and overview containers", () => {
			beforeEach((done) => {
				const options = {
					zoomview: {
						container: document.getElementById("zoomview-container"),
					},
					overview: {
						container: document.getElementById("overview-container"),
					},
					mediaElement: document.getElementById("media"),
					dataUri: {
						json: "base/test/data/sample.json",
					},
				};

				Peaks.init(options, (err, instance) => {
					expect(err).to.equal(null);
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
				expect(view).to.equal(null);
			});

			it("should return null if given an invalid view name", () => {
				const view = p.views.getView("unknown");
				expect(view).to.equal(null);
			});
		});

		context("with only a zoomview container", () => {
			beforeEach((done) => {
				const options = {
					zoomview: {
						container: document.getElementById("zoomview-container"),
					},
					mediaElement: document.getElementById("media"),
					dataUri: {
						json: "base/test/data/sample.json",
					},
				};

				Peaks.init(options, (err, instance) => {
					expect(err).to.equal(null);
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
				expect(view).to.equal(null);
			});

			it("should return the zoomview if given no view name", () => {
				const view = p.views.getView();
				expect(view).to.be.an.instanceOf(WaveformZoomView);
			});

			it("should return null if given an invalid view name", () => {
				const view = p.views.getView("unknown");
				expect(view).to.equal(null);
			});
		});

		context("with only an overview container", () => {
			beforeEach((done) => {
				const options = {
					overview: {
						container: document.getElementById("overview-container"),
					},
					mediaElement: document.getElementById("media"),
					dataUri: {
						json: "base/test/data/sample.json",
					},
				};

				Peaks.init(options, (err, instance) => {
					expect(err).to.equal(null);
					p = instance;
					done();
				});
			});

			it("should return null if given the zoomview view name", () => {
				const view = p.views.getView("zoomview");
				expect(view).to.equal(null);
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
				expect(view).to.equal(null);
			});
		});
	});

	describe("destroyZoomview", () => {
		context("with zoomview and overview containers", () => {
			beforeEach((done) => {
				const options = {
					zoomview: {
						container: document.getElementById("zoomview-container"),
					},
					overview: {
						container: document.getElementById("overview-container"),
					},
					mediaElement: document.getElementById("media"),
					dataUri: {
						json: "base/test/data/sample.json",
					},
				};

				Peaks.init(options, (err, instance) => {
					expect(err).to.equal(null);
					p = instance;
					done();
				});
			});

			it("should destroy the zoomview", () => {
				const view = p.views.getView("zoomview");
				const spy = sinon.spy(view, "destroy");

				p.views.destroyZoomview();

				expect(p.views.getView("zoomview")).to.equal(null);
				expect(spy.callCount).to.equal(1);
			});
		});

		context("with only a zoomview", () => {
			beforeEach((done) => {
				const options = {
					zoomview: {
						container: document.getElementById("zoomview-container"),
					},
					mediaElement: document.getElementById("media"),
					dataUri: {
						json: "base/test/data/sample.json",
					},
				};

				Peaks.init(options, (err, instance) => {
					expect(err).to.equal(null);
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

		context("with no zoomview", () => {
			beforeEach((done) => {
				const options = {
					overview: {
						container: document.getElementById("overview-container"),
					},
					mediaElement: document.getElementById("media"),
					dataUri: {
						json: "base/test/data/sample.json",
					},
				};

				Peaks.init(options, (err, instance) => {
					expect(err).to.equal(null);
					p = instance;
					done();
				});
			});

			it("should do nothing", () => {
				p.views.destroyZoomview();

				expect(p.views.getView("zoomview")).to.equal(null);
			});
		});
	});

	describe("destroyOverview", () => {
		context("with zoomview and overview containers", () => {
			beforeEach((done) => {
				const options = {
					zoomview: {
						container: document.getElementById("zoomview-container"),
					},
					overview: {
						container: document.getElementById("overview-container"),
					},
					mediaElement: document.getElementById("media"),
					dataUri: {
						json: "base/test/data/sample.json",
					},
				};

				Peaks.init(options, (err, instance) => {
					expect(err).to.equal(null);
					p = instance;
					done();
				});
			});

			it("should destroy the overview", () => {
				const view = p.views.getView("overview");
				const spy = sinon.spy(view, "destroy");

				p.views.destroyOverview();

				expect(p.views.getView("overview")).to.equal(null);
				expect(spy.callCount).to.equal(1);
			});
		});

		context("with only an overview", () => {
			beforeEach((done) => {
				const options = {
					overview: {
						container: document.getElementById("overview-container"),
					},
					mediaElement: document.getElementById("media"),
					dataUri: {
						json: "base/test/data/sample.json",
					},
				};

				Peaks.init(options, (err, instance) => {
					expect(err).to.equal(null);
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

		context("with no overview", () => {
			beforeEach((done) => {
				const options = {
					zoomview: {
						container: document.getElementById("zoomview-container"),
					},
					mediaElement: document.getElementById("media"),
					dataUri: {
						json: "base/test/data/sample.json",
					},
				};

				Peaks.init(options, (err, instance) => {
					expect(err).to.equal(null);
					p = instance;
					done();
				});
			});

			it("should do nothing", () => {
				p.views.destroyOverview();

				expect(p.views.getView("overview")).to.equal(null);
			});
		});
	});
});
