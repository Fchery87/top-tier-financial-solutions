import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

// Type definitions for dispute configuration
export interface LegalCitation {
  section: string;
  code: string;
  description: string;
}

export interface EscalationTriggers {
  verified?: string;
  updated?: string;
  no_response?: string;
  deleted?: string | null;
  no_documentation?: string;
  no_validation?: string;
  denied?: string;
  approved?: string | null;
}

export interface Metro2Field {
  field: string;
  codes?: string[];
  format?: string;
  description: string;
  requirement?: string;
}

export interface Methodology {
  name: string;
  description: string;
  round_range: number[];
  target_recipients: string[];
  best_for: string[];
  legal_citations: {
    primary: LegalCitation[];
    secondary?: LegalCitation[];
  };
  escalation_triggers: EscalationTriggers;
  success_indicators?: string[];
  metro2_fields?: {
    base_segment: Metro2Field[];
    k_segment?: Metro2Field[];
  };
  required_demands?: string[];
  required_documentation?: string[];
  approach?: string;
  key_elements?: string[];
}

export interface BureauConfig {
  name: string;
  address: string;
  phone: string;
  online_dispute: string;
  fax: string;
  specific_requirements: string[];
  response_timeframe_days: number;
  investigation_methods: string[];
}

export interface ReasonCode {
  code: string;
  label: string;
  description: string;
  methodology_fit: string[];
  fcra_section?: string;
  dispute_strength: string;
  requires_documentation?: string[];
  metro2_field?: string;
}

export interface ReasonCodeCategory {
  [key: string]: ReasonCode[];
}

export interface DisputeOutcome {
  code: string;
  label: string;
  description: string;
  next_action: string | null;
  is_success: boolean | string;
  fcra_violation?: boolean;
}

export interface ItemTypeConfig {
  recommended_methodologies: string[];
  common_issues: string[];
  required_metro2_fields?: string[];
  reporting_limit_years?: number;
}

export interface DisputeStrategiesConfig {
  version: string;
  methodologies: Record<string, Methodology>;
  bureaus: Record<string, BureauConfig>;
  reason_codes: ReasonCodeCategory;
  escalation_paths: Record<string, Record<string, unknown>>;
  outcomes: DisputeOutcome[];
  item_types: Record<string, ItemTypeConfig>;
}

export interface PromptConfig {
  methodology: string;
  version: string;
  system_context: string;
  writing_guidelines: {
    tone: string;
    reading_level: string;
    avoid: string[];
    include: string[];
    [key: string]: unknown;
  };
  prompt_template: string;
  round_variations?: Record<string, {
    additional_context: string;
    escalation_warning: string;
  }>;
  target_variations?: Record<string, {
    addressee: string;
    opening: string;
    legal_focus: string[];
  }>;
  [key: string]: unknown;
}

// Cache for loaded configs
let strategiesConfig: DisputeStrategiesConfig | null = null;
const promptConfigs: Map<string, PromptConfig> = new Map();

const CONFIG_DIR = path.join(process.cwd(), 'config');
const PROMPTS_DIR = path.join(CONFIG_DIR, 'prompts');

// Load main strategies config
export function loadStrategiesConfig(): DisputeStrategiesConfig {
  if (strategiesConfig) {
    return strategiesConfig;
  }

  try {
    const configPath = path.join(CONFIG_DIR, 'dispute-strategies.yaml');
    const fileContents = fs.readFileSync(configPath, 'utf8');
    strategiesConfig = yaml.load(fileContents) as DisputeStrategiesConfig;
    return strategiesConfig;
  } catch (error) {
    console.error('Error loading dispute strategies config:', error);
    throw new Error('Failed to load dispute strategies configuration');
  }
}

// Load methodology-specific prompt config
export function loadPromptConfig(methodology: string): PromptConfig | null {
  if (promptConfigs.has(methodology)) {
    return promptConfigs.get(methodology)!;
  }

  const promptFileName = getPromptFileName(methodology);
  const promptPath = path.join(PROMPTS_DIR, promptFileName);

  try {
    if (!fs.existsSync(promptPath)) {
      console.warn(`Prompt config not found for methodology: ${methodology}`);
      return null;
    }

    const fileContents = fs.readFileSync(promptPath, 'utf8');
    const config = yaml.load(fileContents) as PromptConfig;
    promptConfigs.set(methodology, config);
    return config;
  } catch (error) {
    console.error(`Error loading prompt config for ${methodology}:`, error);
    return null;
  }
}

