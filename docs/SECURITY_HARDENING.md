# Security configuration

The 2026-11-23 hardening change excludes py7zr versions before 1.1.3, pins
external workflow actions to reviewed tag commit SHAs, and adds weekly
Dependabot checks for Python and GitHub Actions. CodeQL analyzes Python,
JavaScript/TypeScript and workflow definitions on PRs, main pushes and weekly.
Dependency resolution is environment-dependent; these bounds are not a lockfile
or evidence that an existing installation has been updated.

Vercel serves a common Content-Security-Policy and anti-framing, MIME sniffing,
referrer and device-permission headers. Scripts and data fetches use the same
origin. Google Fonts remain permitted. Inline styles are allowed for existing
3D/UI style updates; inline scripts and eval are not allowed. Existing stricter
per-page meta policies still apply alongside the response policy. The homepage
retry button uses an event listener so it also works with this policy.
Media is limited to Blob URLs for the existing local SMT recording preview.

The test extra includes `tomli` only on Python 3.10 so the security contract
parses the actual TOML configuration on every supported Python version. Python
3.11 and newer use the standard-library `tomllib`; runtime dependencies do not
change. Action pins are commit SHAs, dereferencing annotated tags where needed.

Validate configuration changes with:

```sh
PYTHONPATH=src python -m unittest tests.test_security_configuration -v
node --test tests/web/*.test.mjs
```

Run the existing full Python and Linux browser workflows before merging.
After deployment, verify response headers and the homepage, saved evidence,
review JSON import/export and 3D routes in a real browser. Repository settings
(Dependabot enablement, main protection and Actions policies) are independent
of the files in this change; inspect their saved state in GitHub Settings.
