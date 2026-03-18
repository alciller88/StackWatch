import { z } from 'zod'

export const schemas = {
  analyzeLocal: z.object({
    folderPath: z.string().min(1).max(4096),
  }),
  analyzeGitHub: z.object({
    repo: z.string().regex(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/),
    token: z.string().max(256).optional(),
  }),
  saveConfig: z.object({
    repoPath: z.string().min(1),
    config: z.object({
      version: z.string(),
      services: z.array(z.object({
        id: z.string(),
        name: z.string(),
        category: z.string(),
        plan: z.enum(['free', 'paid', 'trial', 'unknown']),
        source: z.enum(['inferred', 'manual']),
      }).passthrough()),
    }).passthrough(),
  }),
  loadConfig: z.object({
    repoPath: z.string().min(1),
  }),
  exportConfig: z.object({
    content: z.string().max(10 * 1024 * 1024), // 10MB max
  }),
  setAISettings: z.object({
    settings: z.object({
      enabled: z.boolean(),
      provider: z.object({
        name: z.string(),
        baseUrl: z.string().url(),
        model: z.string(),
        apiKey: z.string().optional(),
      }),
    }),
  }),
  openExternalUrl: z.object({
    url: z.string().url().refine(
      url => url.startsWith('http://') || url.startsWith('https://'),
      'Only http/https URLs allowed',
    ),
  }),
  scanVulnerabilities: z.object({
    deps: z.array(z.object({
      name: z.string(),
      version: z.string(),
      type: z.string(),
    })).max(5000),
  }),
  exportServicesMd: z.object({
    content: z.string().max(10 * 1024 * 1024),
  }),
  getStackDiff: z.object({
    folderPath: z.string().min(1),
  }),
  getScoreHistory: z.object({
    folderPath: z.string().min(1),
  }),
  saveScoreEntry: z.object({
    folderPath: z.string().min(1),
    entry: z.object({
      timestamp: z.string(),
      score: z.number(),
      passingChecks: z.number(),
      totalChecks: z.number(),
      serviceCount: z.number(),
      depCount: z.number(),
      source: z.enum(['scan', 'manual']).optional(),
    }),
  }),
  checkRenewals: z.object({
    services: z.array(z.object({
      id: z.string(),
      name: z.string(),
      category: z.string(),
      plan: z.string(),
      source: z.string(),
    }).passthrough()),
  }),
  testAIConnection: z.object({
    provider: z.object({
      name: z.string(),
      baseUrl: z.string().url(),
      model: z.string(),
      apiKey: z.string().optional(),
    }),
  }),
  generateSbom: z.object({
    deps: z.array(z.object({
      name: z.string(),
      version: z.string(),
      type: z.string(),
    })),
    projectName: z.string(),
    format: z.enum(['cyclonedx', 'spdx']),
  }),
  exportHtml: z.object({
    data: z.object({
      projectName: z.string(),
    }).passthrough(),
  }),
}

export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  channel: string,
): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    console.error(`[IPC Validation] ${channel}:`, result.error.issues)
    throw new Error(`Invalid arguments for ${channel}: ${result.error.message}`)
  }
  return result.data
}
