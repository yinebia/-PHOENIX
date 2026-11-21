/**
 * Utility to safely extract strictly numeric arithmetic expressions
 * from natural language strings. NEVER returns plain English prose.
 */

const MATH_WORD_PATTERNS: Array<[RegExp, string]> = [
  [/\bmultiplied\s+by\b/gi, '*'],
  [/\btimes\b/gi, '*'],
  [/×/g, '*'],
  [/\bdivided\s+by\b/gi, '/'],
  [/÷/g, '/'],
  [/\bplus\b/gi, '+'],
  [/\bminus\b/gi, '-'],
  [/\bmodulo\b/gi, '%'],
  [/\bto\s+the\s+power\s+of\b/gi, '^'],
];

/**
 * Normalizes supported arithmetic phrasing and returns true ONLY if the
 * candidate is purely valid numeric arithmetic (at least one operator and
 * two operands, no unparsed alphabetic words, balanced parentheses).
 */
export function isValidMathExpression(raw: string): boolean {
  if (!raw || typeof raw !== 'string') return false;
  let s = raw.trim();
  if (!s) return false;

  // Strip optional leading command verbs cleanly
  s = s.replace(/^(?:calculate|compute|evaluate|what\s+is|solve)\s+/i, '').trim();
  // Strip currency signs ($) or commas inside formatted numbers (e.g., $1,200)
  s = s.replace(/\$(?=\s*\d)/g, '').replace(/(?<=\d),(?=\d{3}\b)/g, '');

  for (const [pattern, op] of MATH_WORD_PATTERNS) {
    s = s.replace(pattern, ` ${op} `);
  }
  // Normalize standalone 'x' multiplication strictly between numbers/parens
  s = s.replace(/(?<=[0-9)])\s*x\s*(?=[0-9(])/gi, ' * ');

  // Must not contain any remaining letters (would indicate text description, not math)
  if (/[a-zA-Z]/.test(s)) return false;

  // Must only contain digits, decimal points, arithmetic operators, parentheses, whitespace
  if (!/^[0-9+\-*/%^().\s]+$/.test(s)) return false;

  // Must contain at least two numeric operands and an arithmetic operator
  const numbers = s.match(/\d+(?:\.\d+)?/g);
  const hasOperator = /[+\-*/%^]/.test(s.replace(/^\s*[+-]/, ''));
  if (!numbers || numbers.length < 2 || !hasOperator) return false;

  // Check balanced parentheses
  let depth = 0;
  for (const ch of s) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (depth < 0) return false;
  }
  if (depth !== 0) return false;

  // Guard against trailing or empty operator pairs like "5 *" or "* 5" or "( )"
  if (/[+\-*/%^]\s*$/.test(s) || /^\s*[*/%^]/.test(s) || /\(\s*\)/.test(s)) {
    return false;
  }

  return true;
}

export function extractMathExpression(text: string): string {
  if (!text || typeof text !== 'string') return '';

  // 1. Check explicit command phrases: "calculate 125 multiplied by 48"
  const calcMatch = text.match(
    /(?:calculate|compute|evaluate|what\s+is|solve)\s+([^.?!;\n]+)/i
  );
  if (calcMatch && calcMatch[1]) {
    const candidate = calcMatch[1].trim();
    if (isValidMathExpression(candidate)) {
      return candidate;
    }
  }

  // 2. Check inline arithmetic expressions like "(150 - 30) / 15" or "125 * 48" or "125 multiplied by 48"
  const inlineMatches = text.match(
    /(?:\(\s*[-+]?\d[\d,]*(?:\.\d+)?|\$?\d[\d,]*(?:\.\d+)?)(?:\s*(?:multiplied\s+by|times|divided\s+by|plus|minus|modulo|to\s+the\s+power\s+of|\*|\/|\+|\-|\^|%|×|÷|x)\s*(?:\(\s*)*[-+]?\$?\d[\d,]*(?:\.\d+)?\s*\)*)+/gi
  );
  if (inlineMatches) {
    for (const match of inlineMatches) {
      const candidate = match.trim();
      if (isValidMathExpression(candidate)) {
        return candidate;
      }
    }
  }

  // NEVER fall back to returning plain text! Return empty string if no math found.
  return '';
}
