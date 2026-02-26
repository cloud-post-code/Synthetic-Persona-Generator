/**
 * Human-like names used as fallbacks when a user or advisor name is missing,
 * so every participant in simulations and exports is shown with a natural name.
 */

/** Default name for the person running the simulation when not using their account name. */
const DEFAULT_RUNNER_NAMES = [
  'Alex',
  'Jordan',
  'Sam',
  'Morgan',
  'Casey',
  'Riley',
  'Quinn',
  'Avery',
] as const;

/** Fallback names for personas/advisors when the persona has no name. */
const DEFAULT_PERSONA_NAMES = [
  'Jordan Reed',
  'Sam Chen',
  'Morgan Blake',
  'Casey Wells',
  'Riley Park',
  'Quinn Foster',
  'Avery Hayes',
  'Jamie Lane',
  'Drew Morgan',
  'Skyler James',
] as const;

/** Fallback names for advisors when extraction fails (e.g. "Expert Advisor" replacement). */
const DEFAULT_ADVISOR_NAMES = [
  'Dr. Sarah Mitchell',
  'James Chen',
  'Maria Santos',
  'David Park',
  'Emily Foster',
  'Robert Hayes',
  'Jennifer Walsh',
  'Michael Torres',
] as const;

let runnerIndex = 0;
let personaIndex = 0;

/**
 * Returns a human-like display name for the person running the simulation.
 * Use the provided username when available (e.g. from auth); otherwise a default.
 */
export function getRunnerDisplayName(username: string | null | undefined): string {
  const trimmed = typeof username === 'string' ? username.trim() : '';
  if (trimmed.length > 0) return trimmed;
  const name = DEFAULT_RUNNER_NAMES[runnerIndex % DEFAULT_RUNNER_NAMES.length];
  runnerIndex += 1;
  return name;
}

/**
 * Returns a human-like fallback when a persona has no name.
 * Use this when you need a stable name in a single view (e.g. one conversation).
 */
export function getPersonaFallbackName(): string {
  const name = DEFAULT_PERSONA_NAMES[personaIndex % DEFAULT_PERSONA_NAMES.length];
  personaIndex += 1;
  return name;
}

/** Stable fallback for "unknown persona" in chat/report so all missing names use the same label. */
export function getStablePersonaFallbackName(): string {
  return DEFAULT_PERSONA_NAMES[0];
}

/**
 * Returns a human-like name for an advisor when extraction fails (e.g. document had no clear author).
 */
export function getAdvisorFallbackName(): string {
  const idx = Math.floor(Math.random() * DEFAULT_ADVISOR_NAMES.length);
  return DEFAULT_ADVISOR_NAMES[idx];
}
