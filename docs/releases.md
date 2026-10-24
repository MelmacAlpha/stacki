# Releasing Desktop, Studio, and create-stacki

These are separate publication paths. A successful `Check` run publishes nothing:

- A version tag starts `.github/workflows/release.yml`. Desktop installers, Linux install checks,
  and the Studio browser test must finish before the draft release becomes public.
- `.github/workflows/publish-create-stacki.yml` is manually dispatched from the same tested tag.
  See [create-stacki publication](./create-stacki.md) for authentication and registry verification.

Run the fast checks and complete regression suite locally before pushing. Also run Studio's
`npm run verify` and `npm run test:browser` against a disposable fixture workspace before tagging:
the Desktop regression gate does not run that separate Studio browser scenario.

Use an isolated checkout when other tasks are editing the working directory. Match the root,
Studio, Studio release manifest, and npm starter versions. Never move an existing release tag to
include later changes.

## 0.1.78 updates

- Merge review now opens in a wider, editable final-code view. Branch-colored highlights show
  where each change came from, with independent choices for text and attributes, manual overrides,
  and undo/redo. Automatic merging still combines compatible edits; stale reviews are rejected
  before they can overwrite newer work.
- Branches have distinct colors throughout the branch list, commit destination, and history graph.
  Commit controls clearly identify the destination branch while the graph preserves real ancestry.
- Merge confirmation has cleaner spacing and shorter copy.
- Content fields preserve the caret when deleting spaces, so Backspace continues editing where
  expected instead of jumping to the beginning.

### 0.1.77 release validation

The 0.1.77 release was stopped before publication after Windows CI exposed CRLF conflict markers
being treated as ordinary source. A local reproduction with `core.autocrlf=true` failed the same
real-Git merge test. The parser now accepts CRLF marker endings while retaining source line endings;
regression checks cover both Git conversion modes, exact output, and unclosed markers.

An Ubuntu check also read a popup before its exit timer removed it. The browser probe now waits
for bounded popup presence/removal instead of assuming a fixed sleep is enough. This scheduler
race did not reproduce locally; the strengthened probe passes locally and still runs in CI.
The replacement is 0.1.78; the existing 0.1.77 tag and unpublished draft are retained for diagnosis.

## 0.1.76 updates

- Astro `.map()` callbacks recognize async, function, block, typed, destructured, and referenced
  forms while preserving source and exposing their markup as editable elements.
- Optional content fields use blue reset labels: Option-click to clear, or click and choose Reset.
- Project startup shows one loading indicator while dependencies and the preview are starting.
- [PR #54](https://github.com/flowtricks/stacki/pull/54): Project dependencies and Cloudflare's
  Wrangler install use the site's package manager, preferring `package.json` over its lockfile.
  Cancelling Cloudflare sign-in lets installation finish, and pnpm installs tolerate blocked
  dependency build scripts while keeping those scripts blocked. The sign-in dialog keeps one
  screen through installation, browser sign-in, and retry.
- [PR #55](https://github.com/flowtricks/stacki/pull/55): Start from Astro now asks where the site
  should go, then lets you name it and preview its folder, matching Start from Lumos. Both flows
  share name validation and improved label spacing. Failed Astro creation removes its new folder
  only when it is still empty, so retrying the same name works without deleting generated files.
- The welcome screen uses folder, GitHub, Lumos, and Astro icons with concise action labels.
  Dropdowns expand from their buttons as one white surface and animate closed before opening
  the next dialog, with reduced-motion support.

## Learn from publishing failures

Whenever a GitHub release or publishing workflow fails, inspect the failure before retrying.
Reproduce the cause locally whenever possible, then add or improve a local regression test that
fails for that cause and passes after the fix. Run the regression test and the required local
release checks before pushing again. Include the regression coverage in the fix so future releases
catch the same problem before reaching GitHub.

Match the conditions that caused the failure: a clean checkout, the Git hook environment, the
affected operating system, or the packaged installation. Prefer deterministic reproduction over
repeated retries, longer timeouts, or weakened assertions. For timing failures, synchronize on the
actual event or inject the failing condition instead of relying on a lucky test run.

Some failures depend on external services, signing, authentication, or hosted runner infrastructure.
When a local test cannot reasonably reproduce the cause, document why, record the verification
that is possible, and keep the required remote check. Never skip a gate to make publishing succeed.

## Browser tests and animated popups

Shared popups remain mounted while their close animation runs, and consume outside clicks during
that time. After closing a popup, wait for that popup to detach before clicking another control.
Do not use an arbitrary sleep or weaken the assertion.

In the 0.1.64 release, the Studio browser scenario closed the account menu and immediately clicked
`Expand all`. The closing popup consumed that click, leaving the navigator collapsed. The test
then timed out looking for Heading, even though the component existed. Waiting for
`.account-popover` to detach fixed the scenario.

## 0.1.64 recovery record

The tested release tag points to `6903fb2825006cd79eff99bfbacae2fd51a3b38c`. All three platform
builds, Linux installation checks, and Studio's compilation, lint, formatting, and unit tests passed
in GitHub Actions. The browser scenario reproduced locally against that exact source. After the
test-only popup wait was added, the complete browser scenario passed against the same release.

The existing Desktop installers were preserved. The Studio bundle built from the tested tag was
uploaded, all platform update metadata and installer assets were verified, and the draft was
published as the latest release. No application code or published version tag was changed.

The npm workflow separately failed authentication after passing its tests and building the package.
The maintainer authenticated a local publication of the exact-tag package after a fresh installation
smoke test. The registry's package checksum matched the tested tarball, and both `dist-tags.latest`
and the downloaded CLI reported 0.1.64.

The original failed workflow runs remain red; publishing manually does not rewrite their history.
Confirm live availability through the latest GitHub release and npm registry, rather than inferring
it from workflow badges. Do not bypass an unresolved application failure to publish a draft.
