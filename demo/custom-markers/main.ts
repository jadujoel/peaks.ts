import { Peaks } from "../peaks.esm.js";

import { createPointMarker, createSegmentMarker } from "./marker-factories";
import { createSegmentLabel } from "./segment-label-factory";

function renderSegments(peaks) {
	const segmentsContainer = document.getElementById("segments");
	const segments = peaks.segments.getSegments();
	let html = "";

	for (let i = 0; i < segments.length; i++) {
		const segment = segments[i];

		const row =
			"<tr>" +
			"<td>" +
			segment.id +
			"</td>" +
			'<td><input data-action="update-segment-label" type="text" value="' +
			segment.labelText +
			'" data-id="' +
			segment.id +
			'"/></td>' +
			'<td><input data-action="update-segment-start-time" type="number" value="' +
			segment.startTime +
			'" data-id="' +
			segment.id +
			'"/></td>' +
			'<td><input data-action="update-segment-end-time" type="number" value="' +
			segment.endTime +
			'" data-id="' +
			segment.id +
			'"/></td>' +
			"<td>" +
			'<a href="#' +
			segment.id +
			'" data-action="play-segment" data-id="' +
			segment.id +
			'">Play</a>' +
			"</td>" +
			"<td>" +
			'<a href="#' +
			segment.id +
			'" data-action="remove-segment" data-id="' +
			segment.id +
			'">Remove</a>' +
			"</td>" +
			"</tr>";

		html += row;
	}

	segmentsContainer.querySelector("tbody").innerHTML = html;

	if (html.length) {
		segmentsContainer.classList.remove("hide");
	}

	document
		.querySelectorAll('input[data-action="update-segment-start-time"]')
		.forEach((inputElement) => {
			inputElement.addEventListener("input", (event) => {
				const element = event.target;
				const id = element.getAttribute("data-id");
				const segment = peaks.segments.getSegment(id);

				if (segment) {
					let startTime = parseFloat(element.value);

					if (startTime < 0) {
						startTime = 0;
						element.value = 0;
					}

					if (startTime >= segment.endTime) {
						startTime = segment.endTime - 0.1;
						element.value = startTime;
					}

					segment.update({ startTime: startTime });
				}
			});
		});

	document
		.querySelectorAll('input[data-action="update-segment-end-time"]')
		.forEach((inputElement) => {
			inputElement.addEventListener("input", (event) => {
				const element = event.target;
				const id = element.getAttribute("data-id");
				const segment = peaks.segments.getSegment(id);

				if (segment) {
					let endTime = parseFloat(element.value);

					if (endTime < 0) {
						endTime = 0;
						element.value = 0;
					}

					if (endTime <= segment.startTime) {
						endTime = segment.startTime + 0.1;
						element.value = endTime;
					}

					segment.update({ endTime: endTime });
				}
			});
		});

	document
		.querySelectorAll('input[data-action="update-segment-label"]')
		.forEach((inputElement) => {
			inputElement.addEventListener("input", (event) => {
				const element = event.target;
				const id = element.getAttribute("data-id");
				const segment = peaks.segments.getSegment(id);
				const labelText = element.value;

				if (segment) {
					segment.update({ labelText: labelText });
				}
			});
		});
}

function renderPoints(peaks) {
	const pointsContainer = document.getElementById("points");
	const points = peaks.points.getPoints();
	let html = "";

	for (let i = 0; i < points.length; i++) {
		const point = points[i];

		const row =
			"<tr>" +
			"<td>" +
			point.id +
			"</td>" +
			'<td><input data-action="update-point-label" type="text" value="' +
			point.labelText +
			'" data-id="' +
			point.id +
			'"/></td>' +
			'<td><input data-action="update-point-time" type="number" value="' +
			point.time +
			'" data-id="' +
			point.id +
			'"/></td>' +
			"<td>" +
			'<a href="#' +
			point.id +
			'" data-action="remove-point" data-id="' +
			point.id +
			'">Remove</a>' +
			"</td>" +
			"</tr>";

		html += row;
	}

	pointsContainer.querySelector("tbody").innerHTML = html;

	if (html.length) {
		pointsContainer.classList.remove("hide");
	}

	document
		.querySelectorAll('input[data-action="update-point-time"]')
		.forEach((inputElement) => {
			inputElement.addEventListener("input", (event) => {
				const element = event.target;
				const id = element.getAttribute("data-id");
				const point = peaks.points.getPoint(id);

				if (point) {
					let time = parseFloat(element.value);

					if (time < 0) {
						time = 0;
						element.value = 0;
					}

					point.update({ time: time });
				}
			});
		});

	document
		.querySelectorAll('input[data-action="update-point-label"]')
		.forEach((inputElement) => {
			inputElement.addEventListener("input", (event) => {
				const element = event.target;
				const id = element.getAttribute("data-id");
				const point = peaks.points.getPoint(id);
				const labelText = element.value;

				if (point) {
					point.update({ labelText: labelText });
				}
			});
		});
}

