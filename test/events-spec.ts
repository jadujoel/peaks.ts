import { createPeaksEvents } from "../src/events";

describe("PeaksEvents", () => {
	it("delivers payloads to typed listeners", () => {
		const events = createPeaksEvents();
		const received: Array<{ time: number }> = [];

		events.addEventListener("player.timeupdate", (event) => {
			received.push({ time: event.time });
		});

		events.dispatch("player.timeupdate", { time: 1.25 });
		events.dispatch("player.timeupdate", { time: 2.5 });

		expect(received).to.deep.equal([{ time: 1.25 }, { time: 2.5 }]);
	});

	it("includes the event type on the dispatched event object", () => {
		const events = createPeaksEvents();
		let receivedType: string | undefined;

		events.addEventListener("zoom.update", (event) => {
			receivedType = event.type;
			expect(event.currentZoom).to.equal(1024);
			expect(event.previousZoom).to.equal(512);
		});

		events.dispatch("zoom.update", {
			currentZoom: 1024,
			previousZoom: 512,
		});

		expect(receivedType).to.equal("zoom.update");
	});

	it("removeEventListener stops further delivery", () => {
		const events = createPeaksEvents();
		let count = 0;
		const listener = () => {
			count += 1;
		};

		events.addEventListener("player.canplay", listener);
		events.dispatch("player.canplay", {});
		events.removeEventListener("player.canplay", listener);
		events.dispatch("player.canplay", {});

		expect(count).to.equal(1);
	});

	it("once: true delivers exactly once", () => {
		const events = createPeaksEvents();
		let count = 0;

		events.addEventListener(
			"player.seeked",
			() => {
				count += 1;
			},
			{ once: true },
		);

		events.dispatch("player.seeked", { time: 0.5 });
		events.dispatch("player.seeked", { time: 1.0 });

		expect(count).to.equal(1);
	});

	it("supports empty payloads", () => {
		const events = createPeaksEvents();
		let received = false;

		events.addEventListener("player.ended", (event) => {
			expect(event.type).to.equal("player.ended");
			received = true;
		});

		events.dispatch("player.ended", {});

		expect(received).to.equal(true);
	});
});
