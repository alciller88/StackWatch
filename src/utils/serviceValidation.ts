import type { Service } from '../types'

/**
 * Determines whether a service should be flagged for review.
 * Used when updating a service from any entry point (NodeEditPanel, ServicesPanel)
 * to automatically recalculate needsReview.
 */
export function shouldNeedReview(service: Service): boolean {
  if (service.confidence === 'high') return false
  if (!service.category || service.category === 'other') return true
  if (service.aiContext?.warnings?.length) return true
  return false
}
