/**
 * AI provider interface and factory.
 */

import { execFileSync } from "node:child_process";
import type { AiProviderName, BrandAiProvider } from "../../types/brand.js";

/**
 * Check if the `claude` CLI binary is available in PATH and responsive.
 * Uses `claude --version` as a lightweight probe — no auth needed.
 */
export function isClaudeCodeAvailable(): boolean {
  try {
    execFileSync("claude", ["--version"], { timeout: 5000, stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get an AI provider by name. Returns null if the provider is not available.
 *
 * Provider resolution:
 * 1. Explicit name argument
 * 2. NIB_AI_PROVIDER env var
 * 3. Auto-detection: ANTHROPIC_API_KEY → OPENAI_API_KEY → NIB_AI_BASE_URL → claude-code
 */
export function getProvider(name?: AiProviderName): BrandAiProvider | null {
  const providerName = name ?? (process.env.NIB_AI_PROVIDER as AiProviderName) ?? detectProvider();

  if (!providerName) return null;

  switch (providerName) {
    case "anthropic": {
      if (!process.env.ANTHROPIC_API_KEY) return null;
      // Lazy import to avoid loading SDK when not needed
      const { AnthropicBrandProvider } = require("./anthropic.js") as typeof import("./anthropic.js");
      return new AnthropicBrandProvider();
    }
    case "openai":
    case "ollama": {
      const key = process.env.OPENAI_API_KEY;
      const baseUrl = process.env.NIB_AI_BASE_URL;
      if (!key && !baseUrl) return null;
      const { OpenAiBrandProvider } = require("./openai.js") as typeof import("./openai.js");
      return new OpenAiBrandProvider(baseUrl, key);
    }
    case "claude-code": {
      if (!isClaudeCodeAvailable()) return null;
      const { ClaudeCodeBrandProvider } = require("./claude-code.js") as typeof import("./claude-code.js");
      return new ClaudeCodeBrandProvider();
    }
    default:
      return null;
  }
}

/**
 * Detect which AI provider is available.
 * API keys take priority; claude-code is the zero-config fallback.
 */
export function detectProvider(): AiProviderName | null {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.NIB_AI_BASE_URL) return "ollama";
  if (isClaudeCodeAvailable()) return "claude-code";
  return null;
}
