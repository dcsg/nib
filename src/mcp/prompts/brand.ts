/**
 * nib MCP Prompts — guided workflow prompts for AI agents.
 *
 * 4 prompts:
 *   nib-brand-onboard    — step-by-step brand setup
 *   nib-audit-review     — review WCAG results and suggest fixes
 *   nib-component-add    — guided component contract + registration
 *   nib-prototype-build  — capture .pen design + build HTML prototype
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerBrandPrompts(server: McpServer): void {
  // -------------------------------------------------------------------------
  // nib-brand-onboard
  // -------------------------------------------------------------------------
  server.registerPrompt(
    "nib-brand-onboard",
    {
      title: "Brand Onboarding",
      description:
        "Step-by-step guide to set up a nib brand system: interview → init → validate → audit → push. " +
        "When no source file is provided, interviews the user to build a brand brief first.",
      argsSchema: {
        from: z.string().optional().describe(
          "Source for brand guidelines: path to a .md/.txt/.pdf file, or a URL. " +
          "Omit to start with a brand interview.",
        ),
      },
    },
    async ({ from }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              from
                ? `Set up a nib brand system from: ${from}`
                : "Set up a nib brand system for this project.",
              "",
              "Follow these steps in order:",
              "",
              ...(from
                ? []
                : [
                    "0. **Brand interview** — The user has no brand brief yet. Interview them with these questions",
                    "   (ask one at a time, wait for each answer before continuing):",
                    "   - What is your brand or product name?",
                    "   - What is your primary brand color? (share a hex code, or describe the feel — e.g. 'deep blue, trustworthy')",
                    "   - Do you have a secondary or accent color? (optional — skip if unsure)",
                    "   - Font preference? (serif / sans-serif / specific name like 'Inter' or 'Lato'; leave blank to auto-select)",
                    "   - Choose 2–3 personality words that describe your brand:",
                    "     professional · minimal · bold · playful · friendly · technical · elegant · energetic",
                    "   - Who is your target audience in one sentence?",
                    "   After collecting answers, write a `brand.md` file in the project root with this structure:",
                    "   ```markdown",
                    "   # Brand Brief — {name}",
                    "   Primary color: {hex}",
                    "   Secondary color: {hex or 'none'}",
                    "   Font: {name or 'auto'}",
                    "   Personality: {word1}, {word2}, {word3}",
                    "   Audience: {one sentence}",
                    "   ```",
                    "   Then set `from = 'brand.md'` for the next step.",
                    "",
                  ]),
              "1. **Initialize** — Run `nib_brand_init` with the source file/URL to generate DTCG tokens.",
              "",
              "2. **Validate** — Run `nib_brand_validate` to check token schema, naming, and required tokens.",
              "   - Report any errors and fix them before continuing.",
              "",
              "3. **Audit** — Run `nib_brand_audit` to check WCAG contrast compliance.",
              "   - List all failing color pairs and suggest adjustments to the primary/secondary palette.",
              "",
              "4. **Push** — Run `nib_brand_push` to sync tokens into the Pencil .pen file.",
              "   - Remind the user to save the file in Pencil (Cmd+S).",
              "   - If this is the first push, guide them: Pencil will open the new file automatically.",
              "",
              "After each step, summarize what was done and what comes next.",
            ].join("\n"),
          },
        },
      ],
    }),
  );

  // -------------------------------------------------------------------------
  // nib-audit-review
  // -------------------------------------------------------------------------
  server.registerPrompt(
    "nib-audit-review",
    {
      title: "WCAG Audit Review",
      description:
        "Review the latest WCAG audit results and suggest concrete token value changes " +
        "to bring all failing color pairs into AA compliance.",
    },
    async () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              "Review the nib WCAG contrast audit results and suggest fixes.",
              "",
              "Steps:",
              "1. Run `nib_brand_audit` to get the current audit report.",
              "2. For each failing pair (ratio < 4.5:1 for AA), explain:",
              "   - Which tokens are involved (foreground / background)",
              "   - The current ratio vs. the required ratio",
              "   - A concrete suggestion: e.g., 'lighten background by 10%' or 'darken foreground to #1a1a1a'",
              "3. If there are many failures, group them by theme (e.g., dark mode issues, interactive states).",
              "4. Summarize: X pairs pass, Y pairs fail. Highest-priority fix first.",
              "",
              "Do not modify any files — this is a review and recommendation step only.",
            ].join("\n"),
          },
        },
      ],
    }),
  );

  // -------------------------------------------------------------------------
  // nib-component-add
  // -------------------------------------------------------------------------
  server.registerPrompt(
    "nib-component-add",
    {
      title: "Add Component",
      description:
        "Guided workflow to define a component contract and register it in nib. " +
        "Creates the contract JSON and updates brand.config.json.",
      argsSchema: {
        name: z.string().describe(
          "Component name in PascalCase (e.g., Button, Card, InputField)",
        ),
      },
    },
    async ({ name }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              `Add a nib component contract for: ${name}`,
              "",
              "Steps:",
              `1. **Define the contract** — Run \`nib_component_init\` with name="${name}".`,
              "   - Ask the user to describe the component's states (default, hover, active, disabled, etc.)",
              "   - Ask which design tokens it uses (e.g., color.brand.500 for background, color.neutral.900 for text)",
              "",
              "2. **Review the contract** — Show the generated contract JSON and confirm with the user.",
              "",
              "3. **Validate** — Run `nib_brand_validate` with the component checks enabled.",
              "   - Fix any V-08 through V-11 errors (missing states, bad token refs, a11y issues).",
              "",
              "4. **Summarize** — Show the final registered component and which token slots it uses.",
              "",
              "Be specific about token paths (e.g., color.brand.600, not just 'brand color').",
            ].join("\n"),
          },
        },
      ],
    }),
  );

  // -------------------------------------------------------------------------
  // nib-prototype-build
  // -------------------------------------------------------------------------
  server.registerPrompt(
    "nib-prototype-build",
    {
      title: "Build Prototype",
      description:
        "Capture a Pencil .pen design file and build an HTML prototype. " +
        "Runs nib_capture then nib_build_prototype in sequence.",
      argsSchema: {
        penFile: z.string().describe(
          "Absolute or relative path to the .pen file to capture",
        ),
      },
    },
    async ({ penFile }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: [
              `Build an HTML prototype from: ${penFile}`,
              "",
              "Steps:",
              `1. **Capture** — Run \`nib_capture\` with file="${penFile}".`,
              "   - This extracts all canvases into a DesignDocument JSON.",
              "   - If capture fails (MCP not running), guide the user to start Pencil first.",
              "   - After capture, list all canvas names and their top-level element names.",
              "",
              "2. **Navigation links** — Ask the user:",
              "   'Which elements on each screen should navigate to another screen?'",
              "   - For each answer, collect: source canvas name, node ID, target canvas name, transition.",
              "   - Node IDs come from the captured DesignDocument (id field in the node tree).",
              "   - If the user says 'none', skip this step.",
              "",
              "3. **Build** — Run `nib_build_prototype` with the captured design JSON.",
              "   - Include a `links` array if navigation links were collected (step 2).",
              "   - Use the 'clean' template unless the user requests 'presentation'.",
              "   - Report the output directory and the number of pages built.",
              "",
              "4. **Summarize** — List the canvases captured, the output path, and how to open the prototype.",
              "   - E.g., 'Open prototype/index.html in your browser to preview.'",
              "   - If links were added, confirm which hotspots were wired.",
              "",
              "If there are multiple canvases, list them by name and page count.",
            ].join("\n"),
          },
        },
      ],
    }),
  );
}
