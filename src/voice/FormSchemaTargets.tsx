import React, { useEffect, useMemo, useRef } from 'react';
import {
  defaultActionForType,
  fieldTargetId,
  type FormSchema,
} from '../forms/types.js';
import { useVoiceTarget } from './useVoiceTarget.js';

type Props = {
  schema: FormSchema;
  /**
   * Map of fieldKey -> selector that resolves the rendered DOM element.
   * Selectors are scoped to the page and re-resolved when the schema or
   * `enabled` change. Only fields with a resolvable element are exposed
   * to the voice agent.
   */
  selectors: Record<string, string>;
  enabled?: boolean;
};

/**
 * Headless component that wires every field in a `FormSchema` to a stable
 * voice target by querying the DOM. This is the lighter-weight alternative
 * to `useFormSchema` for pages whose form fields are deeply nested in
 * generic helper components and where adding refs everywhere is invasive.
 *
 * Use only when adding refs is impractical. Prefer `useFormSchema` when
 * each input directly accepts a ref.
 */
export const FormSchemaTargets: React.FC<Props> = ({ schema, selectors, enabled = true }) => {
  const items = useMemo(
    () =>
      schema.fields
        .filter((f) => selectors[f.key])
        .map((f) => ({
          id: fieldTargetId(schema.formKey, f.key),
          label: f.label,
          action: f.action ?? defaultActionForType(f.type),
          selector: selectors[f.key]!,
        })),
    [schema, selectors]
  );

  return (
    <>
      {items.map((it) => (
        <FormSchemaTarget
          key={it.id}
          id={it.id}
          label={it.label}
          action={it.action}
          selector={it.selector}
          enabled={enabled}
        />
      ))}
    </>
  );
};

const FormSchemaTarget: React.FC<{
  id: string;
  label: string;
  action: 'click' | 'fill' | 'focus';
  selector: string;
  enabled: boolean;
}> = ({ id, label, action, selector, enabled }) => {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const el = document.querySelector<HTMLElement>(selector);
    ref.current = el;
  }, [selector, enabled]);
  useVoiceTarget({ id, label, action, ref, enabled });
  return null;
};
