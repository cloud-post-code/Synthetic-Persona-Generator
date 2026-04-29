import type { RouteSpec } from './intents.js';

/** Canonical routes for voice + navigation — mirrors App.tsx */
export const ROUTES: RouteSpec[] = [
  { path: '/', aliases: ['home', 'dashboard'], requiresAuth: true },
  { path: '/login', aliases: ['login', 'sign in'], requiresAuth: false },
  { path: '/build', aliases: ['build persona', 'create persona', 'persona builder', 'new persona'], requiresAuth: true },
  { path: '/simulations', aliases: ['build simulation', 'simulations hub', 'simulation templates'], requiresAuth: true },
  { path: '/simulate', aliases: ['run simulation', 'play simulation', 'simulation run'], requiresAuth: true },
  {
    path: '/gallery',
    aliases: ['my personas', 'gallery', 'persona gallery'],
    requiresAuth: true,
    query: { tab: ['personas', 'library'] },
  },
  { path: '/library', aliases: ['library', 'persona library'], requiresAuth: true },
  { path: '/business-profile', aliases: ['business profile', 'company profile'], requiresAuth: true },
  { path: '/settings', aliases: ['settings', 'preferences', 'account settings'], requiresAuth: true },
  { path: '/admin', aliases: ['admin', 'administration'], requiresAuth: true, requiresAdmin: true },
  { path: '/chat', aliases: ['chat', 'messages', 'conversation'], requiresAuth: true },
  { path: '/info/synthetic-user', aliases: ['synthetic user', 'user detail'], requiresAuth: true },
  { path: '/info/advisor', aliases: ['advisor', 'advisor detail'], requiresAuth: true },
];
