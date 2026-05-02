import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { registerUser, loginUser, getUserPublicById } from '../services/authService.js';
import { RegisterRequest, LoginRequest } from '../types/index.js';

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const data: RegisterRequest = req.body;
    
    // Trim and validate username
    const username = data.username?.trim();
    const password = data.password?.trim();
    const email = data.email?.trim() || undefined;
    
    if (!username || username.length === 0) {
      return res.status(400).json({ error: 'Username is required and cannot be empty' });
    }

    if (!password || password.length === 0) {
      return res.status(400).json({ error: 'Password is required and cannot be empty' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Log registration attempt for debugging
    console.log('Registration attempt:', { username, email: email || 'none', passwordLength: password.length });

    const result = await registerUser({ username, password, email });
    res.status(201).json(result);
  } catch (error: any) {
    if (error.message === 'Username already exists') {
      return res.status(409).json({ error: error.message });
    }
    next(error);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const data: LoginRequest = req.body;
    
    // Trim and validate inputs
    const username = data.username?.trim();
    const password = data.password?.trim();
    
    if (!username || username.length === 0) {
      return res.status(400).json({ error: 'Username is required and cannot be empty' });
    }

    if (!password || password.length === 0) {
      return res.status(400).json({ error: 'Password is required and cannot be empty' });
    }

    const result = await loginUser({ username, password });
    res.json(result);
  } catch (error: any) {
    if (error.message === 'Invalid username or password') {
      return res.status(401).json({ error: error.message });
    }
    next(error);
  }
}

export async function me(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.userId;
    if (!userId || typeof userId !== 'string') {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const user = await getUserPublicById(userId);
    if (!user) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    res.json({ user });
  } catch (error) {
    next(error);
  }
}
