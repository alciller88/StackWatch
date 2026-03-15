export type ServiceCategory =
  | 'domain'
  | 'hosting'
  | 'cicd'
  | 'database'
  | 'auth'
  | 'payments'
  | 'email'
  | 'analytics'
  | 'monitoring'
  | 'cdn'
  | 'storage'
  | 'infra'
  | 'ai'
  | 'mobile'
  | 'gaming'
  | 'data'
  | 'messaging'
  | 'support'
  | 'other';

export interface Service {
  id: string;
  name: string;
  category: ServiceCategory;
  plan: 'free' | 'paid' | 'trial' | 'unknown';
  source: 'inferred' | 'manual';
  confidence?: 'high' | 'medium' | 'low';
  needsReview?: boolean;
  confidenceReasons?: string[];
  inferredFrom?: string;
  cost?: { amount: number; currency: string; period: 'monthly' | 'yearly' };
  renewalDate?: string;
  accountEmail?: string;
  notes?: string;
  url?: string;
}

export interface Dependency {
  name: string;
  version: string;
  type: 'production' | 'development' | 'peer';
  ecosystem:
    | 'npm'
    | 'pip'
    | 'cargo'
    | 'composer'
    | 'go'
    | 'dart'
    | 'maven'
    | 'gradle'
    | 'gem';
  relatedService?: string;
}

export interface FlowNode {
  id: string;
  label: string;
  type: 'user' | 'cdn' | 'frontend' | 'api' | 'database' | 'external';
  serviceId?: string;
}

export interface FlowEdge {
  source: string;
  target: string;
  label?: string;
  flowType: 'data' | 'auth' | 'payment' | 'webhook';
}

export interface AnalysisResult {
  services: Service[];
  dependencies: Dependency[];
  flowNodes: FlowNode[];
  flowEdges: FlowEdge[];
}

export interface UserConfig {
  version: string;
  project: {
    name: string;
    description: string;
  };
  services: Service[];
  accounts: {
    id: string;
    provider: string;
    purpose: string;
    accountEmail: string;
  }[];
}

export interface Evidence {
  type:
    | 'npm_package'
    | 'env_var'
    | 'url'
    | 'import'
    | 'config_file'
    | 'ci_secret'
    | 'domain';
  value: string;
  file: string;
  line?: number;
}

export interface HeuristicResult {
  serviceName: string;
  category: ServiceCategory;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

export interface AIProvider {
  name: string;
  baseUrl: string;
  model: string;
  apiKey?: string;
  recommended?: boolean;
  localOnly?: boolean;
  setupUrl?: string;
  description?: string;
}

export interface AISettings {
  enabled: boolean;
  provider: AIProvider;
}

export interface StackWatchAPI {
  analyzeLocal(folderPath: string): Promise<AnalysisResult>;
  analyzeGitHub(repo: string, token: string): Promise<AnalysisResult>;
  openFolder(): Promise<string | null>;
  loadConfig(repoPath: string): Promise<UserConfig | null>;
  saveConfig(repoPath: string, config: UserConfig): Promise<void>;
  getAISettings(): Promise<AISettings>;
  setAISettings(settings: AISettings): Promise<void>;
  testAIConnection(provider: AIProvider): Promise<{ ok: boolean; error?: string }>;
  getAIPresets(): Promise<AIProvider[]>;
  importConfig(repoPath: string): Promise<string | null>;
  exportConfig(content: string): Promise<boolean>;
  exportServicesMd(content: string): Promise<boolean>;
}

declare global {
  interface Window {
    stackwatch: StackWatchAPI;
  }
}
