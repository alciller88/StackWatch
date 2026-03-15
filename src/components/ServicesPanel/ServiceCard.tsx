import React from 'react';
import type { Service } from '../../types';

const categoryIcons: Record<Service['category'], string> = {
  domain: '\uD83C\uDF10',
  hosting: '\u2601\uFE0F',
  cicd: '\uD83D\uDD04',
  database: '\uD83D\uDDC4\uFE0F',
  auth: '\uD83D\uDD10',
  payments: '\uD83D\uDCB3',
  email: '\u2709\uFE0F',
  analytics: '\uD83D\uDCCA',
  monitoring: '\uD83D\uDCE1',
  cdn: '\u26A1',
  storage: '\uD83D\uDCC1',
  infra: '\uD83C\uDFD7\uFE0F',
  ai: '\uD83E\uDD16',
  mobile: '\uD83D\uDCF1',
  gaming: '\uD83C\uDFAE',
  data: '\uD83D\uDCC0',
  messaging: '\uD83D\uDCE8',
  support: '\uD83C\uDFE7',
  other: '\uD83D\uDD27',
};

const planColors: Record<Service['plan'], string> = {
  free: 'bg-green-900/40 text-green-400 border-green-800',
  paid: 'bg-amber-900/40 text-amber-400 border-amber-800',
  trial: 'bg-blue-900/40 text-blue-400 border-blue-800',
  unknown: 'bg-gray-800 text-gray-400 border-gray-700',
};

const confidenceBadge: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: '', text: '', label: '' },
  medium: { bg: 'bg-yellow-900/40', text: 'text-yellow-400', label: 'review' },
  low: { bg: 'bg-orange-900/40', text: 'text-orange-400', label: 'incomplete' },
};

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

interface ServiceCardProps {
  service: Service;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({ service }) => {
  const days = service.renewalDate ? daysUntil(service.renewalDate) : null;
  const confidence = service.confidence ?? 'high';
  const badge = confidenceBadge[confidence];

  let renewalColor = 'text-gray-400';
  if (days !== null) {
    if (days < 7) renewalColor = 'text-red-400';
    else if (days < 30) renewalColor = 'text-amber-400';
  }

  return (
    <div
      className={`bg-gray-900 border rounded-xl p-4 hover:border-gray-700 transition-colors ${
        confidence === 'low'
          ? 'border-orange-800/50 border-dashed'
          : confidence === 'medium'
          ? 'border-yellow-800/30'
          : 'border-gray-800'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xl" role="img" aria-label={service.category}>
            {categoryIcons[service.category]}
          </span>
          <div>
            <h3 className="text-sm font-medium text-gray-100">{service.name}</h3>
            <span className="text-xs text-gray-500 capitalize">
              {service.category}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Confidence badge */}
          {badge.label && (
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${badge.bg} ${badge.text} border ${
                confidence === 'low' ? 'border-orange-800' : 'border-yellow-800'
              }`}
              title={service.confidenceReasons?.join('\n') ?? ''}
            >
              {confidence === 'low' && '\u26A0 '}
              {badge.label}
            </span>
          )}

          {/* Source badge */}
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
              service.source === 'inferred'
                ? 'bg-purple-900/40 text-purple-400 border border-purple-800'
                : 'bg-gray-800 text-gray-400 border border-gray-700'
            }`}
          >
            {service.source}
          </span>
        </div>
      </div>

      {/* Plan badge */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${planColors[service.plan]}`}
        >
          {service.plan}
        </span>
      </div>

      {/* Cost */}
      {service.cost && (
        <div className="text-xs text-gray-400 mb-2">
          <span className="text-gray-200 font-medium">
            {service.cost.currency} {service.cost.amount}
          </span>
          <span className="text-gray-500"> / {service.cost.period}</span>
        </div>
      )}

      {/* Renewal date */}
      {service.renewalDate && (
        <div className={`text-xs mb-2 ${renewalColor}`}>
          Renews: {new Date(service.renewalDate).toLocaleDateString()}
          {days !== null && days < 30 && (
            <span className="ml-1 font-medium">
              ({days < 0 ? 'overdue' : `${days}d left`})
            </span>
          )}
        </div>
      )}

      {/* Inferred from */}
      {service.source === 'inferred' && service.inferredFrom && (
        <div className="text-[10px] text-gray-600 mt-2 truncate" title={service.inferredFrom}>
          Inferred from: {service.inferredFrom}
        </div>
      )}

      {/* Notes */}
      {service.notes && (
        <div className="text-xs text-gray-500 mt-2 line-clamp-2">
          {service.notes}
        </div>
      )}
    </div>
  );
};
