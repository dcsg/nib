/**
 * Text-based file patcher for .storybook/main.ts and .storybook/preview.ts.
 *
 * Each function accepts a source string and returns a PatchResult.
 * When a pattern cannot be safely matched, `changed` is false and `warning`
 * describes what to add manually.
 */

export interface PatchResult {
  patched: string;
  changed: boolean;
  /** Set when the file could not be safely patched — print this to the user */
  warning?: string;
}

/**
 * Inject missing addon strings into the `addons: [...]` array in main.ts.
 * Supports both single-line and multi-line arrays.
 */
export function patchAddonsArray(source: string, addons: string[]): PatchResult {
  const match = source.match(/addons\s*:\s*\[/);
  if (!match) {
    return {
      patched: source,
      changed: false,
      warning: `Could not find 'addons: [' in main config. Add these addons manually:\n${addons.map(a => `  "${a}"`).join(",\n")}`,
    };
  }

  const toInject = addons.filter(a => !source.includes(a));
  if (toInject.length === 0) return { patched: source, changed: false };

  // Find insertion point: after `addons: [`
  const idx = source.indexOf("addons: [") !== -1
    ? source.indexOf("addons: [") + "addons: [".length
    : (match.index ?? 0) + match[0].length;

  const entries = toInject.map(a => `\n    "${a}",`).join("");
  const patched = source.slice(0, idx) + entries + source.slice(idx);
  return { patched, changed: true };
}

/**
 * Inject a staticDirs entry into main.ts.
 * Adds `staticDirs: ['<dir>']` before the closing brace if not already present.
 */
export function patchStaticDirs(source: string, dir: string): PatchResult {
  if (source.includes(dir)) return { patched: source, changed: false };

  const staticDirsMatch = source.match(/staticDirs\s*:\s*\[/);
  if (staticDirsMatch) {
    // Inject into existing staticDirs array
    const idx = (staticDirsMatch.index ?? 0) + staticDirsMatch[0].length;
    const patched = source.slice(0, idx) + `\n    "../${dir}",` + source.slice(idx);
    return { patched, changed: true };
  }

  // Inject new staticDirs before `framework:` or before the last `};`
  const frameworkIdx = source.indexOf("framework:");
  if (frameworkIdx !== -1) {
    const patched =
      source.slice(0, frameworkIdx) +
      `staticDirs: ["../${dir}"],\n  ` +
      source.slice(frameworkIdx);
    return { patched, changed: true };
  }

  return {
    patched: source,
    changed: false,
    warning: `Could not inject staticDirs. Add this manually to your main config:\n  staticDirs: ["../${dir}"],`,
  };
}

/**
 * Prepend a CSS import line into preview.ts/preview.js.
 * Inserts after any existing import statements at the top of the file.
 */
export function patchPreviewImports(source: string, cssImport: string): PatchResult {
  if (source.includes(cssImport)) return { patched: source, changed: false };

  // Find last import statement line
  const lines = source.split("\n");
  let lastImportIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.trimStart().startsWith("import ")) lastImportIdx = i;
  }

  const insertAfter = lastImportIdx >= 0 ? lastImportIdx : -1;
  const newLines = [
    ...lines.slice(0, insertAfter + 1),
    `import "${cssImport}";`,
    ...lines.slice(insertAfter + 1),
  ];
  return { patched: newLines.join("\n"), changed: true };
}

/**
 * Prepend a decorator import + registration into preview.ts.
 * Looks for `decorators: [` and injects the decorator.
 * If not found, appends it to the preview object.
 */
export function patchDecorators(source: string, importLine: string, decoratorName: string): PatchResult {
  if (source.includes(decoratorName)) return { patched: source, changed: false };

  // First inject the import line
  let result = patchPreviewImports(source, "").patched; // reuse for positioning
  // Actually inject the real import
  const withImport = source.includes(importLine)
    ? source
    : patchPreviewImports(source, importLine.replace('import ', '').replace(';', '')).patched;

  // Then inject into decorators array
  const decoratorsMatch = withImport.match(/decorators\s*:\s*\[/);
  if (decoratorsMatch) {
    const idx = (decoratorsMatch.index ?? 0) + decoratorsMatch[0].length;
    const patched = withImport.slice(0, idx) + `\n    ${decoratorName},` + withImport.slice(idx);
    return { patched, changed: true };
  }

  // No decorators array — warn
  void result;
  return {
    patched: withImport,
    changed: false,
    warning: [
      `Could not find 'decorators: [' in preview config. Add these manually:`,
      `  ${importLine}`,
      `  // In your preview object:`,
      `  decorators: [${decoratorName}],`,
    ].join("\n"),
  };
}
