import pool from '../config/database.js';
import { SimulationTemplate, CreateSimulationRequest, UpdateSimulationRequest } from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';

export async function getAllSimulations(includeInactive: boolean = false): Promise<SimulationTemplate[]> {
  let query = 'SELECT * FROM simulations';
  const params: any[] = [];

  if (!includeInactive) {
    query += ' WHERE is_active = TRUE';
  }

  query += ' ORDER BY created_at DESC';

  const result = await pool.query(query, params);

  return result.rows.map(row => ({
    ...row,
    required_input_fields: row.required_input_fields || [],
  }));
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
  return {
    ...sim,
    required_input_fields: sim.required_input_fields || [],
  };
}

export async function createSimulation(data: CreateSimulationRequest): Promise<SimulationTemplate> {
  const id = uuidv4();

  const result = await pool.query(
    `INSERT INTO simulations (id, title, description, icon, required_input_fields, system_prompt, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      id,
      data.title,
      data.description || null,
      data.icon || null,
      JSON.stringify(data.required_input_fields || []),
      data.system_prompt,
      data.is_active !== undefined ? data.is_active : true,
    ]
  );

  const sim = result.rows[0];
  return {
    ...sim,
    required_input_fields: sim.required_input_fields || [],
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
  return {
    ...sim,
    required_input_fields: sim.required_input_fields || [],
  };
}

export async function deleteSimulation(id: string): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM simulations WHERE id = $1',
    [id]
  );

  return result.rowCount !== null && result.rowCount > 0;
}

