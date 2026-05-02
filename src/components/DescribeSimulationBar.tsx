import React, { useCallback } from 'react';
import { geminiService } from '../services/gemini.js';
import { sanitizeDraft } from '../services/simulationDraft.js';
import type { SimulationTemplateFormHandle } from './SimulationTemplateForm.js';
import { simulationTemplateFormSchema } from '../forms/index.js';
import { DescribeBar, type DescribeBarBuildResult } from './DescribeBar.js';

export type DescribeSimulationBarProps = {
  formRef: React.RefObject<SimulationTemplateFormHandle | null>;
  disabled?: boolean;
};

function countFilledFields(d: ReturnType<typeof sanitizeDraft>): number {
  const tscKeys = d.type_specific_config ? Object.keys(d.type_specific_config).length : 0;
  const runner = d.required_input_fields?.length ?? 0;
  const personaTypes = d.allowed_persona_types?.length ?? 0;
  return 1 + 1 + 1 + personaTypes + 2 + tscKeys + runner + 1;
}

export const DescribeSimulationBar: React.FC<DescribeSimulationBarProps> = ({ formRef, disabled = false }) => {
  const tplKey = simulationTemplateFormSchema.formKey;
  const micField = simulationTemplateFormSchema.fields.find((f) => f.key === 'mic_toggle');

  const onBuild = useCallback(
    async (trimmed: string): Promise<DescribeBarBuildResult> => {
      const draft = await geminiService.draftSimulationFromDescription(trimmed);
      const d = sanitizeDraft(draft);
      const n = countFilledFields(d);
      await formRef.current?.applyDraft(d);
      return {
        ok: true,
        summary: `Filled ${n} fields. Review the form below, then click Create Simulation when ready.`,
      };
    },
    [formRef],
  );

  return (
    <DescribeBar
      formKey={tplKey}
      micVoiceLabel={micField?.label ?? 'Tap to speak your simulation; tap again to build'}
      title="Describe your simulation"
      description={
        <>
          Tap the mic, speak your simulation, tap again to build. Image, PDF, and table inputs still need manual upload
          where the template asks for files. You stay on this page—click{' '}
          <span className="font-semibold text-slate-800">Create Simulation</span> when you want the system prompt step.
        </>
      }
      emptyError="Speak your simulation first (tap Mic, then Stop & build)."
      buildingHint="Building your simulation from what you said…"
      micIdleTitle="Speak your simulation"
      micRecordingTitle="Stop and build from what you said"
      micBuildingTitle="Building your simulation…"
      onBuild={onBuild}
      disabled={disabled}
    />
  );
};
