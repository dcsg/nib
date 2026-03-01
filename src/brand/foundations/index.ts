/**
 * Foundation doc generation — orchestrate all 5 foundation docs.
 *
 * Called by nib brand build alongside token generation.
 * Writes to docs/design/system/foundations/.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { NibBrandConfig } from "../../types/brand.js";
import { generateColorSystemDoc } from "./color-system.js";
import { generateTypographySystemDoc } from "./typography-system.js";
import { generateSpacingSystemDoc } from "./spacing-system.js";
import { generateGridDoc } from "./grid.js";
import { generateMotionDoc } from "./motion.js";

/** Write all foundation docs to the foundations directory */
export async function writeFoundationDocs(config: NibBrandConfig): Promise<void> {
  const foundationsDir = join(config.output, "foundations");
  await mkdir(foundationsDir, { recursive: true });

  await Promise.all([
    writeFile(
      join(foundationsDir, "color-system.md"),
      generateColorSystemDoc(config),
    ),
    writeFile(
      join(foundationsDir, "typography-system.md"),
      generateTypographySystemDoc(config),
    ),
    writeFile(
      join(foundationsDir, "spacing-system.md"),
      generateSpacingSystemDoc(config),
    ),
    writeFile(
      join(foundationsDir, "grid.md"),
      generateGridDoc(config),
    ),
    writeFile(
      join(foundationsDir, "motion.md"),
      generateMotionDoc(config),
    ),
  ]);
}
