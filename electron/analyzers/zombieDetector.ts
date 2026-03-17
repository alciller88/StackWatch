import type { Service, Evidence } from '../types'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export type ZombieStatus = 'active' | 'stale' | 'zombie'

export interface ZombieResult {
  serviceId: string
  lastActivityDate: string | null
  daysSinceActivity: number | null
  status: ZombieStatus
}

async function getLastCommitDate(repoPath: string, filePath: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', ['log', '-1', '--format=%aI', '--', filePath], {
      cwd: repoPath,
      timeout: 10000,
    })
    const date = stdout.trim()
    return date || null
  } catch {
    return null
  }
}

function daysBetween(date1: Date, date2: Date): number {
  const ms = Math.abs(date2.getTime() - date1.getTime())
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

function getZombieStatus(days: number | null): ZombieStatus {
  if (days === null) return 'active'
  if (days >= 180) return 'zombie'
  if (days >= 90) return 'stale'
  return 'active'
}

function getServiceFiles(service: Service, evidences: Evidence[]): string[] {
  const files = new Set<string>()

  if (service.inferredFrom) {
    files.add(service.inferredFrom)
  }

  const serviceName = service.name.toLowerCase()
  for (const ev of evidences) {
    if (
      ev.value.toLowerCase().includes(serviceName) ||
      ev.file.toLowerCase().includes(serviceName)
    ) {
      files.add(ev.file)
    }
  }

  return Array.from(files)
}

export async function detectZombieServices(
  services: Service[],
  evidences: Evidence[],
  repoPath: string,
): Promise<ZombieResult[]> {
  const inferredServices = services.filter(s => s.source === 'inferred')

  const fileDateCache = new Map<string, string | null>()

  async function getCachedDate(file: string): Promise<string | null> {
    if (fileDateCache.has(file)) return fileDateCache.get(file)!
    const date = await getLastCommitDate(repoPath, file)
    fileDateCache.set(file, date)
    return date
  }

  const results: ZombieResult[] = []

  for (const service of inferredServices) {
    const files = getServiceFiles(service, evidences)

    if (files.length === 0) {
      results.push({
        serviceId: service.id,
        lastActivityDate: null,
        daysSinceActivity: null,
        status: 'active',
      })
      continue
    }

    const dates = await Promise.all(files.map(f => getCachedDate(f)))
    const validDates = dates.filter((d): d is string => d !== null)

    if (validDates.length === 0) {
      results.push({
        serviceId: service.id,
        lastActivityDate: null,
        daysSinceActivity: null,
        status: 'active',
      })
      continue
    }

    validDates.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
    const lastActivity = validDates[0]
    const days = daysBetween(new Date(lastActivity), new Date())

    results.push({
      serviceId: service.id,
      lastActivityDate: lastActivity,
      daysSinceActivity: days,
      status: getZombieStatus(days),
    })
  }

  return results
}

export function enrichServicesWithZombieData(
  services: Service[],
  zombieResults: ZombieResult[],
): Service[] {
  const zombieMap = new Map(zombieResults.map(r => [r.serviceId, r]))

  return services.map(service => {
    const zombie = zombieMap.get(service.id)
    if (!zombie) return service

    return {
      ...service,
      lastActivityDate: zombie.lastActivityDate ?? undefined,
      daysSinceActivity: zombie.daysSinceActivity ?? undefined,
      zombieStatus: zombie.status,
    }
  })
}
