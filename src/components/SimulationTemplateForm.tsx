import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronRight, ArrowLeft } from 'lucide-react';
import {
  SimulationTemplate,
  SimulationInputField,
  SimulationType,
  CreateSimulationRequest,
  UpdateSimulationRequest,
} from '../services/simulationTemplateApi.js';
import { IconPicker } from './IconPicker.js';

const SIMULATION_TYPES: { id: SimulationType; label: string }[] = [
  { id: 'chat', label: 'Chat' },
  { id: 'advice', label: 'Advice' },
  { id: 'report', label: 'Report' },
  { id: 'conversational_simulation', label: 'Conversational simulation' },
  { id: 'response_simulation', label: 'Response simulation' },
  { id: 'survey', label: 'Survey' },
  { id: 'ideation', label: 'Ideation' },
];

const PERSONA_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'synthetic_user', label: 'Synthetic User' },
  { value: 'advisor', label: 'Advisor' },
  { value: 'practice_person', label: 'Practice Person' },
];

type FormStep = 'type' | 'common' | 'config' | 'fields';

interface SimulationTemplateFormProps {
  simulation?: SimulationTemplate | null;
  onSubmit: (data: CreateSimulationRequest | UpdateSimulationRequest) => Promise<void>;
  onCancel: () => void;
}

