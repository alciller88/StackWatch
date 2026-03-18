/**
 * Sanitize strings before interpolating into AI prompts.
 * Prevents prompt injection by removing control characters and
 * escaping sequences that could be interpreted as system instructions.
 */
export function sanitizeForPrompt(input: string): string {
  if (!input || typeof input !== 'string') return ''
  return input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .slice(0, 200)
    .trim()
}
