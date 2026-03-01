# INV-003: DesignDocument Backwards Compatibility

**Status:** Active
**Created:** 2026-03-01

---

## Rule

The `DesignDocument` intermediate format (`src/types/design.ts`) is the contract between the capture layer and the build layer. Changes must be backwards-compatible: new fields may be added (additive), existing fields must never be removed or renamed.

## Enforcement

- `DesignDocument`, `ResolvedNode`, `DesignCanvas`, `DesignVariables`, `DesignThemes`, and `DesignAsset` interfaces in `src/types/design.ts` are the source of truth
- New fields must be optional (`field?: Type`) so that existing `.design.json` files produced by older versions of nib continue to work with newer builds
- The build layer (`src/build/`) must handle missing optional fields gracefully with defaults

## Violations

- Removing a field from `DesignDocument` or any of its child interfaces
- Renaming a field (this is a remove + add, which breaks old files)
- Making a previously optional field required
- Changing a field's type in a way that breaks existing values (e.g., `string` → `number`)
- Adding a required field without a default value in the build layer
