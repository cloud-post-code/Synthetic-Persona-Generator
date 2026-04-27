import React from 'react';
import {
  Star,
  Loader2,
  PlayCircle,
  Edit,
  Trash2,
  Users,
  Layers,
} from 'lucide-react';
import type { SimulationTemplate } from '../services/simulationTemplateApi.js';
import { getSimulationIcon } from '../utils/simulationIcons.js';

export type SimulationHubTabContext = 'find' | 'yours' | 'saved';

function creatorLabel(sim: SimulationTemplate): string {
  if (sim.visibility === 'global') return 'Admin';
  return sim.creator_username || 'User';
}

export interface SimulationTemplateListCardProps {
  sim: SimulationTemplate;
  variant: 'hub' | 'admin';
  /** Hub-only: which tab is active */
  hubTab?: SimulationHubTabContext;
  starred?: boolean;
  starDisabled?: boolean;
  onStar?: () => void;
  onRun: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

/**
 * Shared simulation template card — matches Simulations hub + Admin templates grid.
 */
export const SimulationTemplateListCard: React.FC<SimulationTemplateListCardProps> = ({
  sim,
  variant,
  hubTab = 'find',
  starred = false,
  starDisabled = false,
  onStar,
  onRun,
  onEdit,
  onDelete,
}) => {
  const Icon = getSimulationIcon(sim.icon);
  const minP = sim.persona_count_min ?? 1;
  const maxP = sim.persona_count_max ?? 1;

  const personaLabel =
    minP === maxP ? `${minP} persona${minP !== 1 ? 's' : ''}` : `${minP}–${maxP} personas`;

  const visibilityBadge =
    sim.visibility === 'global'
      ? { label: 'Global', className: 'bg-violet-100 text-violet-800' }
      : sim.visibility === 'public'
        ? { label: 'Public', className: 'bg-indigo-100 text-indigo-800' }
        : { label: 'Private', className: 'bg-slate-100 text-slate-700' };

  const showHubVisibilityPill = variant === 'hub' && hubTab === 'yours';

  const hubMetaLine =
    variant === 'hub' ? (
      hubTab === 'yours' ? (
        <span className="text-slate-600">Your template</span>
      ) : (
        <>
          By <span className="font-semibold text-slate-700">{creatorLabel(sim)}</span>
          {hubTab === 'find' && sim.visibility === 'public' && (
            <span className="ml-2 text-indigo-600 font-medium">· Public</span>
          )}
        </>
      )
    ) : (
      <>
        <span className="font-semibold text-slate-700">
          {sim.visibility === 'global' ? 'Admin' : sim.creator_username || '—'}
        </span>
        <span
          className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${visibilityBadge.className}`}
        >
          {visibilityBadge.label}
        </span>
      </>
    );

  return (
    <article className="group flex flex-col rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm ring-1 ring-slate-950/[0.02] transition-all duration-200 hover:border-indigo-200 hover:shadow-md hover:ring-indigo-500/10">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 to-violet-50 text-indigo-600 shadow-inner ring-1 ring-indigo-500/10">
          <Icon className="h-6 w-6" aria-hidden />
        </div>
        <div className="flex items-center gap-1">
          {variant === 'hub' && onStar && (
            <button
              type="button"
              title={starred ? 'Remove from saved' : 'Save'}
              onClick={onStar}
              disabled={starDisabled}
              className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-amber-50 hover:text-amber-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:opacity-50"
            >
              {starDisabled ? (
                <Loader2 className="h-5 w-5 animate-spin text-indigo-600" aria-hidden />
              ) : (
                <Star
                  className={`h-5 w-5 ${starred ? 'fill-amber-400 text-amber-500' : ''}`}
                  aria-hidden
                />
              )}
              <span className="sr-only">{starred ? 'Remove from saved' : 'Save template'}</span>
            </button>
          )}
        </div>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-bold leading-snug text-slate-900">{sim.title}</h3>
        {showHubVisibilityPill && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              sim.visibility === 'public'
                ? 'bg-indigo-100 text-indigo-800'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {sim.visibility === 'public' ? 'Public' : 'Private'}
          </span>
        )}
        {variant === 'admin' && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
              sim.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {sim.is_active ? 'Active' : 'Inactive'}
          </span>
        )}
      </div>

      <p className="mb-2 text-xs text-slate-500">{hubMetaLine}</p>

      {sim.description ? (
        <p className="mb-4 line-clamp-3 flex-grow text-sm leading-relaxed text-slate-600">
          {sim.description}
        </p>
      ) : (
        <div className="mb-4 flex-grow" />
      )}

      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          {personaLabel}
        </span>
        {variant === 'admin' && (
          <span className="inline-flex items-center gap-1.5">
            <Layers className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            {sim.required_input_fields?.length ?? 0} inputs
          </span>
        )}
      </div>

      <div className="mt-auto flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRun}
          className="inline-flex min-h-[44px] min-w-[120px] flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          <PlayCircle className="h-4 w-4 shrink-0" aria-hidden />
          Run
        </button>
        {(variant === 'hub' && hubTab === 'yours') || variant === 'admin' ? (
          <>
            {onEdit && (
              <button
                type="button"
                onClick={onEdit}
                title="Edit"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-indigo-600 shadow-sm transition-colors hover:border-indigo-200 hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              >
                <Edit className="h-4 w-4" aria-hidden />
                <span className="sr-only">Edit</span>
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                title="Delete"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-red-600 shadow-sm transition-colors hover:border-red-200 hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
                <span className="sr-only">Delete</span>
              </button>
            )}
          </>
        ) : null}
      </div>
    </article>
  );
};
