import fs from 'fs/promises'
import path from 'path'
import type { Service, Dependency, AnalysisResult } from '../types'
import { analyzePackageJson } from './packageJson'
import { analyzeEnvFile } from './envFile'
import { analyzeDockerCompose } from './dockerCompose'
import { analyzeGithubWorkflows } from './githubWorkflows'
import { analyzeConfigFile } from './configFiles'
import { inferFlowGraph } from './flowInference'

async function readFileIfExists(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8')
  } catch {
    return null
  }
}

export async function analyzeLocalRepo(
  folderPath: string
): Promise<AnalysisResult> {
  const allServices: Service[] = []
  const allDeps: Dependency[] = []

  // package.json
  const pkgContent = await readFileIfExists(
    path.join(folderPath, 'package.json')
  )
  if (pkgContent) {
    const result = analyzePackageJson(pkgContent)
    allServices.push(...result.services)
    allDeps.push(...result.dependencies)
  }

  // .env files
  for (const envFile of ['.env', '.env.example', '.env.local']) {
    const content = await readFileIfExists(path.join(folderPath, envFile))
    if (content) {
      const result = analyzeEnvFile(content, envFile)
      allServices.push(...result.services)
    }
  }

  // docker-compose
  for (const dcFile of ['docker-compose.yml', 'docker-compose.yaml']) {
    const content = await readFileIfExists(path.join(folderPath, dcFile))
    if (content) {
      const result = analyzeDockerCompose(content)
      allServices.push(...result.services)
    }
  }

  // GitHub workflows
  const workflowsDir = path.join(folderPath, '.github', 'workflows')
  try {
    const files = await fs.readdir(workflowsDir)
    for (const file of files) {
      if (file.endsWith('.yml') || file.endsWith('.yaml')) {
        const content = await readFileIfExists(
          path.join(workflowsDir, file)
        )
        if (content) {
          const result = analyzeGithubWorkflows(content, file)
          allServices.push(...result.services)
        }
      }
    }
  } catch {
    // workflows dir doesn't exist
  }

  // Config files
  const configFiles = [
    'vercel.json',
    'netlify.toml',
    'firebase.json',
    'fly.toml',
    'render.yaml',
    'railway.json',
  ]
  for (const cf of configFiles) {
    const content = await readFileIfExists(path.join(folderPath, cf))
    if (content) {
      const result = analyzeConfigFile(content, cf)
      allServices.push(...result.services)
    }
  }

  // Deduplicate services
  const seenIds = new Set<string>()
  const uniqueServices = allServices.filter((s) => {
    if (seenIds.has(s.id)) return false
    seenIds.add(s.id)
    return true
  })

  // Infer flow graph
  const flow = inferFlowGraph(uniqueServices, allDeps)

  return {
    services: uniqueServices,
    dependencies: allDeps,
    flowNodes: flow.nodes,
    flowEdges: flow.edges,
  }
}
