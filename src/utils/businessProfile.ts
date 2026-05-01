import type { BusinessProfile } from '../models/types.js';
import {
  BUSINESS_PROFILE_SPEC,
  businessProfileAnswerKey,
  compileFrameworkPlainText,
  type BusinessProfileScope,
  DEFAULT_BUSINESS_PROFILE_SCOPE,
} from '../constants/businessProfileSpec.js';

export type { BusinessProfileScope } from '../constants/businessProfileSpec.js';

export function businessProfileHasAnswers(profile: BusinessProfile | null): boolean {
  if (!profile?.answers) return false;
  return Object.values(profile.answers).some((v) => String(v ?? '').trim().length > 0);
}

/** One-line UI summary (no legacy business_name). */
export function businessProfileSummaryLine(profile: BusinessProfile | null): string {
  if (!profile?.answers) return 'No profile saved yet.';
  const keys = Object.keys(profile.answers).filter((k) => (profile.answers[k] ?? '').trim());
  if (keys.length === 0) return 'Profile is empty — add answers in Business Profile.';
  const primary = profile.answers['who_is_customer.target_customer_persona.primary_customer']?.trim();
  if (primary) {
    const short = primary.length > 100 ? `${primary.slice(0, 100)}…` : primary;
    return `${short} (${keys.length} fields filled)`;
  }
  return `${keys.length} fields filled in Business Profile.`;
}

export function businessProfileToPromptString(
  profile: BusinessProfile | null,
  scope: BusinessProfileScope = DEFAULT_BUSINESS_PROFILE_SCOPE
): string {
  if (!profile?.answers) return 'No business background content.';
  const answers = profile.answers;
  const blocks: string[] = [];

  const includeFramework = (sectionKey: string, fwKey: string): boolean => {
    if (scope.mode === 'all') return true;
    return scope.frameworkIds.includes(`${sectionKey}.${fwKey}`);
  };

  for (const sec of BUSINESS_PROFILE_SPEC) {
    for (const fw of sec.frameworks) {
      if (!includeFramework(sec.key, fw.key)) continue;
      const text = compileFrameworkPlainText(sec.key, fw.key, answers);
      if (text) blocks.push(text);
    }
  }
  return blocks.length ? blocks.join('\n\n---\n\n') : 'No business background content.';
}

/** Markdown document for export / print (includes empty sections only if they have content). */
export function compileBusinessProfileMarkdown(answers: Record<string, string>): string {
  const lines: string[] = ['# Business Profile', ''];
  for (const sec of BUSINESS_PROFILE_SPEC) {
    const fwBlocks: string[] = [];
    for (const fw of sec.frameworks) {
      const parts: string[] = [];
      let any = false;
      for (const q of fw.questions) {
        const k = businessProfileAnswerKey(sec.key, fw.key, q.key);
        const v = (answers[k] ?? '').trim();
        if (!v) continue;
        any = true;
        parts.push(`### ${q.label}\n\n${v}`);
      }
      if (any) {
        fwBlocks.push(`## ${fw.title}\n\n_${fw.description}_\n\n${parts.join('\n\n')}`);
      }
    }
    if (fwBlocks.length) {
      lines.push(`# ${sec.title}\n\n${fwBlocks.join('\n\n')}\n`);
    }
  }
  return lines.join('\n').trim();
}
