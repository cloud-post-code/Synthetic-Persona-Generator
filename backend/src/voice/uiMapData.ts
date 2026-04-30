/**
 * Mirror of frontend src/voice/uiMap.ts for server-side intent validation.
 * Keep in sync when adding routes or nodes.
 */
import type { UiNode } from '../types/voiceIntents.js';

export const UI_NODES: UiNode[] = [
  {
    id: 'auth.login',
    title: 'Sign in',
    path: '/login',
    purpose: 'Authenticate to access the app.',
    whenToUse: ['log in', 'sign in', 'login'],
    transitions: [{ to: 'home.dashboard', via: 'navigate', label: 'After successful login' }],
    goals: [],
  },
  {
    id: 'home.dashboard',
    title: 'Dashboard',
    path: '/',
    purpose: 'Overview and entry point to all major workflows.',
    whenToUse: ['home', 'dashboard', 'main page', 'landing', 'overview', 'start here'],
    prerequisites: { auth: 'user' },
    transitions: [
      { to: 'build.persona', via: 'navigate', label: 'Build persona' },
      { to: 'simulations.hub', via: 'navigate', label: 'Simulations hub' },
      { to: 'simulate.run', via: 'navigate', label: 'Run simulation' },
      { to: 'gallery.personas', via: 'navigate', label: 'My personas' },
      { to: 'business.profile', via: 'navigate', label: 'Business profile' },
      { to: 'settings.page', via: 'navigate', label: 'Settings' },
      { to: 'admin.page', via: 'navigate', label: 'Admin' },
    ],
    goals: [],
    speakOnArrival: 'You are on the dashboard.',
  },
  {
    id: 'build.persona',
    title: 'Build Persona',
    path: '/build',
    purpose: 'Create or edit a synthetic persona end-to-end.',
    whenToUse: ['build a persona', 'create persona', 'persona builder', 'new persona'],
    prerequisites: { auth: 'user' },
    transitions: [
      { to: 'gallery.personas', via: 'action', label: 'Save persona', targetId: 'build.save' },
      { to: 'simulations.hub', via: 'navigate', label: 'Use in simulation' },
    ],
    goals: [
      {
        id: 'create_persona',
        description: 'Create and save a new persona',
        completion: { type: 'event', name: 'persona:saved' },
      },
    ],
    speakOnArrival: 'You are on Build Persona.',
  },
  {
    id: 'simulations.hub',
    title: 'Simulations hub',
    path: '/simulations',
    purpose: 'Configure and manage simulation templates before running.',
    whenToUse: ['build simulation', 'simulations hub', 'templates', 'new simulation'],
    prerequisites: { auth: 'user' },
    transitions: [
      { to: 'simulate.run', via: 'navigate', label: 'Run a simulation' },
      { to: 'home.dashboard', via: 'navigate', label: 'Back to dashboard' },
    ],
    goals: [],
    speakOnArrival: 'You are on the simulations hub.',
  },
  {
    id: 'simulate.run',
    title: 'Run simulation',
    path: '/simulate',
    purpose: 'Execute a live simulation with selected personas.',
    whenToUse: ['run simulation', 'play simulation', 'start simulation'],
    prerequisites: { auth: 'user' },
    transitions: [
      { to: 'chat.thread', via: 'navigate', label: 'Open chat' },
      { to: 'simulations.hub', via: 'navigate', label: 'Back to hub' },
    ],
    goals: [],
    speakOnArrival: 'You are on Run simulation.',
  },
  {
    id: 'gallery.personas',
    title: 'My personas',
    path: '/gallery',
    purpose: 'Browse and open personas you created.',
    whenToUse: ['my personas', 'gallery', 'persona list'],
    prerequisites: { auth: 'user' },
    transitions: [
      { to: 'gallery.library', via: 'set_query', label: 'Library tab' },
      { to: 'gallery.saved', via: 'set_query', label: 'Saved tab' },
      { to: 'gallery.focus', via: 'set_query', label: 'Focus groups tab' },
      { to: 'chat.thread', via: 'navigate', label: 'Open persona chat' },
      { to: 'build.persona', via: 'navigate', label: 'Create new persona' },
    ],
    goals: [],
    speakOnArrival: 'You are on My personas.',
  },
  {
    id: 'gallery.saved',
    title: 'Saved personas',
    path: '/gallery',
    query: { tab: 'saved' },
    purpose: 'Personas you saved from the library.',
    whenToUse: ['saved personas', 'saved tab', 'saved'],
    prerequisites: { auth: 'user' },
    transitions: [
      { to: 'gallery.personas', via: 'set_query', label: 'My personas tab' },
      { to: 'gallery.library', via: 'set_query', label: 'Library tab' },
      { to: 'gallery.focus', via: 'set_query', label: 'Focus groups tab' },
      { to: 'chat.thread', via: 'navigate', label: 'Open persona chat' },
      { to: 'build.persona', via: 'navigate', label: 'Create new persona' },
    ],
    goals: [],
    speakOnArrival: 'You are on Saved personas.',
  },
  {
    id: 'gallery.focus',
    title: 'Focus groups',
    path: '/gallery',
    query: { tab: 'focusGroups' },
    purpose: 'Manage focus groups for simulations.',
    whenToUse: ['focus groups', 'focus group tab', 'cohorts'],
    prerequisites: { auth: 'user' },
    transitions: [
      { to: 'gallery.personas', via: 'set_query', label: 'My personas tab' },
      { to: 'gallery.library', via: 'set_query', label: 'Library tab' },
      { to: 'gallery.saved', via: 'set_query', label: 'Saved tab' },
      { to: 'chat.thread', via: 'navigate', label: 'Open chat' },
      { to: 'build.persona', via: 'navigate', label: 'Create new persona' },
    ],
    goals: [],
    speakOnArrival: 'You are on Focus groups.',
  },
  {
    id: 'gallery.library',
    title: 'Persona library',
    path: '/gallery',
    query: { tab: 'library' },
    purpose: 'Browse shared or library personas to add to your collection.',
    whenToUse: ['library', 'persona library', 'browse library'],
    prerequisites: { auth: 'user' },
    transitions: [
      { to: 'gallery.personas', via: 'set_query', label: 'My personas tab' },
      { to: 'gallery.saved', via: 'set_query', label: 'Saved tab' },
      { to: 'gallery.focus', via: 'set_query', label: 'Focus groups tab' },
    ],
    goals: [],
    speakOnArrival: 'You are on the persona library tab.',
  },
  {
    id: 'chat.thread',
    title: 'Chat',
    path: '/chat',
    purpose: 'Converse with a persona or review simulation messages.',
    whenToUse: ['chat', 'conversation', 'messages'],
    prerequisites: { auth: 'user' },
    transitions: [
      { to: 'gallery.personas', via: 'navigate', label: 'Back to gallery' },
      { to: 'simulate.run', via: 'navigate', label: 'Back to simulation' },
    ],
    goals: [],
    speakOnArrival: 'You are in chat.',
  },
  {
    id: 'business.profile',
    title: 'Business profile',
    path: '/business-profile',
    purpose: 'Edit company context used across simulations.',
    whenToUse: ['business profile', 'company profile'],
    prerequisites: { auth: 'user' },
    transitions: [{ to: 'home.dashboard', via: 'navigate', label: 'Home' }],
    goals: [
      {
        id: 'save_business_profile',
        description: 'Save business profile changes',
        completion: { type: 'event', name: 'business_profile:saved' },
      },
    ],
    speakOnArrival: 'You are on Business profile.',
  },
  {
    id: 'settings.page',
    title: 'Settings',
    path: '/settings',
    purpose: 'Account and app preferences.',
    whenToUse: ['settings', 'preferences', 'account'],
    prerequisites: { auth: 'user' },
    transitions: [{ to: 'home.dashboard', via: 'navigate', label: 'Home' }],
    goals: [],
    speakOnArrival: 'You are in settings.',
  },
  {
    id: 'admin.page',
    title: 'Admin',
    path: '/admin',
    purpose: 'Administrative tools (admin users only).',
    whenToUse: ['admin', 'administration', 'admin panel', 'moderator'],
    prerequisites: { auth: 'admin' },
    transitions: [{ to: 'home.dashboard', via: 'navigate', label: 'Home' }],
    goals: [],
    speakOnArrival: 'You are on the admin page.',
  },
  {
    id: 'info.synthetic_user',
    title: 'Synthetic user detail',
    path: '/info/synthetic-user',
    purpose: 'Read-only detail for a synthetic user record.',
    whenToUse: ['synthetic user info', 'user detail', 'synthetic user page'],
    prerequisites: { auth: 'user' },
    transitions: [{ to: 'home.dashboard', via: 'navigate', label: 'Home' }],
    goals: [],
  },
  {
    id: 'info.advisor',
    title: 'Advisor detail',
    path: '/info/advisor',
    purpose: 'Read-only advisor information.',
    whenToUse: ['advisor info', 'advisor detail', 'advisor page'],
    prerequisites: { auth: 'user' },
    transitions: [{ to: 'home.dashboard', via: 'navigate', label: 'Home' }],
    goals: [],
  },
];

