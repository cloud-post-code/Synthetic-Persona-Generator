import { Request, Response, NextFunction } from 'express';
import { registerUser, loginUser } from '../services/authService.js';
import { RegisterRequest, LoginRequest } from '../types/index.js';

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const data: RegisterRequest = req.body;
    
    if (!data.username || !data.password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    if (data.password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const result = await registerUser(data);
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
    
    if (!data.username || !data.password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const result = await loginUser(data);
    res.json(result);
  } catch (error: any) {
    if (error.message === 'Invalid username or password') {
      return res.status(401).json({ error: error.message });
    }
    next(error);
  }
}

