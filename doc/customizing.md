# Customizing Peaks.js

This document describes how to customize various aspects of the waveform rendering and media playback in Peaks.js.

## Contents

- [Introduction](#introduction)
- [Point and Segment Markers](#point-and-segment-markers)
  - [createPointMarker()](#createpointmarkeroptions)
  - [createSegmentMarker()](#createsegmentmarkeroptions)
  - [Marker API](#marker-api)
    - [marker.constructor()](#markerconstructoroptions)
    - [marker.init()](#markerinitgroup)
    - [marker.fitToView()](#markerfittoview)
    - [marker.update()](#markerupdateoptions)
    - [marker.destroy()](#markerdestroy)
  - [Layer API](#layer-api)
    - [layer.getHeight()](#layergetheight)
    - [layer.draw()](#layerdraw)
    - [layer.formatTime()](#layerformattime)
- [Segment Labels](#segment-labels)
  - [createSegmentLabel()](#createsegmentlabeloptions)
- [Media Playback](#media-playback)
  - [Player Interface](#player-interface)
    - [player.init()](#playeriniteventemitter)
    - [player.destroy()](#playerdestroy)
    - [player.setSource()](#playersetsourceoptions)
    - [player.play()](#playerplay)
    - [player.pause()](#playerpause)
    - [player.seek()](#playerseektime)
    - [player.isPlaying()](#playerisplaying)
    - [player.isSeeking()](#playerisseeking)
    - [player.getCurrentTime()](#playergetcurrenttime)
    - [player.getDuration()](#playergetduration)
  - [Configuration](#configuration)
  - [Initialization](#initialization)
  - [Events](#events)
    - [player.canplay](#playercanplay-event)
    - [player.error](#playererror-event)
    - [player.playing](#playerplaying-event)
    - [player.pause](#playerpause-event)
    - [player.seeked](#playerseeked-event)
    - [player.timeupdate](#playertimeupdate-event)
- [Time Labels](#time-labels)

## Introduction

**Note:** The APIs described in this document are not yet stable, and so may
change at any time.

Peaks.ts renders waveforms through a pluggable `CanvasDriver`. Two drivers
ship with the library:

* `KonvaCanvasDriver` (default) — uses [Konva.js](https://konvajs.org/).
* `PixiCanvasDriver` (experimental) — uses [Pixi.js](https://pixijs.com/) and
  is loaded lazily via dynamic `import("pixi.js")`.

Custom point and segment markers are written against the driver-agnostic
`PeaksGroup` / `PeaksNode` abstractions exposed by Peaks.ts (see
`src/peaks-group.ts` and `src/peaks-node.ts`). When using the Konva driver
these map directly to `Konva.Group` and `Konva.Shape`, so the following
Konva references remain useful background reading:

* [Konva Polygon Tutorial](https://konvajs.github.io/docs/shapes/Line_-_Polygon.html)
* [Konva Text Tutorial](https://konvajs.github.io/docs/shapes/Text.html)
* [Konva Label Tutorial](https://konvajs.github.io/docs/shapes/Label.html)

## Point and Segment Markers

Peaks.js allows you to customize the appearance of the point and segment
markers. This is achieved by providing `createPointMarker` and/or
`createSegmentMarker` functions in the options passed when calling
`Peaks.from()`, for example:

```javascript
function createPointMarker(options) {
  // (see below)
}

function createSegmentMarker(options) {
  // (see below)
}

const options = {
  // Add other options, as needed.
  createPointMarker: createPointMarker,
  createSegmentMarker: createSegmentMarker
};

Peaks.from(options).then((result) => {
  if (result.isErr()) return;
  const peaks = result.value;
  // Use the Peaks.js instance here
});
```

Customizing markers does not work with the Peaks.js UMD bundle. You must build
Peaks.js into your own bundle with Konva as a peer dependency, using a module
bundler such as [Webpack](https://webpack.js.org/),
[Rollup](https://rollupjs.org/), [Parcel](https://parceljs.org/), etc.

### `createPointMarker(options)`

The `createPointMarker` function returns an object that renders a point marker.
When called, this function receives an object containing the following
options:

| Name         | Type          | Description                                                                                                                   |
| ------------ | ------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `point`      | `Point`       | The `Point` object associated with this marker. This provides access to the `time`, `color`, and `labelText` attributes, etc. |
| `view`       | `string`      | The name of the view that the marker is being created in, either `zoomview` or `overview`.                                    |
| `layer`      | `PointsLayer` | The rendering layer, see [Layer API](#layer-api) for details.                                                                 |
| `editable`   | `boolean`     | If `true`, the `Point` time can be changed by dragging the mouse.                                                             |
| `color`      | `string`      | Color for the marker (set by the `pointMarkerColor` option in `Peaks.from()`).                                                |
| `fontFamily` | `string`      | Font family for the marker text (set by the `fontFamily` option in `Peaks.from()`, default: `'sans-serif'`).                  |
| `fontSize`   | `number`      | Font size, in px, for the marker text (set by the `fontSize` option in `Peaks.from()`, default: `10`)                         |
| `fontShape`  | `string`      | Font shape for the marker text (set by the `fontShape` option in `Peaks.from()`, default: `'normal'`).                        |

The function should return an instance of an object as illustrated by the
`CustomPointMarker` class below.

You can use the `view` option to give the marker a different appearance or
behaviour in the zoomview and overview waveform views.

```javascript
class CustomPointMarker {
  constructor(options) {
    // (required, see below)
  }

  init(group) {
    // (required, see below)
  }

  fitToView() {
    // (required, see below)
  }

  update(options) {
    // (optional, see below)
  }

  destroy() {
    // (optional, see below)
  }
};

function createPointMarker(options) {
  return new CustomPointMarker(options);
}
```

Your custom point marker object must implement the `init` and
`fitToView` methods. It may also optionally implement `update`
and `destroy`. Refer to the [Marker API](#marker-api)
section for details.

### `createSegmentMarker(options)`

The `createSegmentMarker` function returns an object that renders a segment
marker. When called, this function receives an object containing the
following options:

| Name             | Type            | Description                                                                                                                                     |
| ---------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `segment`        | `Segment`       | The `Segment` object associated with this marker. This provides access to the `startTime`, `endTime`, `color`, and `labelText` attributes, etc. |
| `view`           | `string`        | The name of the view that the marker is being created in, either `zoomview` or `overview`.                                                      |
| `layer`          | `SegmentsLayer` | The rendering layer, see [Layer API](#layer-api) for details.                                                                                   |
| `editable`       | `boolean`       | If `true`, the `Segment` start and end times can be changed by dragging the mouse.                                                              |
| `color`          | `string`        | Color for the marker (set by the `segmentOptions.startMarkerColor` or `segmentOptions.endMarkerColor` option in `Peaks.from()`.                 |
| `fontFamily`     | `string`        | Font family for the marker text (set by the `fontFamily` option in `Peaks.from()`, default: `'sans-serif'`).                                    |
| `fontSize`       | `number`        | Font size, in px, for the marker text (set by the `fontSize` option in `Peaks.from()`, default: `10`)                                           |
| `fontShape`      | `string`        | Font shape for the marker text (set by the `fontShape` option in `Peaks.from()`, default: `'normal'`).                                          |
| `startMarker`    | `boolean`       | If `true`, the marker indicates the start time of the segment. If `false`, the marker indicates the end time of the segment.                    |
| `segmentOptions` | `object`        | An object with segment display options for the current view (see `segmentOptions` in [README.md](README.md)).                                   |

The function should return an instance of an object as illustrated by the
`CustomSegmentMarker` class below.

You can use the `view` option to give the marker a different appearance or
behavior in the zoomview and overview waveform views. You can also return
`null` from this function if you do not want to display a segment marker.

```javascript
class CustomSegmentMarker {
  constructor(options) {
    // (required, see below)
  }

  init(group) {
    // (required, see below)
  }

  fitToView() {
    // (required, see below)
  }

  update(options) {
    // (optional, see below)
  }

  destroy() {
    // (optional, see below)
  }
};

function createSegmentMarker(options) {
  return new CustomSegmentMarker(options);
}
```

Your custom segment marker object must implement the `init` and
`fitToView` methods. It may also optionally implement `update`
and `destroy`. Refer to the [Marker API](#marker-api)
section for details.

### Marker API

Marker objects are constructed in two stages, firstly your code uses `new` to
create the marker object, passing the supplied `options` to the constructor.
Then, Peaks.js will call your `init()` method to complete the initialization.

#### `marker.constructor(options)`

The constructor typically just stores the `options` for later use.

```javascript
constructor(options) {
  this._options = options;
}
```

#### `marker.init(group)`

The `init` method should create the Konva objects needed to render the
marker and add them to the supplied `group` object.

| Name      | Type                                                      | Description                                 |
| --------- | --------------------------------------------------------- | ------------------------------------------- |
| `group`   | [`Konva.Group`](https://konvajs.org/api/Konva.Group.html) | A container for the marker's Konva objects. |

The following example creates a point marker as a vertical line with a
rectangular handle.

Note that the `x` and `y` coordinates (0, 0) represent the centre of the marker
and the top of the waveform view.

```javascript
class CustomPointMarker {
  constructor(options) {
    this._options = options;
  }

  init(group) {
    const layer = this._options.layer;
    const height = layer.getHeight();

    this._handle = new Konva.Rect({
      x:      -20,
      y:      0,
      width:  40,
      height: 20,
      fill:   this._options.color
    });

    this._line = new Konva.Line({
      points:      [0.5, 0, 0.5, height], // x1, y1, x2, y2
      stroke:      options.color,
      strokeWidth: 1
    });

    group.add(this._handle);
    group.add(this._line);
  }
}
```

The `init` method can also add your own custom event handlers
(e.g., `mouseenter` and `mouseleave`), if needed.

We can add the following code to the end of the `init()` method from above. This
code changes the color of the marker handle when the user hovers the mouse over
the handle.

```javascript
const layer = this._options.layer;

this._handle.on('mouseenter', () => {
  const highlightColor = '#ff0000';
  this._handle.fill(highlightColor);
  this._line.stroke(highlightColor);
  layer.draw();
});

this._handle.on('mouseleave', () => {
  const defaultColor = this._options.color;
  this._handle.fill(defaultColor);
  this._line.stroke(defaultColor);
  layer.draw();
});
```

#### `marker.fitToView()`

The `fitToView` method is called after the waveform view has been resized.
This method should resize the marker using the available space.
This is typically done when the height of the view changes.

```javascript
fitToView() {
  const layer = this._options.layer;
  const height = layer.getHeight();

  this._line.points([0.5, 0, 0.5, height]);
}
```

#### `marker.update(options)`

The `update` method is called when any of the point or segment attributes
have changed, e.g., by calling `point.update()` or `segment.update()`, or
when the marker's time position has changed. You should use this method to
update the marker as needed.

| Name      | Type     | Description                     |
| --------- | -------- | ------------------------------- |
| `options` | `object` | Contains the updated attributes |

```javascript
update(options) {
  // For a point marker:
  if (options.time !== undefined) {
    console.log('Updated point marker time', options.time);
  }

  // For a segment start/end marker:
  if (options.startTime !== undefined && this._options.startMarker) {
    console.log('Updated segment start marker time', options.startTime);
  }

  if (options.endTime !== undefined && !this._options.startMarker) {
    console.log('Updated segment end marker time', options.endTime);
  }

  if (options.labelText !== undefined) {
    console.log('Updated label text', options.labelText);
  }

  if (options.color !== undefined) {
    this._line.stroke(options.color);
  }

  if (options.editable !== undefined) {
    // Show or hide the Konva shapes that draw the marker
    console.log('Updated editable state', options.editable);
  }
}
```

#### `marker.destroy()`

The `destroy` method is called when the marker is removed from the view.
Any Konva objects added to the `group` in `init()` will be destroyed
automatically, so you only need to add a `destroy` method if additional
clean-up is needed.

```javascript
destroy() {
  console.log('Marker destroyed');
}
```

### Layer API

The `PointsLayer` and `SegmentsLayer` objects allow you to obtain information
about the rendering canvas, and to render changes to the marker Konva objects.
Note that `PointsLayer` and `SegmentsLayer` are not `Konva.Layer` objects.
The following methods are provided:

#### `layer.getHeight()`

Returns the height of the layer, in pixels.

#### `layer.draw()`

Konva will usually automatically redraw if you change any shape attributes,
but you can call this function to force a redraw if needed.

## Segment Labels

By default, Peaks.js shows the segment label when the user hovers the mouse
over a segment. The label is a Konva object created by the `createSegmentLabel`
function passed when calling `Peaks.from()`.

### `createSegmentLabel(options)`

The `createSegmentLabel` function returns a Konva object that is shown when the
user hovers the mouse over the segment. This can be used to display information
about a segment, such as its `labelText`.

You can also return `null` from this function if you do not want to display a
segment label.

| Name      | Type            | Description                                                                                                                                    |
| --------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `segment` | `Segment`       | The `Segment` object associated with this label. This provides access to the `startTime`, `endTime`, `color`, and `labelText` attributes, etc. |
| `view`    | `string`        | The name of the view that the label is being created in, either `zoomview` or `overview`.                                                      |
| `layer`   | `SegmentsLayer` | The rendering layer, see [Layer API](#layer-api) for details.                                                                                  |

```javascript
function createSegmentLabel(options) {
  if (options.view === 'overview') {
    return null;
  }

  return new Konva.Text({
    text:       options.segment.labelText,
    fontSize:   14,
    fontFamily: 'Calibri',
    fill:       'black'
  });
}

const options = {
  // Add other options, as needed.
  createSegmentLabel: createSegmentLabel,
};

Peaks.from(options).then((result) => {
  if (result.isErr()) return;
  const instance = result.value;
  // Use the Peaks.js instance here
});
```

## Media Playback

Peaks.js' default media player is based on the
[HTMLMediaElement](https://html.spec.whatwg.org/multipage/media.html#media-elements).
Peaks.js allows you to interface with external media player libraries (such as
[Tone.js](https://tonejs.github.io/) or [Howler.js](https://howlerjs.com/)) by
implementing the `AudioDriver` interface and passing it as the `audio` option.

### AudioDriver Interface

```typescript
interface AudioDriver {
  init(ctx: { events: PeaksEvents }): Promise<void>;
  dispose(): void;
  play(): Promise<void>;
  pause(): void;
  isPlaying(): boolean;
  isSeeking(): boolean;
  getCurrentTime(): number;
  getDuration(): number;
  seek(time: number): void;
  playSegment(options: { segment: Segment; loop: boolean }): Promise<void>;
  setSource(source: AudioSource): Promise<void>;
}
```

Pass an instance via the `audio` option:

```javascript
const options = {
  // Add other options, as needed.
  audio: myAudioDriver
};

Peaks.from(options).then((result) => {
  if (result.isErr()) return;
  const instance = result.value;
  // Use the Peaks.js instance here
});
```

The driver is responsible for dispatching `player.*` events on the
`PeaksEvents` bus exposed via the `init` context. See the [Events](API.md#events)
section for details.

## Time Labels

Peaks.js allows you to customize the timestamp labels shown on the time axis or
next to the playhead. This is achieved by providing `formatPlayheadTime` and
`formatAxisTime` functions in the options passed when calling `Peaks.from()`.

These functions accept the time, as a number, and should return a string,
for example:

```javascript
function formatPlayheadTime(time) {
  // Return time formatted to 2 decimal places
  return time.toFixed(2);
}

function formatAxisTime(time) {
  // Return time as a whole number of seconds
  return String(Math.floor(time));
}

const options = {
  // Add other options, as needed.
  formatPlayheadTime: formatPlayheadTime,
  formatAxisTime: formatAxisTime
};

Peaks.from(options).then((result) => {
  if (result.isErr()) return;
  const peaks = result.value;
  // Use the Peaks.js instance here
});
```

Note that if you pass a `formatPlayheadTime` function, the `timeLabelPrecision`
option and `view.setTimeLabelPrecision()` function are ignored.
