import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Boxes, Sparkles, Loader2 } from 'lucide-react';
import {
  simulationTemplateApi,
  CreateSimulationRequest,
  UpdateSimulationRequest,
  SimulationTemplate,
} from '../services/simulationTemplateApi.js';
import { SimulationTemplateForm } from '../components/SimulationTemplateForm.js';
import { useVoiceTarget } from '../voice/useVoiceTarget.js';

const SimulationsHubPage: React.FC = () => {
  const navigate = useNavigate();
  const gotoRunRef = useRef<HTMLAnchorElement>(null);
  useVoiceTarget({
    id: 'simulations.goto_run',
    label: 'Open Run simulation page',
    action: 'click',
    ref: gotoRunRef,
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const [editingSimulation, setEditingSimulation] = useState<SimulationTemplate | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editLoadError, setEditLoadError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [savedBanner, setSavedBanner] = useState(false);
  const [savedBannerWasUpdate, setSavedBannerWasUpdate] = useState(false);

  useEffect(() => {
    if (!editId) {
      setEditingSimulation(null);
      setEditLoadError(null);
      setEditLoading(false);
      return;
    }
    let cancelled = false;
    setEditLoading(true);
    setEditLoadError(null);
    void simulationTemplateApi
      .getByIdUser(editId)
      .then((t) => {
        if (!cancelled) setEditingSimulation(t);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setEditingSimulation(null);
          setEditLoadError(err instanceof Error ? err.message : 'Failed to load template');
        }
      })
      .finally(() => {
        if (!cancelled) setEditLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editId]);

  const clearEditQuery = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('edit');
    setSearchParams(next, { replace: true });
  };

  const handleSubmit = async (data: CreateSimulationRequest | UpdateSimulationRequest) => {
    if (editingSimulation) {
      await simulationTemplateApi.updateMine(editingSimulation.id, data as UpdateSimulationRequest);
      clearEditQuery();
      setEditingSimulation(null);
      setFormKey((k) => k + 1);
      setSavedBannerWasUpdate(true);
      setSavedBanner(true);
      window.setTimeout(() => setSavedBanner(false), 5000);
    } else {
      await simulationTemplateApi.createMine(data as CreateSimulationRequest);
      setFormKey((k) => k + 1);
      setSavedBannerWasUpdate(false);
      setSavedBanner(true);
      window.setTimeout(() => setSavedBanner(false), 5000);
    }
  };

  const handleCancel = () => {
    if (editId) {
      clearEditQuery();
      navigate('/simulate');
    } else {
      navigate('/');
    }
  };

  return (
    <main className="min-h-full bg-gradient-to-b from-slate-50 to-white pb-16">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <header className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-600">
              Build simulation
            </p>
            <div className="mb-2 flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25">
                <Boxes className="h-6 w-6" aria-hidden />
              </span>
              <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                Build simulation
              </h1>
            </div>
            <p className="max-w-xl text-base leading-relaxed text-slate-600">
              Define your scenario: type, system prompt, inputs, and visibility. When you are
              finished, run it from Run simulation.
            </p>
            <Link
              ref={gotoRunRef}
              to="/simulate"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-md hover:bg-indigo-700"
            >
              Open Run simulation
            </Link>
          </div>
        </header>

        <section
          aria-labelledby="build-heading"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ring-1 ring-slate-950/5 sm:p-8"
        >
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Sparkles className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <h2 id="build-heading" className="text-xl font-bold text-slate-900">
                  {editingSimulation ? 'Edit template' : 'New template'}
                </h2>
                <p className="text-sm text-slate-500">
                  {editingSimulation
                    ? 'Update type, prompts, inputs, or visibility. Changes apply the next time you run this simulation.'
                    : 'Configure type, prompts, and inputs. Save to add it to your account; use Run simulation to try it with personas.'}
                </p>
              </div>
            </div>
          </div>
          {editId && editLoading && (
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <Loader2 className="h-5 w-5 animate-spin text-indigo-600 shrink-0" aria-hidden />
              Loading template…
            </div>
          )}
          {editId && editLoadError && (
            <div
              role="alert"
              className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
            >
              <p className="font-medium">{editLoadError}</p>
              <button
                type="button"
                onClick={() => {
                  clearEditQuery();
                  navigate('/simulate');
                }}
                className="mt-2 text-sm font-semibold text-indigo-700 hover:text-indigo-900"
              >
                Back to Run simulation
              </button>
            </div>
          )}
          {savedBanner && (
            <div
              role="status"
              className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"
            >
              {savedBannerWasUpdate ? (
                <>Template updated. Open <span className="font-bold">Run simulation</span> to use the latest version.</>
              ) : (
                <>Template saved. Open <span className="font-bold">Run simulation</span> to use it.</>
              )}
            </div>
          )}
          {!(editId && (editLoading || editLoadError)) && (
            <SimulationTemplateForm
              key={editingSimulation ? `${formKey}-edit-${editingSimulation.id}` : formKey}
              simulation={editingSimulation}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
            />
          )}
        </section>
      </div>
    </main>
  );
};

export default SimulationsHubPage;
