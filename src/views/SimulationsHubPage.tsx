import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Boxes, Sparkles } from 'lucide-react';
import {
  simulationTemplateApi,
  CreateSimulationRequest,
  UpdateSimulationRequest,
} from '../services/simulationTemplateApi.js';
import { SimulationTemplateForm } from '../components/SimulationTemplateForm.js';

const SimulationsHubPage: React.FC = () => {
  const navigate = useNavigate();
  const [formKey, setFormKey] = useState(0);
  const [savedBanner, setSavedBanner] = useState(false);

  const handleCreate = async (data: CreateSimulationRequest | UpdateSimulationRequest) => {
    await simulationTemplateApi.createMine(data as CreateSimulationRequest);
    setFormKey((k) => k + 1);
    setSavedBanner(true);
    window.setTimeout(() => setSavedBanner(false), 5000);
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
                  New template
                </h2>
                <p className="text-sm text-slate-500">
                  Configure type, prompts, and inputs. Save to add it to your account; use Run
                  simulation to try it with personas.
                </p>
              </div>
            </div>
          </div>
          {savedBanner && (
            <div
              role="status"
              className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"
            >
              Template saved. Open <span className="font-bold">Run simulation</span> to use it.
            </div>
          )}
          <SimulationTemplateForm
            key={formKey}
            simulation={null}
            onSubmit={handleCreate}
            onCancel={() => navigate('/')}
          />
        </section>
      </div>
    </main>
  );
};

export default SimulationsHubPage;
