/**
 * Claude Code AI provider for brand enhancement.
 *
 * Uses `claude -p "<prompt>"` to run a single headless turn through the
 * already-authenticated Claude Code installation — no API key required.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { BrandAiEnhancement, BrandAiProvider, BrandInput } from "../../types/brand.js";

const execFileAsync = promisify(execFile);

const TIMEOUT_MS = 30_000;

const SYSTEM_PROMPT = `You are a senior brand designer and design system architect. Given brand details, generate structured content for a design system documentation.

Respond ONLY with valid JSON matching this schema:
{
  "identity": "2-3 sentence brand identity description",
  "colorRules": "markdown bullet list of color usage rules",
  "typographyRules": "markdown bullet list of typography rules",
  "spacingRules": "markdown bullet list of spacing rules",
  "componentPatterns": "markdown with ### headings for Button, Card, Form patterns"
}`;

function buildUserPrompt(input: BrandInput): string {
  return `Brand: ${input.name}
Personality: ${input.personality?.join(", ") ?? "professional"}
Industry: ${input.industry ?? "general"}
Description: ${input.description ?? "N/A"}
Primary color: ${input.colors.primary}
${input.colors.secondary ? `Secondary color: ${input.colors.secondary}` : ""}
${input.colors.accent ? `Accent color: ${input.colors.accent}` : ""}
Font: ${input.typography.fontFamily}
${input.typography.monoFontFamily ? `Mono font: ${input.typography.monoFontFamily}` : ""}

Generate brand system documentation content for this brand. Focus on practical, actionable rules that an AI coding agent can follow to generate on-brand UI components.`;
}

/** Extract the first JSON object from a string (handles preamble/markdown fences) */
function extractJson(text: string): string {
  // Strip markdown code fences if present
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();

  // Find the first {...} block
  const start = text.indexOf("{");
  if (start === -1) throw new Error("No JSON object found in response");

  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }

  throw new Error("Unterminated JSON object in response");
}

export class ClaudeCodeBrandProvider implements BrandAiProvider {
  async enhanceBrand(input: BrandInput): Promise<BrandAiEnhancement> {
    const combinedPrompt = `${SYSTEM_PROMPT}\n\n---\n\n${buildUserPrompt(input)}`;

    let stdout: string;
    let stderr: string;

    // Clear CLAUDECODE so the subprocess isn't blocked by the nested-session guard.
    // Claude Code sets this env var and refuses to launch another session if it's truthy.
    const env = { ...process.env, CLAUDECODE: "" };

    try {
      ({ stdout, stderr } = await execFileAsync("claude", ["-p", combinedPrompt], {
        timeout: TIMEOUT_MS,
        maxBuffer: 1024 * 1024, // 1MB
        env,
      }));
    } catch (err: unknown) {
      const e = err as NodeJS.ErrnoException & { code?: string; stderr?: string };
      if (e.code === "ENOENT") {
        throw new Error(
          "claude binary not found in PATH. Is Claude Code installed? Run: npm install -g @anthropic-ai/claude-code",
        );
      }
      const detail = (e as { stderr?: string }).stderr?.trim() ?? String(err);
      throw new Error(`claude -p exited with error: ${detail}`);
    }

    void stderr; // stderr may contain progress info — not an error

    const raw = stdout.trim();
    if (!raw) {
      throw new Error("claude -p returned empty response");
    }

    let jsonStr: string;
    try {
      jsonStr = extractJson(raw);
    } catch {
      throw new Error(`Could not extract JSON from claude response:\n${raw.slice(0, 500)}`);
    }

    try {
      return JSON.parse(jsonStr) as BrandAiEnhancement;
    } catch {
      throw new Error(`claude response was not valid JSON:\n${jsonStr.slice(0, 500)}`);
    }
  }
}
