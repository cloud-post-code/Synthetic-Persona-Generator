import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { SimulationTemplate, SimulationInputField, CreateSimulationRequest, UpdateSimulationRequest } from '../services/simulationTemplateApi.js';

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
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [inputFields, setInputFields] = useState<SimulationInputField[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (simulation) {
      setTitle(simulation.title);
      setDescription(simulation.description || '');
      setIcon(simulation.icon || '');
      setSystemPrompt(simulation.system_prompt);
      setIsActive(simulation.is_active);
      setInputFields(simulation.required_input_fields || []);
    }
  }, [simulation]);

  const handleAddField = () => {
    setInputFields([
      ...inputFields,
      {
        name: '',
        type: 'text',
        label: '',
        placeholder: '',
        required: true,
      },
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !systemPrompt.trim()) {
      alert('Title and system prompt are required');
      return;
    }

    // Validate input fields
    for (const field of inputFields) {
      if (!field.name.trim() || !field.label.trim()) {
        alert('All input fields must have a name and label');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const data: CreateSimulationRequest | UpdateSimulationRequest = {
        title: title.trim(),
        description: description.trim() || undefined,
        icon: icon.trim() || undefined,
        system_prompt: systemPrompt.trim(),
        required_input_fields: inputFields,
        is_active: isActive,
      };
      await onSubmit(data);
    } catch (error: any) {
      alert(`Failed to save: ${error.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Title *
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="e.g., Web Page Response"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="Short description of this simulation type"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Icon Name
        </label>
        <input
          type="text"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="e.g., Monitor, Megaphone, TrendingUp"
        />
        <p className="mt-1 text-xs text-gray-500">
          Icon name from lucide-react (e.g., Monitor, Megaphone, Briefcase)
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Required Input Fields
        </label>
        <div className="space-y-3">
          {inputFields.map((field, index) => (
            <div key={index} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
              <div className="flex items-start justify-between mb-3">
                <span className="text-sm font-medium text-gray-700">Field {index + 1}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveField(index)}
                  className="text-red-600 hover:text-red-800"
                >
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
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500"
                    placeholder="e.g., bgInfo"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Type *</label>
                  <select
                    value={field.type}
                    onChange={(e) => handleFieldChange(index, { type: e.target.value as 'text' | 'textarea' | 'image' })}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="text">Text</option>
                    <option value="textarea">Textarea</option>
                    <option value="image">Image</option>
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
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500"
                    placeholder="e.g., Background Context"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">Placeholder</label>
                  <input
                    type="text"
                    value={field.placeholder || ''}
                    onChange={(e) => handleFieldChange(index, { placeholder: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-indigo-500"
                    placeholder="Optional placeholder text"
                  />
                </div>
              </div>
              <div className="mt-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={field.required}
                    onChange={(e) => handleFieldChange(index, { required: e.target.checked })}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs text-gray-600">Required</span>
                </label>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddField}
            className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-indigo-400 hover:text-indigo-600 flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Input Field
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          System Prompt *
        </label>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          required
          rows={12}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="Enter the system prompt template. Use {{SELECTED_PROFILE}}, {{SELECTED_PROFILE_FULL}}, {{BACKGROUND_INFO}}, {{OPENING_LINE}} as template variables."
        />
        <p className="mt-1 text-xs text-gray-500">
          Available template variables: {'{{SELECTED_PROFILE}}'}, {'{{SELECTED_PROFILE_FULL}}'}, {'{{BACKGROUND_INFO}}'}, {'{{OPENING_LINE}}'}
        </p>
      </div>

      <div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-sm text-gray-700">Active (visible to users)</span>
        </label>
      </div>

      <div className="flex gap-3 pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Saving...' : simulation ? 'Update Simulation' : 'Create Simulation'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

