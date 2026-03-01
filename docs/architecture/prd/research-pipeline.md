# PRD: Phase 8 — "Research as a Feature"

**Status:** Planned — implement after Phase 7 ships
**Phase:** 8
**Milestone:** Prototypes become research instruments with usability metrics
**Target users:** UX researchers, product designers, and developers who run usability studies; teams that use prototypes for user testing, not just stakeholder demos
**References:** [../roadmap.md](../roadmap.md#phase-8--research-as-a-feature), [../gap-analysis.md](../gap-analysis.md)
**Depends on:** Phase 1 — prototype pipeline (capture/build/export); Phase 4 — DesignDocument interaction declarations

---

## Problem

nib prototypes are built for stakeholder demos. The same prototypes could be research instruments — but there is no infrastructure for it:

1. **No fidelity control** — there is no way to produce a lo-fi wireframe or a hi-fi behavioral prototype from the same design file. Every export is the same fidelity.
2. **No event instrumentation** — clicks, navigations, and task completions leave no trace. There is no session log.
3. **No task definition** — you can't tell the prototype "this session is testing the checkout flow."
4. **No usability metrics** — there is no report anchored to a recognized standard. Session data, if it existed, would be raw events with no interpretation.

The result: nib prototypes are disposable demo artifacts. They could be research assets — but they aren't.

---

## Goals

1. `nib export --mode lofi|on-brand|hifi` produces fidelity-controlled prototypes
2. Exported prototypes capture click, navigation, and task events as a local session JSON log
3. `--task "<description>"` marks the research goal for a session
4. `nib prototype report --session <log.json>` produces a report anchored to ISO 9241-11 metrics
5. No external service required — all instrumentation is local

### Non-goals for this phase

- Video recording or eye tracking
- Participant management or recruitment
- Remote session hosting
- A/B testing or multi-variant studies
- Quantitative statistical analysis beyond ISO 9241-11 metrics

---

## Success Metrics

| Metric | Target |
|--------|--------|
| `nib export --mode lofi` produces a visually de-branded prototype | 100% — no brand colors, no custom typography |
| Session log is written on prototype close or task completion | 100% of instrumented sessions |
| `nib prototype report --session` produces ISO 9241-11 anchored metrics | Effectiveness, efficiency, satisfaction all present in output |
| Session log is valid JSON parseable without nib | 100% — no proprietary format |
| Instrumentation adds < 5KB to prototype bundle | Measured on reference prototype |

---

## User Stories

### Fidelity Modes

**As a UX researcher**, I want `nib export --mode lofi` to strip brand colors and typography from a prototype so participants react to the layout and flow, not the visual polish.

**As a product designer** running a preference test, I want `nib export --mode on-brand` to apply all brand tokens so participants see a realistic representation.

**As a developer** validating behavioral expectations, I want `nib export --mode hifi` to produce a fully interactive prototype with all transitions and states so the test reflects actual implementation behavior.

### Task Definition + Instrumentation

**As a researcher**, I want `nib export --task "Complete the checkout flow"` to embed a task marker in the prototype so the session log knows what the participant was trying to accomplish.

**As a researcher**, I want the prototype to automatically log click events with node IDs and timestamps, and navigation events with screen names and time-on-screen — without installing any analytics service.

**As a developer**, I want session logs to be plain JSON files I can open in any text editor and feed into `nib prototype report` without proprietary tooling.

### Usability Report

**As a researcher** after running sessions with 5 participants, I want `nib prototype report --session session.json` to produce task success rate, time on task, and error rate mapped to ISO 9241-11 so I can report findings in a standard format.

---

## Functional Requirements

### FR-1: Fidelity Modes

**Command:** `nib export <design-json> --mode lofi|on-brand|hifi`

`on-brand` is the current default behavior (no change). `lofi` and `hifi` add new behaviors.

**`--mode lofi`**

Produces a wireframe-fidelity prototype:
- All colors replaced with grayscale equivalents (text: `#1A1A1A`, surfaces: `#F5F5F5`, borders: `#CCCCCC`, interactive: `#666666`)
- Typography replaced with system font stack (`-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`)
- Images replaced with gray placeholder boxes showing original dimensions
- All brand-specific CSS variables stripped
- Fidelity banner added to prototype header: `Lo-fi prototype — layout and flow only`

**`--mode hifi`**

Produces a high-fidelity behavioral prototype:
- All brand tokens applied (same as `on-brand`)
- CSS transitions and animations included (derived from `motion.*` tokens)
- Hover states rendered (CSS `:hover` rules generated for interactive nodes)
- Focus states rendered (focus ring tokens applied as `:focus-visible` styles)
- Fidelity banner: `Hi-fi prototype — behavioral expectations test`

**`--mode on-brand`** (default, unchanged)

Current behavior. No banner.

---

### FR-2: Event Instrumentation

Instrumentation is a small JavaScript snippet (`< 5KB`) injected into the prototype HTML at export time when `--instrument` flag is set (or always when `--task` is specified).

**Captured events:**

| Event | Data captured |
|-------|--------------|
| Session start | `sessionId` (UUID), `taskDescription`, `timestamp`, `prototypeVersion`, `mode` |
| Click / tap | `nodeId`, `nodeName`, `x`, `y`, `timestamp` |
| Navigation | `fromScreen`, `toScreen`, `timestamp`, `timeOnScreen` (ms) |
| Task complete | `timestamp`, `totalDuration` (ms) — triggered by participant or auto on last screen |
| Session end | `timestamp`, `totalDuration`, `screensVisited`, `totalClicks` |
| Error event | `nodeId`, `errorType` (dead-click, back-navigation, repeated-attempt), `timestamp` |

**Error event definitions:**
- `dead-click`: click on a non-interactive node with no prototype link
- `back-navigation`: browser back / prototype back button used
- `repeated-attempt`: same node clicked 3+ times in < 10 seconds (confusion signal)

**Session log format (`session-<uuid>.json`):**
```json
{
  "sessionId": "a1b2c3d4",
  "task": "Complete the checkout flow",
  "mode": "on-brand",
  "prototypeVersion": "0.3.1",
  "startedAt": "2026-02-28T10:00:00Z",
  "endedAt": "2026-02-28T10:04:32Z",
  "totalDuration": 272000,
  "completed": true,
  "events": [
    { "type": "navigation", "from": null, "to": "Cart", "timestamp": "2026-02-28T10:00:00Z", "timeOnScreen": 0 },
    { "type": "click", "nodeId": "node-abc", "nodeName": "Checkout button", "x": 320, "y": 540, "timestamp": "2026-02-28T10:00:08Z" },
    { "type": "navigation", "from": "Cart", "to": "Shipping", "timestamp": "2026-02-28T10:00:08Z", "timeOnScreen": 8000 },
    { "type": "error", "nodeId": "node-xyz", "errorType": "dead-click", "timestamp": "2026-02-28T10:01:15Z" }
  ]
}
```

**Storage:** Written to `localStorage` during session. On session end (tab close or task complete), downloaded as `session-<uuid>.json` or written to a configured local path.

---

### FR-3: `--task` Flag

**Command:** `nib export <design-json> --task "<description>" [--mode <mode>]`

Specifying `--task` automatically enables instrumentation.

**Behavior:**
1. Embeds task description in prototype header: `Task: Complete the checkout flow`
2. Injects instrumentation snippet
3. Adds a "Mark task complete" button to the prototype footer
4. Generates `session-<uuid>.json` on session end

**Multi-task sessions** (future extension — not in Phase 8): single `--task` per export. Multiple tasks require multiple exports.

---

### FR-4: `nib prototype report --session`

**Command:** `nib prototype report --session <session.json> [--format json|md]`

Processes one or more session logs and produces ISO 9241-11 anchored metrics.

**ISO 9241-11 metric definitions:**

| Metric | Definition | Calculation |
|--------|-----------|------------|
| **Effectiveness** | Task completion rate | `completedSessions / totalSessions` |
| **Efficiency** | Time on task for successful completions | `mean(totalDuration)` for `completed: true` sessions |
| **Error rate** | Errors per session | `mean(errorEvents.length)` across all sessions |
| **Satisfaction** | Not automatically computed — placeholder for researcher input | N/A (requires survey data) |

**JSON output:**
```json
{
  "task": "Complete the checkout flow",
  "sessions": 5,
  "iso9241": {
    "effectiveness": {
      "completionRate": 0.8,
      "completed": 4,
      "failed": 1
    },
    "efficiency": {
      "meanTimeOnTask": 187500,
      "medianTimeOnTask": 164000,
      "stdDev": 45000
    },
    "errors": {
      "meanErrorsPerSession": 1.4,
      "errorTypes": {
        "dead-click": 5,
        "back-navigation": 2,
        "repeated-attempt": 0
      }
    },
    "satisfaction": null
  },
  "pathAnalysis": {
    "mostCommonPath": ["Cart", "Shipping", "Payment", "Confirmation"],
    "deviations": [
      { "path": ["Cart", "Home", "Cart", "Shipping", "..."], "count": 1 }
    ]
  }
}
```

**Markdown output:**
```markdown
## Usability Report — Complete the checkout flow

**Sessions:** 5 · **Date:** 2026-02-28

### ISO 9241-11 Metrics

| Metric | Result | Benchmark |
|--------|--------|-----------|
| Effectiveness (completion rate) | 80% | ≥ 78% industry avg |
| Efficiency (mean time on task) | 3m 07s | — |
| Error rate (per session) | 1.4 errors | — |

### Path Analysis

**Most common path:** Cart → Shipping → Payment → Confirmation (4/5 sessions)

**Deviations:** 1 session navigated back from Cart to Home before completing.

### Error Breakdown

| Error type | Count |
|------------|-------|
| Dead click | 5 |
| Back navigation | 2 |
```

**Multi-session input:** `nib prototype report --session "sessions/*.json"` aggregates multiple logs.

---

### FR-5: Export Command Updates

**Updated command signature:**
```bash
nib export <design-json> [--mode lofi|on-brand|hifi] [--task "<description>"] [--instrument] [--output <dir>]
```

`--instrument` enables session logging without a task description (anonymous session).
`--task` implies `--instrument`.

---

## Technical Notes

### Source files to create / modify

| File | Action |
|------|--------|
| `src/build/fidelity.ts` | Create — lofi/hifi CSS transformation pipeline |
| `src/build/instrumentation.ts` | Create — session log snippet generator |
| `src/cli/commands/export.ts` | Modify — wire `--mode`, `--task`, `--instrument` flags |
| `src/report/session.ts` | Create — session log parser + ISO 9241-11 calculator |
| `src/cli/commands/prototype/report.ts` | Modify — add `--session` flag alongside existing `--design-json` |
| `src/types/session.ts` | Create — `SessionLog`, `SessionEvent`, `UsabilityReport` interfaces |

### Instrumentation snippet

The instrumentation snippet must be:
- Self-contained (no external dependencies)
- < 5KB minified
- Compatible with the prototype's existing event system (prototype links use `data-to` attributes)
- Resilient to ad blockers (no network requests, localStorage only)

### ISO 9241-11 reference

ISO 9241-11:2018 defines usability as effectiveness × efficiency × satisfaction. nib covers the first two automatically from session data. Satisfaction requires researcher-administered surveys (SUS, UMUX-Lite) — nib provides a `satisfaction: null` placeholder and documents how to add a survey score manually.

---

## Open Questions

1. **Session data privacy** — Session logs contain click coordinates and navigation paths. Should nib include a notice in the prototype that the session is being recorded? Recommendation: yes — `--task` always shows a "This session is being recorded for usability research" banner that the participant dismisses.

2. **Benchmark data** — The report shows ISO 9241-11 metrics but no benchmarks. Should nib include industry average benchmarks (e.g., Nielsen Norman Group data) as optional context? Recommendation: include as optional `--benchmarks` flag with curated defaults; off by default.

3. **Session end trigger** — How does the prototype know the task is complete? Options: (a) participant clicks "Mark task complete" button, (b) participant reaches a designated final screen, (c) session ends when tab is closed. Recommendation: all three — any of these triggers session end.

4. **Multi-participant analysis** — Should `nib prototype report --session` accept a directory of session files and aggregate automatically? Recommendation: yes — glob pattern support (`sessions/*.json`).

---

## Done Criteria

- [ ] `nib export design.json --mode lofi` produces a grayscale, system-font prototype
- [ ] `nib export design.json --mode hifi` produces a prototype with transitions and hover states
- [ ] `nib export design.json --task "..."` injects instrumentation and shows task banner
- [ ] Session log is written as valid JSON on session end
- [ ] `nib prototype report --session session.json` outputs ISO 9241-11 metrics in JSON and Markdown
- [ ] Multi-session glob input aggregates correctly across sessions
- [ ] Instrumentation snippet is < 5KB minified
- [ ] `bun run typecheck` passes with no new errors
- [ ] `bun run test` passes with fixture-based coverage for fidelity transforms + session parser

---

*Created: 2026-02-28*
*References: gap-analysis.md GAP 12*
