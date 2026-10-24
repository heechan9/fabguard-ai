# Local UI verification on the existing CI service

The owner authorised an already installed browser in an allowed local/CI environment. The scratch environment has no browser executable and the prior official Chromium download failed. Do not repeat that installation or expand preview access.

A test-only Playwright 1.62.1 driver is isolated under the runner temporary directory. Reason: run the already prepared browser checks with preinstalled Chrome/Chromium, recording versions and exact checked-out commit. It is not a runtime/project dependency. Browser downloads and npm lifecycle scripts are disabled. Browser presence is checked before driver installation; no installed browser means the job fails and UI verification remains pending.

The workflow runs on this follow-up branch only, checks out its exact push SHA, uses contents:read, and starts an HTTP server bound to 127.0.0.1. The page request interceptor rejects external origins. There is no public tunnel, access change, merge, deployment or source dataset upload. Evidence consists of synthetic/public page content, screenshots and a result JSON retained as an existing GitHub Actions artifact for 14 days. Artifacts are not proof of visual review.

Planned CSS viewports: 1366x900, 390x844, 360x800. The harness covers malformed contract values, lock/unlock focus, input errors, synthetic null metrics, CSV limits, keyboard navigation and horizontal overflow. Browser execution, generated screenshots and each failure still require inspection. Tests are unexecuted until a concrete workflow run is checked; no CI success alone counts as complete visual validation. Mobile emulation does not establish physical phone or screen reader behaviour.

First run b8e74cef passed all 57 checks using preinstalled Chrome 155.0.8059.39, but visual inspection found the runner fallback fonts had no Korean glyphs. This is an environment evidence limitation, not a product code finding. Before rerunning, install the test-environment-only fonts-noto-cjk package so blocked external font requests still render Korean. No browser installation is added. Move error/filter screenshots to the relevant controls for review.
