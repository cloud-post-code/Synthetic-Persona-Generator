import pool from '../config/database.js';
import { SimulationTemplate, CreateSimulationRequest, UpdateSimulationRequest } from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';

export async function getAllSimulations(includeInactive: boolean = false): Promise<SimulationTemplate[]> {
  try {
    let query = 'SELECT * FROM simulations';
    const params: any[] = [];

    if (!includeInactive) {
      query += ' WHERE is_active = TRUE';
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);

    return result.rows.map(row => {
      // Handle JSONB field - PostgreSQL pg library should parse it automatically
      // But handle cases where it might be null, string, or already parsed
      let requiredInputFields: any[] = [];
      if (row.required_input_fields !== null && row.required_input_fields !== undefined) {
        if (typeof row.required_input_fields === 'string') {
          try {
            requiredInputFields = JSON.parse(row.required_input_fields);
          } catch (e) {
            console.error('Failed to parse required_input_fields:', e);
            requiredInputFields = [];
          }
        } else if (Array.isArray(row.required_input_fields)) {
          requiredInputFields = row.required_input_fields;
        } else if (typeof row.required_input_fields === 'object') {
          // If it's already an object (parsed JSONB), use it directly
          requiredInputFields = row.required_input_fields;
        }
      }
      
      return {
        id: row.id,
        title: row.title,
        description: row.description || undefined,
        icon: row.icon || undefined,
        required_input_fields: requiredInputFields,
        system_prompt: row.system_prompt,
        is_active: row.is_active !== undefined ? row.is_active : true,
        created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
        updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
      };
    });
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
  // Parse JSONB field if it's a string, otherwise use as-is
  let requiredInputFields = sim.required_input_fields || [];
  if (typeof requiredInputFields === 'string') {
    try {
      requiredInputFields = JSON.parse(requiredInputFields);
    } catch (e) {
      console.error('Failed to parse required_input_fields:', e);
      requiredInputFields = [];
    }
  }
  
  return {
    id: sim.id,
    title: sim.title,
    description: sim.description || undefined,
    icon: sim.icon || undefined,
    required_input_fields: requiredInputFields,
    system_prompt: sim.system_prompt,
    is_active: sim.is_active !== undefined ? sim.is_active : true,
    created_at: sim.created_at instanceof Date ? sim.created_at.toISOString() : sim.created_at,
    updated_at: sim.updated_at instanceof Date ? sim.updated_at.toISOString() : sim.updated_at,
  };
}

export async function createSimulation(data: CreateSimulationRequest): Promise<SimulationTemplate> {
  const id = uuidv4();

  // PostgreSQL JSONB accepts JSON objects directly, no need to stringify
  const result = await pool.query(
    `INSERT INTO simulations (id, title, description, icon, required_input_fields, system_prompt, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      id,
      data.title,
      data.description || null,
      data.icon || null,
      JSON.stringify(data.required_input_fields || []), // Keep stringify for consistency
      data.system_prompt,
      data.is_active !== undefined ? data.is_active : true,
    ]
  );

  const sim = result.rows[0];
  // Parse JSONB field if it's a string, otherwise use as-is
  let requiredInputFields: any[] = [];
  if (sim.required_input_fields !== null && sim.required_input_fields !== undefined) {
    if (typeof sim.required_input_fields === 'string') {
      try {
        requiredInputFields = JSON.parse(sim.required_input_fields);
      } catch (e) {
        console.error('Failed to parse required_input_fields:', e);
        requiredInputFields = [];
      }
    } else if (Array.isArray(sim.required_input_fields)) {
      requiredInputFields = sim.required_input_fields;
    } else if (typeof sim.required_input_fields === 'object') {
      requiredInputFields = sim.required_input_fields;
    }
  }
  
  return {
    id: sim.id,
    title: sim.title,
    description: sim.description || undefined,
    icon: sim.icon || undefined,
    required_input_fields: requiredInputFields,
    system_prompt: sim.system_prompt,
    is_active: sim.is_active !== undefined ? sim.is_active : true,
    created_at: sim.created_at instanceof Date ? sim.created_at.toISOString() : sim.created_at,
    updated_at: sim.updated_at instanceof Date ? sim.updated_at.toISOString() : sim.updated_at,
  };
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
  // Parse JSONB field if it's a string, otherwise use as-is
  let requiredInputFields: any[] = [];
  if (sim.required_input_fields !== null && sim.required_input_fields !== undefined) {
    if (typeof sim.required_input_fields === 'string') {
      try {
        requiredInputFields = JSON.parse(sim.required_input_fields);
      } catch (e) {
        console.error('Failed to parse required_input_fields:', e);
        requiredInputFields = [];
      }
    } else if (Array.isArray(sim.required_input_fields)) {
      requiredInputFields = sim.required_input_fields;
    } else if (typeof sim.required_input_fields === 'object') {
      requiredInputFields = sim.required_input_fields;
    }
  }
  
  return {
    id: sim.id,
    title: sim.title,
    description: sim.description || undefined,
    icon: sim.icon || undefined,
    required_input_fields: requiredInputFields,
    system_prompt: sim.system_prompt,
    is_active: sim.is_active !== undefined ? sim.is_active : true,
    created_at: sim.created_at instanceof Date ? sim.created_at.toISOString() : sim.created_at,
    updated_at: sim.updated_at instanceof Date ? sim.updated_at.toISOString() : sim.updated_at,
  };
}

export async function deleteSimulation(id: string): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM simulations WHERE id = $1',
    [id]
  );

  return result.rowCount !== null && result.rowCount > 0;
}

