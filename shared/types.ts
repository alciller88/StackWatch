export const SERVICE_CATEGORIES = [
  'domain', 'hosting', 'cicd', 'database', 'auth', 'payments',
  'email', 'analytics', 'monitoring', 'cdn', 'storage', 'infra',
  'ai', 'mobile', 'gaming', 'data', 'messaging', 'support', 'other',
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

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
  owner?: string;
  comment?: string;
  lastActivityDate?: string;
  daysSinceActivity?: number;
  zombieStatus?: 'active' | 'stale' | 'zombie';
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
  deepAnalysis?: DeepAnalysisResult;
  aiError?: string;
  monorepo?: {
    type: string;
    packages: string[];
  };
}

export interface GraphNodeData {
  label: string;
  category?: ServiceCategory;
  nodeType?: FlowNode['type'];
  plan?: Service['plan'];
  confidence?: 'high' | 'medium' | 'low';
  url?: string;
  note?: string;
  source?: 'inferred' | 'manual';
}

export interface GraphConfig {
  nodes: {
    id: string;
    position: { x: number; y: number };
    data: GraphNodeData;
  }[];
  edges: {
    id: string;
    source: string;
    target: string;
    type: FlowEdge['flowType'];
  }[];
  excludedServices: string[];
}

export interface StackSource {
  type: 'local' | 'github';
  githubRepo?: string;
  githubBranch?: string;
  lastSeenPath?: string;
}

export type LinkStatus = 'linked' | 'unlinked' | 'unknown';

export interface UserConfig {
  version: string;
  source?: StackSource;
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
  graph?: GraphConfig;
  confidenceOverrides?: Record<string, 'high' | 'medium' | 'low'>;
  budget?: {
    monthly: number;
    currency: string;
    alertThreshold?: number;
  };
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

export type ScanMode = 'heuristic' | 'hybrid';

export interface AISettings {
  enabled: boolean;
  provider: AIProvider;
  scanMode?: ScanMode;
}

export interface ServiceContext {
  serviceId: string;
  usage: string;
  criticalityLevel: 'critical' | 'important' | 'optional';
  usageLocations: string[];
  warnings?: string[];
}

export interface DeepAnalysisResult {
  serviceContexts: ServiceContext[];
  hiddenServices: Service[];
  inferredEdgeTypes: { serviceId: string; flowType: FlowEdge['flowType']; reason: string }[];
}

export interface Vulnerability {
  id: string;
  summary: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'unknown';
  aliases: string[];
  fixedVersion?: string;
  url?: string;
}

export interface DepVulnResult {
  ecosystem: string;
  name: string;
  version: string;
  vulnerabilities: Vulnerability[];
}

export interface StackDiffResult {
  added: Service[];
  removed: Service[];
  changed: {
    service: Service;
    previousCategory: ServiceCategory;
    previousConfidence: 'high' | 'medium' | 'low';
  }[];
  addedDeps: Dependency[];
  removedDeps: Dependency[];
  timestamp: string;
  previousTimestamp: string;
}

export interface ScoreHistoryEntry {
  timestamp: string;
  score: number;
  breakdown: {
    servicesWithCost: number;
    servicesWithOwner: number;
    servicesReviewed: number;
    graphCompleteness: number;
  };
  serviceCount: number;
  depCount: number;
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
  importConfig(): Promise<UserConfig | null>;
  exportConfig(content: string): Promise<boolean>;
  exportServicesMd(content: string): Promise<boolean>;
  checkLinkStatus(config: UserConfig): Promise<LinkStatus>;
  relinkLocal(): Promise<string | null>;
  scanVulnerabilities(deps: Dependency[]): Promise<DepVulnResult[]>;
  getStackDiff(folderPath: string): Promise<StackDiffResult | null>;
  getScoreHistory(folderPath: string): Promise<ScoreHistoryEntry[]>;
  checkRenewals(services: Service[]): Promise<void>;
  openExternalUrl(url: string): Promise<boolean>;
  windowMinimize(): void;
  windowMaximize(): void;
  windowClose(): void;
  windowIsMaximized(): Promise<boolean>;
}
