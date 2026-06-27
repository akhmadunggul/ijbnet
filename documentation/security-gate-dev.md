# IJBNet Dependency Security Gate — Development Documentation

**Version:** v0.9.5  
**Author:** Joshua Matusso  
**Date:** 2026-06-27  
**Status:** Production

---

## Overview

IJBNet stores highly sensitive personal data — biometric photos, NIK (national identity numbers), bank account details, and employment histories for Indonesian SSW candidates. Ensuring that the platform's dependencies do not introduce known vulnerabilities is a compliance obligation under **UU PDP** and a basic security hygiene requirement.

Prior to v0.9.5, the project had two CI security mechanisms:
- **Strix AI** (`.github/workflows/security-scan.yml`): static application security testing (SAST) — scans source code for insecure patterns like SQL injection, XSS, hardcoded secrets.
- **Dependabot** (`.github/dependabot.yml`): automated PRs for dependency updates — but only for the `github-actions` package ecosystem, not npm.

Neither of these caught **known CVEs in npm dependencies** (Software Composition Analysis, or SCA). The Vulnerability Management Dashboard introduced in v0.9.4 revealed 65 open findings — 30 High, 32 Medium, 3 Low — across the three workspaces. Without a CI gate, nothing prevented new vulnerabilities from entering the codebase through future package upgrades or newly published advisories.

The security gate added in v0.9.5 closes this gap with two complementary mechanisms.

---

## Architecture

```
Pull Request / Push to main
          │
          ▼
┌─────────────────────────────┐
│  dependency-security-gate   │  .github/workflows/dependency-security-gate.yml
│  (GitHub Actions workflow)  │
└─────────────────────────────┘
          │
          ├─ 1. Generate SBOM ──► cdxgen reads pnpm-lock.yaml
          │                        outputs sbom-ci.cdx.json (CycloneDX JSON v1.6)
          │
          ├─ 2. Grype scan ─────► reads sbom-ci.cdx.json
          │                        outputs grype-ci.json (JSON)
          │
          ├─ 3. Gate A ─────────► any Critical finding? → FAIL (zero tolerance)
          │
          ├─ 4. Gate B ─────────► new (pkg, version, CVE) tuples vs
          │                        documentation/grype-report.json baseline?
          │                        → High/Critical new finding? FAIL
          │                        → Medium/Low new finding? WARN (PR comment only)
          │
          ├─ 5. Artifacts ──────► upload sbom-ci.cdx.json + grype-ci.json (30d)
          │
          └─ 6. PR comment ─────► markdown table of new findings (if any)


Weekly schedule (Monday 02:00 UTC)
          │
          └─ same pipeline, no PR context → catches newly published CVEs
             even when no packages changed


Dependabot
          │
          ├─ npm / "/"                → root workspace security PRs
          ├─ npm / "/apps/backend"    → backend security PRs
          └─ npm / "/apps/frontend"   → frontend security PRs
```

---

## Components

### 1. `dependency-security-gate.yml`

**File:** `.github/workflows/dependency-security-gate.yml`

#### Triggers

```yaml
on:
  pull_request:
    branches: [main]
    paths:
      - '**/package.json'
      - 'pnpm-lock.yaml'
  push:
    branches: [main]
    paths:
      - '**/package.json'
      - 'pnpm-lock.yaml'
  schedule:
    - cron: '0 2 * * 1'   # Weekly, Monday 02:00 UTC
```

The `paths` filter is critical — without it, the workflow would trigger on every PR (including pure documentation changes), wasting 2–3 minutes of CI time per run. The weekly `schedule` is the safety net: even if no packages change for months, the gate re-scans against an updated Grype vulnerability database that may have new CVE entries.

#### Step 1 — Generate SBOM

```bash
npx --yes @cyclonedx/cdxgen \
  -t js \
  -o sbom-ci.cdx.json \
  --project-name ijbnet \
  --project-version "$VERSION"
```

`@cyclonedx/cdxgen` is invoked via `npx` (no installation step needed). It reads the `pnpm-lock.yaml` in the repo root to enumerate all components — both direct and transitive — across all three workspaces. No `pnpm install` is needed because cdxgen reads the lockfile directly.

The output is a **CycloneDX JSON v1.6** file. This is the same format used for the committed SBOM in `documentation/sbom.cdx.json`, making them directly comparable.

#### Step 2 — Install and Run Grype

