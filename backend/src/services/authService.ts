import pool from '../config/database.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { generateToken } from '../utils/jwt.js';
import { User, RegisterRequest, LoginRequest, AuthResponse } from '../types/index.js';

export async function registerUser(data: RegisterRequest): Promise<AuthResponse> {
  const { username, password, email } = data;

  // Check if user already exists
  const existingUser = await pool.query(
    'SELECT id FROM users WHERE username = $1',
    [username]
  );

  if (existingUser.rows.length > 0) {
    throw new Error('Username already exists');
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user
  const result = await pool.query(
    `INSERT INTO users (username, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, username, email`,
    [username, email || null, passwordHash]
  );

  const user = result.rows[0];

  // Generate token
  const token = generateToken({
    userId: user.id,
    username: user.username,
  });

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
    },
  };
}

export async function loginUser(data: LoginRequest): Promise<AuthResponse> {
  const { username, password } = data;

  // Find user
  const result = await pool.query(
    'SELECT id, username, email, password_hash FROM users WHERE username = $1',
    [username]
  );

  if (result.rows.length === 0) {
    throw new Error('Invalid username or password');
  }

  const user: User = result.rows[0];

  // Verify password
  const isValid = await comparePassword(password, user.password_hash);
  if (!isValid) {
    throw new Error('Invalid username or password');
  }

  // Generate token
  const token = generateToken({
    userId: user.id,
    username: user.username,
  });

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
    },
  };
}

export async function getUserById(userId: string): Promise<User | null> {
  const result = await pool.query(
    'SELECT id, username, email, created_at, updated_at FROM users WHERE id = $1',
    [userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

