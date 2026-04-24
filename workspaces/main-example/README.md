# `@peaks/main-example`

Comprehensive showcase for [`@jadujoel/peaks.ts`](../../) that exercises the
**Konva** and **Pixi** canvas drivers (selectable at runtime) together with
the **ClipNode audio driver**, and exposes UI controls for every "bells and
whistles" feature Peaks supports.

The active canvas driver can be chosen via the on-page selector or via the
`?driver=konva|pixi` URL parameter (the choice is persisted in
`localStorage`).

## Run

```bash
# from the repository root
bun install                # link the workspace
bun run build              # build the library so dist/peaks.esm.js exists

bun run example            # builds + serves on http://127.0.0.1:8090
# or, equivalently:
bun --filter @peaks/main-example dev
```

Open <http://127.0.0.1:8090/>.

To produce a static build only:

```bash
bun run example:build
# outputs to workspaces/main-example/dist/main.js
```

## What each control demonstrates

| Group       | Controls                                          | Peaks API surface                                                                           |
| ----------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Playback    | Play / Pause / Stop, time readout                 | `peaks.player.play/pause/seek`, `player.timeupdate` event                                   |
| Loops       | Loop file, Stop loop, segment-row Loop button     | `peaks.player.playSegment(segment, true)`                                                   |
| Zoom        | Zoom in / out, Level select                       | `peaks.zoom.zoomIn/zoomOut/setIndex`                                                        |
| Display     | Auto-scroll, Scrollbar, Overview, drag modes      | `zoomview.enableAutoScroll`, `setWaveformDragMode`, `setSegmentDragMode`, `views.*Overview` |
| Colors      | Waveform / played / axis label / axis grid        | `view.setWaveformColor`, `setPlayedWaveformColor`, `setAxisLabelColor`, `setAxisGridlineColor` |
| Amplitude   | Scale slider (0.1 – 4)                            | `view.setAmplitudeScale`                                                                    |
| Channels    | Mono / Multi-channel                              | `peaks.setSource({ webAudio: { multiChannel } })`                                           |
| Size        | Width / Height                                    | CSS custom properties + `window.dispatchEvent('resize')`                                    |
| Segments    | Add at playhead, list, Loop, Remove               | `peaks.segments.add/getSegments/removeById`                                                 |
| Points      | Add at playhead, list, Jump, Remove               | `peaks.points.add/getPoints/removeById`                                                     |

## Architecture notes

* `src/main.ts` boots the page: pre-fetches and decodes the audio buffer,
  instantiates `ClipNodeAudioDriver` and `PixiCanvasDriver`, and calls
  `Peaks.from`.
* `src/controls.ts` wires every DOM control. All methods are arrow functions
  to preserve `this` without `bind` (per repository conventions).
* `src/loop-controller.ts` owns loop state. Whole-file loop is implemented as
  a transient segment over `[0, duration]` with `loop = true`, since
  `ClipNodeAudioDriver` only exposes the loop flag via `playSegment`.
* `src/dom.ts` provides typed `getElementById`-style helpers that throw on
  HTML/JS drift.
* `build.ts` runs `Bun.build` with `splitting: true`. `pixi.js` is
  externalised and resolved at runtime via the importmap in `index.html` —
  this mirrors the lazy-driver bundling strategy described in
  [the `splitting` note in repo memory](#).
* `serve.ts` is a tiny `Bun.serve` static server. It rebuilds on startup; for
  iterative work, just refresh the page after re-running `bun run example`.

## E2E coverage

`e2e/main-example.spec.ts` boots the page through Playwright's `webServer`
config (the second entry in `playwright.config.ts`) and round-trips every
major control group.
