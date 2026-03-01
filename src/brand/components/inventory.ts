/**
 * Component inventory section generator for brand.md.
 *
 * generateInventorySection(registry, contracts) → Markdown block
 * to append/replace in brand.md.
 *
 * The section is explicitly written for AI agent consumption.
 * The phrase "Do not invent or use components not listed here"
 * is intentional and machine-directed.
 */

import type { ComponentContract, ComponentRegistry } from "../../types/brand.js";

const SECTION_HEADER = "## Component Inventory";
const SECTION_SENTINEL_START = "<!-- nib-component-inventory:start -->";
const SECTION_SENTINEL_END = "<!-- nib-component-inventory:end -->";

/** Generate the ## Component Inventory section content */
export function generateInventorySection(
  registry: ComponentRegistry,
  contracts: Map<string, ComponentContract>,
): string {
  const entries = Object.entries(registry);

  if (entries.length === 0) {
    return `${SECTION_HEADER}
${SECTION_SENTINEL_START}

The following components are defined in this design system.
Do not invent or use components not listed here.

_No components defined yet. Run \`nib component init <Name>\` to scaffold your first component._

For full contracts, see docs/design/system/components/.

${SECTION_SENTINEL_END}
`;
  }

  const tableRows = entries
    .map(([name, entry]) => {
      const contract = contracts.get(name);
      const description = contract?.description ?? "_no description_";
      return `| ${name} | ${entry.status} | ${description} |`;
    })
    .join("\n");

  return `${SECTION_HEADER}
${SECTION_SENTINEL_START}

The following components are defined in this design system.
Do not invent or use components not listed here.

| Component | Status | Description |
|-----------|--------|-------------|
${tableRows}

For full contracts, see docs/design/system/components/.

${SECTION_SENTINEL_END}
`;
}

/**
 * Replace or append the ## Component Inventory section in brand.md content.
 *
 * If a sentinel block already exists, replace it; otherwise append at end.
 */
export function patchBrandMd(
  brandMdContent: string,
  inventorySection: string,
): string {
  const startIdx = brandMdContent.indexOf(SECTION_SENTINEL_START);
  const endIdx = brandMdContent.indexOf(SECTION_SENTINEL_END);

  if (startIdx !== -1 && endIdx !== -1) {
    // Find the header line before the sentinel and replace the whole section
    const headerIdx = brandMdContent.lastIndexOf(SECTION_HEADER, startIdx);
    const replaceFrom = headerIdx !== -1 ? headerIdx : startIdx;
    const replaceTo = endIdx + SECTION_SENTINEL_END.length;
    return (
      brandMdContent.slice(0, replaceFrom) +
      inventorySection +
      brandMdContent.slice(replaceTo)
    );
  }

  // Append after last non-empty line
  const trimmed = brandMdContent.trimEnd();
  return trimmed + "\n\n" + inventorySection;
}
