import React, { useState, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useStore } from '../../store/useStore';
import { useToastStore } from '../../store/toastStore';
import type { Dependency, DepVulnResult, Vulnerability } from '../../types';

type SortKey = 'name' | 'type';
type SortDir = 'asc' | 'desc';

const typeColors: Record<Dependency['type'], string> = {
  production: 'bg-[#1a3a1a] text-[#3d8c5e] border-[#2a5a2a]',
  development: 'bg-[#1a2a3a] text-[#4a8ab0] border-[#2a4a6a]',
  peer: 'bg-[#2a1e0a] text-[#e2b04a] border-[#6b3d0a]',
};

const ecosystemUrls: Record<Dependency['ecosystem'], (name: string) => string> = {
  npm: (name) => `https://www.npmjs.com/package/${name}`,
  pip: (name) => `https://pypi.org/project/${name}`,
  cargo: (name) => `https://crates.io/crates/${name}`,
  composer: (name) => `https://packagist.org/packages/${name}`,
  go: (name) => `https://pkg.go.dev/${name}`,
  dart: (name) => `https://pub.dev/packages/${name}`,
  maven: (name) => `https://search.maven.org/search?q=${name}`,
  gradle: (name) => `https://search.maven.org/search?q=${name}`,
  gem: (name) => `https://rubygems.org/gems/${name}`,
};

