/**
 * OpenAI-compatible AI provider for brand enhancement.
 * Works with OpenAI API, Ollama, and any OpenAI-compatible endpoint.
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

export class OpenAiBrandProvider implements BrandAiProvider {
  constructor(
    private baseUrl?: string,
    private apiKey?: string,
  ) {}

  async enhanceBrand(input: BrandInput): Promise<BrandAiEnhancement> {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({
      apiKey: this.apiKey ?? process.env.OPENAI_API_KEY,
      baseURL: this.baseUrl,
    });

    const response = await client.chat.completions.create({
      model: this.baseUrl ? "llama3" : "gpt-4o",
      max_tokens: 2000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input) },
      ],
      response_format: { type: "json_object" },
    });

    const text = response.choices[0]?.message?.content ?? "{}";
    return JSON.parse(text) as BrandAiEnhancement;
  }
}
