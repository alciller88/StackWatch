export interface Service {
  id: string;
  name: string;
  category:
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
    | 'other';
  plan: 'free' | 'paid' | 'trial' | 'unknown';
  source: 'inferred' | 'manual';
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
  ecosystem: 'npm' | 'pip' | 'cargo' | 'composer';
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

export interface StackWatchAPI {
  analyzeLocal(folderPath: string): Promise<AnalysisResult>;
  analyzeGitHub(repo: string, token: string): Promise<AnalysisResult>;
  saveConfig(config: UserConfig): Promise<void>;
  loadConfig(): Promise<UserConfig>;
  openFolder(): Promise<string | null>;
}

declare global {
  interface Window {
    stackwatch: StackWatchAPI;
  }
}