export const DepsPanel: React.FC = () => {
  const { dependencies, repoPath } = useStore();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<Dependency['type'] | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [groupByType, setGroupByType] = useState(false);
  const [vulnResults, setVulnResults] = useState<DepVulnResult[]>([]);
  const [vulnLoading, setVulnLoading] = useState(false);
  const [vulnScanned, setVulnScanned] = useState(false);

  const scanVulns = async () => {
    if (!window.stackwatch?.scanVulnerabilities || dependencies.length === 0) return;
    setVulnLoading(true);
    try {
      const results = await window.stackwatch.scanVulnerabilities(dependencies);
      setVulnResults(results);
      setVulnScanned(true);
    } catch {
      useToastStore.getState().addToast('Vulnerability scan failed', 'error');
    } finally {
      setVulnLoading(false);
    }
  };

  const vulnMap = useMemo(() => {
    const map = new Map<string, DepVulnResult>();
    for (const r of vulnResults) {
      map.set(`${r.ecosystem}-${r.name}`, r);
    }
    return map;
  }, [vulnResults]);

  const totalVulns = vulnResults.reduce((sum, r) => sum + r.vulnerabilities.length, 0);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const filtered = useMemo(() => {
    let result = dependencies.filter((d) => {
      if (search && !d.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (filterType !== 'all' && d.type !== filterType) {
        return false;
      }
      return true;
    });

    result.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      const cmp = aVal.localeCompare(bVal);
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [dependencies, search, filterType, sortKey, sortDir]);

  const grouped = useMemo(() => {
    if (!groupByType) return null;
    const groups: Record<string, typeof filtered> = {};
    for (const dep of filtered) {
      if (!groups[dep.type]) groups[dep.type] = [];
      groups[dep.type].push(dep);
    }
    return groups;
  }, [filtered, groupByType]);

  const tableContainerRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: grouped ? 0 : filtered.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 41,
    overscan: 20,
  });

  const openExternal = (dep: Dependency) => {
    const urlFn = ecosystemUrls[dep.ecosystem];
    if (urlFn) {
      window.stackwatch.openExternalUrl(urlFn(dep.name));
    }
  };

  const SortIcon: React.FC<{ column: SortKey }> = ({ column }) => {
    if (sortKey !== column) return <span className="text-[var(--color-text-muted)] ml-1">&#8645;</span>;
    return (
      <span className="text-[var(--color-accent)] ml-1">
        {sortDir === 'asc' ? '\u2191' : '\u2193'}
      </span>
    );
  };

  const renderRow = (dep: Dependency) => (
    <tr
      key={`${dep.ecosystem}-${dep.name}`}
      className="border-b cursor-pointer transition-colors hover:bg-[var(--color-bg-hover)]"
      style={{ borderColor: 'rgba(30,36,48,0.3)' }}
      onClick={() => openExternal(dep)}
      title={`Open ${dep.name} on ${dep.ecosystem}`}
    >
      <td className="px-4 py-2.5 font-mono text-[12px] text-[var(--color-text-primary)]">
        <span className="flex items-center gap-1.5">
          {dep.name}
          {vulnMap.has(`${dep.ecosystem}-${dep.name}`) && (
            <span
              className="shrink-0 text-[10px] px-1 py-0.5 font-medium uppercase tracking-wide"
              style={{ color: '#c05050', border: '1px solid #c05050' }}
              title={vulnMap.get(`${dep.ecosystem}-${dep.name}`)!.vulnerabilities.map((v: Vulnerability) => `${v.id}: ${v.summary}`).join('\n')}
            >
              {vulnMap.get(`${dep.ecosystem}-${dep.name}`)!.vulnerabilities.length} vuln{vulnMap.get(`${dep.ecosystem}-${dep.name}`)!.vulnerabilities.length !== 1 ? 's' : ''}
            </span>
          )}
        </span>
      </td>
      <td className="px-4 py-2.5 font-mono text-[11px] text-[var(--color-text-secondary)]">{dep.version}</td>
      <td className="px-4 py-2.5">
        <span
          className={`text-[11px] px-2 py-0.5 rounded-sm border font-medium ${typeColors[dep.type]}`}
        >
          {dep.type}
        </span>
      </td>
      <td className="px-4 py-2.5 font-mono text-[11px] text-[var(--color-text-muted)]">{dep.ecosystem}</td>
    </tr>
  );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-6 py-4 border-b space-y-3" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex items-center justify-between">
          <h2 className="font-mono uppercase tracking-widest text-sm font-medium text-[var(--color-text-primary)]">
            Dependencies
            <span className="ml-2 font-mono text-[11px] text-[var(--color-text-muted)] font-normal">
              ({filtered.length})
            </span>
          </h2>
          <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] cursor-pointer">
            <input
              type="checkbox"
              checked={groupByType}
              onChange={(e) => setGroupByType(e.target.checked)}
              className="rounded-sm border-[var(--color-border)]"
              style={{ accentColor: 'var(--color-accent)' }}
            />
            Group by type
          </label>
          <button
            onClick={scanVulns}
            disabled={vulnLoading || dependencies.length === 0}
            className="flex items-center gap-1.5 px-2.5 py-1 font-mono text-[11px] tracking-widest uppercase rounded-sm transition-colors border disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              borderColor: vulnScanned && totalVulns > 0 ? '#c05050' : 'var(--color-border)',
              color: vulnScanned && totalVulns > 0 ? '#c05050' : 'var(--color-text-secondary)',
            }}
          >
            {vulnLoading ? (
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m9-7a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {vulnScanned
              ? totalVulns > 0 ? `${totalVulns} vuln${totalVulns !== 1 ? 's' : ''}` : 'No vulns'
              : 'Scan vulns'}
          </button>
        </div>

        <div className="flex gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search dependencies..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full border rounded-sm pl-10 pr-4 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-accent)]"
              style={{ background: 'var(--color-bg-secondary)', borderColor: 'var(--color-border)' }}
            />
          </div>

          {/* Type filter */}
          <div className="flex gap-1.5">
            {(['all', 'production', 'development', 'peer'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest rounded-sm capitalize transition-colors ${
                  filterType === t
                    ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]'
                    : 'bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]'
                }`}
              >
                {t === 'all' ? 'All' : t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Vulnerability summary */}
      {vulnScanned && totalVulns > 0 && (
        <div className="px-6 py-2 border-b flex items-center gap-3" style={{ borderColor: 'var(--color-border)', background: '#1a0a0a' }}>
          <span className="text-[#c05050] font-mono text-[11px] uppercase tracking-widest font-medium">
            {totalVulns} vulnerabilit{totalVulns !== 1 ? 'ies' : 'y'} in {vulnResults.length} package{vulnResults.length !== 1 ? 's' : ''}
          </span>
          <span className="text-[var(--color-text-muted)] font-mono text-[11px]">
            via OSV.dev
          </span>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto" ref={tableContainerRef}>
        {filtered.length === 0 ? (
          dependencies.length === 0 && repoPath ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
              <svg className="w-12 h-12 text-[var(--color-text-muted)] opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <div>
                <p className="font-mono text-sm text-[var(--color-text-secondary)] uppercase tracking-widest mb-2">No dependencies found</p>
                <p className="font-mono text-[11px] text-[var(--color-text-muted)] max-w-md leading-relaxed">
                  Make sure the project has a package.json, requirements.txt, Cargo.toml, go.mod, or similar dependency file.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-[var(--color-text-muted)] text-sm">
              {dependencies.length === 0
                ? 'No dependencies found. Analyze a repository to get started.'
                : 'No dependencies match your filters.'}
            </div>
          )
        ) : (
          <table className="w-full">
            <caption className="absolute w-px h-px p-0 -m-px overflow-hidden" style={{ clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>Project dependencies</caption>
            <thead className="sticky top-0 z-10" style={{ background: 'var(--color-bg-secondary)' }}>
              <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                <th
                  className="px-4 py-2.5 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)] cursor-pointer hover:text-[var(--color-text-secondary)]"
                  onClick={() => handleSort('name')}
                >
                  Name <SortIcon column="name" />
                </th>
                <th className="px-4 py-2.5 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
                  Version
                </th>
                <th
                  className="px-4 py-2.5 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)] cursor-pointer hover:text-[var(--color-text-secondary)]"
                  onClick={() => handleSort('type')}
                >
                  Type <SortIcon column="type" />
                </th>
                <th className="px-4 py-2.5 text-left font-mono text-[10px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
                  Ecosystem
                </th>
              </tr>
            </thead>
            <tbody>
              {grouped
                ? Object.entries(grouped).map(([type, deps]) => (
                    <React.Fragment key={type}>
                      <tr style={{ background: 'var(--color-bg-secondary)' }}>
                        <td
                          colSpan={4}
                          className="px-4 py-2 font-mono text-[10px] font-medium text-[var(--color-text-secondary)] uppercase tracking-widest"
                        >
                          {type} ({deps.length})
                        </td>
                      </tr>
                      {deps.map(renderRow)}
                    </React.Fragment>
                  ))
                : (
                  <>
                    {rowVirtualizer.getVirtualItems().length > 0 && (
                      <tr style={{ height: rowVirtualizer.getVirtualItems()[0]?.start ?? 0 }}>
                        <td colSpan={4} />
                      </tr>
                    )}
                    {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                      const dep = filtered[virtualRow.index];
                      return renderRow(dep);
                    })}
                    {rowVirtualizer.getVirtualItems().length > 0 && (
                      <tr style={{ height: rowVirtualizer.getTotalSize() - (rowVirtualizer.getVirtualItems().at(-1)?.end ?? 0) }}>
                        <td colSpan={4} />
                      </tr>
                    )}
                  </>
                )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
