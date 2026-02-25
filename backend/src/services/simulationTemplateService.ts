import pool from '../config/database.js';
import { SimulationTemplate, CreateSimulationRequest, UpdateSimulationRequest } from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';

function parseJsonField(val: unknown): any[] | Record<string, unknown> | undefined {
  if (val === null || val === undefined) return undefined;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return undefined;
    }
  }
  if (Array.isArray(val) || (typeof val === 'object' && val !== null)) return val as any;
  return undefined;
}

function mapRowToTemplate(row: any): SimulationTemplate {
  const requiredInputFields = parseJsonField(row.required_input_fields) ?? [];
  const allowedPersonaTypes = parseJsonField(row.allowed_persona_types);
  const typeSpecificConfig = parseJsonField(row.type_specific_config);
  return {
    id: row.id,
    title: row.title,
    description: row.description || undefined,
    icon: row.icon || undefined,
    required_input_fields: Array.isArray(requiredInputFields) ? requiredInputFields : [],
    system_prompt: row.system_prompt,
    is_active: row.is_active !== undefined ? row.is_active : true,
    simulation_type: row.simulation_type || undefined,
    allowed_persona_types: Array.isArray(allowedPersonaTypes) ? allowedPersonaTypes as any : undefined,
    persona_count_min: row.persona_count_min != null ? Number(row.persona_count_min) : undefined,
    persona_count_max: row.persona_count_max != null ? Number(row.persona_count_max) : undefined,
    type_specific_config: typeSpecificConfig && typeof typeSpecificConfig === 'object' && !Array.isArray(typeSpecificConfig) ? typeSpecificConfig : undefined,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}

export async function getAllSimulations(includeInactive: boolean = false): Promise<SimulationTemplate[]> {
  try {
    let query = 'SELECT * FROM simulations';
    const params: any[] = [];

    if (!includeInactive) {
      query += ' WHERE is_active = TRUE';
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);

    return result.rows.map(row => mapRowToTemplate(row));
  } catch (error: any) {
    console.error('Error in getAllSimulations:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
    });
    throw error;
  }
}

