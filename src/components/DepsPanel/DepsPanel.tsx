import React, { useState, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import type { Dependency } from '../../types';

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
      className="border-b cursor-pointer transition-colors"
      style={{ borderColor: 'rgba(30,36,48,0.3)' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(20,26,36,0.4)')}
      onMouseLeave={e => (e.currentTarget.style.background = '')}
      onClick={() => openExternal(dep)}
      title={`Open ${dep.name} on ${dep.ecosystem}`}
    >
      <td className="px-4 py-2.5 font-mono text-[12px] text-[var(--color-text-primary)]">{dep.name}</td>
      <td className="px-4 py-2.5 font-mono text-[11px] text-[var(--color-text-secondary)]">{dep.version}</td>
      <td className="px-4 py-2.5">
        <span
          className={`text-[10px] px-2 py-0.5 rounded-sm border font-medium ${typeColors[dep.type]}`}
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
                className={`px-2.5 py-1 font-mono text-[9px] uppercase tracking-widest rounded-sm capitalize transition-colors ${
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

      {/* Table */}
      <div className="flex-1 overflow-auto">
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
            <thead className="sticky top-0 z-10" style={{ background: 'var(--color-bg-secondary)' }}>
              <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                <th
                  className="px-4 py-2.5 text-left font-mono text-[9px] font-medium uppercase tracking-widest text-[var(--color-text-muted)] cursor-pointer hover:text-[var(--color-text-secondary)]"
                  onClick={() => handleSort('name')}
                >
                  Name <SortIcon column="name" />
                </th>
                <th className="px-4 py-2.5 text-left font-mono text-[9px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
                  Version
                </th>
                <th
                  className="px-4 py-2.5 text-left font-mono text-[9px] font-medium uppercase tracking-widest text-[var(--color-text-muted)] cursor-pointer hover:text-[var(--color-text-secondary)]"
                  onClick={() => handleSort('type')}
                >
                  Type <SortIcon column="type" />
                </th>
                <th className="px-4 py-2.5 text-left font-mono text-[9px] font-medium uppercase tracking-widest text-[var(--color-text-muted)]">
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
                          className="px-4 py-2 font-mono text-[9px] font-medium text-[var(--color-text-secondary)] uppercase tracking-widest"
                        >
                          {type} ({deps.length})
                        </td>
                      </tr>
                      {deps.map(renderRow)}
                    </React.Fragment>
                  ))
                : filtered.map(renderRow)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
