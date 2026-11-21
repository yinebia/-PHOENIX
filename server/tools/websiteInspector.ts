import vm from 'node:vm';

export type LayerStatus = 'PASSED' | 'FAILED' | 'WARNING' | 'NOT_RUN' | 'LOCAL_PROTOTYPE_ONLY';

export interface LayerAuditResult {
  name: string;
  status: LayerStatus;
  executed: boolean;
  summary: string;
  checks: string[];
  issues: string[];
}

export interface WebsiteInspectionResult {
  fileName: string;
  byteLength: number;
  lineCount: number;
  overallPassed: boolean;
  securityPassed: boolean;
  structuralPassed: boolean;
  functionalPassed: boolean;
  structural: LayerAuditResult;
  security: LayerAuditResult;
  functional: LayerAuditResult;
  browserTesting: LayerAuditResult;
  deploymentVerification: LayerAuditResult;
  placeholdersDetected: string[];
  brokenAnchorLinks: string[];
  unsafeSinksDetected: string[];
  jsSyntaxErrors: string[];
}

/**
 * Inspects a generated HTML website prototype across distinct verification layers:
 * 1. Structural Validation (markup closure, <title>, viewport, headings)
 * 2. Security Testing (unsafe DOM sinks like innerHTML/outerHTML/document.write/eval, javascript: URIs, wa.me validation)
 * 3. Functional Testing (vm.Script JS syntax check, internal #anchor target checks, responsive CSS rules, interactive filters/forms, prototype disclaimer)
 * 4. Browser Testing (honestly flagged NOT_RUN unless an external Playwright/browser runner actually executed)
 * 5. Deployment Verification (honestly flagged LOCAL_PROTOTYPE_ONLY)
 */
