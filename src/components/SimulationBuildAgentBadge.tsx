import React from 'react';
import { Sparkles } from 'lucide-react';
import { SIMULATION_GEMINI_AGENT_DISPLAY_NAME } from '../services/gemini.js';

/** Pill shown next to simulation “build with AI” surfaces so users know which model fills fields. */
export const SimulationBuildAgentBadge: React.FC = () => (
  <span
    className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700"
    title={`Build agent: ${SIMULATION_GEMINI_AGENT_DISPLAY_NAME}`}
  >
    <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
    Agent: {SIMULATION_GEMINI_AGENT_DISPLAY_NAME}
  </span>
);
