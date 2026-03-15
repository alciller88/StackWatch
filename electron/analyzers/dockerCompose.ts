import yaml from 'js-yaml'
import type { Service, FlowNode, FlowEdge } from '../types'

const IMAGE_MAP: Record<string, { name: string; category: Service['category'] }> = {
  postgres: { name: 'PostgreSQL', category: 'database' },
  mysql: { name: 'MySQL', category: 'database' },
  mariadb: { name: 'MariaDB', category: 'database' },
  mongo: { name: 'MongoDB', category: 'database' },
  redis: { name: 'Redis', category: 'database' },
  nginx: { name: 'Nginx', category: 'cdn' },
  rabbitmq: { name: 'RabbitMQ', category: 'other' },
  elasticsearch: { name: 'Elasticsearch', category: 'other' },
  mailhog: { name: 'MailHog', category: 'email' },
  minio: { name: 'MinIO', category: 'storage' },
  memcached: { name: 'Memcached', category: 'database' },
}

interface ComposeFile {
  services?: Record<
    string,
    {
      image?: string
      depends_on?: string[] | Record<string, unknown>
      ports?: string[]
    }
  >
}

export function analyzeDockerCompose(content: string): {
  services: Service[]
  flowNodes: FlowNode[]
  flowEdges: FlowEdge[]
} {
  const compose = yaml.load(content) as ComposeFile
  const services: Service[] = []
  const flowNodes: FlowNode[] = []
  const flowEdges: FlowEdge[] = []

  if (!compose?.services) return { services, flowNodes, flowEdges }

  for (const [svcName, svcDef] of Object.entries(compose.services)) {
    const image = svcDef.image?.split(':')[0]?.split('/').pop() ?? ''

    const match = Object.entries(IMAGE_MAP).find(([key]) =>
      image.includes(key)
    )

    if (match) {
      const [, meta] = match
      const serviceId = `docker-${meta.name.toLowerCase().replace(/\s/g, '-')}`
      services.push({
        id: serviceId,
        name: meta.name,
        category: meta.category,
        plan: 'free',
        source: 'inferred',
        inferredFrom: `docker-compose.yml → ${svcName} (${image})`,
      })

      flowNodes.push({
        id: `docker-${svcName}`,
        label: meta.name,
        type: meta.category === 'database' ? 'database' : 'external',
        serviceId,
      })
    } else {
      flowNodes.push({
        id: `docker-${svcName}`,
        label: svcName,
        type: 'api',
      })
    }

    const dependsOn = Array.isArray(svcDef.depends_on)
      ? svcDef.depends_on
      : svcDef.depends_on
        ? Object.keys(svcDef.depends_on)
        : []

    for (const dep of dependsOn) {
      flowEdges.push({
        source: `docker-${svcName}`,
        target: `docker-${dep}`,
        flowType: 'data',
        label: 'depends_on',
      })
    }
  }

  return { services, flowNodes, flowEdges }
}
