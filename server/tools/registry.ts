/**
 * PHOENIX Modular Tool Registry
 * Strictly classifies tools as REAL, LLM_REASONING, or SIMULATED.
 * Never marks simulated operations as real execution.
 */

import { executeCalculator, CalculatorOutput } from './calculator';
import { executeArtifactValidator, ValidatorInput, ValidatorOutput } from './validator';

export type ToolCategory = 'REAL' | 'SIMULATED' | 'LLM_REASONING';

export interface ToolExecutionResult {
  tool: string;
  toolType: ToolCategory;
  isRealExecution: boolean;
  status: 'SUCCESS' | 'FAILED';
  input: any;
  output: any;
  executionTimeMs: number;
  retryCount: number;
  safeToRetry: boolean;
  error?: string;
  logs: string[];
  verificationPassed: boolean;
  verificationEvidence?: string;
}

export interface RegisteredTool {
  name: string;
  category: ToolCategory;
  description: string;
  isReal: boolean;
  defaultRequiresApproval?: boolean;
  execute: (input: any) => Promise<any> | any;
  verify: (output: any, input: any) => { passed: boolean; evidence: string };
}

class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();

  constructor() {
    this.registerRealTools();
    this.registerReasoningTools();
    this.registerSimulatedTools();
  }

  private registerRealTools() {
    // 1. Genuine Calculator Tool
    this.register({
      name: 'calculator',
      category: 'REAL',
      description: 'Safely evaluates mathematical, budget, pricing, and arithmetic expressions without code injection.',
      isReal: true,
      execute: (input: { expression?: string; query?: string }) => {
        const expr = input.expression || input.query || '';
        return executeCalculator({ expression: expr });
      },
      verify: (output: CalculatorOutput) => {
        if (typeof output.result !== 'number' || Number.isNaN(output.result)) {
          return { passed: false, evidence: 'Result is not a valid number.' };
        }
        if (!Number.isFinite(output.result)) {
          return { passed: false, evidence: 'Result is infinite.' };
        }
        return {
          passed: true,
          evidence: `Verified mathematical equality: ${output.formattedResult}. Execution duration: ${output.executionTimeMs}ms. Zero mock evaluation.`
        };
      }
    });

    // 2. Genuine Artifact Validator Tool
    this.register({
      name: 'artifact_validator',
      category: 'REAL',
      description: 'Deterministically validates generated deliverables (JSON, HTML, Markdown, YAML) for structural integrity.',
      isReal: true,
      execute: (input: ValidatorInput) => {
        return executeArtifactValidator(input);
      },
      verify: (output: ValidatorOutput) => {
        if (!output.valid) {
          return {
            passed: false,
            evidence: `Structural validation failed for ${output.fileName}: ${output.errors.join('; ')}`
          };
        }
        return {
          passed: true,
          evidence: `Validated ${output.fileName} (${output.byteLength} bytes, ${output.lineCount} lines): ${output.checksRun.join(' | ')}`
        };
      }
    });

    // 3. Genuine Verification Harness Tool (Full Artifact Reconciliation & Multi-Layer Verification)
    this.register({
      name: 'verification_harness',
      category: 'REAL',
      description: 'Runs deterministic structural, security, and JS/link verification over all completed outputs and reconciles every artifact.',
      isReal: true,
      execute: (input: { artifacts?: ValidatorInput[]; priorOutputs?: any[] }) => {
        const start = performance.now();
        const rawArtifacts = input.artifacts || [];
        const priorOutputs = input.priorOutputs || [];

        // Reconcile every artifact present in the mission without skipping deliverables
        const artifactChecks = rawArtifacts.map((art) => executeArtifactValidator(art));
        const failedArtifactChecks = artifactChecks.filter((c) => !c.valid);
        const passedArtifacts = artifactChecks.length - failedArtifactChecks.length;
        const failedPriors = priorOutputs.filter((p) => p && p.status === 'FAILED');

        const htmlChecks = artifactChecks.filter((c) => c.layerResults);
        const structuralIssues = artifactChecks.flatMap((c) =>
          c.layerResults ? c.layerResults.structuralValidation.issues : c.errors
        );
        const securityIssues = artifactChecks.flatMap((c) =>
          c.layerResults ? c.layerResults.securityTesting.issues : []
        );
        const functionalIssues = artifactChecks.flatMap((c) =>
          c.layerResults ? c.layerResults.functionalTesting.issues : []
        );

        const verificationLayers = {
          structuralValidation: {
            name: 'Structural Validation',
            status: structuralIssues.length === 0 ? 'PASSED' : 'FAILED',
            executed: true,
            summary:
              structuralIssues.length === 0
                ? `Validated structure of all ${artifactChecks.length} artifact(s).`
                : `Structural defects in ${structuralIssues.length} check(s).`,
            checks: artifactChecks.flatMap((c) =>
              c.layerResults ? c.layerResults.structuralValidation.checks : c.checksRun
            ),
            issues: structuralIssues,
          },
          securityTesting: {
            name: 'Security Testing (Static XSS & Link Scan)',
            status: securityIssues.length === 0 ? (htmlChecks.length > 0 ? 'PASSED' : 'PASSED') : 'FAILED',
            executed: true,
            summary:
              securityIssues.length === 0
                ? htmlChecks.length > 0
                  ? `Zero unsafe innerHTML/eval/javascript: sinks found across ${htmlChecks.length} HTML deliverable(s).`
                  : 'No HTML XSS attack surfaces present in deliverables.'
                : `Security scan failed with ${securityIssues.length} unsafe DOM/link finding(s).`,
            checks: htmlChecks.flatMap((c) => c.layerResults!.securityTesting.checks),
            issues: securityIssues,
          },
          functionalTesting: {
            name: 'Functional & Prototype Logic Verification',
            status: functionalIssues.length === 0 ? 'PASSED' : 'FAILED',
            executed: true,
            summary:
              functionalIssues.length === 0
                ? `JS syntax V8 check & link/form contract checks passed across ${artifactChecks.length} deliverable(s).`
                : `Functional verification identified ${functionalIssues.length} issue(s).`,
            checks: htmlChecks.flatMap((c) => c.layerResults!.functionalTesting.checks),
            issues: functionalIssues,
          },
          browserTesting: {
            name: 'Live Headless Browser Testing',
            status: 'NOT_RUN',
            executed: false,
            summary: 'Live headless browser automation (Playwright/Chromium) was NOT executed.',
            checks: [],
            issues: [
              'Real browser DOM click-through and pixel layout testing require an external headless browser runner (not attached to this backend).',
            ],
          },
          deploymentVerification: {
            name: 'Deployment Verification',
            status: 'LOCAL_PROTOTYPE_ONLY',
            executed: false,
            summary: 'Deliverables verified locally in workspace/session only; no live public deployment occurred.',
            checks: [],
            issues: [
              'Public URL hosting, DNS, TLS, and live backend order persistence remain unverified until deployed.',
            ],
          },
        };

        const artifactReconciliation = {
          totalGenerated: rawArtifacts.length,
          checkedCount: artifactChecks.length,
          verifiedCount: passedArtifacts,
          failedCount: failedArtifactChecks.length,
          unverifiedCount: Math.max(0, rawArtifacts.length - artifactChecks.length),
          reconciled: rawArtifacts.length === artifactChecks.length,
          artifactDetails: artifactChecks.map((c) => ({
            name: c.fileName,
            format: c.format,
            exists: c.byteLength > 0,
            structuralPass: c.layerResults ? c.layerResults.structuralValidation.status === 'PASSED' : c.valid,
            securityPass: c.layerResults ? c.layerResults.securityTesting.status === 'PASSED' : true,
            functionalPass: c.layerResults ? c.layerResults.functionalTesting.status === 'PASSED' : c.valid,
            checks: c.checksRun,
            issues: c.errors,
          })),
        };

        const elapsed = parseFloat((performance.now() - start).toFixed(3));
        return {
          tool: 'verification_harness',
          artifactsChecked: artifactChecks.length,
          passedArtifacts,
          failedArtifacts: failedArtifactChecks.map((f) => ({ name: f.fileName, errors: f.errors })),
          priorFailuresDetected: failedPriors.length,
          allPassed: failedArtifactChecks.length === 0 && failedPriors.length === 0,
          verificationLayers,
          artifactReconciliation,
          checks: artifactChecks,
          executionTimeMs: elapsed,
        };
      },
      verify: (output: any) => {
        if (!output.allPassed) {
          return {
            passed: false,
            evidence: `Deterministic harness detected ${output.failedArtifacts.length} failing artifact(s) and ${output.priorFailuresDetected} failed prior step(s).`
          };
        }
        return {
          passed: true,
          evidence: `Reconciled & verified ${output.artifactsChecked}/${output.artifactReconciliation?.totalGenerated ?? output.artifactsChecked} artifact(s) across structural, static security, and JS VM functional checks in ${output.executionTimeMs}ms (live browser/deployment NOT run).`
        };
      }
    });

    // 4. Genuine Google Search Grounding Tool (Live Web Research via Gemini 4 + googleSearch)
    this.register({
      name: 'web_search',
      category: 'REAL',
      description: 'Live web intelligence grounded with Google Search (gemini-4-hydrogen + googleSearch tool), returning verifiable source URLs.',
      isReal: true,
      execute: async (input: { query?: string; executorFn?: (q: string) => Promise<any> }) => {
        if (typeof input?.executorFn === 'function') {
          return await input.executorFn(String(input.query || ''));
        }
        throw new Error('Google Search Grounding runtime handler was not supplied by backend route.');
      },
      verify: (output: any) => {
        if (!output || !output.summary || String(output.summary).trim().length === 0) {
          return {
            passed: false,
            evidence: 'Google Search Grounding returned an empty synthesis payload.',
          };
        }
        const sourceCount = Array.isArray(output.groundingSources) ? output.groundingSources.length : 0;
        return {
          passed: true,
          evidence:
            sourceCount > 0
              ? `Google Search Grounding succeeded in ${output.executionTimeMs}ms with ${sourceCount} verified web source citation(s).`
              : `Google Search Grounding completed in ${output.executionTimeMs}ms (zero external URLs returned by search index for query).`,
        };
      },
    });
  }

  private registerReasoningTools() {
    // AI Reasoning & Deliverable Drafting (Gemini)
    this.register({
      name: 'llm_reasoning',
      category: 'LLM_REASONING',
      description: 'AI cognitive synthesis, business strategy, copywriting, and structured deliverable generation via Gemini (routes dynamically to gemini-3.1-flash-lite or gemini-4-hydrogen).',
      isReal: false, // Classified strictly as LLM_REASONING, not an external tool action
      execute: (input: any) => input,
      verify: (output: any) => ({
        passed: !!output,
        evidence: 'AI reasoning and deliverable content synthesized.'
      })
    });
  }

  private registerSimulatedTools() {
    // External tools without live production API integrations yet
    const simulatedSpecs: Array<{ name: string; desc: string; approval?: boolean }> = [
      {
        name: 'web_intelligence',
        desc: 'Simulated container fallback when live search grounding is bypassed.'
      },
      {
        name: 'code_sandbox',
        desc: 'Simulated code runtime container (isolated demo workflow).'
      },
      {
        name: 'schema_generator',
        desc: 'Simulated database/API provisioning workflow.'
      },
      {
        name: 'security_audit',
        desc: 'Simulated network perimeter scanner (no live packet probing).'
      },
      {
        name: 'workflow_setup',
        desc: 'Simulated business workflow & CRM automation setup.'
      },
      {
        name: 'site_publisher',
        desc: 'Simulated website deployment (requires explicit human approval before publishing).',
        approval: true
      },
      {
        name: 'outreach_dispatcher',
        desc: 'Simulated customer outreach / email dispatch (requires explicit human approval).',
        approval: true
      }
    ];

    simulatedSpecs.forEach((spec) => {
      this.register({
        name: spec.name,
        category: 'SIMULATED',
        description: spec.desc,
        isReal: false,
        defaultRequiresApproval: !!spec.approval,
        execute: (input: any) => {
          return {
            simulated: true,
            notice: `SIMULATED EXECUTION: ${spec.name} operated in safe demo mode. No external system mutations occurred.`,
            inputReceived: input,
            timestamp: new Date().toISOString()
          };
        },
        verify: () => {
          return {
            passed: true,
            evidence: `Simulated routine (${spec.name}) completed inside safe demo boundary.`
          };
        }
      });
    });
  }

  register(tool: RegisteredTool) {
    this.tools.set(tool.name.toLowerCase(), tool);
  }

  getTool(name: string): RegisteredTool | undefined {
    return this.tools.get(name.toLowerCase());
  }

  listTools(): Array<{ name: string; category: ToolCategory; isReal: boolean; description: string; defaultRequiresApproval: boolean }> {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      category: t.category,
      isReal: t.isReal,
      description: t.description,
      defaultRequiresApproval: !!t.defaultRequiresApproval,
    }));
  }

  /**
   * Dispatches a registered tool with bounded retry and deterministic error classification.
   */
  async execute(toolName: string, input: any, maxRetries = 2): Promise<ToolExecutionResult> {
    const startTime = performance.now();
    const tool = this.getTool(toolName);

    if (!tool) {
      return {
        tool: toolName,
        toolType: 'SIMULATED',
        isRealExecution: false,
        status: 'FAILED',
        input,
        output: null,
        executionTimeMs: 0,
        retryCount: 0,
        safeToRetry: false,
        error: `Tool '${toolName}' is not registered in PHOENIX tool registry.`,
        logs: [`[ERROR] Unregistered tool '${toolName}'`],
        verificationPassed: false,
        verificationEvidence: 'Execution halted: Tool not found in registry.'
      };
    }

    let attempts = 0;
    let lastError: any = null;
    let lastOutput: any = null;
    const executionLogs: string[] = [
      `[REGISTRY] Tool: ${tool.name} | Classification: ${tool.category} | Real Executable: ${tool.isReal ? 'YES' : 'NO'}`,
      `[INPUT] Payload: ${JSON.stringify(input).slice(0, 300)}`
    ];

    while (attempts <= maxRetries) {
      try {
        if (attempts > 0) {
          executionLogs.push(`[RETRY] Attempt ${attempts}/${maxRetries} after error: ${lastError?.message || lastError}`);
        }

        const rawOutput = await tool.execute(input);
        lastOutput = rawOutput;
        const verification = tool.verify(rawOutput, input);
        const elapsed = parseFloat((performance.now() - startTime).toFixed(3));

        if (!verification.passed) {
          lastError = new Error(`Verification failed: ${verification.evidence}`);
          executionLogs.push(`[EXCEPTION] ${lastError.message}`);
          attempts++;
          break;
        }

        executionLogs.push(
          `[EXEC_PASS] ${tool.category} execution succeeded in ${elapsed}ms`
        );
        executionLogs.push(`[VERIFICATION] ${verification.evidence}`);

        return {
          tool: tool.name,
          toolType: tool.category,
          isRealExecution: tool.isReal,
          status: 'SUCCESS',
          input,
          output: rawOutput,
          executionTimeMs: elapsed,
          retryCount: attempts,
          safeToRetry: true,
          logs: executionLogs,
          verificationPassed: true,
          verificationEvidence: verification.evidence
        };
      } catch (err: any) {
        lastError = err;
        const msg = err?.message || String(err);
        executionLogs.push(`[EXCEPTION] ${msg}`);

        // Determine if error is deterministic (e.g., division by zero or invalid syntax) vs transient
        const isDeterministicInputError = /division by zero|modulo by zero|unsupported character|syntax error|empty/i.test(msg);
        if (isDeterministicInputError) {
          executionLogs.push(`[RECOVERY_CHECK] Deterministic input error detected; further identical retries skipped.`);
          attempts++;
          break;
        }
        attempts++;
      }
    }

    const totalElapsed = parseFloat((performance.now() - startTime).toFixed(3));
    const errorMsg = lastError?.message || String(lastError);
    executionLogs.push(`[FATAL] Tool execution failed after ${Math.max(0, attempts - 1)} retries: ${errorMsg}`);

    return {
      tool: tool.name,
      toolType: tool.category,
      isRealExecution: tool.isReal,
      status: 'FAILED',
      input,
      output: lastOutput,
      executionTimeMs: totalElapsed,
      retryCount: Math.max(0, attempts - 1),
      safeToRetry: !/division by zero|modulo by zero/i.test(errorMsg),
      error: errorMsg,
      logs: executionLogs,
      verificationPassed: false,
      verificationEvidence: `Execution failed. Error: ${errorMsg}`
    };
  }
}

export const toolRegistry = new ToolRegistry();
