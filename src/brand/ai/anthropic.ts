/**
 * Anthropic AI provider for brand enhancement.
 */

import type { BrandAiEnhancement, BrandAiProvider, BrandInput } from "../../types/brand.js";

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

export class AnthropicBrandProvider implements BrandAiProvider {
  async enhanceBrand(input: BrandInput): Promise<BrandAiEnhancement> {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic();

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(input) }],
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => ("text" in block ? block.text : ""))
      .join("");

    return JSON.parse(text) as BrandAiEnhancement;
  }
}