```bash
curl -sSfL https://raw.githubusercontent.com/anchore/grype/main/install.sh \
  | sh -s -- -b /usr/local/bin

grype sbom:sbom-ci.cdx.json -o json 2>/dev/null > grype-ci.json || true
```

Grype is installed directly from the official install script rather than via `apt` or a GitHub Action, ensuring the latest version is always used. The `|| true` after the scan prevents a non-zero exit from Grype's own threshold system from terminating the workflow before the custom gate logic runs — the gates are implemented as separate steps for precise control over the error message.

#### Step 3 — Gate A: Zero Critical Tolerance

```bash
CRITICAL=$(jq '[.matches[] | select(.vulnerability.severity=="Critical")] | length' grype-ci.json)
if [ "$CRITICAL" -gt 0 ]; then
  # print findings and exit 1
fi
```

This is an **absolute gate** — it does not compare against the baseline. If any Critical CVE appears in the scan (whether new or previously known), the build fails. The rationale: there are currently zero Critical findings in the committed baseline. Any Critical in a future scan is, by definition, new.

#### Step 4 — Gate B: Baseline Diff (New Findings Only)

This is the key design decision that makes the gate usable on an existing codebase with known vulnerabilities.

**The problem:** Running `grype --fail-on high` would immediately fail every PR because there are already 30 High findings in the current codebase. Blocking all development until every existing vulnerability is patched is not operationally viable.

**The solution:** Compare the current scan against a committed baseline. Only fail on findings that are **net-new** — present in the current scan but absent from the baseline.

```bash
# Extract (package, version, CVE) tuples from both scans
jq -r '.matches[] | "\(.artifact.name)|\(.artifact.version)|\(.vulnerability.id)|\(.vulnerability.severity)"' \
  documentation/grype-report.json | sort > baseline.txt

jq -r '.matches[] | "\(.artifact.name)|\(.artifact.version)|\(.vulnerability.id)|\(.vulnerability.severity)"' \
  grype-ci.json | sort > current.txt

# Lines in current but NOT in baseline = newly introduced findings
comm -13 baseline.txt current.txt > new-findings.txt
```

`comm -13` outputs lines that appear only in the second file (current scan but not baseline). Comparing on `(name, version, CVE)` tuples rather than just CVE IDs correctly handles cases where the same CVE affects multiple packages at different versions.

New High or Critical findings fail the build. New Medium or Low findings generate a PR comment but do not block merging.

#### Step 5 — Artifacts

```yaml
- uses: actions/upload-artifact@v4
  with:
    name: vulnerability-reports-${{ github.run_number }}
    path: |
      sbom-ci.cdx.json
      grype-ci.json
    retention-days: 30
```

Both the generated SBOM and the scan report are uploaded as workflow artifacts. This allows security review of any PR's exact dependency state without re-running the scan. The 30-day retention aligns with typical PR review windows.

#### Step 6 — PR Comment

When new findings are present on a PR, the workflow posts a markdown table as a comment:

```
## 🛡️ Dependency Security Gate — New Findings

This PR introduces 3 new vulnerability finding(s) not present in the baseline.

| Pkg | Version | Advisory | Severity | Fix |
|---|---|---|---|---|
| `axios` | 1.14.0 | GHSA-fvcv-3m26-pcqx | 🟠 High | `1.16.0` |
...

> ❌ 2 High/Critical finding(s) block this PR. Upgrade the affected
> package(s) or update the baseline in `documentation/grype-report.json`
> with justification.
```

The comment includes a direct link to the GHSA advisory for each finding and the minimum fix version, making it immediately actionable for the developer.

---

### 2. Extended Dependabot (`dependabot.yml`)

**File:** `.github/dependabot.yml`

The existing configuration only watched the `github-actions` ecosystem. Three `npm` entries were added — one per workspace directory:

```yaml
- package-ecosystem: "npm"
  directory: "/"              # root workspace + monorepo tooling

- package-ecosystem: "npm"
  directory: "/apps/backend"  # Express + Sequelize + nodemailer + multer

- package-ecosystem: "npm"
  directory: "/apps/frontend" # React + Vite + react-query + react-router
```

Each entry uses:
- `open-pull-requests-limit: 10` — prevents flooding the PR queue
- `groups.security-patch` with `applies-to: security-updates` — batches security updates into a single PR per workspace rather than one PR per package
- Workspace-specific labels (`backend`, `frontend`) for filtering

When Dependabot opens a security PR, the Grype gate runs automatically. If the upgrade resolves a vulnerability that was in the baseline, the gate will pass (the tuple disappears from the diff). If the upgrade introduces a regression, the gate catches it.