export const SimulationTemplateForm: React.FC<SimulationTemplateFormProps> = ({
  simulation,
  onSubmit,
  onCancel,
}) => {
  const [step, setStep] = useState<FormStep>(() => {
    if (simulation) {
      if (simulation.simulation_type) return 'common';
      return 'fields'; // legacy edit: go to fields and show system prompt
    }
    return 'type';
  });
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [simulationType, setSimulationType] = useState<SimulationType | ''>('');
  const [allowedPersonaTypes, setAllowedPersonaTypes] = useState<string[]>(['synthetic_user', 'advisor', 'practice_person']);
  const [personaCountMin, setPersonaCountMin] = useState(1);
  const [personaCountMax, setPersonaCountMax] = useState(1);
  const [typeSpecificConfig, setTypeSpecificConfig] = useState<Record<string, unknown>>({});
  const [inputFields, setInputFields] = useState<SimulationInputField[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (simulation) {
      setTitle(simulation.title);
      setDescription(simulation.description || '');
      setIcon(simulation.icon || '');
      setSystemPrompt(simulation.system_prompt);
      setIsActive(simulation.is_active);
      setSimulationType(simulation.simulation_type || '');
      setAllowedPersonaTypes(simulation.allowed_persona_types?.length ? simulation.allowed_persona_types : ['synthetic_user', 'advisor', 'practice_person']);
      setPersonaCountMin(simulation.persona_count_min ?? 1);
      setPersonaCountMax(simulation.persona_count_max ?? 1);
      setTypeSpecificConfig(simulation.type_specific_config || {});
      setInputFields(simulation.required_input_fields || []);
    }
  }, [simulation]);

  const handleAddField = () => {
    setInputFields([
      ...inputFields,
      { name: '', type: 'text', label: '', placeholder: '', required: false },
    ]);
  };

  const handleRemoveField = (index: number) => {
    setInputFields(inputFields.filter((_, i) => i !== index));
  };

  const handleFieldChange = (index: number, field: Partial<SimulationInputField>) => {
    const updated = [...inputFields];
    updated[index] = { ...updated[index], ...field };
    setInputFields(updated);
  };

  const togglePersonaType = (value: string) => {
    setAllowedPersonaTypes((prev) =>
      prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('Title is required');
      return;
    }
    if (simulationType && !description.trim()) {
      alert('Description (what is this simulation) is required');
      return;
    }
    if (!simulationType && !systemPrompt.trim()) {
      alert('System prompt is required for legacy simulations');
      return;
    }
    if (allowedPersonaTypes.length === 0) {
      alert('Select at least one persona type');
      return;
    }
    if (personaCountMin > personaCountMax) {
      alert('Min personas cannot exceed max personas');
      return;
    }
    for (const field of inputFields) {
      if (!field.name.trim() || !field.label.trim()) {
        alert('All input fields must have a name and label');
        return;
      }
      if (field.type === 'multiple_choice' && (!field.options || field.options.length === 0)) {
        alert(`Field "${field.label || field.name}" (multiple choice) must have at least one option`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const data: CreateSimulationRequest | UpdateSimulationRequest = {
        title: title.trim(),
        description: description.trim() || undefined,
        icon: icon.trim() || undefined,
        required_input_fields: inputFields,
        is_active: isActive,
      };
      if (simulationType) {
        data.simulation_type = simulationType;
        data.allowed_persona_types = allowedPersonaTypes;
        data.persona_count_min = personaCountMin;
        data.persona_count_max = personaCountMax;
        data.type_specific_config = Object.keys(typeSpecificConfig).length ? typeSpecificConfig : undefined;
      } else {
        data.system_prompt = systemPrompt.trim();
      }
      await onSubmit(data);
    } catch (error: any) {
      alert(`Failed to save: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderTypeStep = () => (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">Choose the type of simulation you want to create.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {SIMULATION_TYPES.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setSimulationType(id);
              setStep('common');
            }}
            className="p-4 border-2 border-gray-200 rounded-lg text-left hover:border-indigo-500 hover:bg-indigo-50 font-medium"
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex gap-3 pt-4">
        <button type="button" onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded-lg">
          Cancel
        </button>
      </div>
    </div>
  );

  const renderCommonStep = () => (
    <div className="space-y-6">
      {!simulation && (
        <button type="button" onClick={() => setStep('type')} className="text-sm text-indigo-600 flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to type
        </button>
      )}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          placeholder="e.g., Web Page Response"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          What is this simulation? (open-ended) *
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required={!!simulationType}
          rows={4}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          placeholder="Describe what this simulation is and what it tests..."
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Persona types that can run this</label>
        <div className="flex flex-wrap gap-4">
          {PERSONA_TYPE_OPTIONS.map(({ value, label }) => (
            <label key={value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={allowedPersonaTypes.includes(value)}
                onChange={() => togglePersonaType(value)}
                className="w-4 h-4 rounded border-gray-300 text-indigo-600"
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Min number of personas</label>
          <select
            value={personaCountMin}
            onChange={(e) => setPersonaCountMin(Number(e.target.value))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Max number of personas</label>
          <select
            value={personaCountMax}
            onChange={(e) => setPersonaCountMax(Number(e.target.value))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex gap-3 pt-4">
        <button type="button" onClick={() => setStep('type')} className="px-4 py-2 border border-gray-300 rounded-lg flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <button type="button" onClick={() => setStep('config')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg flex items-center gap-1">
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const renderConfigStep = () => {
    const setConfig = (key: string, value: unknown) =>
      setTypeSpecificConfig((prev) => ({ ...prev, [key]: value }));
    return (
      <div className="space-y-6">
        <button type="button" onClick={() => setStep('common')} className="text-sm text-indigo-600 flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        {simulationType === 'chat' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Opening line (optional)</label>
            <input
              type="text"
              value={(typeSpecificConfig.opening_line as string) || ''}
              onChange={(e) => setConfig('opening_line', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              placeholder="Default opening line for the chat"
            />
          </div>
        )}
        {simulationType === 'report' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Report structure (sections/headings) *</label>
              <textarea
                value={(typeSpecificConfig.report_structure as string) || ''}
                onChange={(e) => setConfig('report_structure', e.target.value)}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                placeholder="e.g., Executive Summary, Methodology, Findings..."
              />
            </div>
            <p className="text-xs text-gray-500">Document upload for report basis can be added as an input field below.</p>
          </>
        )}
        {simulationType === 'conversational_simulation' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Context prompt (for user)</label>
              <input
                type="text"
                value={(typeSpecificConfig.context_label as string) || 'Context'}
                onChange={(e) => setConfig('context_label', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Decision point (creator description) *</label>
              <textarea
                value={(typeSpecificConfig.decision_point as string) || ''}
                onChange={(e) => setConfig('decision_point', e.target.value)}
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                placeholder="What decision does the user/persona make?"
              />
            </div>
          </>
        )}
        {simulationType === 'response_simulation' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Decision type</label>
              <select
                value={(typeSpecificConfig.decision_type as string) || 'numeric'}
                onChange={(e) => setConfig('decision_type', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="numeric">Numeric (e.g. time, $)</option>
                <option value="action">Action (multiple choice)</option>
                <option value="text">Text (answer to a question)</option>
              </select>
            </div>
            {(typeSpecificConfig.decision_type as string) === 'action' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Possible outputs (comma-separated)</label>
                <input
                  type="text"
                  value={(typeSpecificConfig.action_options as string) || ''}
                  onChange={(e) => setConfig('action_options', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g., Click, Don't click"
                />
              </div>
            )}
          </>
        )}
        {simulationType === 'survey' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Survey format (one question per line; prefix with type: text, numeric, or choice)</label>
            <textarea
              value={(typeSpecificConfig.survey_format as string) || ''}
              onChange={(e) => setConfig('survey_format', e.target.value)}
              rows={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm"
              placeholder="text: What is your name?\nnumeric: How many years?\nchoice: Preferred option? (A|B|C)"
            />
          </div>
        )}
        {simulationType === 'ideation' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Ideation prompts/questions</label>
              <textarea
                value={(typeSpecificConfig.ideation_prompts as string) || ''}
                onChange={(e) => setConfig('ideation_prompts', e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                placeholder="Questions or prompts for brainstorming..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Number of ideas (default)</label>
              <select
                value={(typeSpecificConfig.num_ideas as number) ?? 5}
                onChange={(e) => setConfig('num_ideas', Number(e.target.value))}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                {[3, 5, 10, 15, 20].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </>
        )}
        {simulationType === 'advice' && (
          <p className="text-sm text-gray-500">Advice simulation uses the description above. Scoring and feedback are applied at runtime.</p>
        )}
        <div className="flex gap-3 pt-4">
          <button type="button" onClick={() => setStep('common')} className="px-4 py-2 border border-gray-300 rounded-lg">
            Back
          </button>
          <button type="button" onClick={() => setStep('fields')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg flex items-center gap-1">
            Next: Input fields & icon <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  const renderFieldsStep = () => (
    <div className="space-y-6">
      {simulationType && (
        <button type="button" onClick={() => setStep('config')} className="text-sm text-indigo-600 flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to config
        </button>
      )}
      <IconPicker value={icon} onChange={setIcon} label="Icon" />
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Input Fields</label>
        <div className="space-y-3">
          {inputFields.map((field, index) => (
            <div key={index} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
              <div className="flex items-start justify-between mb-3">
                <span className="text-sm font-medium text-gray-700">Field {index + 1}</span>
                <button type="button" onClick={() => handleRemoveField(index)} className="text-red-600 hover:text-red-800">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Field Name *</label>
                  <input
                    type="text"
                    value={field.name}
                    onChange={(e) => handleFieldChange(index, { name: e.target.value })}
                    required
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded"
                    placeholder="e.g., bgInfo"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Type *</label>
                  <select
                    value={field.type}
                    onChange={(e) => {
                      const newType = e.target.value as SimulationInputField['type'];
                      handleFieldChange(index, newType === 'multiple_choice' && !(field.options?.length) ? { type: newType, options: [''] } : { type: newType });
                    }}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded"
                  >
                    <option value="text">Short text</option>
                    <option value="textarea">Long text / paragraph</option>
                    <option value="image">Image</option>
                    <option value="table">Table (CSV, Excel)</option>
                    <option value="pdf">PDF</option>
                    <option value="multiple_choice">Multiple choice</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Label *</label>
                  <input
                    type="text"
                    value={field.label}
                    onChange={(e) => handleFieldChange(index, { label: e.target.value })}
                    required
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded"
                    placeholder="e.g., Background Context"
                  />
                </div>
                {field.type !== 'multiple_choice' && (
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Placeholder</label>
                    <input
                      type="text"
                      value={field.placeholder || ''}
                      onChange={(e) => handleFieldChange(index, { placeholder: e.target.value })}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded"
                    />
                  </div>
                )}
              </div>
              {field.type === 'multiple_choice' && (
                <div className="mt-3 space-y-2">
                  <label className="block text-xs text-gray-600">Options *</label>
                  {(field.options || []).map((opt, optIdx) => (
                    <div key={optIdx} className="flex gap-2">
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const opts = [...(field.options || [])];
                          opts[optIdx] = e.target.value;
                          handleFieldChange(index, { options: opts });
                        }}
                        className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded"
                      />
                      <button type="button" onClick={() => handleFieldChange(index, { options: (field.options || []).filter((_, i) => i !== optIdx) })} className="text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => handleFieldChange(index, { options: [...(field.options || []), ''] })} className="text-sm text-indigo-600 flex items-center gap-1">
                    <Plus className="w-4 h-4" /> Add option
                  </button>
                </div>
              )}
              <div className="mt-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) => handleFieldChange(index, { required: e.target.checked })}
                    className="rounded border-gray-300 text-indigo-600 w-5 h-5"
                  />
                  <span className="text-sm text-gray-700">Required</span>
                </label>
              </div>
            </div>
          ))}
          <button type="button" onClick={handleAddField} className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-indigo-400 flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" /> Add Input Field
          </button>
        </div>
      </div>
      {!simulationType && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">System Prompt * (legacy)</label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            required={!simulationType}
            rows={8}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm"
            placeholder="Use {{SELECTED_PROFILE}}, {{SELECTED_PROFILE_FULL}}, {{BACKGROUND_INFO}}, {{OPENING_LINE}}"
          />
        </div>
      )}
      <div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded border-gray-300 text-indigo-600 w-4 h-4" />
          <span className="text-sm text-gray-700">Active (visible to users)</span>
        </label>
      </div>
      <div className="flex gap-3 pt-4">
        {simulationType ? (
          <button type="button" onClick={() => setStep('config')} className="px-4 py-2 border border-gray-300 rounded-lg">
            Back
          </button>
        ) : null}
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : simulation ? 'Update Simulation' : 'Create Simulation'}
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 border border-gray-300 rounded-lg">
          Cancel
        </button>
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {step === 'type' && renderTypeStep()}
      {step === 'common' && renderCommonStep()}
      {step === 'config' && renderConfigStep()}
      {step === 'fields' && renderFieldsStep()}
    </form>
  );
};
