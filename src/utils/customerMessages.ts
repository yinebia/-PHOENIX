/**
 * Customer-facing message sanitizer: ensures technical tool errors
 * (like "Calculator error: ...") never appear on customer screens.
 * Full technical diagnostics remain strictly inside the Admin Support Dashboard.
 */

const TECHNICAL_ERROR_PATTERN =
  /calculator\s*(?:syntax\s*)?error|could not extract valid arithmetic|unexpected token|division by zero|modulo by zero|tool execution failed|no tokens to evaluate|unsupported character|typeerror|syntaxerror|econnreset|status\s*50\d|503\s*unavailable/i;

export function toFriendlyCustomerError(rawError?: string, tool?: string): string {
  const raw = String(rawError || '').trim();
  const isCalc =
    (tool || '').toLowerCase() === 'calculator' ||
    /calculator|arithmetic|expression|pricing|margin|token|syntax/i.test(raw);

  if (!raw || TECHNICAL_ERROR_PATTERN.test(raw)) {
    return isCalc
      ? 'I used sensible estimates for the pricing step so we can keep moving.'
      : 'This step hit a quick snag, so we paused safely with your saved work. Choose "Continue with estimates" to keep moving.';
  }

  // Also scrub inline technical prefixes if any remain
  if (/^step\s+".*"\s*\(calculator\)\s*failed:/i.test(raw)) {
    return 'I used sensible estimates for the pricing step so we can keep moving.';
  }

  return raw;
}

export function toFriendlyRecoveryNote(rawNote?: string, tool?: string): string {
  const raw = String(rawNote || '').trim();
  if (!raw) {
    return 'Your completed work is saved. Choose "Continue with estimates" to keep moving.';
  }
  if (TECHNICAL_ERROR_PATTERN.test(raw)) {
    return (tool || '').toLowerCase() === 'calculator'
      ? 'Choose "Continue with estimates" to use an Estimated projection pricing table and finish the rest of your mission.'
      : 'Your completed progress is safe. Click "Continue with estimates" to keep moving smoothly.';
  }
  return raw;
}
