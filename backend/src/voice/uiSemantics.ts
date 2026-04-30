/**
 * UI + backend semantics corpus consumed by the planner. Each `UiSemanticDoc`
 * is one logical reference document chunked + embedded into `knowledge_chunks`
 * with a synthetic NULL persona/user/session, and retrieved by
 * `retrieveUiSemantics` per planning call.
 *
 * The corpus is regenerated on demand from `buildUiSemanticsCorpus()` (see
 * `backend/scripts/generateUiSemantics.ts`) and indexed at boot when
 * `VOICE_SEMANTICS_AUTOINDEX=1` or via `POST /api/admin/reindex-ui-semantics`.
 */

import { createHash } from 'crypto';
import { ALL_FORMS, type BackendFormSchema, fieldId } from './forms.js';
import { UI_NODES } from './uiMapData.js';

export type UiSemanticType =
  | 'ui_node'
  | 'form_schema'
  | 'api_route'
  | 'db_table'
  | 'workflow';

export type UiSemanticDoc = {
  /** Vector source_type — ends up in `knowledge_chunks.source_type`. */
  type: UiSemanticType;
  /** Stable id within a type — used to detect deltas + to power admin views. */
  id: string;
  /** Short title shown in retrieval previews. */
  title: string;
  /** Long-form markdown body that gets chunked + embedded. */
  body: string;
};

export type UiSemanticsCorpus = {
  hash: string;
  generatedAt: string;
  docs: UiSemanticDoc[];
};

function uiNodeDocs(): UiSemanticDoc[] {
  return UI_NODES.map((n) => {
    const transitions = n.transitions
      .map((t) => `- to:${t.to} via:${t.via} label:${t.label}${t.targetId ? ` targetId:${t.targetId}` : ''}`)
      .join('\n');
    const goals = n.goals
      .map((g) => `- ${g.id}: ${g.description} (completion=${JSON.stringify(g.completion)})`)
      .join('\n');
    const auth = n.prerequisites?.auth ?? 'none';
    const queryStr = n.query ? `?${new URLSearchParams(n.query).toString()}` : '';
    const body = `# UI node ${n.id}

Title: ${n.title}
Path: ${n.path}${queryStr}
Auth: ${auth}
Purpose: ${n.purpose}

## When to use
${n.whenToUse.map((x) => `- ${x}`).join('\n')}

## Transitions
${transitions || '(none)'}

## Goals
${goals || '(none)'}
`;
    return {
      type: 'ui_node',
      id: n.id,
      title: `UI node — ${n.title} (${n.path}${queryStr})`,
      body,
    };
  });
}

function formSchemaDoc(form: BackendFormSchema): UiSemanticDoc {
  const queryStr = form.pageQuery
    ? `?${new URLSearchParams(form.pageQuery).toString()}`
    : '';
  const fields = form.fields
    .map((f) => {
      const opts = f.options?.length
        ? ` options=[${f.options.map((o) => o.value).join(', ')}]`
        : '';
      const db = f.dbColumn ? ` dbColumn=${f.dbColumn}` : '';
      const req = f.required ? ' required' : '';
      const ex = f.examples?.length ? ` examples=[${f.examples.join(' | ')}]` : '';
      const action = f.action ?? (f.type === 'button' || f.type === 'tab' || f.type === 'checkbox' || f.type === 'radio' ? 'click' : 'fill');
      return `- ${fieldId(form.formKey, f.key)} | label="${f.label}" type=${f.type} action=${action}${db}${req}${opts}${ex}`;
    })
    .join('\n');
  const body = `# Form ${form.formKey}

Title: ${form.title}
Page: ${form.page}${queryStr}
Purpose: ${form.purpose}
${form.persistsTo?.length ? `Persists to: ${form.persistsTo.join(', ')}` : ''}
${form.submitTargetId ? `Submit target id: ${form.submitTargetId}` : ''}

## Fields (target ids)
${fields}
`;
  return {
    type: 'form_schema',
    id: form.formKey,
    title: `Form — ${form.title}`,
    body,
  };
}

type ApiRoute = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  controller: string;
  purpose: string;
  auth: 'none' | 'user' | 'admin';
};

