import React, { useCallback } from 'react';
import { geminiService } from '../services/gemini.js';
import type { PersonaBuildDraft } from '../services/personaBuildDraft.js';
import { buildPersonaAssistantSchema } from '../forms/index.js';
import { DescribeBar, type DescribeBarBuildResult } from './DescribeBar.js';

export type BuildPersonaMode = 'synthetic_user' | 'advisor';

export type DescribePersonaBarProps = {
  onApplyDraft: (draft: PersonaBuildDraft) => void;
  disabled?: boolean;
  /** When set, the planner only returns that persona kind (user already opened that builder). */
  lockPersonaType?: BuildPersonaMode | null;
};

export const DescribePersonaBar: React.FC<DescribePersonaBarProps> = ({
  onApplyDraft,
  disabled = false,
  lockPersonaType = null,
}) => {
  const formKey = buildPersonaAssistantSchema.formKey;
  const micField = buildPersonaAssistantSchema.fields.find((f) => f.key === 'mic_toggle');

  const onBuild = useCallback(
    async (trimmed: string): Promise<DescribeBarBuildResult> => {
      const draft = await geminiService.draftPersonaBuildFromDescription(trimmed, {
        forcePersonaType: lockPersonaType ?? undefined,
      });
      onApplyDraft(draft);
      const kind = draft.persona_type === 'advisor' ? 'Advisor' : 'Synthetic user';
      const sub =
        draft.persona_type === 'advisor' ? draft.advisor_source ?? 'source' : draft.synthetic_method ?? 'method';
      return {
        ok: true,
        summary: `${kind} · ${sub}. ${draft.routing_rationale} Review the fields below, then submit when ready.`,
      };
    },
    [lockPersonaType, onApplyDraft],
  );

  return (
    <DescribeBar
      formKey={formKey}
      micVoiceLabel={micField?.label ?? 'Tap to speak your persona; tap again to build'}
      title="Describe your persona"
      description={
        <>
          Tap the mic, speak what you need, tap again to build. The assistant picks Synthetic user vs Advisor, chooses
          the best method, and fills the form.
        </>
      }
      emptyError="Speak what you need first (tap Mic, then Stop & build)."
      buildingHint="Building your persona from what you said…"
      micIdleTitle="Speak your persona"
      micRecordingTitle="Stop and build from what you said"
      micBuildingTitle="Building your persona…"
      onBuild={onBuild}
      disabled={disabled}
    />
  );
};