---

## The Baseline (`documentation/grype-report.json`)

The baseline is the pivot point of the entire gate. It represents the **accepted current state** of known vulnerabilities in the codebase.

### What it contains

```json
{
  "matches": [
    {
      "artifact": {
        "name": "axios",
        "version": "1.14.0"
      },
      "vulnerability": {
        "id": "GHSA-fvcv-3m26-pcqx",
        "severity": "High",
        "dataSource": "https://github.com/advisories/GHSA-fvcv-3m26-pcqx",
        "fix": { "versions": ["1.16.0"], "state": "fixed" }
      }
    }
    // ... 64 more entries
  ]
}
```

### When to update the baseline

The baseline must be regenerated and committed alongside any PR that:

1. **Upgrades a vulnerable package** — the fixed finding disappears from the new scan, making it safe to remove from the baseline.
2. **Accepts a known finding as low-risk** — document the risk decision in the commit message, then add the finding to the baseline to stop blocking the gate.
3. **Adds a new package** — if the new package introduces Medium/Low findings that the team accepts, update the baseline to stop the weekly schedule from treating them as "new".

### How to regenerate

On Windows (PowerShell 5.1 — avoid BOM):

```powershell
# 1. Regenerate the SBOM from current lockfile
npx @cyclonedx/cdxgen -t js `
  -o documentation/sbom.cdx.json `
  --project-name ijbnet `
  --project-version (node -p "require('./package.json').version")

# 2. Scan and write the new baseline (UTF-8 without BOM)
$json = grype sbom:documentation/sbom.cdx.json -o json 2>$null
[System.IO.File]::WriteAllText(
  "$PWD\documentation\grype-report.json",
  $json,
  [System.Text.UTF8Encoding]::new($false)
)
```

On Linux/macOS (GitHub Actions runner, no BOM issue):

```bash
npx @cyclonedx/cdxgen -t js -o documentation/sbom.cdx.json --project-name ijbnet
grype sbom:documentation/sbom.cdx.json -o json > documentation/grype-report.json
```

> **Important:** PowerShell 5.1's `Out-File -Encoding utf8` and the `>` redirect operator both add a UTF-8 BOM (`\xEF\xBB\xBF`) to the file. Node.js's `JSON.parse()` fails on BOM-prefixed input. Always use `[System.IO.File]::WriteAllText` with `UTF8Encoding($false)` on Windows. The backend endpoint has a BOM-stripping guard as a fallback, but the committed file should be clean.

---

## How the Gate Evolves Over Time

### Phase 1 — Current (v0.9.5)

- Gate A: block on Critical (zero tolerance)
- Gate B: block on new High/Critical vs baseline
- Baseline contains 65 existing findings (30 High, 32 Medium, 3 Low)

### Phase 2 — After Tier 1 Remediations (axios, nodemailer)

Once `axios` and `nodemailer` are upgraded:

1. Run the baseline regeneration commands above
2. The new baseline will have ~40 fewer findings
3. Commit the updated baseline alongside the package upgrades

The gate continues to pass because the fixed findings are no longer in _either_ file.

### Phase 3 — Tighten the Gate

After all Tier 1 and Tier 2 packages (axios, nodemailer, multer, file-type, postcss, react-router) are patched and the baseline is regenerated clean:

```yaml
# In dependency-security-gate.yml, change:
- name: Gate — no Critical vulnerabilities
  run: |
    CRITICAL=$(jq '...' grype-ci.json)
```

To:

```bash
# Fail on High OR Critical — now viable with a clean baseline
THRESHOLD_COUNT=$(jq '[.matches[] | select(.vulnerability.severity=="Critical" or .vulnerability.severity=="High")] | length' grype-ci.json)
if [ "$THRESHOLD_COUNT" -gt 0 ]; then
  exit 1