export function findNodeId(pathname: string, search: string): string | null {
  const sp = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);

  if (pathname === '/login') return 'auth.login';
  if (pathname === '/') return 'home.dashboard';
  if (pathname === '/build') return 'build.persona';
  if (pathname === '/simulations') return 'simulations.hub';
  if (pathname === '/simulate') return 'simulate.run';
  if (pathname === '/business-profile') return 'business.profile';
  if (pathname === '/settings') return 'settings.page';
  if (pathname === '/admin') return 'admin.page';
  if (pathname === '/info/synthetic-user') return 'info.synthetic_user';
  if (pathname === '/info/advisor') return 'info.advisor';

  if (pathname === '/gallery') {
    const tab = sp.get('tab');
    if (!tab || tab === 'my' || tab === 'personas') return 'gallery.personas';
    if (tab === 'library') return 'gallery.library';
    if (tab === 'saved') return 'gallery.saved';
    if (tab === 'focusGroups') return 'gallery.focus';
    return 'gallery.personas';
  }

  if (pathname === '/chat' || pathname.startsWith('/chat/')) {
    return 'chat.thread';
  }

  if (pathname === '/library') return 'gallery.library';

  return null;
}

export function getNodeById(id: string): UiNode | undefined {
  return UI_NODES.find((n) => n.id === id);
}
