/**
 * Genuine Deterministic Artifact Validator Tool
 * Performs real structural, security (XSS/link), and functional (Node VM JS syntax & anchor link) checks.
 */

import { inspectWebsitePrototype, LayerAuditResult } from './websiteInspector';

export interface ValidatorInput {
  name: string;
  format: string;
  content: string;
}

export interface ValidatorOutput {
  tool: 'artifact_validator';
  fileName: string;
  format: string;
  valid: boolean;
  byteLength: number;
  lineCount: number;
  checksRun: string[];
  warnings: string[];
  errors: string[];
  executionTimeMs: number;
  layerResults?: {
    structuralValidation: LayerAuditResult;
    securityTesting: LayerAuditResult;
    functionalTesting: LayerAuditResult;
    browserTesting: LayerAuditResult;
    deploymentVerification: LayerAuditResult;
  };
}

export function executeArtifactValidator(input: ValidatorInput): ValidatorOutput {
  const startTime = performance.now();
  const content = (input.content || '').trim();
  const format = (input.format || 'text').toLowerCase();
  const fileName = input.name || 'artifact.txt';

  const checksRun: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!content) {
    errors.push('Artifact content is empty.');
  }

  const byteLength = Buffer.byteLength(content, 'utf8');
  const lineCount = content ? content.split(/\r?\n/).length : 0;
  checksRun.push(`Measured size: ${byteLength} bytes across ${lineCount} lines`);

  let layerResults: ValidatorOutput['layerResults'];

  if (format === 'json' || fileName.endsWith('.json')) {
    checksRun.push('JSON.parse() structural syntax validation');
    try {
      const parsed = JSON.parse(content);
      if (typeof parsed !== 'object' || parsed === null) {
        errors.push('JSON root must be an object or array.');
      } else {
        const keyCount = Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length;
        checksRun.push(`Parsed valid JSON (${Array.isArray(parsed) ? `${keyCount} items` : `${keyCount} top-level keys`})`);
      }
    } catch (err: any) {
      errors.push(`Invalid JSON syntax: ${err.message}`);
    }
  } else if (format === 'html' || fileName.endsWith('.html')) {
    const inspection = inspectWebsitePrototype(content, fileName);
    checksRun.push(...inspection.structural.checks);
    checksRun.push(...inspection.security.checks);
    checksRun.push(...inspection.functional.checks);
    errors.push(...inspection.structural.issues, ...inspection.security.issues, ...inspection.functional.issues);
    warnings.push(...inspection.browserTesting.issues, ...inspection.deploymentVerification.issues);

    layerResults = {
      structuralValidation: inspection.structural,
      securityTesting: inspection.security,
      functionalTesting: inspection.functional,
      browserTesting: inspection.browserTesting,
      deploymentVerification: inspection.deploymentVerification,
    };
  } else if (format === 'markdown' || format === 'md' || fileName.endsWith('.md')) {
    checksRun.push('Markdown structure & non-trivial content check');
    if (content.length < 40) {
      errors.push('Markdown deliverable is too short to be an actionable specification.');
    }
    if (!/^#{1,6}\s+/m.test(content)) {
      warnings.push('No markdown headings detected.');
    } else {
      checksRun.push('PASS: Verified structured markdown headings');
    }
  } else if (format === 'yaml' || format === 'yml' || fileName.endsWith('.yaml') || fileName.endsWith('.yml')) {
    checksRun.push('YAML key-value indentation sanity check');
    if (!/^[a-zA-Z0-9_-]+:/m.test(content)) {
      errors.push('YAML deliverable does not contain valid key:value mappings.');
    }
  }

  const executionTimeMs = parseFloat((performance.now() - startTime).toFixed(3));
  const valid = errors.length === 0;

  return {
    tool: 'artifact_validator',
    fileName,
    format,
    valid,
    byteLength,
    lineCount,
    checksRun,
    warnings,
    errors,
    executionTimeMs,
    ...(layerResults ? { layerResults } : {}),
  };
}
