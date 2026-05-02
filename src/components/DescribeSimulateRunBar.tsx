import React, { useCallback } from 'react';
import { geminiService } from '../services/gemini.js';
import type { SimulationRunDraft } from '../services/simulationRunDraft.js';
import type { Persona } from '../models/types.js';
import type { SimulationTemplate } from '../services/simulationTemplateApi.js';
import { simulateRunAssistantSchema } from '../forms/simulateRunAssistantSchema.js';
import { DescribeBar, type DescribeBarBuildResult } from './DescribeBar.js';

export type DescribeSimulateRunBarProps = {
  templates: SimulationTemplate[];
  personas: Persona[];
  hasSavedBusinessProfile: boolean;
  onApplyDraft: (draft: SimulationRunDraft) => void;
  disabled?: boolean;
};

export const DescribeSimulateRunBar: React.FC<DescribeSimulateRunBarProps> = ({
  templates,
  personas,
  hasSavedBusinessProfile,
  onApplyDraft,
  disabled = false,
}) => {
  const onBuild = useCallback(
    async (trimmed: string): Promise<DescribeBarBuildResult> => {
      const draft = await geminiService.draftSimulationRunFromDescription(trimmed, {
        templates,
        personas,
        hasSavedBusinessProfile,
      });
      if (!draft.template_id) {
        return {
          ok: false,
          error: [draft.routing_rationale, ...draft.notes].filter(Boolean).join(' ') || 'No matching template.',
        };
      }
      onApplyDraft(draft);
      const nFields = Object.keys(draft.input_values).length;
      const pCount = draft.persona_ids.length;
      const parts = [
        draft.routing_rationale,
        `Template + ${pCount} persona(s) + ${nFields} runner field(s) updated. Review below, then start when ready.`,
      ];
      if (draft.notes.length) parts.push(draft.notes.join(' '));
      return { ok: true, summary: parts.filter(Boolean).join(' ') };
    },
    [hasSavedBusinessProfile, onApplyDraft, personas, templates],
  );

  return (
    <DescribeBar
      formKey={simulateRunAssistantSchema.formKey}
      micVoiceLabel={simulateRunAssistantSchema.fields[0]?.label ?? 'Tap to speak your run; tap again to build'}
      title="Describe your simulation run"
      description={
        <>
          Tap the mic, speak your run, tap again to build. Image, PDF, and table inputs still need manual upload.{' '}
          <span className="font-semibold text-slate-800">Start simulation</span> when you are ready.
        </>
      }
      emptyError="Speak your simulation run first (tap Mic, then Stop & build)."
      buildingHint="Building your run from what you said…"
      micIdleTitle="Speak your run"
      micRecordingTitle="Stop and build from what you said"
      micBuildingTitle="Building your run…"
      onBuild={onBuild}
      disabled={disabled}
    />
  );
};
