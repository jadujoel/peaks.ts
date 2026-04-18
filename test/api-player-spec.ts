import Peaks from "../src/main";
import Player from "../src/player";

describe("Player", () => {
	describe("with stub player", () => {
		let p = null;
		let player = null;
		let logger = null;

		beforeEach((done) => {
			logger = sinon.spy();

			player = {
				init: sinon.spy(() => Promise.resolve()),
				destroy: sinon.spy(),
				play: sinon.spy(() => Promise.resolve()),
				pause: sinon.spy(),
				seek: sinon.spy(),
				isPlaying: sinon.spy(() => true),
				isSeeking: sinon.spy(() => false),
				getCurrentTime: sinon.spy(() => 111),
				getDuration: sinon.spy(() => 123),
			};

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
				logger: logger,
				player: player,
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
				p = null;
			}
		});

		describe("constructor", () => {
			it("should throw a type error if an adapter property is missing", () => {
				const adapter = {
					init: () => {},
				};

				expect(() => {
					new Player(null, adapter as unknown as never);
				}).to.throw(TypeError);
			});

			it("should throw a type error if an adapter property is not a function", () => {
				const adapter = {
					init: "wrong: this should be a function",
					destroy: sinon.spy(),
					play: sinon.spy(),
					pause: sinon.spy(),
					isPlaying: sinon.spy(),
					isSeeking: sinon.spy(),
					getCurrentTime: sinon.spy(),
					getDuration: sinon.spy(),
					seek: sinon.spy(),
				};

				expect(() => {
					new Player(null, adapter as unknown as never);
				}).to.throw(TypeError);
			});
		});

		describe("init", () => {
			it("should call the player's init() method", () => {
				expect(player.init.calledOnce).to.be.true;
			});
		});

		describe("destroy", () => {
			it("should call the player's destroy() method", () => {
				expect(player.destroy.notCalled).to.equal(true);

				p.destroy();

				expect(player.destroy.calledOnce).to.equal(true);
			});
		});

		describe("play", () => {
			it("should call the player's play() method", () => {
				p.player.play();

				expect(player.play.calledOnce).to.equal(true);
			});

			it("should return the value from the player's play() method", () => {
				const result = p.player.play();

				expect(result).to.be.an.instanceOf(Promise);
			});
		});

		describe("pause", () => {
			it("should call the player's pause() method", () => {
				p.player.pause();

				expect(player.pause.calledOnce).to.equal(true);
			});
		});

		describe("isPlaying", () => {
			it("should call the player's isPlaying() method and return its value", () => {
				const count = player.isPlaying.callCount;
				expect(p.player.isPlaying()).to.equal(true);
				expect(player.isPlaying.callCount).to.equal(count + 1);
			});
		});

		describe("isSeeking", () => {
			it("should call the player's isSeeking() method and return its value", () => {
				expect(p.player.isSeeking()).to.equal(false);
				expect(player.isSeeking.calledOnce).to.equal(true);
			});
		});

		describe("getCurrentTime", () => {
			it("should call the player's getCurrentTime() method and return its value", () => {
				const count = player.getCurrentTime.callCount;
				expect(p.player.getCurrentTime()).to.equal(111);
				expect(player.getCurrentTime.callCount).to.equal(count + 1);
			});
		});

		describe("getDuration", () => {
			it("should call the player's getDuration() method and return its value", () => {
				expect(p.player.getDuration()).to.equal(123);
				expect(player.getDuration.calledOnce).to.equal(true);
			});
		});

		describe("seek", () => {
			it("should call the player's seek() method", () => {
				p.player.seek(42);

				expect(logger.notCalled).to.equal(true);
				expect(player.seek.calledOnce).to.equal(true);
				expect(player.seek).to.have.been.calledWith(42);
			});

			it("should log an error if the given time is not valid", () => {
				p.player.seek("6.0");

				expect(logger.calledOnce).to.equal(true);
				expect(player.seek.notCalled).to.equal(true);
			});
		});

		describe("playSegment", () => {
			it("should return a rejected promise if a segment id is given", () => {
				const result = p.player.playSegment("peaks.segment.0");

				expect(result).to.be.an.instanceOf(Promise);

				return result.catch((error) => {
					expect(error).to.be.an.instanceOf(Error);
					expect(error.message).to.match(/segment object/);
				});
			});

			it("should call the player's seek() and play() methods", (done) => {
				const segment = { startTime: 10, endTime: 20, editable: true };

				p.player.playSegment(segment).then(() => {
					expect(logger.notCalled).to.equal(true);

					expect(player.seek.calledOnce).to.equal(true);
					expect(player.seek).to.have.been.calledWith(segment.startTime);

					expect(player.play.calledOnce).to.equal(true);
					expect(player.pause.notCalled).to.equal(true);
					done();
				});
			});

			it("should return the value from the player's play() method", () => {
				const result = p.player.playSegment({ startTime: 10, endTime: 20 });

				expect(result).to.be.an.instanceOf(Promise);
			});
		});
	});

	describe("with media element player", () => {
		let p = null;
		let logger = null;

		beforeEach((done) => {
			logger = sinon.spy();

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
				logger: logger,
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
				p = null;
			}
		});

		describe("play", () => {
			it("should trigger mediaelement playing event", (done) => {
				p.on("player.playing", (currentTime) => {
					expect(currentTime).to.be.lessThan(0.05);
					done();
				});

				p.player.play();
			});
		});

		describe("isSeeking", () => {
			it("should return the actual value of the audio element", () => {
				expect(p.player.isSeeking()).to.equal(
					document.getElementById("media").seeking,
				);
			});
		});

		describe("getCurrentTime", () => {
			const newTime = 6.0;

			it("should return the actual value of the audio element", () => {
				expect(p.player.getCurrentTime()).to.equal(0);
			});

			it("should return an updated time if it has been modified through the audio element", (done) => {
				p.on("player.seeked", (currentTime) => {
					expect(currentTime).to.equal(p.player.getCurrentTime());

					const diff = Math.abs(currentTime - newTime);
					expect(diff).to.be.lessThan(0.2);

					done();
				});

				document.querySelector("audio").currentTime = newTime;
			});
		});

		describe("seek", () => {
			beforeEach((done) => {
				if (p.player.getCurrentTime() === 0.0) {
					done();
					return;
				}

				p.once("player.seeked", () => {
					done();
				});

				p.player.seek(0.0);
			});

			it("should change the currentTime value of the audio element", (done) => {
				const newTime = 6.0;

				p.once("player.seeked", (currentTime) => {
					const diff = Math.abs(currentTime - newTime);
					expect(diff).to.be.lessThan(0.2);
					done();
				});

				p.player.seek(newTime);
			});

			it("should log an error and not seek if the given time is not valid", () => {
				p.player.seek("6.0");

				expect(logger.calledOnce).to.equal(true);
				expect(p.player.getCurrentTime()).to.equal(0.0);
			});
		});

		describe("playSegment", () => {
			it("should return a rejected promise if a segment id is given", () => {
				const result = p.player.playSegment("peaks.segment.0");

				expect(result).to.be.an.instanceOf(Promise);

				return result.catch((error) => {
					expect(error).to.be.an.instanceOf(Error);
					expect(error.message).to.match(/segment object/);
				});
			});

			it("should play a given segment", () => {
				p.segments.add({ startTime: 10, endTime: 20, editable: true });

				const segments = p.segments.getSegments();
				expect(segments.length).to.equal(1);

				return p.player.playSegment(segments[0]).then(() => {
					p.player.pause();
					expect(logger.notCalled).to.equal(true);
				});
			});

			it("should play a segment if an object with startTime and endTime values is given", (done) => {
				const expectedStart = 1;
				const expectedEnd = 2;

				p.player
					.playSegment({ startTime: expectedStart, endTime: expectedEnd })
					.catch((error) => {
						expect(error.name).to.equal("AbortError");
					});

				p.on("player.playing", (currentTime) => {
					const diff = Math.abs(currentTime - expectedStart);
					expect(diff).to.be.lessThan(0.05);
				});

				p.on("player.pause", () => {
					const diff = Math.abs(p.player.getCurrentTime() - expectedEnd);
					expect(diff).to.be.lessThan(0.05);
					done();
				});
			});
		});

		describe("destroy", () => {
			it("should remove all event listeners", () => {
				p.player.destroy();

				expect(p.player._adapter._listeners).to.be.empty;
			});
		});
	});

	describe("with custom player that fails to initialize", () => {
		let p = null;

		afterEach(() => {
			if (p) {
				p.destroy();
				p = null;
			}
		});

		describe("init", () => {
			it("should cause Peaks.init() to return an error", (done) => {
				const player = {
					init: sinon.spy(() => Promise.reject(new Error("failed"))),
					destroy: sinon.spy(),
					play: sinon.spy(() => Promise.resolve()),
					pause: sinon.spy(),
					seek: sinon.spy(),
					isPlaying: sinon.spy(() => true),
					isSeeking: sinon.spy(() => false),
					getCurrentTime: sinon.spy(() => 111),
					getDuration: sinon.spy(() => 123),
				};

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
					player: player,
				};

				Peaks.init(options, (err, instance) => {
					expect(err).to.be.an.instanceOf(Error);
					expect(err.message).to.equal("failed");
					p = instance;
					done();
				});
			});
		});
	});
});
