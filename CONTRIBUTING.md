# Contributing

Thank you for your interest in Peaks.ts!

Peaks.ts is a TypeScript fork of the BBC's
[peaks.js](https://github.com/bbc/peaks.js). Bug fixes and feature
contributions are welcomed. If you're thinking of fixing a bug or writing a
new feature, please first read the following guidelines.

## Asking questions

* Please check the [Frequently Asked Questions](doc/faq.md) before opening an
  issue.

## Making changes

* Before creating a pull request, please discuss the change you want to make
  by raising an issue on
  [github.com/jadujoel/peaks.ts](https://github.com/jadujoel/peaks.ts).

* Pull requests should focus on a single change. Avoid combining unrelated
  changes in a single PR.

* Please don't change the `version` field in `package.json` or update
  `CHANGELOG.md` in feature branches — those are touched only when preparing
  a release.

* Please follow the existing coding conventions:
  * Run `bun run lint` (Biome) and fix any reported issues.
  * Run `bun run typecheck` and ensure there are no TypeScript errors.
  * Don't suppress lint warnings — fix the underlying issue.
  * Use arrow functions instead of `.bind(this)`.
  * Prefer dependency injection over mocking in tests.

* Please add tests for your change:
  * Unit / component tests live in `test/` and run with `bun run test`
    (Vitest, browser mode).
  * End-to-end tests live in `e2e/` and run with `bun run test:e2e`
    (Playwright).
  * `bun run test:all` runs lint + typecheck + unit tests + build + e2e and
    is a good pre-PR check.

* When fixing a bug, add an end-to-end (or component) test that fails before
  the fix and passes after, to prevent regressions.

* For commit messages, please follow
  [these guidelines](https://chris.beams.io/posts/git-commit/). Don't use
  [Conventional Commits](https://www.conventionalcommits.org/) style. We may
  edit commit messages for consistency when merging.

## Local development

This repository uses [Bun](https://bun.sh) as its package manager and task
runner. After cloning:

```bash
bun install
bun run build              # produce dist/peaks.esm.js
bun run example            # serve the demo on http://127.0.0.1:8090
```

The interactive demo in [workspaces/main-example](workspaces/main-example) is
the easiest way to validate UI changes against both the Konva and Pixi
canvas drivers.

### Preparing a new release

When publishing a new release version, create a single commit on `master`
with the following changes only:

* Increment the `version` field in `package.json`.
* Describe the new features in this release in `CHANGELOG.md`.
* Tag this commit using the form `vX.Y.Z` and push the commit using
  `git push origin master --tags`.
* In GitHub, [create a Release](https://github.com/jadujoel/peaks.ts/releases/new)
  from this tag.
* If this is a beta release, the tag and release names should have the form
  `vX.Y.Z-beta.N`.
* Creating a Release triggers a GitHub Actions workflow that publishes to
  npm. This will publish either a `latest` or `beta` release based on the
  tag name.