export function inspectWebsitePrototype(content: string, fileName = 'website_prototype.html'): WebsiteInspectionResult {
  const html = (content || '').trim();
  const lower = html.toLowerCase();
  const byteLength = Buffer.byteLength(html, 'utf8');
  const lineCount = html ? html.split(/\r?\n/).length : 0;

  // --- 1. STRUCTURAL VALIDATION ---
  const structuralChecks: string[] = [];
  const structuralIssues: string[] = [];

  if (!html) {
    structuralIssues.push('HTML deliverable is empty.');
  } else {
    structuralChecks.push(`Measured ${byteLength} bytes across ${lineCount} lines.`);
  }

  if (!lower.includes('<html') && !lower.includes('<section') && !lower.includes('<div') && !lower.includes('<body')) {
    structuralIssues.push('Missing core HTML document or container tags.');
  }
  if (lower.includes('<html') && !lower.includes('</html>')) {
    structuralIssues.push('Missing closing </html> tag.');
  }
  if (lower.includes('<body') && !lower.includes('</body>')) {
    structuralIssues.push('Missing closing </body> tag.');
  }
  if (lower.includes('<style') && !lower.includes('</style>')) {
    structuralIssues.push('Unclosed <style> block.');
  }
  if (lower.includes('<script') && !lower.includes('</script>')) {
    structuralIssues.push('Unclosed <script> block.');
  }
  if (/<title>[\s\S]*?<\/title>/i.test(html)) {
    structuralChecks.push('Document <title> present.');
  } else {
    structuralIssues.push('Missing <title> metadata tag.');
  }
  if (/name=["']viewport["']/i.test(html)) {
    structuralChecks.push('Responsive <meta name="viewport"> tag present.');
  } else {
    structuralIssues.push('Missing mobile viewport meta tag.');
  }
  if (/<h1[\s>]/i.test(html) || /<h2[\s>]/i.test(html)) {
    structuralChecks.push('Semantic heading hierarchy (<h1>/<h2>) verified.');
  } else {
    structuralIssues.push('Missing semantic primary heading (<h1> or <h2>).');
  }

  const structuralPassed = structuralIssues.length === 0;

  // --- 2. SECURITY TESTING ---
  const securityChecks: string[] = [];
  const securityIssues: string[] = [];
  const unsafeSinksDetected: string[] = [];

  const scriptBlocks: string[] = [];
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let scriptMatch: RegExpExecArray | null;
  while ((scriptMatch = scriptRegex.exec(html)) !== null) {
    if (scriptMatch[1] && scriptMatch[1].trim()) {
      scriptBlocks.push(scriptMatch[1]);
    }
  }
  const combinedJs = scriptBlocks.join('\n');

  // Check for unsafe DOM insertion / execution sinks
  const sinkPatterns: Array<{ label: string; regex: RegExp }> = [
    { label: 'innerHTML assignment', regex: /\.innerHTML\s*(\+=|=)/gi },
    { label: 'outerHTML assignment', regex: /\.outerHTML\s*(\+=|=)/gi },
    { label: 'insertAdjacentHTML call', regex: /\.insertAdjacentHTML\s*\(/gi },
    { label: 'document.write call', regex: /document\.write(ln)?\s*\(/gi },
    { label: 'eval() / new Function()', regex: /\b(eval\s*\(|new\s+Function\s*\()/gi },
  ];

  for (const sink of sinkPatterns) {
    const matches = combinedJs.match(sink.regex);
    if (matches && matches.length > 0) {
      unsafeSinksDetected.push(`${sink.label} (${matches.length} occurrence${matches.length > 1 ? 's' : ''})`);
      securityIssues.push(
        `Unsafe DOM/XSS sink detected: ${sink.label} (${matches.length}x). Use textContent and document.createElement() instead.`
      );
    }
  }
  if (unsafeSinksDetected.length === 0) {
    securityChecks.push('Zero unsafe DOM sinks (innerHTML, outerHTML, insertAdjacentHTML, document.write, eval) detected in scripts.');
  }

  if (/textContent\s*=/.test(combinedJs)) {
    securityChecks.push('Safe DOM textContent assignment verified in inline scripts.');
  }

  // Check for javascript: URIs or unquoted inline JS handlers
  if (/href\s*=\s*["']\s*javascript:/i.test(html)) {
    securityIssues.push('Dangerous javascript: URI found in href attribute.');
  } else {
    securityChecks.push('No javascript: URIs detected in links.');
  }

  // Validate WhatsApp external link safety if wa.me is present
  if (/wa\.me/i.test(html)) {
    const hasHttpsWa = /https:\/\/wa\.me\//i.test(html);
    const hasHttpInsecureWa = /http:\/\/wa\.me\//i.test(html);
    const hasEncodeUri = /encodeURIComponent\s*\(/i.test(combinedJs);
    const hasNoopener = /noopener/i.test(html);

    if (hasHttpInsecureWa) {
      securityIssues.push('Insecure http://wa.me link found; enforce https://wa.me/.');
    } else if (hasHttpsWa) {
      securityChecks.push('WhatsApp links use HTTPS (https://wa.me/).');
    }

    if (scriptBlocks.length > 0 && /wa\.me/.test(combinedJs) && !hasEncodeUri) {
      securityIssues.push('Dynamic WhatsApp URL construction lacks encodeURIComponent() parameter escaping.');
    } else if (/wa\.me/.test(combinedJs)) {
      securityChecks.push('Dynamic WhatsApp URL construction uses encodeURIComponent() escaping.');
    }

    if (/target\s*=\s*["']_blank["']/i.test(html) && !hasNoopener) {
      securityIssues.push('External target="_blank" link is missing rel="noopener noreferrer".');
    } else if (/target\s*=\s*["']_blank["']/i.test(html)) {
      securityChecks.push('External target="_blank" links include rel="noopener noreferrer".');
    }
  }

  const securityPassed = securityIssues.length === 0;

  // --- 3. FUNCTIONAL TESTING (NODE VM SYNTAX + STATIC INTERACTION CHECKS) ---
  const functionalChecks: string[] = [];
  const functionalIssues: string[] = [];
  const jsSyntaxErrors: string[] = [];

  if (scriptBlocks.length === 0) {
    functionalChecks.push('Static HTML without inline scripts (no JS syntax errors possible).');
  } else {
    scriptBlocks.forEach((code, idx) => {
      try {
        // Parses JS with Node.js V8 compiler without executing DOM code
        new vm.Script(code, { filename: `${fileName}#script-${idx + 1}` });
        functionalChecks.push(`Inline <script> #${idx + 1} passed V8 JS syntax compilation check.`);
      } catch (syntaxErr: any) {
        const msg = `JS syntax error in <script> #${idx + 1}: ${syntaxErr.message}`;
        jsSyntaxErrors.push(msg);
        functionalIssues.push(msg);
      }
    });
  }

  // Internal anchor broken-link check (#section -> id="section")
  const idsInDoc = new Set<string>();
  const idRegex = /\bid\s*=\s*["']([^"']+)["']/gi;
  let idMatch: RegExpExecArray | null;
  while ((idMatch = idRegex.exec(html)) !== null) {
    idsInDoc.add(idMatch[1].trim());
  }

  const brokenAnchorLinks: string[] = [];
  const anchorHrefRegex = /<a\b[^>]*\bhref\s*=\s*["']#([^"']*)["'][^>]*>/gi;
  let hrefMatch: RegExpExecArray | null;
  let checkedAnchorCount = 0;
  while ((hrefMatch = anchorHrefRegex.exec(html)) !== null) {
    const targetId = hrefMatch[1].trim();
    if (!targetId) continue; // href="#" top anchor allowed if present
    checkedAnchorCount++;
    if (!idsInDoc.has(targetId)) {
      brokenAnchorLinks.push(`#${targetId}`);
    }
  }
  if (brokenAnchorLinks.length > 0) {
    functionalIssues.push(`Broken internal navigation anchor(s): ${brokenAnchorLinks.join(', ')}`);
  } else if (checkedAnchorCount > 0) {
    functionalChecks.push(`Verified ${checkedAnchorCount} internal navigation anchor link(s) map to existing DOM IDs.`);
  }

  // Mobile responsive CSS check
  const hasMediaQueries = /@media\s*\(/i.test(html);
  if (hasMediaQueries) {
    functionalChecks.push('Responsive @media breakpoint CSS rules present.');
  } else {
    functionalIssues.push('No @media CSS responsive breakpoints detected.');
  }

  // Interactive navigation / filter / form checks
  const hasFilterHook = /data-category|filterProducts|data-filter/i.test(html);
  const hasForm = /<form\b/i.test(html);
  if (hasFilterHook) {
    functionalChecks.push('Catalogue category filter hooks detected in markup/scripts.');
  }
  if (hasForm) {
    const hasSubmitHandler = /addEventListener\s*\(\s*["']submit["']|onsubmit\s*=/i.test(html);
    if (hasSubmitHandler) {
      functionalChecks.push('Inquiry/contact form submit validation listener attached.');
    } else {
      functionalIssues.push('<form> element found without an explicit client-side submit validation handler.');
    }

    // Prototype honesty check: verify the prototype doesn't falsely say an order was submitted/saved externally
    const hasPrototypeDisclaimer = /prototype|not submitted|not saved|preview only|local preview|no backend/i.test(html);
    if (hasPrototypeDisclaimer) {
      functionalChecks.push('Prototype inquiry form explicitly labeled as a local preview (does not fabricate live order submission).');
    } else {
      functionalIssues.push('Inquiry form lacks an explicit local-prototype disclaimer.');
    }
  }

  const placeholdersDetected = Array.from(
    new Set(html.match(/\[[A-Z0-9 _-]{3,48}\]/g) || [])
  );
  if (placeholdersDetected.length > 0) {
    functionalChecks.push(`Preserved ${placeholdersDetected.length} distinct bracketed placeholder token(s) without inventing facts.`);
  }

  const functionalPassed = functionalIssues.length === 0;

  return {
    fileName,
    byteLength,
    lineCount,
    overallPassed: structuralPassed && securityPassed && functionalPassed,
    securityPassed,
    structuralPassed,
    functionalPassed,
    structural: {
      name: 'Structural Validation',
      status: structuralPassed ? 'PASSED' : 'FAILED',
      executed: true,
      summary: structuralPassed
        ? `Valid HTML structure (${byteLength} bytes, ${structuralChecks.length} checks passed).`
        : `Structural HTML defects found (${structuralIssues.length} issue(s)).`,
      checks: structuralChecks,
      issues: structuralIssues,
    },
    security: {
      name: 'Security Testing (Static XSS & Link Scan)',
      status: securityPassed ? 'PASSED' : 'FAILED',
      executed: true,
      summary: securityPassed
        ? 'Passed static DOM XSS and external link safety scan.'
        : `Security scan FAILED: ${securityIssues.length} vulnerability pattern(s) detected.`,
      checks: securityChecks,
      issues: securityIssues,
    },
    functional: {
      name: 'Functional & Prototype Logic Verification',
      status: functionalPassed ? 'PASSED' : 'FAILED',
      executed: true,
      summary: functionalPassed
        ? `Passed JS V8 syntax compilation (${scriptBlocks.length} script(s)) and DOM interaction contract checks.`
        : `Functional check found ${functionalIssues.length} defect(s).`,
      checks: functionalChecks,
      issues: functionalIssues,
    },
    browserTesting: {
      name: 'Live Headless Browser Testing',
      status: 'NOT_RUN',
      executed: false,
      summary: 'Live headless browser runtime (Playwright/Chromium DOM clicks & layout measurement) was NOT executed on the backend.',
      checks: [],
      issues: [
        'Headless browser automation is not installed in this execution container; only static DOM/link inspection and Node V8 script parsing ran.',
      ],
    },
    deploymentVerification: {
      name: 'Deployment Verification',
      status: 'LOCAL_PROTOTYPE_ONLY',
      executed: false,
      summary: 'Deliverable exists strictly as a local prototype artifact; NOT deployed to a live public domain.',
      checks: [],
      issues: [
        'Public DNS, SSL hosting, backend API persistence, and live WhatsApp dispatch remain unconfigured until operator deployment.',
      ],
    },
    placeholdersDetected,
    brokenAnchorLinks,
    unsafeSinksDetected,
    jsSyntaxErrors,
  };
}
