import Peaks from "../src/main";

describe("Peaks.zoom", () => {
	let p = null;

	describe("with overview and zoomview", () => {
		beforeEach((done) => {
			const options = {
				overview: {
					container: document.getElementById("overview-container"),
				},
				zoomview: {
					container: document.getElementById("zoomview-container"),
				},
				mediaElement: document.getElementById("media"),
				dataUri: {
					json: "base/test/data/sample.json",
				},
				zoomLevels: [512, 1024],
			};

			Peaks.init(options, (err, instance) => {
				expect(err).to.equal(null);
				p = instance;
				done();
			});
		});

		afterEach(() => {
			if (p) {
				p.destroy();
			}
		});

		describe("getZoom", () => {
			it("should return the initial zoom level index", () => {
				expect(p.zoom.getZoom()).to.equal(0);
			});
		});

		describe("setZoom", () => {
			it("should update the zoom level index", () => {
				p.zoom.setZoom(1);

				expect(p.zoom.getZoom()).to.equal(1);
			});

			it("should emit a zoom.update event with the new zoom level", () => {
				const spy = sinon.spy();

				p.on("zoom.update", spy);
				p.zoom.setZoom(1);

				expect(spy.callCount).to.equal(1);
				expect(spy).calledWith({ currentZoom: 1024, previousZoom: 512 });
			});

			it("should limit the zoom level index value to the minimum valid index", () => {
				p.zoom.setZoom(-1);

				expect(p.zoom.getZoom()).to.equal(0);
			});

			it("should limit the zoom level index to the maximum valid index", () => {
				p.zoom.setZoom(2);

				expect(p.zoom.getZoom()).to.equal(1);
			});

			it("should not throw an exception if an existing zoom level does not have sufficient data", () => {
				expect(() => {
					p.zoom.setZoom(3);
				}).not.to.throw();
			});
		});

		describe("zoomOut", () => {
			it("should call setZoom with a bigger zoom level", () => {
				const spy = sinon.spy();

				p.on("zoom.update", spy);
				p.zoom.zoomOut();

				expect(spy.callCount).to.equal(1);
				expect(spy).to.have.been.calledWith({
					currentZoom: 1024,
					previousZoom: 512,
				});
			});
		});

		describe("zoomIn", () => {
			it("should call setZoom with a smaller zoom level", () => {
				p.zoom.setZoom(1);

				const spy = sinon.spy();

				p.on("zoom.update", spy);
				p.zoom.zoomIn();

				expect(spy.callCount).to.equal(1);
				expect(spy).calledWith({ currentZoom: 512, previousZoom: 1024 });
			});
		});
	});

	describe("with overview only", () => {
		beforeEach((done) => {
			const options = {
				overview: {
					container: document.getElementById("overview-container"),
				},
				mediaElement: document.getElementById("media"),
				dataUri: {
					json: "base/test/data/sample.json",
				},
				zoomLevels: [512, 1024],
			};

			Peaks.init(options, (err, instance) => {
				expect(err).to.equal(null);
				p = instance;
				done();
			});
		});

		afterEach(() => {
			if (p) {
				p.destroy();
			}
		});

		describe("setZoom", () => {
			it("should update the zoom level index", () => {
				p.zoom.setZoom(1);

				expect(p.zoom.getZoom()).to.equal(1);
			});

			it("should not try to update the zoomview", () => {
				const spy = sinon.spy();

				p.on("zoom.update", spy);
				p.zoom.setZoom(1);

				expect(spy).to.not.have.been.called;
			});
		});
	});
});