const API_ROUTES: ApiRoute[] = [
  { method: 'POST', path: '/api/auth/register', controller: 'authController.register', purpose: 'Create a new user account.', auth: 'none' },
  { method: 'POST', path: '/api/auth/login', controller: 'authController.login', purpose: 'Authenticate and receive a JWT.', auth: 'none' },

  { method: 'GET', path: '/api/personas/library', controller: 'personaController.getLibraryPersonas', purpose: 'List all library-shared personas.', auth: 'user' },
  { method: 'GET', path: '/api/personas/starred', controller: 'personaController.getStarredPersonas', purpose: 'List personas the current user has starred.', auth: 'user' },
  { method: 'GET', path: '/api/personas/available', controller: 'personaController.getAvailablePersonas', purpose: 'List personas the user can use (own + library).', auth: 'user' },
  { method: 'POST', path: '/api/personas/:id/star', controller: 'personaController.starPersona', purpose: 'Star a persona for quick access.', auth: 'user' },
  { method: 'DELETE', path: '/api/personas/:id/star', controller: 'personaController.unstarPersona', purpose: 'Remove a star from a persona.', auth: 'user' },
  { method: 'GET', path: '/api/personas', controller: 'personaController.getPersonas', purpose: 'List the user\'s own personas.', auth: 'user' },
  { method: 'GET', path: '/api/personas/:id', controller: 'personaController.getPersona', purpose: 'Fetch a single persona.', auth: 'user' },
  { method: 'POST', path: '/api/personas', controller: 'personaController.createPersona', purpose: 'Create a new persona row in `personas`.', auth: 'user' },
  { method: 'PUT', path: '/api/personas/:id', controller: 'personaController.updatePersona', purpose: 'Update persona fields, including visibility.', auth: 'user' },
  { method: 'DELETE', path: '/api/personas/:id', controller: 'personaController.deletePersona', purpose: 'Delete a persona.', auth: 'user' },
  { method: 'GET', path: '/api/personas/:personaId/files', controller: 'personaController.getPersonaFiles', purpose: 'List blueprint files attached to a persona.', auth: 'user' },
  { method: 'POST', path: '/api/personas/:personaId/files', controller: 'personaController.createPersonaFile', purpose: 'Attach a blueprint markdown file to a persona.', auth: 'user' },

  { method: 'GET', path: '/api/chat/sessions', controller: 'chatController.getChatSessions', purpose: 'List chat sessions.', auth: 'user' },
  { method: 'POST', path: '/api/chat/sessions', controller: 'chatController.createChatSession', purpose: 'Create a new chat session.', auth: 'user' },
  { method: 'GET', path: '/api/chat/sessions/:id', controller: 'chatController.getChatSession', purpose: 'Fetch a single chat session.', auth: 'user' },
  { method: 'PUT', path: '/api/chat/sessions/:id', controller: 'chatController.updateChatSession', purpose: 'Rename a chat session.', auth: 'user' },
  { method: 'DELETE', path: '/api/chat/sessions/:id', controller: 'chatController.deleteChatSession', purpose: 'Delete a chat session.', auth: 'user' },
  { method: 'GET', path: '/api/chat/sessions/:sessionId/personas', controller: 'chatController.getSessionPersonas', purpose: 'List personas attached to a chat session.', auth: 'user' },
  { method: 'GET', path: '/api/chat/sessions/:sessionId/messages', controller: 'chatController.getMessages', purpose: 'Load chat messages.', auth: 'user' },
  { method: 'POST', path: '/api/chat/sessions/:sessionId/messages', controller: 'chatController.createMessage', purpose: 'Append a chat message.', auth: 'user' },
  { method: 'DELETE', path: '/api/chat/sessions/:sessionId/messages/:messageId', controller: 'chatController.deleteMessage', purpose: 'Delete a chat message.', auth: 'user' },

  { method: 'POST', path: '/api/agent/turn', controller: 'agentController.turn', purpose: 'Run one in-character persona turn (think + respond + validate).', auth: 'user' },
  { method: 'POST', path: '/api/agent/index-context', controller: 'agentController.indexContext', purpose: 'Index per-session context inputs.', auth: 'user' },
  { method: 'POST', path: '/api/agent/retrieve', controller: 'agentController.retrieveContext', purpose: 'Cosine-similarity retrieval over knowledge_chunks.', auth: 'user' },
  { method: 'POST', path: '/api/agent/index-unindexed', controller: 'agentController.indexUnindexed', purpose: 'Re-index personas missing chunks.', auth: 'user' },

  { method: 'GET', path: '/api/simulations/templates/mine', controller: 'simulationTemplateUserController.getMine', purpose: 'List the user\'s own templates.', auth: 'user' },
  { method: 'GET', path: '/api/simulations/templates/library', controller: 'simulationTemplateUserController.getLibrary', purpose: 'Library of public templates.', auth: 'user' },
  { method: 'GET', path: '/api/simulations/templates/starred', controller: 'simulationTemplateUserController.getStarred', purpose: 'List starred templates.', auth: 'user' },
  { method: 'POST', path: '/api/simulations/templates/preview-prompt', controller: 'simulationTemplateUserController.previewSystemPromptUser', purpose: 'Preview the generated system_prompt for a config.', auth: 'user' },
  { method: 'POST', path: '/api/simulations/templates', controller: 'simulationTemplateUserController.createUserTemplate', purpose: 'Create a new simulation template.', auth: 'user' },
  { method: 'GET', path: '/api/simulations/templates/:id', controller: 'simulationTemplateUserController.getTemplateById', purpose: 'Fetch one template.', auth: 'user' },
  { method: 'PUT', path: '/api/simulations/templates/:id', controller: 'simulationTemplateUserController.updateUserTemplate', purpose: 'Update an owned template.', auth: 'user' },
  { method: 'DELETE', path: '/api/simulations/templates/:id', controller: 'simulationTemplateUserController.deleteUserTemplate', purpose: 'Delete an owned template.', auth: 'user' },
  { method: 'POST', path: '/api/simulations/templates/:id/star', controller: 'simulationTemplateUserController.starTemplate', purpose: 'Star a template.', auth: 'user' },
  { method: 'DELETE', path: '/api/simulations/templates/:id/star', controller: 'simulationTemplateUserController.unstarTemplate', purpose: 'Unstar a template.', auth: 'user' },
  { method: 'GET', path: '/api/simulations/templates', controller: 'simulationTemplateController.getActiveSimulations', purpose: 'List active library templates.', auth: 'user' },
  { method: 'GET', path: '/api/simulations', controller: 'simulationController.getSimulationSessions', purpose: 'List simulation runs.', auth: 'user' },
  { method: 'GET', path: '/api/simulations/:id', controller: 'simulationController.getSimulationSession', purpose: 'Fetch a simulation run.', auth: 'user' },
  { method: 'POST', path: '/api/simulations', controller: 'simulationController.createSimulationSession', purpose: 'Start a simulation run.', auth: 'user' },
  { method: 'POST', path: '/api/simulations/:id/messages', controller: 'simulationController.createSimulationMessage', purpose: 'Append a message to a simulation run.', auth: 'user' },
  { method: 'POST', path: '/api/simulations/:id/messages/bulk', controller: 'simulationController.createSimulationMessagesBulk', purpose: 'Bulk insert simulation messages.', auth: 'user' },
  { method: 'PUT', path: '/api/simulations/:id', controller: 'simulationController.updateSimulationSession', purpose: 'Update a simulation run.', auth: 'user' },
  { method: 'DELETE', path: '/api/simulations/:id', controller: 'simulationController.deleteSimulationSession', purpose: 'Delete a simulation run.', auth: 'user' },

  { method: 'GET', path: '/api/profile/business', controller: 'businessProfileController.getBusinessProfile', purpose: 'Fetch the runner business profile.', auth: 'user' },
  { method: 'PUT', path: '/api/profile/business', controller: 'businessProfileController.upsertBusinessProfile', purpose: 'Upsert the runner business profile.', auth: 'user' },

  { method: 'GET', path: '/api/focus-groups', controller: 'focusGroupController.listFocusGroups', purpose: 'List focus groups.', auth: 'user' },
  { method: 'GET', path: '/api/focus-groups/:id', controller: 'focusGroupController.getFocusGroup', purpose: 'Fetch a focus group.', auth: 'user' },
  { method: 'POST', path: '/api/focus-groups', controller: 'focusGroupController.createFocusGroup', purpose: 'Create a focus group.', auth: 'user' },
  { method: 'PUT', path: '/api/focus-groups/:id', controller: 'focusGroupController.updateFocusGroup', purpose: 'Update or rename a focus group, change membership.', auth: 'user' },
  { method: 'DELETE', path: '/api/focus-groups/:id', controller: 'focusGroupController.deleteFocusGroup', purpose: 'Delete a focus group.', auth: 'user' },

  { method: 'POST', path: '/api/voice/intent-public', controller: 'voiceController.intentPublic', purpose: 'Anonymous voice intent (rate-limited).', auth: 'none' },
  { method: 'POST', path: '/api/voice/intent', controller: 'voiceController.intent', purpose: 'Authenticated voice intent. Returns single or batch.', auth: 'user' },
  { method: 'POST', path: '/api/voice/plan', controller: 'voiceController.plan', purpose: 'Create a multi-step plan for the navigator agent.', auth: 'user' },
  { method: 'POST', path: '/api/voice/observe', controller: 'voiceController.observe', purpose: 'Report an observation, get continue/replan/done.', auth: 'user' },
  { method: 'POST', path: '/api/voice/cancel', controller: 'voiceController.cancel', purpose: 'Cancel an in-flight plan.', auth: 'user' },

  { method: 'GET', path: '/api/admin/users', controller: 'adminController.getUsers', purpose: 'Admin: list users.', auth: 'admin' },
  { method: 'GET', path: '/api/admin/personas', controller: 'adminController.getPersonas', purpose: 'Admin: list all personas.', auth: 'admin' },
  { method: 'POST', path: '/api/admin/reindex-all', controller: 'adminController.reindexAll', purpose: 'Admin: re-index all personas.', auth: 'admin' },
  { method: 'POST', path: '/api/admin/reindex-ui-semantics', controller: 'adminController.reindexUiSemantics', purpose: 'Admin: rebuild the UI semantics RAG corpus.', auth: 'admin' },
];

