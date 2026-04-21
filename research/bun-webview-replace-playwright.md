# Bun.WebView 1.3.12: replacing Playwright in peaks.ts

Date: 2026-04-21
Bun version surveyed: 1.3.12
Target to replace: `@playwright/test` 1.54.2 and `playwright` 1.54.2 (devDependencies)

## 1. What Bun.WebView is

`Bun.WebView` is a headless browser automation API **built into the Bun runtime** (shipped in 1.3.12). It exposes a Playwright-flavored API (`navigate`, `click`, `type`, `press`, `screenshot`, `evaluate`, selector-based auto-wait) with two backends sharing a single JS API:

- **WebKit** — uses the system `WKWebView` on macOS. No download, no Playwright browser cache, zero dependencies. Requires macOS.
- **Chrome** — drives Chrome/Chromium over the Chrome DevTools Protocol (CDP). Cross-platform (macOS/Linux). Auto-detects installed Chrome, falls back to `BUN_CHROME_PATH`, `$PATH`, standard install locations, and the Playwright cache.

Firefox is **not supported** — this is the first concrete gap versus the current `playwright.config.ts` which runs against chromium, firefox, and webkit.

All input (click, type, press, scroll) is dispatched as **OS-level events with `isTrusted: true`**, the same as a real user. Selector-based methods auto-wait for actionability (attached, visible, stable for two frames, topmost at center).

## 2. Complete API surface

### Construction

```ts
const view = new Bun.WebView({
  width: 1280,                       // 1–16384, default 800
  height: 720,                       // 1–16384, default 600
  url: "http://127.0.0.1:8080/index.html", // optional: navigate on create
  backend: "webkit",                 // "webkit" | "chrome" | { type, path, argv, ... }
  console: globalThis.console,       // or (type, ...args) => void
  dataStore: { directory: "./.profile" }, // or "ephemeral"
  headless: true,                    // only `true` is supported
});

// Automatic cleanup with explicit resource management:
await using view = new Bun.WebView({ /* ... */ });
```

### Navigation

| Method | Returns | Notes |
| --- | --- | --- |
| `navigate(url)` | `Promise<void>` | resolves on page `load` event |
| `goBack()` / `goForward()` / `reload()` | `Promise<void>` | |
| `view.onNavigated = (url, title) => {...}` | callback | |
| `view.onNavigationFailed = (err) => {...}` | callback | |

### Input

| Method | Playwright equivalent |
| --- | --- |
| `click(x, y, opts?)` / `click(selector, opts?)` | `page.mouse.click()` / `locator.click()` |
| `type(text)` | `locator.fill()` / `keyboard.type()` (dispatches `InsertText`; fires `beforeinput`/`input`, **not** `keydown`/`keyup`) |
| `press(key, { modifiers })` | `keyboard.press("Shift+ArrowLeft")` |
| `scroll(dx, dy)` | `mouse.wheel()` |
| `scrollTo(selector, { block })` | `locator.scrollIntoViewIfNeeded()` |
| `resize(width, height)` | viewport resize |

`ClickOptions`: `button: 'left' | 'right' | 'middle'`, `clickCount: 1 | 2 | 3`, `modifiers: ('Shift' | 'Control' | 'Alt' | 'Meta')[]`, `timeout` (selector form only).

`VirtualKey`: `Enter`, `Tab`, `Space`, `Backspace`, `Delete`, `Escape`, `Arrow{Left,Right,Up,Down}`, `Home`, `End`, `PageUp`, `PageDown`.

### JavaScript evaluation

```ts
const title = await view.evaluate("document.title"); // JSON-serialized, promises auto-awaited
```

This is the workhorse — every Playwright `page.evaluate(fn)` and `locator.evaluate(fn)` maps to a string-serialized expression passed to `view.evaluate`. Unlike Playwright, you **cannot pass a function closure**; you must serialize the expression. Closures must be rewritten as IIFE strings or template-interpolated.

### Screenshots

```ts
const png    = await view.screenshot();                                  // Buffer, PNG by default
const jpeg   = await view.screenshot({ format: "jpeg", quality: 90 });
const webp   = await view.screenshot({ format: "webp", quality: 75 });   // Chrome only
const b64    = await view.screenshot({ encoding: "base64" });
```

### Instance properties

`view.url` (readonly), `view.title` (readonly), `view.loading` (readonly).

### Lifecycle & concurrency

- `view.close()` — synchronous, idempotent.
- `Bun.WebView.closeAll()` — SIGKILLs all browser subprocesses.
- One op of each kind in flight per view: one navigate/reload, one `evaluate`, one `screenshot`, one `cdp`, one "simple" op (click/type/press/scroll/scrollTo/resize). Overlapping throws `ERR_INVALID_STATE` synchronously — just `await` each call. Different `WebView` instances run in parallel.