fi
```

This enforces a stricter standard: no High findings at all, blocking any PR that introduces or bumps to a vulnerable version.

---

## Relationship to Existing CI

| Mechanism | Type | Catches | Blocks PRs? |
|---|---|---|---|
| Strix AI (`.github/workflows/security-scan.yml`) | SAST (code) | SQL injection, XSS, hardcoded secrets, insecure patterns in source code | Yes |
| Grype gate (`.github/workflows/dependency-security-gate.yml`) | SCA (dependencies) | Known CVEs in npm packages via SBOM | Yes |
| Dependabot (`.github/dependabot.yml`) | Automated upgrades | Dependency version drift; opens PRs | Opens PRs (Grype gate validates them) |
| Vulnerability Dashboard (`/superadmin/vulnerability`) | Visibility | Same CVE data, human-readable | No (observability only) |

The four mechanisms are complementary: Strix catches code-level issues, Grype catches dependency CVEs, Dependabot automates the fix PRs, and the dashboard gives security-aware operators a live view without needing to read CI logs.

---

## Key Design Decisions

### Why a committed baseline rather than `--fail-on high`?

Running `grype --fail-on high` on an existing codebase with 30 known High findings would block every PR immediately. The team cannot pause all development to fix 30 vulnerabilities before the gate goes live. A committed baseline allows the gate to be enabled today while existing findings are tracked and addressed incrementally via the risk analysis in `documentation/vulnerability-risk-analysis.md`.

### Why `(pkg, version, CVE)` tuples rather than just CVE IDs?

The same CVE can affect multiple packages (e.g. a bundled copy of a library in two different transitive dependencies). Comparing only CVE IDs would incorrectly mark a finding as "not new" if the same CVE appeared against a different package. The 3-tuple comparison is precise.

### Why `comm -13` rather than a JSON diff tool?

`comm` is a POSIX standard tool available on every Linux runner. It operates on sorted text lines, making it fast and dependency-free. A JSON-aware diff tool would require an additional install step and is unnecessary given that the tuple extraction via `jq` produces deterministic sorted output.

### Why weekly schedule in addition to path-filtered triggers?

The `paths` filter means no scan runs when only documentation or source code (not `package.json`/lockfile) changes. But Grype's vulnerability database is updated daily — a package that was clean on Monday may have a CVE published by Friday. The weekly schedule ensures the baseline is re-validated against the current database even in quiet periods.

### Why `npx --yes @cyclonedx/cdxgen` rather than a pinned action?

Pinning to a specific cdxgen version would require manual updates. Since cdxgen reads the lockfile (not compiled code), any version incompatibility would be immediately visible as a malformed SBOM. The `--yes` flag suppresses the interactive install prompt. If stability becomes a concern, pin with `npx @cyclonedx/cdxgen@12.7.0`.

---

## Operational Runbook

### A PR is blocked by Gate A (Critical finding)

1. Identify the finding from the CI log or PR comment.
2. Check if it is in the package you just modified or a transitive dependency.
3. If direct: upgrade the package to the fix version. If transitive: upgrade the parent package.
4. If no fix exists: assess the exploitability in IJBNet's context. If the code path is unreachable, document this in the PR description and open a separate issue to track it. Do not remove it from the gate without documented justification.

### A PR is blocked by Gate B (new High/Critical finding)

Same as Gate A but the finding appeared because you upgraded a package to a version that introduced a new CVE (regression), or you added a new package that carries a known vulnerability.

Options:
- Upgrade further to a version that fixes the CVE.
- Use a different package.
- If the CVE is demonstrably not exploitable in IJBNet's context, add the finding to the baseline with a commit message explaining why (e.g. `chore: accept GHSA-xxxx in baseline — affects unreachable code path in lodash.template`).

### The weekly scan fails on main

This means a CVE was published against a currently installed package since the last baseline update. It does not block PRs (the schedule trigger does not run in PR context) but it does fail on the `push: main` equivalent of the schedule.

1. Pull the latest Grype report from the failed run's artifacts.
2. Identify the new finding.
3. Open a patch PR upgrading the affected package, or update the baseline with justification.

### How to check if a finding is truly new vs a database update

Run the scan locally and compare the CVE ID against the GitHub Security Advisories site (ghsa.github.io). If the advisory was published after the last baseline regeneration date (visible in `documentation/grype-report.json` at `.descriptor.db.builtAt`), it is a genuinely new published CVE, not a regression.

---

## Files Changed in v0.9.5

| File | Change |
|---|---|
| `.github/workflows/dependency-security-gate.yml` | New — Grype SCA gate workflow |
| `.github/dependabot.yml` | Extended — added npm ecosystem for all three workspaces |
| `documentation/grype-report.json` | Baseline (committed in v0.9.4, referenced by the gate) |
| `documentation/sbom.cdx.json` | SBOM (committed in v0.9.4, regenerated locally when baseline changes) |
| `CHANGELOG.md` | v0.9.5 entry |
| `CLAUDE.md` | Version bump + recent changes entry |
| `package.json` / `apps/*/package.json` | Version bumped to 0.9.5 |
