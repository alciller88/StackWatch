import { describe, it, expect } from 'vitest'
import { analyzeTerraform } from '../terraform'

describe('analyzeTerraform', () => {
  it('detects providers from provider blocks', () => {
    const content = `
provider "aws" {
  region = "us-east-1"
}

provider "cloudflare" {
  api_token = var.cf_token
}
    `.trim()

    const result = analyzeTerraform(content, 'main.tf')
    const names = result.services.map((s) => s.name).sort()
    expect(names).toEqual(['AWS', 'Cloudflare'])
  })

  it('detects providers from resource types', () => {
    const content = `
resource "aws_instance" "web" {
  ami           = "ami-abc123"
  instance_type = "t2.micro"
}

resource "google_compute_instance" "default" {
  name = "test"
}
    `.trim()

    const result = analyzeTerraform(content, 'main.tf')
    const names = result.services.map((s) => s.name).sort()
    expect(names).toEqual(['AWS', 'Google Cloud'])
  })

  it('deduplicates providers', () => {
    const content = `
provider "aws" {
  region = "us-east-1"
}

resource "aws_s3_bucket" "data" {
  bucket = "my-bucket"
}

resource "aws_lambda_function" "handler" {
  function_name = "handler"
}
    `.trim()

    const result = analyzeTerraform(content, 'main.tf')
    expect(result.services).toHaveLength(1)
    expect(result.services[0].name).toBe('AWS')
  })

  it('sets correct inferredFrom', () => {
    const content = 'provider "aws" { region = "us-east-1" }'
    const result = analyzeTerraform(content, 'infra.tf')
    expect(result.services[0].inferredFrom).toBe('infra.tf → provider aws')
  })

  it('sets correct categories', () => {
    const content = `
provider "aws" {}
provider "datadog" {}
provider "cloudflare" {}
    `.trim()

    const result = analyzeTerraform(content, 'main.tf')
    const byName = Object.fromEntries(result.services.map((s) => [s.name, s.category]))
    expect(byName['AWS']).toBe('infra')
    expect(byName['Datadog']).toBe('monitoring')
    expect(byName['Cloudflare']).toBe('cdn')
  })

  it('handles empty tf file', () => {
    const result = analyzeTerraform('# empty file', 'main.tf')
    expect(result.services).toHaveLength(0)
  })

  it('detects required_providers', () => {
    const content = `
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}
    `.trim()

    const result = analyzeTerraform(content, 'main.tf')
    expect(result.services).toHaveLength(1)
    expect(result.services[0].name).toBe('AWS')
  })
})