### Raw CDP (Chrome backend only)

```ts
await view.cdp("Network.enable");
view.addEventListener("Network.responseReceived", (e) => console.log(e.data.response.status));
await view.cdp("Emulation.setUserAgentOverride", { userAgent: "MyBot/1.0" });
```

Needed for anything the high-level API doesn't expose (network interception, cookies, geolocation, request mocking). **Not available on the WebKit backend.**

## 3. Gap analysis vs. Playwright features used in peaks.ts

Current tests in [e2e/demo-smoke.spec.ts](../e2e/demo-smoke.spec.ts) rely on:

| Playwright feature | Bun.WebView status | Workaround |
| --- | --- | --- |
| `page.goto(url)` | `view.navigate(url)` | 1:1 |
| `page.locator(sel).click()` | `view.click(sel)` | 1:1; auto-waits for actionability |
| `page.locator(sel).fill(value)` | `click(sel)` then `type(value)` | two steps; `type` does not clear existing content |
| `expect(locator).toBeVisible()` | ❌ no assertion library | poll `view.evaluate` for element + rect + `offsetParent`; or implement a small helper |
| `expect(locator).toHaveValue()` | ❌ | `await view.evaluate("document.querySelector('...').value")` then compare |
| `page.keyboard.press("Shift+ArrowLeft")` | `view.press("ArrowLeft", { modifiers: ["Shift"] })` | 1:1, different shape |
| `page.evaluate(async () => { ... })` with closures | ❌ closures not supported | serialize to string/IIFE (see §5) |
| `page.on("console", ...)` | `new Bun.WebView({ console: (type, ...args) => ... })` | works; types are strings, not `ConsoleMessage` objects |
| `page.on("pageerror", ...)` | ❌ no direct API | inject `window.addEventListener("error", ...)` in the page via `evaluate`, then poll from the test |
| Firefox project | ❌ not supported | drop Firefox, or keep Playwright just for Firefox |
| `trace: "retain-on-failure"` | ❌ no trace viewer | `screenshot()` on failure; no time-travel debugging |
| `webServer` auto-start | ❌ | spawn `bun run start` via `Bun.spawn` in a test setup hook |
| Test runner, `test()`, `expect()` | ❌ | use `bun test` — which has `describe/test/expect` but is a separate runner |
| `reuseExistingServer` | ❌ | implement with a port check |
| HTML reporter | ❌ | `bun test` has plain output / `--reporter` flags |

**The biggest missing pieces** are assertion auto-retry (`toBeVisible`, `toHaveValue`) and `pageerror` capture. Both are straightforwardly polyfillable on top of `evaluate`.

## 4. Migration strategy for this repo

### Option A — full swap (drop Firefox, drop Playwright)

Pros: one runtime, zero install (WebKit on macOS / bundled Chrome auto-detect on Linux CI), faster startup, no Playwright browser cache in CI.
Cons: lose Firefox coverage, lose trace viewer, write ~50 lines of test helpers, rewrite `page.evaluate(fn)` closures into strings.

### Option B — hybrid (Playwright for Firefox only, Bun.WebView for Chrome + WebKit)

Pros: keep Firefox. Cons: two toolchains; little benefit.

### Option C — keep Playwright

Recommended only if Firefox coverage matters. Bun.WebView doesn't eliminate a real pain point in this repo today — Playwright already works and is already wired to CI. The win is install size / cold-start time, not correctness.

**Recommendation:** Option A if Firefox coverage isn't load-bearing. The existing 6 tests are small and well-structured; a rewrite is ~1 day of work including helpers.

### Required helpers

To preserve the ergonomics of the current tests, build a tiny wrapper (~40 lines):

```ts
// e2e/helpers/expect-visible.ts
export async function expectVisible(
  view: Bun.WebView,
  selector: string,
  timeoutMs = 5000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const visible = await view.evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && el.offsetParent !== null;
    })()`);
    if (visible) return;
    await Bun.sleep(50);
  }
  throw new Error(`Element not visible: ${selector}`);
}
```

Similar one-liners cover `expectValue`, `expectEqualArrays`, and a `pageerror` collector that installs `window.addEventListener("error", e => (window.__errors ??= []).push(e.message))` after every `navigate()`.

## 5. Concrete rewrite: smoke test

Below is the current first test rewritten against `Bun.WebView`. It demonstrates the rough shape — this would be driven by `bun test` rather than `playwright test`.

```ts
// e2e/demo-smoke.test.ts
import { afterAll, beforeAll, expect, test } from "bun:test";
import { expectVisible } from "./helpers/expect-visible";

let server: ReturnType<typeof Bun.spawn> | undefined;
let view: Bun.WebView;

