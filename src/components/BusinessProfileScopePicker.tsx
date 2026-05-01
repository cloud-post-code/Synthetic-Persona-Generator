import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import {
  BUSINESS_PROFILE_SPEC,
  businessProfileFrameworkId,
  type BusinessProfileScope,
  DEFAULT_BUSINESS_PROFILE_SCOPE,
} from '../constants/businessProfileSpec.js';

export type BusinessProfileScopePickerProps = {
  value: BusinessProfileScope;
  onChange: (next: BusinessProfileScope) => void;
  /** Smaller control for inline simulation / build flows */
  compact?: boolean;
};

export const BusinessProfileScopePicker: React.FC<BusinessProfileScopePickerProps> = ({
  value,
  onChange,
  compact = false,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const summaryLabel =
    value.mode === 'all'
      ? 'Business profile (all frameworks)'
      : `${value.frameworkIds.length} framework${value.frameworkIds.length === 1 ? '' : 's'} selected`;

  const frameworkChecked = (id: string) => value.mode === 'frameworks' && value.frameworkIds.includes(id);

  const toggleFramework = (id: string) => {
    if (value.mode === 'all') {
      onChange({ mode: 'frameworks', frameworkIds: [id] });
      return;
    }
    const set = new Set(value.frameworkIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    const ids = [...set];
    if (ids.length === 0) onChange(DEFAULT_BUSINESS_PROFILE_SCOPE);
    else onChange({ mode: 'frameworks', frameworkIds: ids });
  };

  const btnClass = compact
    ? 'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50'
    : 'inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50';

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        className={btnClass}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="max-w-[220px] truncate text-left">{summaryLabel}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-500 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          className={`absolute left-0 z-50 mt-1 max-h-72 overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg ${
            compact ? 'min-w-[260px] text-xs' : 'min-w-[300px] text-sm'
          }`}
          role="listbox"
        >
          <button
            type="button"
            className="flex w-full items-center gap-2 border-b border-gray-100 px-3 py-2.5 text-left font-medium text-gray-900 hover:bg-gray-50"
            onClick={() => {
              onChange(DEFAULT_BUSINESS_PROFILE_SCOPE);
              setOpen(false);
            }}
          >
            {value.mode === 'all' ? <Check className="h-4 w-4 text-gray-900" /> : <span className="w-4" />}
            Business profile (all)
          </button>
          {BUSINESS_PROFILE_SPEC.map((sec) => (
            <div key={sec.key} className="border-b border-gray-50 last:border-0">
              <div className="bg-gray-50/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                {sec.title}
              </div>
              {sec.frameworks.map((fw) => {
                const id = businessProfileFrameworkId(sec.key, fw.key);
                const checked = frameworkChecked(id);
                return (
                  <button
                    key={id}
                    type="button"
                    className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-gray-50"
                    onClick={() => toggleFramework(id)}
                  >
                    <span
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        checked ? 'border-gray-900 bg-gray-900' : 'border-gray-300 bg-white'
                      }`}
                    >
                      {checked ? <Check className="h-3 w-3 text-white" strokeWidth={3} /> : null}
                    </span>
                    <span>
                      <span className="block font-medium text-gray-900">{fw.title}</span>
                      <span className="block text-gray-500 line-clamp-2">{fw.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