function apiRouteDoc(r: ApiRoute): UiSemanticDoc {
  const body = `# API ${r.method} ${r.path}

Controller: ${r.controller}
Auth: ${r.auth}
Purpose: ${r.purpose}
`;
  return {
    type: 'api_route',
    id: `${r.method} ${r.path}`,
    title: `API — ${r.method} ${r.path}`,
    body,
  };
}

type DbTable = {
  name: string;
  purpose: string;
  columns: { name: string; type: string; notes?: string }[];
};

const DB_TABLES: DbTable[] = [
  {
    name: 'users',
    purpose: 'Account records. JWT subject. Admin flag controls /admin access.',
    columns: [
      { name: 'id', type: 'uuid' },
      { name: 'username', type: 'text' },
      { name: 'email', type: 'text' },
      { name: 'is_admin', type: 'boolean' },
      { name: 'created_at', type: 'timestamp' },
    ],
  },
  {
    name: 'business_profiles',
    purpose: 'One company-context row per user. Fed into persona generation and simulations.',
    columns: [
      { name: 'id', type: 'uuid' },
      { name: 'user_id', type: 'uuid', notes: 'fk users.id, unique' },
      { name: 'business_name', type: 'text' },
      { name: 'mission_statement', type: 'text' },
      { name: 'vision_statement', type: 'text' },
      { name: 'description_main_offerings', type: 'text' },
      { name: 'key_features_or_benefits', type: 'text' },
      { name: 'unique_selling_proposition', type: 'text' },
      { name: 'pricing_model', type: 'text' },
      { name: 'customer_segments', type: 'text' },
      { name: 'geographic_focus', type: 'text' },
      { name: 'industry_served', type: 'text' },
      { name: 'what_differentiates', type: 'text' },
      { name: 'market_niche', type: 'text' },
      { name: 'distribution_channels', type: 'text' },
      { name: 'key_personnel', type: 'text' },
      { name: 'major_achievements', type: 'text' },
      { name: 'revenue', type: 'text' },
      { name: 'key_performance_indicators', type: 'text' },
      { name: 'funding_rounds', type: 'text' },
      { name: 'revenue_streams', type: 'text' },
      { name: 'website', type: 'text' },
    ],
  },
  {
    name: 'personas',
    purpose: 'Synthetic users and advisors. Used by chat and simulations.',
    columns: [
      { name: 'id', type: 'uuid' },
      { name: 'user_id', type: 'uuid' },
      { name: 'name', type: 'text' },
      { name: 'type', type: 'text', notes: 'synthetic_user | advisor' },
      { name: 'description', type: 'text' },
      { name: 'avatar_url', type: 'text' },
      { name: 'visibility', type: 'text', notes: 'private | public' },
      { name: 'last_embedded_at', type: 'timestamp' },
    ],
  },
  {
    name: 'persona_files',
    purpose: 'Blueprint and knowledge markdown files attached to a persona; chunked into knowledge_chunks.',
    columns: [
      { name: 'id', type: 'uuid' },
      { name: 'persona_id', type: 'uuid' },
      { name: 'name', type: 'text' },
      { name: 'content', type: 'text' },
      { name: 'type', type: 'text' },
    ],
  },
  {
    name: 'focus_groups',
    purpose: 'User-curated cohorts of personas; can be added all at once in chat or simulation.',
    columns: [
      { name: 'id', type: 'uuid' },
      { name: 'user_id', type: 'uuid' },
      { name: 'name', type: 'text' },
      { name: 'allowed_persona_types', type: 'text[]' },
    ],
  },
  {
    name: 'focus_group_personas',
    purpose: 'Membership table linking focus_groups to personas.',
    columns: [
      { name: 'focus_group_id', type: 'uuid' },
      { name: 'persona_id', type: 'uuid' },
    ],
  },
  {
    name: 'chat_sessions',
    purpose: 'Persistent conversation threads with one or more personas.',
    columns: [
      { name: 'id', type: 'uuid' },
      { name: 'user_id', type: 'uuid' },
      { name: 'name', type: 'text' },
    ],
  },
  {
    name: 'chat_session_personas',
    purpose: 'Membership table linking chat_sessions to personas.',
    columns: [
      { name: 'session_id', type: 'uuid' },
      { name: 'persona_id', type: 'uuid' },
    ],
  },
  {
    name: 'messages',
    purpose: 'Individual chat messages within a chat_session.',
    columns: [
      { name: 'id', type: 'uuid' },
      { name: 'session_id', type: 'uuid' },
      { name: 'sender_type', type: 'text', notes: 'user | persona' },
      { name: 'persona_id', type: 'uuid' },
      { name: 'content', type: 'text' },
      { name: 'created_at', type: 'timestamp' },
    ],
  },
  {
    name: 'simulations',
    purpose: 'Simulation templates that drive how a simulation runs (type, prompts, inputs).',
    columns: [
      { name: 'id', type: 'uuid' },
      { name: 'user_id', type: 'uuid' },
      { name: 'title', type: 'text' },
      { name: 'description', type: 'text' },
      { name: 'simulation_type', type: 'text' },
      { name: 'allowed_persona_types', type: 'text[]' },
      { name: 'persona_count_min', type: 'int' },
      { name: 'persona_count_max', type: 'int' },
      { name: 'system_prompt', type: 'text' },
      { name: 'visibility', type: 'text' },
      { name: 'is_active', type: 'boolean' },
      { name: 'icon', type: 'text' },
      { name: 'required_input_fields', type: 'jsonb' },
      { name: 'type_specific_config', type: 'jsonb' },
    ],
  },
  {
    name: 'simulation_sessions',
    purpose: 'Per-run state for a simulation execution: persona ids, status, runner inputs.',
    columns: [
      { name: 'id', type: 'uuid' },
      { name: 'user_id', type: 'uuid' },
      { name: 'simulation_id', type: 'uuid' },
      { name: 'status', type: 'text' },
      { name: 'persona_ids', type: 'uuid[]' },
    ],
  },
  {
    name: 'simulation_messages',
    purpose: 'Per-turn messages within a simulation_session.',
    columns: [
      { name: 'id', type: 'uuid' },
      { name: 'session_id', type: 'uuid' },
      { name: 'persona_id', type: 'uuid' },
      { name: 'content', type: 'text' },
      { name: 'created_at', type: 'timestamp' },
    ],
  },
  {
    name: 'knowledge_chunks',
    purpose: 'Vector index for RAG. Stores text + embedding rows scoped by persona/session/user, plus the global UI semantics corpus (NULL scope, source_type IN ui_node|form_schema|api_route|db_table|workflow).',
    columns: [
      { name: 'id', type: 'uuid' },
      { name: 'persona_id', type: 'uuid' },
      { name: 'session_id', type: 'uuid' },
      { name: 'user_id', type: 'uuid' },
      { name: 'source_type', type: 'text' },
      { name: 'source_name', type: 'text' },
      { name: 'chunk_index', type: 'int' },
      { name: 'chunk_text', type: 'text' },
      { name: 'embedding', type: 'real[]', notes: 'cosine similarity at query time' },
    ],
  },
];

