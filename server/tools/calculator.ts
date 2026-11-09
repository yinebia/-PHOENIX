/**
 * Safe Mathematical Calculator Tool
 * Evaluates arithmetic expressions safely without `eval` or `Function`.
 */

export interface CalculatorInput {
  expression: string;
}

export interface CalculatorOutput {
  tool: 'calculator';
  inputExpression: string;
  normalizedExpression: string;
  result: number;
  formattedResult: string;
  executionTimeMs: number;
  steps: string[];
}

export function executeCalculator(input: CalculatorInput): CalculatorOutput {
  const startTime = performance.now();
  const rawExpression = input.expression || '';

  if (!rawExpression.trim()) {
    throw new Error('Calculator error: Expression is empty');
  }

  // 1. Normalize natural language words into operators
  let normalized = rawExpression
    .toLowerCase()
    .replace(/\bmultiplied\s+by\b/g, '*')
    .replace(/\btimes\b/g, '*')
    .replace(/\bx\b/gi, '*')
    .replace(/×/g, '*')
    .replace(/\bdivided\s+by\b/g, '/')
    .replace(/÷/g, '/')
    .replace(/\bplus\b/g, '+')
    .replace(/\bminus\b/g, '-')
    .replace(/\bmodulo\b/g, '%')
    .replace(/\bto\s+the\s+power\s+of\b/g, '^')
    .replace(/\^/g, '**')
    .replace(/[^0-9+\-*/().\s*]/g, ' ') // strip non-math chars except spaces
    .replace(/\s+/g, ' ')
    .trim();

  // If normalized is empty after stripping natural language (e.g. user passed just text without numbers)
  if (!normalized) {
    throw new Error(`Calculator error: Could not extract valid arithmetic from "${rawExpression}"`);
  }

  const steps: string[] = [
    `Received input: "${rawExpression}"`,
    `Normalized mathematical expression: "${normalized}"`
  ];

  // 2. Safe Tokenizer
  const tokens = tokenize(normalized);
  steps.push(`Tokenized into: [${tokens.join(', ')}]`);

  // 3. Safe Recursive Descent Parser
  const parser = new SafeMathParser(tokens);
  const result = parser.parse();

  if (!Number.isFinite(result)) {
    throw new Error(`Calculator error: Calculation resulted in non-finite value (${result})`);
  }

  const endTime = performance.now();
  const elapsed = parseFloat((endTime - startTime).toFixed(3));
  steps.push(`Computed verified numerical result: ${result} in ${elapsed}ms`);

  return {
    tool: 'calculator',
    inputExpression: rawExpression,
    normalizedExpression: normalized,
    result,
    formattedResult: `${normalized} = ${result}`,
    executionTimeMs: elapsed,
    steps,
  };
}

// Tokenizer
function tokenize(expr: string): string[] {
  const tokens: string[] = [];
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (ch === '*' && expr[i + 1] === '*') {
      tokens.push('**');
      i += 2;
      continue;
    }

    if ('+-*/%()'.includes(ch)) {
      tokens.push(ch);
      i++;
      continue;
    }

    if (/[0-9.]/.test(ch)) {
      let numStr = '';
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        numStr += expr[i];
        i++;
      }
      tokens.push(numStr);
      continue;
    }

    throw new Error(`Calculator error: Unsupported character '${ch}' at index ${i}`);
  }

  return tokens;
}

// Safe Parser (Grammar: Expression -> Term (+/- Term)*; Term -> Factor (*|/|% Factor)*; Factor -> Primary (** Primary)*)
class SafeMathParser {
  private tokens: string[];
  private pos = 0;

  constructor(tokens: string[]) {
    this.tokens = tokens;
  }

  parse(): number {
    if (this.tokens.length === 0) {
      throw new Error('Calculator error: No tokens to evaluate');
    }
    const val = this.expression();
    if (this.pos < this.tokens.length) {
      throw new Error(`Calculator syntax error: Unexpected token '${this.tokens[this.pos]}' at position ${this.pos}`);
    }
    return val;
  }

  private peek(): string | undefined {
    return this.tokens[this.pos];
  }

  private consume(): string {
    return this.tokens[this.pos++];
  }

  private expression(): number {
    let result = this.term();

    while (this.peek() === '+' || this.peek() === '-') {
      const op = this.consume();
      const right = this.term();
      if (op === '+') result += right;
      else result -= right;
    }

    return result;
  }

  private term(): number {
    let result = this.factor();

    while (this.peek() === '*' || this.peek() === '/' || this.peek() === '%') {
      const op = this.consume();
      const right = this.factor();

      if (op === '*') {
        result *= right;
      } else if (op === '/') {
        if (right === 0) {
          throw new Error('Calculator error: Division by zero is undefined');
        }
        result /= right;
      } else if (op === '%') {
        if (right === 0) {
          throw new Error('Calculator error: Modulo by zero is undefined');
        }
        result %= right;
      }
    }

    return result;
  }

  private factor(): number {
    let result = this.primary();

    while (this.peek() === '**') {
      this.consume();
      const exponent = this.factor(); // right-associative power
      result = Math.pow(result, exponent);
    }

    return result;
  }

  private primary(): number {
    // Unary plus or minus
    if (this.peek() === '-') {
      this.consume();
      return -this.primary();
    }
    if (this.peek() === '+') {
      this.consume();
      return this.primary();
    }

    if (this.peek() === '(') {
      this.consume();
      const val = this.expression();
      if (this.peek() !== ')') {
        throw new Error("Calculator error: Missing closing parenthesis ')'");
      }
      this.consume(); // consume ')'
      return val;
    }

    const token = this.peek();
    if (token !== undefined && !Number.isNaN(Number(token))) {
      this.consume();
      return parseFloat(token);
    }

    throw new Error(`Calculator syntax error: Unexpected token '${token}'`);
  }
}