const options = {
	createPointMarker: createPointMarker,
	createSegmentLabel: createSegmentLabel,
	createSegmentMarker: createSegmentMarker,
	dataUri: {
		arraybuffer: "TOL_6min_720p_download.dat",
		json: "TOL_6min_720p_download.json",
	},
	keyboard: true,
	mediaElement: document.getElementById("audio"),
	overview: {
		container: document.getElementById("overview-container"),
		highlightColor: "#888",
		waveformColor: {
			linearGradientColorStops: [
				"rgba(150, 0, 0, 0.2)",
				"rgba(150, 0, 0, 0.5)",
			],
			linearGradientEnd: 58,
			linearGradientStart: 50,
		},
	},
	segmentOptions: {
		endMarkerColor: "#006eb0",
		startMarkerColor: "#006eb0",
	},
	showPlayheadTime: false,
	zoomview: {
		container: document.getElementById("zoomview-container"),
		waveformColor: {
			linearGradientColorStops: ["hsl(180, 78%, 46%)", "hsl(180, 78%, 16%)"],
			linearGradientEnd: 60,
			linearGradientStart: 20,
		},
	},
};

Peaks.init(options, (err, peaksInstance) => {
	if (err) {
		console.error(err.message);
		return;
	}

	console.log("Peaks instance ready");

	document
		.querySelector('[data-action="zoom-in"]')
		.addEventListener("click", () => {
			peaksInstance.zoom.zoomIn();
		});

	document
		.querySelector('[data-action="zoom-out"]')
		.addEventListener("click", () => {
			peaksInstance.zoom.zoomOut();
		});

	let segmentCounter = 1;

	document
		.querySelector('button[data-action="add-segment"]')
		.addEventListener("click", () => {
			peaksInstance.segments.add({
				color: {
					linearGradientColorStops: ["hsl(40, 78%, 46%)", "hsl(80, 78%, 16%)"],
					linearGradientEnd: 60,
					linearGradientStart: 20,
				},
				editable: true,
				endTime: peaksInstance.player.getCurrentTime() + 10,
				labelText: `Segment ${segmentCounter++}`,
				startTime: peaksInstance.player.getCurrentTime(),
			});
		});

	let pointCounter = 1;

	document
		.querySelector('button[data-action="add-point"]')
		.addEventListener("click", () => {
			peaksInstance.points.add({
				color: "#006eb0",
				editable: true,
				labelText: `Point ${pointCounter++}`,
				time: peaksInstance.player.getCurrentTime(),
			});
		});

	document
		.querySelector('button[data-action="log-data"]')
		.addEventListener("click", (_event) => {
			renderSegments(peaksInstance);
			renderPoints(peaksInstance);
		});

	document
		.querySelector('button[data-action="seek"]')
		.addEventListener("click", (_event) => {
			const time = document.getElementById("seek-time").value;
			const seconds = parseFloat(time);

			if (!Number.isNaN(seconds)) {
				peaksInstance.player.seek(seconds);
			}
		});

	document
		.querySelector('button[data-action="destroy"]')
		.addEventListener("click", (_event) => {
			peaksInstance.destroy();
		});

	document.getElementById("auto-scroll").addEventListener("change", (event) => {
		const view = peaksInstance.views.getView("zoomview");
		view.enableAutoScroll(event.target.checked);
	});

	document.querySelector("body").addEventListener("click", (event) => {
		const element = event.target;
		const action = element.getAttribute("data-action");
		const id = element.getAttribute("data-id");

		if (action === "play-segment") {
			const segment = peaksInstance.segments.getSegment(id);
			peaksInstance.player.playSegment(segment);
		} else if (action === "remove-point") {
			peaksInstance.points.removeById(id);
		} else if (action === "remove-segment") {
			peaksInstance.segments.removeById(id);
		}
	});

	const amplitudeScales = {
		0: 0.0,
		1: 0.1,
		2: 0.25,
		3: 0.5,
		4: 0.75,
		5: 1.0,
		6: 1.5,
		7: 2.0,
		8: 3.0,
		9: 4.0,
		10: 5.0,
	};

	document
		.getElementById("amplitude-scale")
		.addEventListener("input", (event) => {
			const scale = amplitudeScales[event.target.value];

			peaksInstance.views.getView("zoomview").setAmplitudeScale(scale);
			peaksInstance.views.getView("overview").setAmplitudeScale(scale);
		});

	document
		.querySelector('button[data-action="resize-width"]')
		.addEventListener("click", (_event) => {
			document.querySelectorAll(".waveform-container").forEach((container) => {
				container.style.width =
					container.offsetWidth === 1000 ? "700px" : "1000px";
			});

			const zoomview = peaksInstance.views.getView("zoomview");

			if (zoomview) {
				zoomview.fitToContainer();
			}

			const scrollbar = peaksInstance.views.getScrollbar();

			if (scrollbar) {
				scrollbar.fitToContainer();
			}

			const overview = peaksInstance.views.getView("overview");

			if (overview) {
				overview.fitToContainer();
			}
		});

	document
		.querySelector('button[data-action="resize-height"]')
		.addEventListener("click", (_event) => {
			const zoomviewContainer = document.getElementById("zoomview-container");
			const overviewContainer = document.getElementById("overview-container");

			zoomviewContainer.style.height =
				zoomviewContainer.offsetHeight === 200 ? "300px" : "200px";
			overviewContainer.style.height =
				overviewContainer.offsetHeight === 200 ? "85px" : "200px";

			const zoomview = peaksInstance.views.getView("zoomview");

			if (zoomview) {
				zoomview.fitToContainer();
			}

			const overview = peaksInstance.views.getView("overview");

			if (overview) {
				overview.fitToContainer();
			}
		});

	document.getElementById("enable-seek").addEventListener("change", (event) => {
		const overview = peaksInstance.views.getView("overview");
		const zoomview = peaksInstance.views.getView("zoomview");

		zoomview.enableSeek(event.target.checked);
		overview.enableSeek(event.target.checked);
	});

	document
		.getElementById("waveform-drag-mode")
		.addEventListener("change", (event) => {
			const view = peaksInstance.views.getView("zoomview");

			view.setWaveformDragMode(event.target.value);
		});

	document
		.getElementById("enable-segment-dragging")
		.addEventListener("change", (event) => {
			const zoomview = peaksInstance.views.getView("zoomview");

			zoomview.enableSegmentDragging(event.target.checked);
		});

	document
		.getElementById("segment-drag-mode")
		.addEventListener("change", (event) => {
			const view = peaksInstance.views.getView("zoomview");

			view.setSegmentDragMode(event.target.value);
		});

	// Point events

	peaksInstance.events.addEventListener("points.mouseenter", (event) => {
		console.log("points.mouseenter:", event);
	});

	peaksInstance.events.addEventListener("points.mouseleave", (event) => {
		console.log("points.mouseleave:", event);
	});

	peaksInstance.events.addEventListener("points.click", (event) => {
		console.log("points.click:", event);
	});

	peaksInstance.events.addEventListener("points.dblclick", (event) => {
		console.log("points.dblclick:", event);
	});

	peaksInstance.events.addEventListener("points.contextmenu", (event) => {
		event.evt.preventDefault();

		console.log("points.contextmenu:", event);
	});

	peaksInstance.events.addEventListener("points.dragstart", (event) => {
		console.log("points.dragstart:", event);
	});

	peaksInstance.events.addEventListener("points.dragmove", (event) => {
		console.log("points.dragmove:", event);
	});

	peaksInstance.events.addEventListener("points.dragend", (event) => {
		console.log("points.dragend:", event);
	});

	// Segment events

	peaksInstance.events.addEventListener("segments.dragstart", (event) => {
		console.log("segments.dragstart:", event);
	});

	peaksInstance.events.addEventListener("segments.dragend", (event) => {
		console.log("segments.dragend:", event);
	});

	peaksInstance.events.addEventListener("segments.dragged", (event) => {
		console.log("segments.dragged:", event);
	});

	peaksInstance.events.addEventListener("segments.mouseenter", (event) => {
		console.log("segments.mouseenter:", event);
	});

	peaksInstance.events.addEventListener("segments.mouseleave", (event) => {
		console.log("segments.mouseleave:", event);
	});

	peaksInstance.events.addEventListener("segments.click", (event) => {
		console.log("segments.click:", event);
	});

	peaksInstance.events.addEventListener("segments.dblclick", (event) => {
		console.log("segments.dblclick:", event);
	});

	peaksInstance.events.addEventListener("segments.contextmenu", (event) => {
		event.evt.preventDefault();

		console.log("segments.contextmenu:", event);
	});

	// Zoomview waveform events

	peaksInstance.events.addEventListener("zoomview.click", (event) => {
		console.log("zoomview.click:", event);
	});

	peaksInstance.events.addEventListener("zoomview.dblclick", (event) => {
		console.log("zoomview.dblclick:", event);
	});

	peaksInstance.events.addEventListener("zoomview.contextmenu", (event) => {
		event.evt.preventDefault();

		console.log("zoomview.contextmenu:", event);
	});

	peaksInstance.events.addEventListener("zoomview.update", (event) => {
		console.log("zoomview.update:", event);
	});

	// Overview waveform events

	peaksInstance.events.addEventListener("overview.click", (event) => {
		console.log("overview.click:", event);
	});

	peaksInstance.events.addEventListener("overview.dblclick", (event) => {
		console.log("overview.dblclick:", event);
	});

	peaksInstance.events.addEventListener("overview.contextmenu", (event) => {
		event.evt.preventDefault();

		console.log("overview.contextmenu:", event);
	});
});