function getPromptFileName(methodology: string): string {
  const fileMap: Record<string, string> = {
    factual: 'factual-dispute.yaml',
    metro2_compliance: 'metro2-compliance.yaml',
    consumer_law: 'consumer-law.yaml',
    method_of_verification: 'method-of-verification.yaml',
    debt_validation: 'debt-validation.yaml',
    goodwill: 'goodwill.yaml',
  };
  return fileMap[methodology] || `${methodology}.yaml`;
}

// Get methodology details
export function getMethodology(methodologyKey: string): Methodology | null {
  const config = loadStrategiesConfig();
  return config.methodologies[methodologyKey] || null;
}

// Get all methodologies
export function getAllMethodologies(): Record<string, Methodology> {
  const config = loadStrategiesConfig();
  return config.methodologies;
}

// Get bureau config
export function getBureauConfig(bureau: string): BureauConfig | null {
  const config = loadStrategiesConfig();
  return config.bureaus[bureau.toLowerCase()] || null;
}

// Get reason codes filtered by methodology
export function getReasonCodesForMethodology(methodology: string): ReasonCode[] {
  const config = loadStrategiesConfig();
  const allCodes: ReasonCode[] = [];
  
  for (const category of Object.values(config.reason_codes)) {
    for (const code of category) {
      if (code.methodology_fit.includes(methodology)) {
        allCodes.push(code);
      }
    }
  }
  
  return allCodes;
}

// Get all reason codes grouped by category
export function getAllReasonCodes(): ReasonCodeCategory {
  const config = loadStrategiesConfig();
  return config.reason_codes;
}

// Get flat list of all reason codes
export function getAllReasonCodesFlat(): ReasonCode[] {
  const config = loadStrategiesConfig();
  const allCodes: ReasonCode[] = [];
  
  for (const category of Object.values(config.reason_codes)) {
    allCodes.push(...category);
  }
  
  return allCodes;
}

// Get item type configuration
export function getItemTypeConfig(itemType: string): ItemTypeConfig | null {
  const config = loadStrategiesConfig();
  return config.item_types[itemType] || null;
}

// Get recommended methodology for item type
export function getRecommendedMethodology(itemType: string, round: number = 1): string {
  const itemConfig = getItemTypeConfig(itemType);
  if (itemConfig && itemConfig.recommended_methodologies.length > 0) {
    // For round 2+, prefer method_of_verification if available
    if (round >= 2 && itemConfig.recommended_methodologies.includes('method_of_verification')) {
      return 'method_of_verification';
    }
    return itemConfig.recommended_methodologies[0];
  }
  return 'factual'; // Default to factual
}

// Get escalation suggestion based on outcome
export function getEscalationSuggestion(
  methodology: string,
  outcome: string
): string | null {
  const methodologyConfig = getMethodology(methodology);
  if (!methodologyConfig) return null;
  
  const triggers = methodologyConfig.escalation_triggers;
  return (triggers as Record<string, string | null>)[outcome] || null;
}

// Get outcomes configuration
export function getOutcomes(): DisputeOutcome[] {
  const config = loadStrategiesConfig();
  return config.outcomes;
}

// Build legal citations string for a methodology
export function buildLegalCitationsString(methodology: string): string {
  const methodologyConfig = getMethodology(methodology);
  if (!methodologyConfig) return '';
  
  const citations: string[] = [];
  
  for (const citation of methodologyConfig.legal_citations.primary) {
    citations.push(`${citation.section} (${citation.code}): ${citation.description}`);
  }
  
  if (methodologyConfig.legal_citations.secondary) {
    for (const citation of methodologyConfig.legal_citations.secondary) {
      citations.push(`${citation.section} (${citation.code}): ${citation.description}`);
    }
  }
  
  return citations.join('\n');
}

// Clear caches (useful for development/testing)
export function clearConfigCache(): void {
  strategiesConfig = null;
  promptConfigs.clear();
}

// Export types
export type {
  DisputeStrategiesConfig,
  PromptConfig,
};
