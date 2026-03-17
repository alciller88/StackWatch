import React from 'react'

const shimmer = {
  background: 'var(--color-bg-tertiary)',
  borderRadius: 0,
  animation: 'pulse 1.5s ease-in-out infinite',
}

export const SkeletonBlock: React.FC<{ width?: string; height?: string; className?: string }> = ({
  width = '100%',
  height = '12px',
  className = '',
}) => (
  <div className={className} style={{ ...shimmer, width, height }} />
)

export const SkeletonServiceCard: React.FC = () => (
  <div
    className="border p-4 space-y-3"
    style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}
  >
    <div className="flex items-center gap-2.5">
      <SkeletonBlock width="28px" height="28px" />
      <div className="flex-1 space-y-1.5">
        <SkeletonBlock width="60%" height="12px" />
        <SkeletonBlock width="30%" height="8px" />
      </div>
    </div>
    <SkeletonBlock width="40px" height="16px" />
    <SkeletonBlock width="80%" height="10px" />
    <SkeletonBlock width="50%" height="10px" />
  </div>
)

export const SkeletonTableRow: React.FC = () => (
  <tr>
    <td className="px-4 py-2.5"><SkeletonBlock width="120px" height="12px" /></td>
    <td className="px-4 py-2.5"><SkeletonBlock width="50px" height="12px" /></td>
    <td className="px-4 py-2.5"><SkeletonBlock width="70px" height="16px" /></td>
    <td className="px-4 py-2.5"><SkeletonBlock width="40px" height="12px" /></td>
  </tr>
)

export const ServicesPanelSkeleton: React.FC = () => (
  <div className="flex-1 flex flex-col min-h-0">
    <div className="px-6 py-4 border-b space-y-3" style={{ borderColor: 'var(--color-border)' }}>
      <SkeletonBlock width="120px" height="16px" />
      <SkeletonBlock height="36px" />
      <div className="flex gap-1.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonBlock key={i} width="60px" height="24px" />
        ))}
      </div>
    </div>
    <div className="flex-1 overflow-auto p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <SkeletonServiceCard key={i} />
        ))}
      </div>
    </div>
  </div>
)

export const DepsPanelSkeleton: React.FC = () => (
  <div className="flex-1 flex flex-col min-h-0">
    <div className="px-6 py-4 border-b space-y-3" style={{ borderColor: 'var(--color-border)' }}>
      <SkeletonBlock width="140px" height="16px" />
      <div className="flex gap-3">
        <SkeletonBlock height="36px" className="flex-1" />
        <div className="flex gap-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock key={i} width="70px" height="28px" />
          ))}
        </div>
      </div>
    </div>
    <div className="flex-1 overflow-auto">
      <table className="w-full">
        <thead className="sticky top-0 z-10" style={{ background: 'var(--color-bg-secondary)' }}>
          <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
            <th className="px-4 py-2.5"><SkeletonBlock width="40px" height="8px" /></th>
            <th className="px-4 py-2.5"><SkeletonBlock width="50px" height="8px" /></th>
            <th className="px-4 py-2.5"><SkeletonBlock width="30px" height="8px" /></th>
            <th className="px-4 py-2.5"><SkeletonBlock width="60px" height="8px" /></th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 12 }).map((_, i) => (
            <SkeletonTableRow key={i} />
          ))}
        </tbody>
      </table>
    </div>
  </div>
)

export const FlowGraphSkeleton: React.FC = () => (
  <div
    className="flex-1 flex items-center justify-center"
    style={{
      background: 'var(--color-bg-primary)',
      backgroundImage: 'linear-gradient(var(--color-grid) 1px, transparent 1px), linear-gradient(90deg, var(--color-grid) 1px, transparent 1px)',
      backgroundSize: '32px 32px',
    }}
  >
    <div className="space-y-4 text-center">
      <div className="flex justify-center gap-8">
        <SkeletonBlock width="140px" height="48px" />
        <SkeletonBlock width="140px" height="48px" />
        <SkeletonBlock width="140px" height="48px" />
      </div>
      <div className="flex justify-center gap-12">
        <SkeletonBlock width="140px" height="48px" />
        <SkeletonBlock width="140px" height="48px" />
      </div>
      <SkeletonBlock width="100px" height="10px" className="mx-auto" />
    </div>
  </div>
)

export const DiscardedPanelSkeleton: React.FC = () => (
  <div className="flex-1 flex flex-col min-h-0">
    <div className="px-6 py-4 border-b space-y-3" style={{ borderColor: 'var(--color-border)' }}>
      <SkeletonBlock width="120px" height="16px" />
      <SkeletonBlock height="36px" />
      <div className="flex gap-1.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonBlock key={i} width="70px" height="24px" />
        ))}
      </div>
    </div>
    <div className="flex-1 overflow-auto">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="px-6 py-3 border-b flex items-center gap-3" style={{ borderColor: 'var(--color-border)' }}>
          <SkeletonBlock width="120px" height="12px" />
          <SkeletonBlock width="30px" height="12px" />
          <SkeletonBlock width="70px" height="16px" />
          <div className="ml-auto"><SkeletonBlock width="60px" height="24px" /></div>
        </div>
      ))}
    </div>
  </div>
)

export const CostsPanelSkeleton: React.FC = () => (
  <div className="flex-1 overflow-y-auto p-6" style={{ background: 'var(--color-bg-primary)' }}>
    <SkeletonBlock width="120px" height="14px" className="mb-6" />
    <div className="grid grid-cols-3 gap-px mb-6" style={{ background: 'var(--color-border)' }}>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="p-4" style={{ background: 'var(--color-bg-secondary)' }}>
          <SkeletonBlock width="60px" height="8px" className="mb-2" />
          <SkeletonBlock width="80px" height="20px" />
        </div>
      ))}
    </div>
    <SkeletonBlock width="100px" height="8px" className="mb-3" />
    <div className="border space-y-0" style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="grid grid-cols-3 px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <SkeletonBlock width="80px" height="10px" />
          <SkeletonBlock width="20px" height="10px" className="ml-auto" />
          <SkeletonBlock width="60px" height="10px" className="ml-auto" />
        </div>
      ))}
    </div>
  </div>
)
