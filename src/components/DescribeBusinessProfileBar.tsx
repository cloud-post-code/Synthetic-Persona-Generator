import React, { useCallback } from 'react';
import { geminiService, type BusinessProfileVoiceDraft } from '../services/gemini.js';
import { businessProfileAssistantSchema } from '../forms/businessProfileAssistantSchema.js';
import { DescribeBar, type DescribeBarBuildResult } from './DescribeBar.js';

export type DescribeBusinessProfileBarProps = {
  onApplyDraft: (draft: BusinessProfileVoiceDraft) => void | Promise<void>;
  disabled?: boolean;
  /** Current form answers (all keys); used for conservative merge when building from speech. */
  existingAnswers?: Record<string, string>;
};

export const DescribeBusinessProfileBar: React.FC<DescribeBusinessProfileBarProps> = ({
  onApplyDraft,
  disabled = false,
  existingAnswers,
}) => {
  const formKey = businessProfileAssistantSchema.formKey;
  const micField = businessProfileAssistantSchema.fields.find((f) => f.key === 'mic_toggle');

  const onBuild = useCallback(
    async (trimmed: string): Promise<DescribeBarBuildResult> => {
      const draft = await geminiService.draftBusinessProfileFromDescription(trimmed, {
        existingAnswers,
      });
      const n = Object.keys(draft.filled).length;
      if (n === 0) {
        return {
          ok: false,
          error:
            [draft.routing_rationale, ...draft.notes].filter(Boolean).join(' ') ||
            'No profile fields could be filled from that description. Try adding more detail.',
        };
      }
      await Promise.resolve(onApplyDraft(draft));
      const parts = [draft.routing_rationale, `Updated ${n} field(s). Watch the sections below, then review.`];
      if (draft.notes.length) parts.push(draft.notes.join(' '));
      return { ok: true, summary: parts.filter(Boolean).join(' ') };
    },
    [existingAnswers, onApplyDraft],
  );

  return (
    <DescribeBar
      formKey={formKey}
      micVoiceLabel={micField?.label ?? 'Tap to speak your business; tap again to build'}
      title="Describe your business"
      description={
        <>
          Tap the mic, describe your business, tap again to build. The assistant places your story into the right
          profile sections. Multiple tabs can update at once; you will see each section apply in order.
        </>
      }
      emptyError="Speak your business story first (tap Mic, then Stop & build)."
      buildingHint="Building your profile from what you said…"
      micIdleTitle="Speak your business"
      micRecordingTitle="Stop and build from what you said"
      micBuildingTitle="Building your profile…"
      onBuild={onBuild}
      disabled={disabled}
    />
  );
};
