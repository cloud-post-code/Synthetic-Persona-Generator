import pool from '../config/database.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { generateToken } from '../utils/jwt.js';
import { User, RegisterRequest, LoginRequest, AuthResponse } from '../types/index.js';

export async function registerUser(data: RegisterRequest): Promise<AuthResponse> {
  // Validate and trim inputs
  const username = data.username?.trim();
  const password = data.password?.trim();
  const email = data.email?.trim() || undefined;

  if (!username || username.length === 0) {
    throw new Error('Username is required and cannot be empty');
  }

  if (!password || password.length === 0) {
    throw new Error('Password is required and cannot be empty');
  }

  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }

  try {
    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );

    if (existingUser.rows.length > 0) {
      throw new Error('Username already exists');
    }

    // Hash password
    console.log('Hashing password for user:', username);
    const passwordHash = await hashPassword(password);
    
    if (!passwordHash || passwordHash.length === 0) {
      throw new Error('Failed to hash password');
    }
    console.log('Password hashed successfully, hash length:', passwordHash.length);

    // Create user
    console.log('Inserting user into database:', { username, email: email || 'null', hasPasswordHash: !!passwordHash });
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, username, email, password_hash`,
      [username, email || null, passwordHash]
    );

    if (!result.rows || result.rows.length === 0) {
      console.error('Database insert failed: No rows returned');
      throw new Error('Failed to create user account');
    }

    const user = result.rows[0];
    console.log('User created successfully:', { id: user.id, username: user.username, email: user.email });

    // Verify password_hash was stored
    if (!user.password_hash) {
      console.error('WARNING: password_hash was not stored in database for user:', username);
      throw new Error('Failed to store password hash');
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
  } catch (error: any) {
    // Re-throw known errors
    if (error.message === 'Username already exists') {
      throw error;
    }
    
    // Log database errors
    console.error('Error in registerUser:', {
      message: error.message,
      stack: error.stack,
      username,
      hasPassword: !!password,
    });
    
    // Check for database constraint violations
    if (error.code === '23505') { // Unique violation
      throw new Error('Username already exists');
    }
    
    throw new Error(`Failed to create user account: ${error.message}`);
  }
}

export async function loginUser(data: LoginRequest): Promise<AuthResponse> {
  // Validate and trim inputs
  const username = data.username?.trim();
  const password = data.password?.trim();

  if (!username || username.length === 0) {
    throw new Error('Username is required and cannot be empty');
  }

  if (!password || password.length === 0) {
    throw new Error('Password is required and cannot be empty');
  }

  try {
    // Find user
    const result = await pool.query(
      'SELECT id, username, email, password_hash FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      throw new Error('Invalid username or password');
    }

    const user: User = result.rows[0];

    // Verify password hash exists
    if (!user.password_hash) {
      console.error('User found but password_hash is missing for username:', username);
      throw new Error('Invalid username or password');
    }

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
  } catch (error: any) {
    // Re-throw known errors
    if (error.message === 'Invalid username or password') {
      throw error;
    }
    
    // Log unexpected errors
    console.error('Error in loginUser:', {
      message: error.message,
      stack: error.stack,
      username,
    });
    
    throw new Error(`Login failed: ${error.message}`);
  }
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
