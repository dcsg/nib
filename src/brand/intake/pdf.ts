/**
 * PDF brand intake — extract text from PDF and parse brand values.
 *
 * Uses a lightweight approach: read the PDF as a buffer and extract text
 * from the raw content streams. For complex PDFs, the AI provider can
 * enhance the extraction.
 */

import { readFile } from "node:fs/promises";
import type { BrandInput } from "../../types/brand.js";

/** Simple PDF text extraction — pulls text from content streams */
function extractTextFromPdf(buffer: Buffer): string {
  const text = buffer.toString("latin1");
  const chunks: string[] = [];

  // Extract text between BT/ET (Begin Text / End Text) operators
  const btEtPattern = /BT\s([\s\S]*?)ET/g;
  let match;
  while ((match = btEtPattern.exec(text)) !== null) {
    const block = match[1]!;
    // Extract text from Tj and TJ operators
    const tjPattern = /\(([^)]*)\)\s*Tj/g;
    let tjMatch;
    while ((tjMatch = tjPattern.exec(block)) !== null) {
      chunks.push(tjMatch[1]!);
    }
    // TJ arrays
    const tjArrayPattern = /\[([^\]]*)\]\s*TJ/g;
    let arrMatch;
    while ((arrMatch = tjArrayPattern.exec(block)) !== null) {
      const inner = arrMatch[1]!;
      const strPattern = /\(([^)]*)\)/g;
      let strMatch;
      while ((strMatch = strPattern.exec(inner)) !== null) {
        chunks.push(strMatch[1]!);
      }
    }
  }

  return chunks.join(" ").replace(/\s+/g, " ").trim();
}

/** Extract hex colors from text */
function extractColors(text: string): string[] {
  const hexPattern = /#[0-9a-fA-F]{6}\b/g;
  return [...new Set(text.match(hexPattern) ?? [])];
}

/** Extract brand input from a PDF file */
export async function pdfIntake(filePath: string): Promise<BrandInput> {
  const buffer = await readFile(filePath);
  const text = extractTextFromPdf(buffer);

  if (text.length < 10) {
    throw new Error(
      `Could not extract meaningful text from ${filePath}. The PDF may be image-based. ` +
      `Try converting it to markdown first, or use interactive mode.`,
    );
  }

  const colors = extractColors(text);

  // Try to find brand name patterns
  const namePatterns = [
    /(?:brand|company|organization)\s*(?:name)?[:\s]+["']?([^\n"']+)/i,
    /^(.+?)\s*(?:brand|style|design)\s*(?:guide|guidelines|system)/im,
  ];

  let brandName: string | null = null;
  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      brandName = match[1].trim();
      break;
    }
  }

  if (!brandName) {
    // Use filename as fallback
    brandName = filePath
      .split("/")
      .pop()!
      .replace(/\.pdf$/i, "")
      .replace(/[-_]/g, " ");
  }

  if (colors.length === 0) {
    throw new Error(
      `No hex colors found in ${filePath}. The PDF may store colors in a non-text format. ` +
      `Add hex values to your brand guidelines, or use interactive mode.`,
    );
  }

  // Try to detect fonts
  const fontPattern = /(?:font|typeface)[:\s]+["']?([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/g;
  const fonts: string[] = [];
  let fontMatch;
  while ((fontMatch = fontPattern.exec(text)) !== null) {
    if (fontMatch[1]) fonts.push(fontMatch[1].trim());
  }

  return {
    name: brandName,
    description: text.slice(0, 200).replace(/\s+/g, " ").trim(),
    colors: {
      primary: colors[0]!,
      secondary: colors[1],
      accent: colors[2],
    },
    typography: {
      fontFamily: fonts[0] ?? "Inter",
      monoFontFamily: fonts.find((f) =>
        /mono|code|consolas|fira|jetbrains/i.test(f),
      ),
    },
  };
}