beforeAll(async () => {
  server = Bun.spawn(["bun", "run", "start"], { stdout: "pipe", stderr: "pipe" });
  // poll 127.0.0.1:8080 until ready
  for (let i = 0; i < 50; i++) {
    try { await fetch("http://127.0.0.1:8080/"); break; } catch { await Bun.sleep(100); }
  }
});

afterAll(() => { server?.kill(); Bun.WebView.closeAll(); });

test("precomputed waveform demo loads without runtime errors", async () => {
  await using view = new Bun.WebView({
    width: 1280,
    height: 720,
    backend: "webkit",
    console: (type, ...args) => { if (type === "error") consoleErrors.push(String(args[0])); },
  });

  const consoleErrors: string[] = [];

  await view.navigate("http://127.0.0.1:8080/index.html");

  // install pageerror collector since Bun.WebView has no direct pageerror event
  await view.evaluate(`
    window.__pageErrors = [];
    window.addEventListener("error", e => window.__pageErrors.push(e.message));
    window.addEventListener("unhandledrejection", e => window.__pageErrors.push(String(e.reason)));
  `);

  await expectVisible(view, '#controls button[data-action="zoom-in"]');
  await expectVisible(view, "#zoomview-container .konvajs-content canvas");
  await expectVisible(view, "#overview-container .konvajs-content canvas");

  await view.click('button[data-action="zoom-in"]');
  await view.click('button[data-action="zoom-out"]');

  const pageErrors = await view.evaluate("window.__pageErrors") as string[];
  expect(pageErrors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
```

### Notable translations

- `page.locator('input').fill("Renamed Segment")` → `await view.click(sel); await view.type("Renamed Segment")`. Note: `type` does **not clear** first; if the field has prior content, call `view.press("a", { modifiers: ["Meta"] })` then `view.press("Delete")` first.
- `page.keyboard.press("Shift+ArrowLeft")` → `view.press("ArrowLeft", { modifiers: ["Shift"] })`.
- `page.evaluate(async () => { const m = await import("/peaks.esm.js"); ... })` — the closure form is gone. You can still do it, but the body must be a serialized string. For multi-statement test bodies, this gets ugly fast; consider moving the logic into a page script (`<script type="module">`) loaded by the demo page and calling a top-level function via `evaluate`.

## 6. CI implications

- **No Playwright browser download step.** Today, CI must install the Playwright browser cache (several hundred MB). With Bun.WebView:
  - macOS runners: WebKit backend uses system WKWebView → zero install.
  - Linux runners: Chrome backend needs Chrome/Chromium on the runner. GitHub's `ubuntu-latest` ships Chrome preinstalled at `/usr/bin/google-chrome`, so the existing [.github/workflows/e2e.yml](../.github/workflows/e2e.yml) can drop the `npx playwright install` step.
- **Bun version pin.** CI must use Bun ≥ 1.3.12. Earlier versions will fail with `Bun.WebView is undefined`.
- **Firefox coverage disappears** unless Option B is chosen.

## 7. Third-party alternatives (if Bun.WebView falls short)

Both exist and predate the built-in:

- `webview-bun` (tr1ckydev) — Bun bindings around the `webview` C library. Oriented toward building desktop GUIs, **not** automation. Wrong tool for replacing Playwright.
- `bunview` (theseyan) — "feature-complete webview library for Bun." Also GUI-oriented.

Neither is an automation framework. For replacing Playwright, Bun.WebView is the only in-ecosystem option.

## 8. Bottom line

Bun.WebView 1.3.12 **can** replace Playwright for the current peaks.ts e2e tests if:

1. Firefox coverage is not required (biggest blocker).
2. You're willing to write ~40 lines of assertion helpers (`expectVisible`, `expectValue`, pageerror polyfill).
3. You accept no trace viewer / no HTML report.
4. All `page.evaluate(fn)` closures are rewritten as strings or moved into the demo page.

The payoff is: a single runtime, no Playwright browser cache, faster CI cold-start, and no extra devDependencies. For this repo's 6 tests, that trade is reasonable but not overwhelmingly compelling — Playwright is already wired and working. Revisit if (a) CI install time becomes painful, or (b) the test suite grows and the closure/serialization overhead becomes acceptable in exchange for the install win.

## Sources

- [Bun v1.3.12 release blog](https://bun.com/blog/bun-v1.3.12)
- [Bun.WebView docs](https://bun.com/docs/runtime/webview)
- [Bun.WebView API reference](https://bun.com/reference/bun/WebView)
- [What's New in Bun v1.3.12 (Onix React, Medium)](https://medium.com/@onix_react/whats-new-in-bun-v1-3-12-ae2637068b45)
- [oven-sh/bun WebView API (DeepWiki)](https://deepwiki.com/oven-sh/bun/9.10-webview-api)
