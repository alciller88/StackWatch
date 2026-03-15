import React, { useState, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { ServiceCard } from './ServiceCard';
import type { Service } from '../../types';

const categories: Service['category'][] = [
  'domain',
  'hosting',
  'cicd',
  'database',
  'auth',
  'payments',
  'email',
  'analytics',
  'monitoring',
  'cdn',
  'storage',
  'other',
];

const planTypes: Service['plan'][] = ['free', 'paid', 'trial', 'unknown'];

export const ServicesPanel: React.FC = () => {
  const { services } = useStore();
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<Service['category'] | 'all'>('all');
  const [activePlan, setActivePlan] = useState<Service['plan'] | 'all'>('all');
  const [showAddForm, setShowAddForm] = useState(false);

  const filtered = useMemo(() => {
    return services.filter((s) => {
      if (search && !s.name.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      if (activeCategory !== 'all' && s.category !== activeCategory) {
        return false;
      }
      if (activePlan !== 'all' && s.plan !== activePlan) {
        return false;
      }
      return true;
    });
  }, [services, search, activeCategory, activePlan]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-800 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-100">
            Services
            <span className="ml-2 text-sm text-gray-500 font-normal">
              ({filtered.length})
            </span>
          </h2>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            + Add Service
          </button>
        </div>

        {/* Search */}
        <div className="relative">
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
            placeholder="Search services..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
              activeCategory === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-2.5 py-1 text-xs rounded-full capitalize transition-colors ${
                activeCategory === cat
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Plan filters */}
        <div className="flex gap-1.5">
          <button
            onClick={() => setActivePlan('all')}
            className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
              activePlan === 'all'
                ? 'bg-gray-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            All Plans
          </button>
          {planTypes.map((plan) => (
            <button
              key={plan}
              onClick={() => setActivePlan(plan)}
              className={`px-2.5 py-1 text-xs rounded-full capitalize transition-colors ${
                activePlan === plan
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {plan}
            </button>
          ))}
        </div>
      </div>

      {/* Add Service Form (basic) */}
      {showAddForm && <AddServiceForm onClose={() => setShowAddForm(false)} />}

      {/* Grid */}
      <div className="flex-1 overflow-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            {services.length === 0
              ? 'No services detected. Analyze a repository to get started.'
              : 'No services match your filters.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/** Basic add-service form */
const AddServiceForm: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { config, saveConfig } = useStore();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Service['category']>('other');
  const [plan, setPlan] = useState<Service['plan']>('unknown');

  const handleAdd = async () => {
    if (!name.trim()) return;

    const newService: Service = {
      id: name.toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(),
      name: name.trim(),
      category,
      plan,
      source: 'manual',
    };

    const currentConfig = config ?? {
      version: '1',
      project: { name: '', description: '' },
      services: [],
      accounts: [],
    };

    await saveConfig({
      ...currentConfig,
      services: [...currentConfig.services, newService],
    });
    onClose();
  };

  return (
    <div className="px-6 py-4 border-b border-gray-800 bg-gray-900/50">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs text-gray-400 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Service name"
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Service['category'])}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Plan</label>
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value as Service['plan'])}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
          >
            {planTypes.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleAdd}
          className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
        >
          Add
        </button>
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 rounded transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