function dbTableDoc(t: DbTable): UiSemanticDoc {
  const cols = t.columns.map((c) => `- ${c.name}: ${c.type}${c.notes ? ` — ${c.notes}` : ''}`).join('\n');
  const body = `# DB table ${t.name}

Purpose: ${t.purpose}

## Columns
${cols}
`;
  return {
    type: 'db_table',
    id: t.name,
    title: `DB — ${t.name}`,
    body,
  };
}

const WORKFLOWS: { id: string; title: string; body: string }[] = [
  {
    id: 'create_persona',
    title: 'Create persona end-to-end',
    body: `# Workflow: create a persona end-to-end

The user wants to build one or more synthetic personas (or an advisor).

Recommended steps for the navigator:
1. navigate /build (UI node \`build.persona\`).
2. Choose a mode: action target_id \`build.choose_synthetic\` or \`build.choose_advisor\` (also \`build.persona.picker.choose_synthetic\` / \`...choose_advisor\`).
3. For Synthetic User > Problem/Solution, fill the four \`build.persona.problem_solution.*\` fields the user described, set \`...context\` and \`...count\`, then click \`build.persona.problem_solution.submit\`.
4. Wait for generation to finish — the page emits a visibility step.
5. Choose \`build.persona.visibility.visibility = private|public\` then click \`build.save\`.

Replan triggers:
- If saved business profile is missing and the user picked the business_profile mode, ask the user or navigate to \`/business-profile\` first.
`,
  },
  {
    id: 'edit_business_profile',
    title: 'Edit and save the business profile',
    body: `# Workflow: edit business profile

The user wants to update fields on \`/business-profile\` (table business_profiles).

Steps:
1. navigate /business-profile if not there (UI node \`business.profile\`).
2. For each field the user mentioned, action target_id \`business.profile.<dbColumn>\` value=<text>. Examples: \`business.profile.mission_statement\`, \`business.profile.unique_selling_proposition\`, \`business.profile.website\`.
3. Click \`business.profile.save\` (legacy alias \`business.save\`).
`,
  },
  {
    id: 'configure_simulation_template',
    title: 'Configure or create a simulation template',
    body: `# Workflow: simulation template editor

Steps:
1. navigate /simulations (UI node \`simulations.hub\`).
2. Open the create form. action target_id \`simulations.template.simulation_type\` value=<one of report|persuasion_simulation|response_simulation|survey|persona_conversation|idea_generation>.
3. Click \`simulations.template.continue_to_form\`.
4. Fill \`simulations.template.title\`, \`simulations.template.description\`.
5. Toggle \`simulations.template.allowed_persona_types\` to the user's selection.
6. Set \`simulations.template.persona_count_min\` / \`persona_count_max\`.
7. Choose \`simulations.template.visibility\`.
8. Click \`simulations.template.save\` (legacy alias \`simulations.save_template\`). Review the system prompt, then click again to finalize.
`,
  },
  {
    id: 'send_chat_message',
    title: 'Send a chat message to a persona',
    body: `# Workflow: chat with a persona

Steps:
1. If currently on /gallery and the user named a persona, action target_id \`gallery.open_chat.<personaId>\` (this navigates to /chat?personaId=...).
2. Otherwise navigate /chat.
3. action target_id \`chat.composer.message_input\` value=<message text>.
4. action target_id \`chat.composer.send\` (legacy alias \`chat.send\`).
`,
  },
  {
    id: 'create_focus_group',
    title: 'Create a focus group',
    body: `# Workflow: create a focus group

Steps:
1. navigate /gallery?tab=focusGroups (UI node \`gallery.focus\`).
2. action target_id \`gallery.focus.new\` if visible to open the create modal.
3. action target_id \`focus_groups.create.name\` value=<name>.
4. Optional: action target_id \`focus_groups.create.allowed_role\` value=synthetic_user|advisor|"".
5. Click \`focus_groups.create.submit\`.
`,
  },
  {
    id: 'sign_in',
    title: 'Sign the user in',
    body: `# Workflow: sign in

Steps (only when on /login or unauthenticated):
1. action target_id \`login.username\` value=<username or email>.
2. action target_id \`login.password\` value=<password>.
3. Click \`login.submit\`.

Never invent passwords. If missing, clarify.
`,
  },
];

function workflowDoc(w: { id: string; title: string; body: string }): UiSemanticDoc {
  return {
    type: 'workflow',
    id: w.id,
    title: `Workflow — ${w.title}`,
    body: w.body,
  };
}

export function buildUiSemanticsCorpus(): UiSemanticsCorpus {
  const docs: UiSemanticDoc[] = [
    ...uiNodeDocs(),
    ...ALL_FORMS.map(formSchemaDoc),
    ...API_ROUTES.map(apiRouteDoc),
    ...DB_TABLES.map(dbTableDoc),
    ...WORKFLOWS.map(workflowDoc),
  ];
  const hash = createHash('sha256')
    .update(docs.map((d) => `${d.type}:${d.id}\n${d.body}`).join('\n---\n'))
    .digest('hex');
  return {
    hash,
    generatedAt: new Date().toISOString(),
    docs,
  };
}
