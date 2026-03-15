import { describe, it, expect } from 'vitest'
import { analyzeEnvFile } from '../envFile'

describe('analyzeEnvFile — expanded patterns', () => {
  it('detects AI services', () => {
    const content = `
OPENAI_API_KEY=sk-xxx
ANTHROPIC_API_KEY=sk-ant-xxx
HUGGINGFACE_TOKEN=hf_xxx
WANDB_API_KEY=xxx
    `.trim()

    const result = analyzeEnvFile(content, '.env')
    const names = result.services.map((s) => s.name).sort()
    expect(names).toEqual(['Anthropic', 'HuggingFace', 'OpenAI', 'Weights & Biases'])
  })

  it('detects mobile services', () => {
    const content = `
FIREBASE_API_KEY=xxx
APPCENTER_TOKEN=xxx
ONESIGNAL_APP_ID=xxx
    `.trim()

    const result = analyzeEnvFile(content, '.env')
    const names = result.services.map((s) => s.name).sort()
    expect(names).toEqual(['App Center', 'Firebase', 'OneSignal'])
    expect(result.services.find((s) => s.name === 'Firebase')?.category).toBe('mobile')
  })

  it('detects data services', () => {
    const content = `
SNOWFLAKE_ACCOUNT=xxx
DATABRICKS_HOST=xxx
PINECONE_API_KEY=xxx
ELASTICSEARCH_URL=http://localhost:9200
    `.trim()

    const result = analyzeEnvFile(content, '.env')
    const names = result.services.map((s) => s.name).sort()
    expect(names).toEqual(['Databricks', 'Elasticsearch', 'Pinecone', 'Snowflake'])
  })

  it('detects messaging services', () => {
    const content = `
RABBITMQ_URL=amqp://localhost
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
PUSHER_APP_ID=xxx
    `.trim()

    const result = analyzeEnvFile(content, '.env')
    const names = result.services.map((s) => s.name).sort()
    expect(names).toEqual(['Apache Kafka', 'Pusher', 'RabbitMQ'])
  })

  it('detects gaming services', () => {
    const content = `
STEAM_API_KEY=xxx
DISCORD_TOKEN=xxx
PLAYFAB_TITLE_ID=xxx
    `.trim()

    const result = analyzeEnvFile(content, '.env')
    const names = result.services.map((s) => s.name).sort()
    expect(names).toEqual(['Discord', 'PlayFab', 'Steam'])
  })

  it('detects support services', () => {
    const content = `
INTERCOM_APP_ID=xxx
ZENDESK_API_KEY=xxx
    `.trim()

    const result = analyzeEnvFile(content, '.env')
    const names = result.services.map((s) => s.name).sort()
    expect(names).toEqual(['Intercom', 'Zendesk'])
  })

  it('still detects original web services', () => {
    const content = `
STRIPE_SECRET_KEY=sk_test_xxx
SENTRY_DSN=https://xxx@sentry.io/123
DATABASE_URL=postgres://localhost/mydb
    `.trim()

    const result = analyzeEnvFile(content, '.env.example')
    const names = result.services.map((s) => s.name).sort()
    expect(names).toEqual(['PostgreSQL', 'Sentry', 'Stripe'])
  })
})
