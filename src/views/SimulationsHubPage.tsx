import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Star,
  Loader2,
  PlayCircle,
  Plus,
  Edit,
  Trash2,
  Boxes,
  Users,
} from 'lucide-react';
import {
  simulationTemplateApi,
  SimulationTemplate,
  CreateSimulationRequest,
  UpdateSimulationRequest,
} from '../services/simulationTemplateApi.js';
import { SimulationTemplateForm } from '../components/SimulationTemplateForm.js';
import { getSimulationIcon } from '../utils/simulationIcons.js';
import { useAuth } from '../context/AuthContext.js';

type HubTab = 'find' | 'yours' | 'saved' | 'build';

function creatorLabel(sim: SimulationTemplate): string {
  if (sim.visibility === 'global') return 'Admin';
  return sim.creator_username || 'User';
}

const SimulationsHubPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<HubTab>('find');
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SimulationTemplate[]>([]);
  const [search, setSearch] = useState('');
  const [showBuildForm, setShowBuildForm] = useState(false);
  const [editingSimulation, setEditingSimulation] = useState<SimulationTemplate | null>(null);
  const [togglingStarId, setTogglingStarId] = useState<string | null>(null);
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());

  const loadStarredIds = useCallback(async () => {
    try {
      const starred = await simulationTemplateApi.getStarred();
      setStarredIds(new Set(starred.map((s) => s.id)));
    } catch {
      setStarredIds(new Set());
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (activeTab === 'find') {
        const data = await simulationTemplateApi.getLibrary();
        setItems(data);
      } else if (activeTab === 'yours') {
        const data = await simulationTemplateApi.getMine();
        setItems(data);
      } else if (activeTab === 'saved') {
        const data = await simulationTemplateApi.getStarred();
        setItems(data);
      } else {
        setItems([]);
      }
      await loadStarredIds();
    } catch (err: unknown) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Failed to load simulations');
    } finally {
      setLoading(false);
    }
  }, [activeTab, loadStarredIds]);

  useEffect(() => {
    if (activeTab === 'build') {
      setLoading(false);
      return;
    }
    loadData();
  }, [activeTab, loadData]);

  const handleRun = (sim: SimulationTemplate) => {
    navigate(`/simulate?templateId=${encodeURIComponent(sim.id)}`);
  };

  const handleToggleStar = async (sim: SimulationTemplate) => {
    const id = sim.id;
    const isStarred = starredIds.has(id);
    setTogglingStarId(id);
    try {
      if (isStarred) {
        await simulationTemplateApi.unstar(id);
        setStarredIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } else {
        await simulationTemplateApi.star(id);
        setStarredIds((prev) => new Set([...prev, id]));
      }
      if (activeTab === 'saved') await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update saved');
    } finally {
      setTogglingStarId(null);
    }
  };

  const handleCreateOrUpdate = async (data: CreateSimulationRequest | UpdateSimulationRequest) => {
    if (editingSimulation) {
      await simulationTemplateApi.updateMine(editingSimulation.id, data);
    } else {
      await simulationTemplateApi.createMine(data as CreateSimulationRequest);
    }
    setShowBuildForm(false);
    setEditingSimulation(null);
    setActiveTab('yours');
    try {
      const mine = await simulationTemplateApi.getMine();
      setItems(mine);
      await loadStarredIds();
    } catch {
      /* list refresh best-effort */
    }
  };

  const handleEdit = (sim: SimulationTemplate) => {
    setEditingSimulation(sim);
    setShowBuildForm(true);
    setActiveTab('build');
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this simulation template?')) return;
    try {
      await simulationTemplateApi.deleteMine(id);
      await loadData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const filtered = useMemo(() => {
    const base =
      activeTab === 'yours' && user?.id ? items.filter((s) => s.user_id === user.id) : items;
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((s) => {
      return (
        (s.title || '').toLowerCase().includes(q) ||
        (s.description || '').toLowerCase().includes(q) ||
        creatorLabel(s).toLowerCase().includes(q)
      );
    });
  }, [items, search, activeTab, user?.id]);

  const tabs: { id: HubTab; label: string }[] = [
    { id: 'find', label: 'Find' },
    { id: 'yours', label: 'Your simulations' },
    { id: 'saved', label: 'Saved' },
    { id: 'build', label: 'Build' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Boxes className="w-8 h-8 text-indigo-600" />
            <h1 className="text-3xl font-black text-gray-900">Simulations</h1>
          </div>
          <p className="text-gray-600">
            Explore public templates, save favorites, build your own, then run from here or the runner.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingSimulation(null);
            setShowBuildForm(true);
            setActiveTab('build');
          }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-bold shrink-0"
        >
          <Plus className="w-4 h-4" />
          New simulation
        </button>
      </div>

      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex flex-wrap gap-4">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  if (tab.id === 'build') {
                    setActiveTab('build');
                    if (!editingSimulation) setShowBuildForm(true);
                  } else {
                    setActiveTab(tab.id);
                    setShowBuildForm(false);
                    setEditingSimulation(null);
                  }
                }}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  isActive
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {activeTab === 'build' ? (
        <div className="bg-white rounded-xl shadow border border-gray-100 p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <h2 className="text-xl font-bold text-gray-900">
              {editingSimulation ? 'Edit simulation' : 'Build simulation'}
            </h2>
            <button
              type="button"
              onClick={() => {
                setShowBuildForm(false);
                setEditingSimulation(null);
                setActiveTab('yours');
              }}
              className="text-sm text-gray-600 hover:text-indigo-600 font-medium"
            >
              Back to your simulations
            </button>
          </div>
          {(showBuildForm || editingSimulation) && (
            <SimulationTemplateForm
              simulation={editingSimulation}
              onSubmit={handleCreateOrUpdate}
              onCancel={() => {
                setShowBuildForm(false);
                setEditingSimulation(null);
                setActiveTab('yours');
              }}
            />
          )}
        </div>
      ) : loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
        </div>
      ) : (
        <>
          <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm mb-8">
            <div className="relative max-w-xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by title, description, or creator..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              <p className="text-gray-600 font-medium">
                {activeTab === 'find' && 'No public simulations to explore yet.'}
                {activeTab === 'yours' && "You haven't created any simulations yet. Open the Build tab."}
                {activeTab === 'saved' && 'Nothing saved yet. Star simulations from Find or the runner list.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((sim) => {
                const Icon = getSimulationIcon(sim.icon);
                const minP = sim.persona_count_min ?? 1;
                const maxP = sim.persona_count_max ?? 1;
                return (
                  <div
                    key={sim.id}
                    className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm flex flex-col hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-2 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          title={starredIds.has(sim.id) ? 'Remove from saved' : 'Save'}
                          onClick={() => handleToggleStar(sim)}
                          disabled={togglingStarId === sim.id}
                          className="p-2 rounded-lg text-gray-400 hover:text-amber-500 hover:bg-amber-50 disabled:opacity-50"
                        >
                          {togglingStarId === sim.id ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <Star
                              className={`w-5 h-5 ${starredIds.has(sim.id) ? 'fill-amber-400 text-amber-500' : ''}`}
                            />
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold text-gray-900">{sim.title}</h3>
                      {activeTab === 'yours' && (
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            sim.visibility === 'public'
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {sim.visibility === 'public' ? 'Public' : 'Private'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mb-2">
                      {activeTab === 'yours' ? (
                        <span className="text-gray-600">Your template</span>
                      ) : (
                        <>
                          By <span className="font-semibold text-gray-700">{creatorLabel(sim)}</span>
                          {activeTab === 'find' && sim.visibility === 'public' && (
                            <span className="ml-2 text-indigo-600 font-medium">· Public</span>
                          )}
                        </>
                      )}
                    </p>
                    {sim.description ? (
                      <p className="text-sm text-gray-500 line-clamp-3 flex-grow mb-4">{sim.description}</p>
                    ) : (
                      <div className="flex-grow mb-4" />
                    )}
                    <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
                      <Users className="w-4 h-4" />
                      <span>
                        {minP === maxP ? `${minP} persona${minP !== 1 ? 's' : ''}` : `${minP}–${maxP} personas`}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-auto">
                      <button
                        type="button"
                        onClick={() => handleRun(sim)}
                        className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700"
                      >
                        <PlayCircle className="w-4 h-4" />
                        Run
                      </button>
                      {activeTab === 'yours' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleEdit(sim)}
                            className="p-2 border border-gray-200 rounded-lg text-indigo-600 hover:bg-gray-50"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(sim.id)}
                            className="p-2 border border-gray-200 rounded-lg text-red-600 hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SimulationsHubPage;
