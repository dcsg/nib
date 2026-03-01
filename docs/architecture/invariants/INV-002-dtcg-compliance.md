# INV-002: DTCG Compliance

**Status:** Active
**Created:** 2026-03-01

---

## Rule

All token files must conform to the W3C Design Tokens Community Group (DTCG) specification. Every token must have `$value` and `$type`. `$description` is required on all semantic and component tokens.

Token references use the `{group.token}` alias syntax defined by the spec.

## Enforcement

- Token generators in `src/brand/tokens/` produce DTCG-compliant JSON with `$value`, `$type`, and `$description` keys
- `nib brand validate` checks schema compliance: presence of required keys, valid `$type` values, valid alias references
- Composite types (`shadow`, `typography`, `transition`, `cubicBezier`) use structured value objects, not flat strings
- `$extensions.nib` namespace is used for tool-specific metadata (audit status, ownership, deprecation)

## Violations

- Emitting a token without `$value` or `$type`
- Using non-standard keys (e.g., `value` instead of `$value`)
- Emitting composite types as flat strings instead of structured objects
- Using `$extensions` keys outside the `nib` namespace (risk of collision with other tools)
- Breaking alias references (referencing tokens that don't exist in the primitive tier)
