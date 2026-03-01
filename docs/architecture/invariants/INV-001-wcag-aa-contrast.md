# INV-001: WCAG AA Contrast

**Status:** Active
**Created:** 2026-03-01

---

## Rule

All generated color token pairs (text/background, icon/background, interactive/background) must pass WCAG AA contrast minimums.

- Normal text: minimum 4.5:1 contrast ratio
- Large text (≥18pt or ≥14pt bold) and UI icons: minimum 3:1 contrast ratio

## Enforcement

- `buildSemanticLight()` and `buildSemanticDark()` in `src/brand/tokens/color.ts` map semantic tokens to primitive steps that are pre-validated for contrast
- `brandAudit()` in `src/brand/wcag.ts` computes contrast ratios for all foreground/background pairs and reports failures
- `nib brand validate` includes contrast checks as a required validation gate

## Violations

- Generating a semantic token pair (e.g., `text.primary` on `background.primary`) with a contrast ratio below 4.5:1
- Removing or weakening the contrast check in the audit pipeline
- Adding a new semantic color pair without including it in the audit matrix
- Manually overriding a failing contrast ratio without adjusting the token value