export async function getSimulationById(id: string): Promise<SimulationTemplate | null> {
  const result = await pool.query(
    'SELECT * FROM simulations WHERE id = $1',
    [id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const sim = result.rows[0];
  return mapRowToTemplate(sim);
}

export async function createSimulation(data: CreateSimulationRequest): Promise<SimulationTemplate> {
  const id = uuidv4();
  const systemPrompt = (data.system_prompt?.trim() && !data.simulation_type)
    ? data.system_prompt.trim()
    : buildSystemPromptFromConfig(data);
  const result = await pool.query(
    `INSERT INTO simulations (id, title, description, icon, required_input_fields, system_prompt, is_active, simulation_type, allowed_persona_types, persona_count_min, persona_count_max, type_specific_config)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      id,
      data.title,
      data.description || null,
      data.icon || null,
      JSON.stringify(data.required_input_fields || []),
      systemPrompt,
      data.is_active !== undefined ? data.is_active : true,
      data.simulation_type || 'chat',
      JSON.stringify(data.allowed_persona_types ?? ['synthetic_user', 'advisor', 'practice_person']),
      data.persona_count_min ?? 1,
      data.persona_count_max ?? 1,
      JSON.stringify(data.type_specific_config ?? {}),
    ]
  );

  const sim = result.rows[0];
  return mapRowToTemplate(sim);
}

function buildSystemPromptFromConfig(data: CreateSimulationRequest): string {
  const desc = data.description?.trim() || 'No description provided.';
  const type = data.simulation_type || 'chat';
  const config = data.type_specific_config || {};
  const lines: string[] = [
    `You are running a ${type} simulation.`,
    '',
    '### What this simulation is',
    desc,
    '',
    '### Variables you can use',
    '- {{SELECTED_PROFILE}} - Name of the selected persona',
    '- {{SELECTED_PROFILE_FULL}} - Full profile and blueprint',
    '- {{BACKGROUND_INFO}} - Background context from user',
    '- {{OPENING_LINE}} - Opening line or content from user',
    '',
  ];

  if (type === 'conversational_simulation') {
    const decisionPoint = (config.decision_point as string)?.trim();
    const decisionCriteria = (config.decision_criteria as string)?.trim();
    if (decisionPoint) lines.push('### Decision point\n' + decisionPoint + '\n');
    if (decisionCriteria) lines.push('### Decision criteria (evaluate the persona\'s decision using)\n' + decisionCriteria + '\n');
  }

  if (type === 'survey') {
    const surveyMode = (config.survey_mode as string) || 'generated';
    lines.push('### Survey mode: ' + surveyMode + '\n');
    if (surveyMode === 'generated') {
      const purpose = (config.survey_purpose as string)?.trim();
      if (purpose) lines.push('### Survey purpose\n' + purpose + '\n');
      const questions = config.survey_questions as Array<{ type: string; question: string; options?: string[] }> | undefined;
      if (questions?.length) {
        lines.push('### Survey questions (in order)');
        questions.forEach((q, i) => {
          lines.push(`${i + 1}. [${q.type}] ${q.question}`);
          if (q.type === 'multiple_choice' && q.options?.length) lines.push('   Options: ' + q.options.filter(Boolean).join(', '));
        });
        lines.push('');
      }
    }
  }

  lines.push('### Additional config');
  lines.push(JSON.stringify(config));
  lines.push('');
  lines.push('Stay in character and use the profile and inputs to respond.');

  return lines.join('\n');
}

export async function updateSimulation(id: string, data: UpdateSimulationRequest): Promise<SimulationTemplate | null> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (data.title !== undefined) {
    fields.push(`title = $${paramCount++}`);
    values.push(data.title);
  }
  if (data.description !== undefined) {
    fields.push(`description = $${paramCount++}`);
    values.push(data.description);
  }
  if (data.icon !== undefined) {
    fields.push(`icon = $${paramCount++}`);
    values.push(data.icon);
  }
  if (data.required_input_fields !== undefined) {
    fields.push(`required_input_fields = $${paramCount++}`);
    values.push(JSON.stringify(data.required_input_fields));
  }
  if (data.system_prompt !== undefined) {
    fields.push(`system_prompt = $${paramCount++}`);
    values.push(data.system_prompt);
  }
  if (data.is_active !== undefined) {
    fields.push(`is_active = $${paramCount++}`);
    values.push(data.is_active);
  }
  if (data.simulation_type !== undefined) {
    fields.push(`simulation_type = $${paramCount++}`);
    values.push(data.simulation_type);
  }
  if (data.allowed_persona_types !== undefined) {
    fields.push(`allowed_persona_types = $${paramCount++}`);
    values.push(JSON.stringify(data.allowed_persona_types));
  }
  if (data.persona_count_min !== undefined) {
    fields.push(`persona_count_min = $${paramCount++}`);
    values.push(data.persona_count_min);
  }
  if (data.persona_count_max !== undefined) {
    fields.push(`persona_count_max = $${paramCount++}`);
    values.push(data.persona_count_max);
  }
  if (data.type_specific_config !== undefined) {
    fields.push(`type_specific_config = $${paramCount++}`);
    values.push(JSON.stringify(data.type_specific_config));
  }

  if (fields.length === 0) {
    return getSimulationById(id);
  }

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(id);

  const result = await pool.query(
    `UPDATE simulations
     SET ${fields.join(', ')}
     WHERE id = $${paramCount}
     RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    return null;
  }

  const sim = result.rows[0];
  return mapRowToTemplate(sim);
}

export async function deleteSimulation(id: string): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM simulations WHERE id = $1',
    [id]
  );

  return result.rowCount !== null && result.rowCount > 0;
}

