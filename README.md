# Peaks.ts

[![npm version](https://img.shields.io/npm/v/@jadujoel/peaks.ts.svg)](https://www.npmjs.com/package/@jadujoel/peaks.ts)
[![npm bundle size](https://img.shields.io/bundlephobia/minzip/@jadujoel/peaks.ts.svg)](https://www.npmjs.com/package/@jadujoel/peaks.ts)

Peaks.ts is a TypeScript-first UI component for displaying and interacting with
audio waveforms in the browser. It is a typed, modernised fork of the BBC's
[peaks.js](https://github.com/bbc/peaks.js) library.

The public API surface is broadly compatible with upstream `peaks.js`, but with
the following differences:

- **Strict TypeScript**: full type definitions are bundled and the codebase is
  written in TypeScript with no `any` escapes in the public API.
- **Promise / `Result` initialisation**: `Peaks.from()` returns
  `Promise<Peaks>`. A `Peaks.tryFrom()` variant returns a
  [`ResultAsync<Peaks, Error>`](https://github.com/supermacro/neverthrow) for
  callers that prefer explicit error values.
- **Typed event bus**: instances expose `peaks.events`, a typed event target
  with `addEventListener` / `removeEventListener` semantics.
- **Pluggable canvas drivers**: the rendering backend is injected. A
  [Konva](https://konvajs.org/) driver ships by default; an experimental
  [Pixi.js](https://pixijs.com/) driver is available and lazily loaded.
- **Pluggable audio drivers**: choose between an `<audio>` /
  `MediaElementAudioDriver` or a Web Audio `ClipNodeAudioDriver` that owns its
  own `AudioBuffer`.
- **No callback-style APIs**: `Peaks.from()` and `peaks.setSource()` are
  Promise-returning. The legacy callback signatures have been removed.

For a list of breaking changes vs. upstream `peaks.js`, see
[doc/migration-guide.md](doc/migration-guide.md).

## Contents

- [Install](#install)
- [Quick start](#quick-start)
- [Drivers](#drivers)
  - [Canvas drivers](#canvas-drivers)
  - [Audio drivers](#audio-drivers)
- [API documentation](#api-documentation)
- [Development](#development)
- [License](#license)

## Install

```bash
npm install @jadujoel/peaks.ts waveform-data konva
# or
bun add @jadujoel/peaks.ts waveform-data konva
```

`konva` and `pixi.js` are both declared as **optional** peer dependencies. Only
install the one(s) you actually use:

| Driver              | Required peer dependency |
| ------------------- | ------------------------ |
| `KonvaCanvasDriver` | `konva`                  |
| `PixiCanvasDriver`  | `pixi.js`                |

`waveform-data` is required at runtime.

## Quick start

```ts
import {
  ClipNodeAudioDriver,
  KonvaCanvasDriver,
  Peaks,
} from "@jadujoel/peaks.ts";

const audioContext = new AudioContext();

const buffer = await fetch("/sample.mp3")
  .then((r) => r.arrayBuffer())
  .then((a) => audioContext.decodeAudioData(a));

const peaks = await Peaks.from({
  audio: ClipNodeAudioDriver.from({ buffer, context: audioContext }),
  driver: KonvaCanvasDriver.default(),
  zoomview: { container: document.getElementById("zoomview-container")! },
  overview: { container: document.getElementById("overview-container")! },
  zoomLevels: [128, 256, 512, 1024, 2048, 4096],
  keyboard: true,
});

peaks.events.addEventListener("player.timeupdate", (event) => {
  console.log(event.time);
});

peaks.player.play();
```

`Peaks.tryFrom()` is the same call expressed as a `ResultAsync`:

```ts
const result = await Peaks.tryFrom(config);
if (result.isErr()) {
  console.error(result.error);
  return;
}
const peaks = result.value;
```

## Drivers

### Canvas drivers

The canvas backend is selected at construction time by passing a
`CanvasDriver` to `Peaks.from({ driver })`. Two implementations are bundled:

- **`KonvaCanvasDriver`** (default). Use `KonvaCanvasDriver.default()`. Pulls
  in `konva` synchronously.
- **`PixiCanvasDriver`** (experimental). Use
  `await PixiCanvasDriver.create()`. The Pixi backend is loaded via dynamic
  `import("pixi.js")` so it is only fetched when actually used. To take
  advantage of this in a bundle, enable code splitting in your bundler
  (`splitting: true` in Bun, `build.rollupOptions.output.manualChunks` in
  Vite, etc.).

If `driver` is omitted, `Peaks.from()` falls back to
`KonvaCanvasDriver.default()`.

### Audio drivers

Audio playback is also pluggable, via `audio` on `PeaksConfiguration`. Two
implementations are bundled:

- **`ClipNodeAudioDriver`** — Web Audio. Owns an `AudioBuffer` and uses the
  [`@jadujoel/web-audio-clip-node`](https://www.npmjs.com/package/@jadujoel/web-audio-clip-node)
  package internally. Construct from a buffer:

  ```ts
  ClipNodeAudioDriver.from({ buffer, context });
  ```

  or from a URL:

  ```ts
  ClipNodeAudioDriver.from({ url: "/sample.mp3", context });
  ```

  When the driver owns the buffer, `webAudio.audioBuffer` /
  `webAudio.audioContext` on the Peaks options can be omitted — they are
  filled in automatically by `Peaks.from()` and `peaks.setSource()`.

- **`MediaElementAudioDriver`** — wraps an `HTMLMediaElement`. Used
  automatically when no `audio` driver is provided and `mediaElement` is set
  in the options.

If `audio` is omitted, the legacy `mediaElement` / `webAudio` options are used
to derive a default driver.

## API documentation

- [doc/API.md](doc/API.md) — full public API reference (configuration,
  methods, events).
- [doc/customizing.md](doc/customizing.md) — custom point/segment markers,
  segment labels, and player implementations.
- [doc/migration-guide.md](doc/migration-guide.md) — breaking changes vs.
  upstream `peaks.js`.
- [doc/faq.md](doc/faq.md) — frequently asked questions.

## Development

This repository uses [Bun](https://bun.sh) for installs, scripts, and the
build. Common commands:

```bash
bun install               # install workspace deps
bun run lint              # biome check
bun run typecheck         # tsc --noEmit on src + tests
bun run test              # vitest unit + component tests
bun run test:e2e          # playwright end-to-end tests
bun run build             # build dist/peaks.esm.js
bun run example           # serve workspaces/main-example on :8090
bun run test:all          # lint + typecheck + tests + build + e2e
```

Source layout (top level):

- `src/` — library source.
  - `src/driver/konva` and `src/driver/pixi` — canvas drivers.
  - `src/driver/audio/{clip-node,media-element}` — audio drivers.
  - `src/waveform/` — view, builder, layers, axis, shapes.
- `workspaces/main-example/` — interactive demo that exercises every major
  feature against both canvas drivers. See its
  [README](workspaces/main-example/README.md).
- `e2e/` — Playwright end-to-end tests.
- `test/` — unit and component tests (Vitest, browser mode).
- `doc/` — user-facing documentation.

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## License

LGPL-3.0. See [COPYING](COPYING).
