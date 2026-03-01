/**
 * Interactive brand intake — guided Q&A via @clack/prompts.
 */

import * as p from "@clack/prompts";
import type { BrandInput, BrandPersonality } from "../../types/brand.js";

/** Run the interactive brand intake flow */
export async function interactiveIntake(): Promise<BrandInput> {
  p.intro("Brand System Generator");

  const name = await p.text({
    message: "What is the brand name?",
    placeholder: "Acme Corp",
    validate: (v) => (v.length === 0 ? "Brand name is required" : undefined),
  });

  if (p.isCancel(name)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }

  const description = await p.text({
    message: "Brief brand description (optional)",
    placeholder: "A modern SaaS platform for team collaboration",
  });

  if (p.isCancel(description)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }

  const industry = await p.text({
    message: "Industry (optional)",
    placeholder: "Technology, Healthcare, Finance...",
  });

  if (p.isCancel(industry)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }

  const personality = await p.multiselect({
    message: "Select brand personality traits",
    options: [
      { value: "professional", label: "Professional" },
      { value: "playful", label: "Playful" },
      { value: "warm", label: "Warm" },
      { value: "bold", label: "Bold" },
      { value: "minimal", label: "Minimal" },
      { value: "elegant", label: "Elegant" },
      { value: "technical", label: "Technical" },
      { value: "friendly", label: "Friendly" },
    ],
    required: true,
  });

  if (p.isCancel(personality)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }

  const primaryColor = await p.text({
    message: "Primary brand color (hex)",
    placeholder: "#3b82f6",
    validate: (v) => {
      if (!/^#[0-9a-fA-F]{6}$/.test(v)) return "Enter a valid hex color (e.g. #3b82f6)";
      return undefined;
    },
  });

  if (p.isCancel(primaryColor)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }

  const secondaryColor = await p.text({
    message: "Secondary brand color (hex, optional)",
    placeholder: "#8b5cf6 (leave empty to skip)",
  });

  if (p.isCancel(secondaryColor)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }

  const accentColor = await p.text({
    message: "Accent color (hex, optional)",
    placeholder: "#f59e0b (leave empty to skip)",
  });

  if (p.isCancel(accentColor)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }

  const fontFamily = await p.text({
    message: "Primary font family",
    placeholder: "Inter",
    initialValue: "Inter",
    validate: (v) => (v.length === 0 ? "Font family is required" : undefined),
  });

  if (p.isCancel(fontFamily)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }

  const monoFont = await p.text({
    message: "Monospace font (optional)",
    placeholder: "JetBrains Mono",
  });

  if (p.isCancel(monoFont)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }

  const scaleRatio = await p.select({
    message: "Type scale ratio",
    options: [
      { value: "major-third", label: "Major Third (1.25) — apps & dashboards" },
      { value: "perfect-fourth", label: "Perfect Fourth (1.333) — marketing sites" },
    ],
  });

  if (p.isCancel(scaleRatio)) {
    p.cancel("Cancelled.");
    process.exit(0);
  }

  const isValidHex = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);

  const input: BrandInput = {
    name: name as string,
    description: (description as string) || undefined,
    industry: (industry as string) || undefined,
    personality: personality as BrandPersonality[],
    colors: {
      primary: primaryColor as string,
      secondary: isValidHex(secondaryColor as string) ? (secondaryColor as string) : undefined,
      accent: isValidHex(accentColor as string) ? (accentColor as string) : undefined,
    },
    typography: {
      fontFamily: fontFamily as string,
      monoFontFamily: (monoFont as string) || undefined,
      scaleRatio: scaleRatio as "major-third" | "perfect-fourth",
    },
  };

  p.outro("Brand input collected — generating design system...");

  return input;
}
