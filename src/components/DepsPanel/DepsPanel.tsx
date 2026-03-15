import React, { useState, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import type { Dependency } from '../../types';

type SortKey = 'name' | 'type';
type SortDir = 'asc' | 'desc';

const typeColors: Record<Dependency['type'], string> = {
  production: 'bg-green-900/40 text-green-400 border-green-800',
  development: 'bg-blue-900/40 text-blue-400 border-blue-800',
  peer: 'bg-amber-900/40 text-amber-400 border-amber-800',
};

const ecosystemUrls: Record<Dependency['ecosystem'], (name: string) => string> = {
  npm: (name) => `https://www.npmjs.com/package/${name}`,
  pip: (name) => `https://pypi.org/project/${name}`,
  cargo: (name) => `https://crates.io/crates/${name}`,
  composer: (name) => `https://packagist.org/packages/${name}`,
};

export const DepsPanel: React.FC = () => {
  const { dependencies } = useStore();
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
      window.open(urlFn(dep.name), '_blank');
    }
  };

  const SortIcon: React.FC<{ column: SortKey }> = ({ column }) => {
    if (sortKey !== column) return <span className="text-gray-600 ml-1">&#8645;</span>;
    return (
      <span className="text-blue-400 ml-1">
        {sortDir === 'asc' ? '\u2191' : '\u2193'}
      </span>
    );
  };

  const renderRow = (dep: Dependency) => (
    <tr
      key={`${dep.ecosystem}-${dep.name}`}
      className="border-b border-gray-800/50 hover:bg-gray-800/30 cursor-pointer transition-colors"
      onClick={() => openExternal(dep)}
      title={`Open ${dep.name} on ${dep.ecosystem}`}
    >
      <td className="px-4 py-2.5 text-sm text-gray-200">{dep.name}</td>
      <td className="px-4 py-2.5 text-sm text-gray-400 font-mono">{dep.version}</td>
      <td className="px-4 py-2.5">
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${typeColors[dep.type]}`}
        >
          {dep.type}
        </span>
      </td>
      <td className="px-4 py-2.5 text-sm text-gray-500">{dep.ecosystem}</td>
    </tr>
  );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-100">
            Dependencies
            <span className="ml-2 text-sm text-gray-500 font-normal">
              ({filtered.length})
            </span>
          </h2>
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={groupByType}
              onChange={(e) => setGroupByType(e.target.checked)}
              className="rounded bg-gray-800 border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-0"
            />
            Group by type
          </label>
        </div>

        <div className="flex gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
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
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Type filter */}
          <div className="flex gap-1.5">
            {(['all', 'production', 'development', 'peer'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-2.5 py-1 text-xs rounded-full capitalize transition-colors ${
                  filterType === t
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
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
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            {dependencies.length === 0
              ? 'No dependencies found. Analyze a repository to get started.'
              : 'No dependencies match your filters.'}
          </div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 bg-gray-900 z-10">
              <tr className="border-b border-gray-800">
                <th
                  className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-200"
                  onClick={() => handleSort('name')}
                >
                  Name <SortIcon column="name" />
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Version
                </th>
                <th
                  className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-200"
                  onClick={() => handleSort('type')}
                >
                  Type <SortIcon column="type" />
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Ecosystem
                </th>
              </tr>
            </thead>
            <tbody>
              {grouped
                ? Object.entries(grouped).map(([type, deps]) => (
                    <React.Fragment key={type}>
                      <tr className="bg-gray-900/80">
                        <td
                          colSpan={4}
                          className="px-4 py-2 text-xs font-semibold text-gray-300 uppercase tracking-wider"
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
