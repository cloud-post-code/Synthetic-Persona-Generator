import pool from '../config/database.js';
import { Persona, PersonaFile } from '../types/index.js';
import { v4 as uuidv4 } from 'uuid';

export async function getPersonasByUserId(userId: string): Promise<Persona[]> {
  const result = await pool.query(
    `SELECT id, user_id, name, type, description, avatar_url, metadata, created_at, updated_at
     FROM personas
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );

  return result.rows.map(row => ({
    ...row,
    metadata: row.metadata || {},
  }));
}

export async function getPersonaById(personaId: string, userId: string): Promise<Persona | null> {
  const result = await pool.query(
    `SELECT id, user_id, name, type, description, avatar_url, metadata, created_at, updated_at
     FROM personas
     WHERE id = $1 AND user_id = $2`,
    [personaId, userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const persona = result.rows[0];
  return {
    ...persona,
    metadata: persona.metadata || {},
  };
}

export async function createPersona(userId: string, personaData: Omit<Persona, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Persona> {
  const id = uuidv4();
  
  const result = await pool.query(
    `INSERT INTO personas (id, user_id, name, type, description, avatar_url, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, user_id, name, type, description, avatar_url, metadata, created_at, updated_at`,
    [
      id,
      userId,
      personaData.name,
      personaData.type,
      personaData.description,
      personaData.avatar_url,
      JSON.stringify(personaData.metadata || {}),
    ]
  );

  const persona = result.rows[0];
  return {
    ...persona,
    metadata: persona.metadata || {},
  };
}

export async function updatePersona(personaId: string, userId: string, updates: Partial<Persona>): Promise<Persona | null> {
  const fields: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (updates.name !== undefined) {
    fields.push(`name = $${paramCount++}`);
    values.push(updates.name);
  }
  if (updates.description !== undefined) {
    fields.push(`description = $${paramCount++}`);
    values.push(updates.description);
  }
  if (updates.avatar_url !== undefined) {
    fields.push(`avatar_url = $${paramCount++}`);
    values.push(updates.avatar_url);
  }
  if (updates.metadata !== undefined) {
    fields.push(`metadata = $${paramCount++}`);
    values.push(JSON.stringify(updates.metadata));
  }

  if (fields.length === 0) {
    return getPersonaById(personaId, userId);
  }

  values.push(personaId, userId);

  const result = await pool.query(
    `UPDATE personas
     SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
     WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
     RETURNING id, user_id, name, type, description, avatar_url, metadata, created_at, updated_at`,
    values
  );

  if (result.rows.length === 0) {
    return null;
  }

  const persona = result.rows[0];
  return {
    ...persona,
    metadata: persona.metadata || {},
  };
}

export async function deletePersona(personaId: string, userId: string): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM personas WHERE id = $1 AND user_id = $2',
    [personaId, userId]
  );

  return result.rowCount !== null && result.rowCount > 0;
}

export async function getPersonaFiles(personaId: string, userId: string): Promise<PersonaFile[]> {
  // Verify persona belongs to user
  const persona = await getPersonaById(personaId, userId);
  if (!persona) {
    return [];
  }

  const result = await pool.query(
    `SELECT id, persona_id, name, content, type, created_at
     FROM persona_files
     WHERE persona_id = $1
     ORDER BY created_at ASC`,
    [personaId]
  );

  return result.rows;
}

export async function createPersonaFile(personaId: string, userId: string, fileData: Omit<PersonaFile, 'id' | 'persona_id' | 'created_at'>): Promise<PersonaFile> {
  // Verify persona belongs to user
  const persona = await getPersonaById(personaId, userId);
  if (!persona) {
    throw new Error('Persona not found');
  }

  const id = uuidv4();
  
  const result = await pool.query(
    `INSERT INTO persona_files (id, persona_id, name, content, type)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, persona_id, name, content, type, created_at`,
    [id, personaId, fileData.name, fileData.content, fileData.type]
  );

  return result.rows[0];
}

