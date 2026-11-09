/**
 * Utility to extract math expressions from natural language strings.
 */
export function extractMathExpression(text: string): string {
  if (!text) return '';

  // Look for patterns like "calculate 125 multiplied by 48", "125 * 48", "125 x 48", etc.
  const calcMatch = text.match(/(?:calculate|compute|evaluate|what is|solve)\s+([^.?!;\n]+)/i);
  if (calcMatch && calcMatch[1]) {
    return calcMatch[1].trim();
  }

  // Look for numbers joined by operator words or symbols
  const directMatch = text.match(/([0-9.]+\s*(?:multiplied by|times|divided by|plus|minus|\*|\/|\+|\-|\^|x)\s*[0-9.]+[^.?!;\n]*)/i);
  if (directMatch && directMatch[1]) {
    return directMatch[1].trim();
  }

  return text.trim();
}
