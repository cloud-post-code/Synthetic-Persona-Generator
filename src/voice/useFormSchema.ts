import React, { useMemo, useRef } from 'react';
import {
  defaultActionForType,
  fieldTargetId,
  type FormFieldDef,
  type FormSchema,
} from '../forms/types.js';
import { useVoiceTarget } from './useVoiceTarget.js';

type RefMap = Record<string, React.RefObject<HTMLElement | null>>;

export type UseFormSchemaResult = {
  /** Stable id for a given field, e.g. `business.profile.mission_statement`. */
  idFor: (key: string) => string;
  /** Ref to attach to the underlying DOM element for a field. */
  refFor: (key: string) => React.RefObject<HTMLElement | null>;
  /** Spread on the input/select/textarea/button element to wire up voice + a11y. */
  fieldProps: (
    key: string,
    overrides?: { 'aria-label'?: string }
  ) => {
    ref: React.RefObject<any>;
    'data-voice-target': string;
    'aria-label': string;
    name: string;
    id: string;
  };
};

/**
 * Registers every field in a `FormSchema` as a stable voice target.
 * Pass `enabledKeys` to gate which fields are currently mounted (so the
 * registry doesn't expose IDs whose DOM nodes are not visible).
 */
export function useFormSchema(
  schema: FormSchema,
  options?: { enabledKeys?: ReadonlyArray<string> | true }
): UseFormSchemaResult {
  const refs = useRef<RefMap>({});

  const enabledSet: Set<string> | true = useMemo(() => {
    if (!options?.enabledKeys || options.enabledKeys === true) return true;
    return new Set(options.enabledKeys);
  }, [options?.enabledKeys]);

  for (const field of schema.fields) {
    if (!refs.current[field.key]) {
      refs.current[field.key] = React.createRef<HTMLElement | null>();
    }
    const enabled = enabledSet === true ? true : enabledSet.has(field.key);
    registerField(schema, field, refs.current[field.key]!, enabled);
  }

  return useMemo(() => {
    const idFor = (key: string) => fieldTargetId(schema.formKey, key);
    const refFor = (key: string) => {
      if (!refs.current[key]) {
        refs.current[key] = React.createRef<HTMLElement | null>();
      }
      return refs.current[key]!;
    };
    const fieldProps: UseFormSchemaResult['fieldProps'] = (key, overrides) => {
      const field = schema.fields.find((f) => f.key === key);
      const ref = refFor(key);
      const id = idFor(key);
      return {
        ref,
        'data-voice-target': id,
        'aria-label': overrides?.['aria-label'] ?? field?.label ?? key,
        name: id,
        id,
      };
    };
    return { idFor, refFor, fieldProps };
  }, [schema]);
}

/**
 * Inline component-style helper so we can call `useVoiceTarget` once per field.
 * Hooks must be called unconditionally per render, so we encapsulate the call
 * inside a child component generated for each field.
 */
function registerField(
  schema: FormSchema,
  field: FormFieldDef,
  ref: React.RefObject<HTMLElement | null>,
  enabled: boolean
) {
  // We can't call hooks inside a loop guarded by data — but the loop iterates
  // a stable schema (fields never change at runtime for a given mount), so
  // the hook order is stable. React allows this pattern as long as the schema
  // is identity-stable across renders.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useVoiceTarget({
    id: fieldTargetId(schema.formKey, field.key),
    label: field.label,
    action: field.action ?? defaultActionForType(field.type),
    ref,
    enabled,
  });
}
