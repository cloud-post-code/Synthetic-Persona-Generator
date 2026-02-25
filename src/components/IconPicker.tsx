import React, { useState, useRef, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { simulationIconNames, getSimulationIcon, SIMULATION_ICON_DEFAULT } from '../utils/simulationIcons.js';

interface IconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
  label?: string;
  placeholder?: string;
}

export const IconPicker: React.FC<IconPickerProps> = ({
  value,
  onChange,
  label = 'Icon',
  placeholder = 'Add icon',
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const displayIcon = value?.trim() || SIMULATION_ICON_DEFAULT;
  const IconComponent = getSimulationIcon(displayIcon);
  const filteredNames = search.trim()
    ? simulationIconNames.filter((n) => n.toLowerCase().includes(search.toLowerCase()))
    : simulationIconNames;

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      >
        <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
          <IconComponent className="w-5 h-5" />
        </div>
        <span className="text-left flex-1 text-gray-700">
          {value?.trim() ? displayIcon : `Default (${SIMULATION_ICON_DEFAULT})`}
        </span>
        <Plus className="w-4 h-4 text-gray-400" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-80 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="p-2 border-b border-gray-100">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search icons..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div className="overflow-y-auto max-h-64 p-2 grid grid-cols-4 sm:grid-cols-6 gap-1">
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className="flex flex-col items-center justify-center p-2 rounded-lg hover:bg-indigo-50 text-gray-600 hover:text-indigo-700"
            >
              <div className="w-8 h-8 rounded flex items-center justify-center bg-gray-100">
                <IconComponent className="w-4 h-4" />
              </div>
              <span className="text-[10px] mt-1 truncate w-full text-center">Default</span>
            </button>
            {filteredNames.map((name) => {
              const I = getSimulationIcon(name);
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    onChange(name);
                    setOpen(false);
                  }}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg hover:bg-indigo-50 ${
                    value === name ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:text-indigo-700'
                  }`}
                >
                  <div className="w-8 h-8 rounded flex items-center justify-center bg-gray-100">
                    <I className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] mt-1 truncate w-full text-center">{name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
