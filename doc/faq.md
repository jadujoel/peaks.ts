# Peaks.js Frequently Asked Questions

## Clicking to seek the waveform doesn't work, it always seeks back to the beginning

This problem is seen in Chromium based browsers. The usual cause is if you're serving the audio or video file from a web server that does not support [HTTP range requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Range_requests). See [this Chrome issue](https://bugs.chromium.org/p/chromium/issues/detail?id=973357) for more detail.

Most commonly, this happens with Python's `http.server` module, which does not support range requests (see [this issue](https://github.com/python/cpython/issues/86809)). The HTTP server should reply with `206 Partial Content` status in response to a range request. If you're using Python, we suggest installing an alternative HTTP server, such as
[rangehttpserver](https://pypi.org/project/rangehttpserver/).

## Custom markers don't work, they cannot be dragged

When using the Konva canvas driver, this problem is most often caused by
having more than one copy of the `konva` dependency in your JavaScript
bundle. Make sure your bundler de-duplicates `konva` and that the same
instance is shared between Peaks.ts and your custom marker code.

The published `dist/peaks.esm.js` declares `konva`, `pixi.js`, and
`waveform-data` as external — they are loaded from your application's
`node_modules`, so there is only ever one copy.

## How do I test a pre-release build?

The best way to test a pre-release build in your own project is to clone the
repo, check out the branch you want to use, and build locally:

```
git clone git@github.com:jadujoel/peaks.ts
cd peaks.ts
bun install
bun run build
```

Then link or copy the built `dist/` folder into your project. With Bun /
npm / pnpm you can use the workspace's `package.json` directly via a local
path dependency:

```jsonc
{
  "dependencies": {
    "@jadujoel/peaks.ts": "file:../peaks.ts"
  }
}
```
