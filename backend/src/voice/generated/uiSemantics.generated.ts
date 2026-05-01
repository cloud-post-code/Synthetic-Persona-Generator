// AUTO-GENERATED FILE - DO NOT EDIT.
// Run `tsx backend/scripts/generateUiSemantics.ts` to refresh.

import type { UiSemanticDoc, UiSemanticsCorpus } from '../uiSemantics.js';

export const GENERATED_UI_SEMANTICS: UiSemanticsCorpus = {
  "hash": "85c47b98eef7c05aca2f496245e8c08c2f98addbdb260c9b4b294b4379891ac2",
  "generatedAt": "2026-05-01T19:51:44.504Z",
  "docs": [
    {
      "type": "ui_node",
      "id": "auth.login",
      "title": "UI node — Sign in (/login)",
      "body": "# UI node auth.login\n\nTitle: Sign in\nPath: /login\nAuth: none\nPurpose: Authenticate to access the app.\n\n## When to use\n- log in\n- sign in\n- login\n\n## Transitions\n- to:home.dashboard via:navigate label:After successful login\n\n## Goals\n(none)\n"
    },
    {
      "type": "ui_node",
      "id": "home.dashboard",
      "title": "UI node — Dashboard (/)",
      "body": "# UI node home.dashboard\n\nTitle: Dashboard\nPath: /\nAuth: user\nPurpose: Overview and entry point to all major workflows.\n\n## When to use\n- home\n- dashboard\n- main page\n- landing\n- overview\n- start here\n\n## Transitions\n- to:build.persona via:navigate label:Build persona\n- to:simulations.hub via:navigate label:Simulations hub\n- to:simulate.run via:navigate label:Run simulation\n- to:gallery.personas via:navigate label:My personas\n- to:business.profile via:navigate label:Business profile\n- to:settings.page via:navigate label:Settings\n- to:admin.page via:navigate label:Admin\n\n## Goals\n(none)\n"
    },
    {
      "type": "ui_node",
      "id": "build.persona",
      "title": "UI node — Build Persona (/build)",
      "body": "# UI node build.persona\n\nTitle: Build Persona\nPath: /build\nAuth: user\nPurpose: Create or edit a synthetic persona end-to-end.\n\n## When to use\n- build a persona\n- create persona\n- persona builder\n- new persona\n\n## Transitions\n- to:gallery.personas via:action label:Save persona targetId:build.save\n- to:simulations.hub via:navigate label:Use in simulation\n\n## Goals\n- create_persona: Create and save a new persona (completion={\"type\":\"event\",\"name\":\"persona:saved\"})\n"
    },
    {
      "type": "ui_node",
      "id": "simulations.hub",
      "title": "UI node — Simulations hub (/simulations)",
      "body": "# UI node simulations.hub\n\nTitle: Simulations hub\nPath: /simulations\nAuth: user\nPurpose: Configure and manage simulation templates before running.\n\n## When to use\n- build simulation\n- simulations hub\n- templates\n- new simulation\n\n## Transitions\n- to:simulate.run via:navigate label:Run a simulation\n- to:home.dashboard via:navigate label:Back to dashboard\n\n## Goals\n(none)\n"
    },
    {
      "type": "ui_node",
      "id": "simulate.run",
      "title": "UI node — Run simulation (/simulate)",
      "body": "# UI node simulate.run\n\nTitle: Run simulation\nPath: /simulate\nAuth: user\nPurpose: Execute a live simulation with selected personas.\n\n## When to use\n- run simulation\n- play simulation\n- start simulation\n\n## Transitions\n- to:chat.thread via:navigate label:Open chat\n- to:simulations.hub via:navigate label:Back to hub\n\n## Goals\n(none)\n"
    },
    {
      "type": "ui_node",
      "id": "gallery.personas",
      "title": "UI node — My personas (/gallery)",
      "body": "# UI node gallery.personas\n\nTitle: My personas\nPath: /gallery\nAuth: user\nPurpose: Browse and open personas you created.\n\n## When to use\n- my personas\n- gallery\n- persona list\n\n## Transitions\n- to:gallery.library via:set_query label:Library tab\n- to:gallery.saved via:set_query label:Saved tab\n- to:gallery.focus via:set_query label:Focus groups tab\n- to:chat.thread via:navigate label:Open persona chat\n- to:build.persona via:navigate label:Create new persona\n\n## Goals\n(none)\n"
    },
    {
      "type": "ui_node",
      "id": "gallery.saved",
      "title": "UI node — Saved personas (/gallery?tab=saved)",
      "body": "# UI node gallery.saved\n\nTitle: Saved personas\nPath: /gallery?tab=saved\nAuth: user\nPurpose: Personas you saved from the library.\n\n## When to use\n- saved personas\n- saved tab\n- saved\n\n## Transitions\n- to:gallery.personas via:set_query label:My personas tab\n- to:gallery.library via:set_query label:Library tab\n- to:gallery.focus via:set_query label:Focus groups tab\n- to:chat.thread via:navigate label:Open persona chat\n- to:build.persona via:navigate label:Create new persona\n\n## Goals\n(none)\n"
    },
    {
      "type": "ui_node",
      "id": "gallery.focus",
      "title": "UI node — Focus groups (/gallery?tab=focusGroups)",
      "body": "# UI node gallery.focus\n\nTitle: Focus groups\nPath: /gallery?tab=focusGroups\nAuth: user\nPurpose: Manage focus groups for simulations.\n\n## When to use\n- focus groups\n- focus group tab\n- cohorts\n\n## Transitions\n- to:gallery.personas via:set_query label:My personas tab\n- to:gallery.library via:set_query label:Library tab\n- to:gallery.saved via:set_query label:Saved tab\n- to:chat.thread via:navigate label:Open chat\n- to:build.persona via:navigate label:Create new persona\n\n## Goals\n(none)\n"
    },
    {
      "type": "ui_node",
      "id": "gallery.library",
      "title": "UI node — Persona library (/gallery?tab=library)",
      "body": "# UI node gallery.library\n\nTitle: Persona library\nPath: /gallery?tab=library\nAuth: user\nPurpose: Browse shared or library personas to add to your collection.\n\n## When to use\n- library\n- persona library\n- browse library\n\n## Transitions\n- to:gallery.personas via:set_query label:My personas tab\n- to:gallery.saved via:set_query label:Saved tab\n- to:gallery.focus via:set_query label:Focus groups tab\n\n## Goals\n(none)\n"
    },
    {
      "type": "ui_node",
      "id": "chat.thread",
      "title": "UI node — Chat (/chat)",
      "body": "# UI node chat.thread\n\nTitle: Chat\nPath: /chat\nAuth: user\nPurpose: Converse with a persona or review simulation messages.\n\n## When to use\n- chat\n- conversation\n- messages\n\n## Transitions\n- to:gallery.personas via:navigate label:Back to gallery\n- to:simulate.run via:navigate label:Back to simulation\n\n## Goals\n(none)\n"
    },
    {
      "type": "ui_node",
      "id": "business.profile",
      "title": "UI node — Business profile (/business-profile)",
      "body": "# UI node business.profile\n\nTitle: Business profile\nPath: /business-profile\nAuth: user\nPurpose: Edit company context used across simulations.\n\n## When to use\n- business profile\n- company profile\n\n## Transitions\n- to:home.dashboard via:navigate label:Home\n\n## Goals\n- save_business_profile: Save business profile changes (completion={\"type\":\"event\",\"name\":\"business_profile:saved\"})\n"
    },
    {
      "type": "ui_node",
      "id": "settings.page",
      "title": "UI node — Settings (/settings)",
      "body": "# UI node settings.page\n\nTitle: Settings\nPath: /settings\nAuth: user\nPurpose: Account and app preferences.\n\n## When to use\n- settings\n- preferences\n- account\n\n## Transitions\n- to:home.dashboard via:navigate label:Home\n\n## Goals\n(none)\n"
    },
    {
      "type": "ui_node",
      "id": "admin.page",
      "title": "UI node — Admin (/admin)",
      "body": "# UI node admin.page\n\nTitle: Admin\nPath: /admin\nAuth: admin\nPurpose: Administrative tools (admin users only).\n\n## When to use\n- admin\n- administration\n- admin panel\n- moderator\n\n## Transitions\n- to:home.dashboard via:navigate label:Home\n\n## Goals\n(none)\n"
    },
    {
      "type": "ui_node",
      "id": "info.synthetic_user",
      "title": "UI node — Synthetic user detail (/info/synthetic-user)",
      "body": "# UI node info.synthetic_user\n\nTitle: Synthetic user detail\nPath: /info/synthetic-user\nAuth: user\nPurpose: Read-only detail for a synthetic user record.\n\n## When to use\n- synthetic user info\n- user detail\n- synthetic user page\n\n## Transitions\n- to:home.dashboard via:navigate label:Home\n\n## Goals\n(none)\n"
    },
    {
      "type": "ui_node",
      "id": "info.advisor",
      "title": "UI node — Advisor detail (/info/advisor)",
      "body": "# UI node info.advisor\n\nTitle: Advisor detail\nPath: /info/advisor\nAuth: user\nPurpose: Read-only advisor information.\n\n## When to use\n- advisor info\n- advisor detail\n- advisor page\n\n## Transitions\n- to:home.dashboard via:navigate label:Home\n\n## Goals\n(none)\n"
    },
    {
      "type": "form_schema",
      "id": "build.persona.assistant",
      "title": "Form — Build persona — voice assistant",
      "body": "# Form build.persona.assistant\n\nTitle: Build persona — voice assistant\nPage: /build\nPurpose: Voice and text describe; Build it for me routes to Synthetic user or Advisor and fills fields.\n\n\n\n## Fields (target ids)\n- build.persona.assistant.describe | label=\"Describe your persona\" type=textarea action=fill\n- build.persona.assistant.mic_toggle | label=\"Voice describe persona\" type=button action=click\n- build.persona.assistant.generate | label=\"Build persona form from description\" type=button action=click\n"
    },
    {
      "type": "form_schema",
      "id": "login",
      "title": "Form — Sign in",
      "body": "# Form login\n\nTitle: Sign in\nPage: /login\nPurpose: Authenticate the user. Issues a JWT and redirects to the dashboard.\nPersists to: users\nSubmit target id: login.submit\n\n## Fields (target ids)\n- login.username | label=\"Username or email\" type=text action=fill dbColumn=username required\n- login.password | label=\"Password\" type=password action=fill required\n- login.submit | label=\"Sign in\" type=button action=click\n"
    },
    {
      "type": "form_schema",
      "id": "business.profile",
      "title": "Form — Business profile",
      "body": "# Form business.profile\n\nTitle: Business profile\nPage: /business-profile\nPurpose: Structured Business Profile Builder (disciplined entrepreneurship). Answers auto-save to business_profiles.answers (JSON).\nPersists to: business_profiles\nSubmit target id: business.profile.save\n\n## Fields (target ids)\n- business.profile.company_hint | label=\"Company name or website (optional)\" type=text action=fill dbColumn=company_hint\n- business.profile.who_is_customer.target_customer_persona.primary_customer | label=\"Who is your primary customer?\" type=textarea action=fill dbColumn=who_is_customer.target_customer_persona.primary_customer\n- business.profile.who_is_customer.target_customer_persona.job_title_role | label=\"What is their job/title or role?\" type=textarea action=fill dbColumn=who_is_customer.target_customer_persona.job_title_role\n- business.profile.who_is_customer.target_customer_persona.industry | label=\"What industry are they in?\" type=textarea action=fill dbColumn=who_is_customer.target_customer_persona.industry\n- business.profile.who_is_customer.target_customer_persona.demographic_profile | label=\"What is their demographic profile?\" type=textarea action=fill dbColumn=who_is_customer.target_customer_persona.demographic_profile\n- business.profile.who_is_customer.target_customer_persona.goals | label=\"What are their goals?\" type=textarea action=fill dbColumn=who_is_customer.target_customer_persona.goals\n- business.profile.who_is_customer.target_customer_persona.frustrations | label=\"What are their frustrations?\" type=textarea action=fill dbColumn=who_is_customer.target_customer_persona.frustrations\n- business.profile.who_is_customer.beachhead_market.niche_first | label=\"What specific niche are you targeting first?\" type=textarea action=fill dbColumn=who_is_customer.beachhead_market.niche_first\n- business.profile.who_is_customer.beachhead_market.why_niche | label=\"Why this niche?\" type=textarea action=fill dbColumn=who_is_customer.beachhead_market.why_niche\n- business.profile.who_is_customer.beachhead_market.segment_size | label=\"How large is this segment?\" type=textarea action=fill dbColumn=who_is_customer.beachhead_market.segment_size\n- business.profile.who_is_customer.beachhead_market.group_accessible | label=\"What makes this group accessible?\" type=textarea action=fill dbColumn=who_is_customer.beachhead_market.group_accessible\n- business.profile.who_is_customer.customer_segmentation.segments | label=\"What are the different customer segments?\" type=textarea action=fill dbColumn=who_is_customer.customer_segmentation.segments\n- business.profile.who_is_customer.customer_segmentation.priority_segment | label=\"Which segment is the highest priority?\" type=textarea action=fill dbColumn=who_is_customer.customer_segmentation.priority_segment\n- business.profile.who_is_customer.customer_segmentation.segment_differentiators | label=\"What differentiates each segment?\" type=textarea action=fill dbColumn=who_is_customer.customer_segmentation.segment_differentiators\n- business.profile.problem_solution.problem_definition.core_problem | label=\"What is the core problem?\" type=textarea action=fill dbColumn=problem_solution.problem_definition.core_problem\n- business.profile.problem_solution.problem_definition.frequency | label=\"How frequently does this problem occur?\" type=textarea action=fill dbColumn=problem_solution.problem_definition.frequency\n- business.profile.problem_solution.problem_definition.pain_level_1_10 | label=\"How painful is it (1–10)?\" type=textarea action=fill dbColumn=problem_solution.problem_definition.pain_level_1_10\n- business.profile.problem_solution.problem_definition.if_unsolved | label=\"What happens if it's not solved?\" type=textarea action=fill dbColumn=problem_solution.problem_definition.if_unsolved\n- business.profile.problem_solution.current_alternatives.solve_today | label=\"How do customers solve this today?\" type=textarea action=fill dbColumn=problem_solution.current_alternatives.solve_today\n- business.profile.problem_solution.current_alternatives.limitations | label=\"What are the limitations of current solutions?\" type=textarea action=fill dbColumn=problem_solution.current_alternatives.limitations\n- business.profile.problem_solution.current_alternatives.insufficient_why | label=\"Why are these solutions insufficient?\" type=textarea action=fill dbColumn=problem_solution.current_alternatives.insufficient_why\n- business.profile.problem_solution.your_solution.product | label=\"What is your product?\" type=textarea action=fill dbColumn=problem_solution.your_solution.product\n- business.profile.problem_solution.your_solution.how_solves | label=\"How does it solve the problem?\" type=textarea action=fill dbColumn=problem_solution.your_solution.how_solves\n- business.profile.problem_solution.your_solution.uniqueness | label=\"What makes your solution unique?\" type=textarea action=fill dbColumn=problem_solution.your_solution.uniqueness\n- business.profile.problem_solution.your_solution.vs_alternatives | label=\"Why is it better than alternatives?\" type=textarea action=fill dbColumn=problem_solution.your_solution.vs_alternatives\n- business.profile.problem_solution.value_proposition.main_benefit | label=\"What is the main benefit to the customer?\" type=textarea action=fill dbColumn=problem_solution.value_proposition.main_benefit\n- business.profile.problem_solution.value_proposition.outcome | label=\"What outcome do they achieve?\" type=textarea action=fill dbColumn=problem_solution.value_proposition.outcome\n- business.profile.problem_solution.value_proposition.why_care | label=\"Why should they care?\" type=textarea action=fill dbColumn=problem_solution.value_proposition.why_care\n- business.profile.acquisition.customer_journey.discovery | label=\"How does a customer discover your product?\" type=textarea action=fill dbColumn=acquisition.customer_journey.discovery\n- business.profile.acquisition.customer_journey.steps_before_purchase | label=\"What steps do they take before buying?\" type=textarea action=fill dbColumn=acquisition.customer_journey.steps_before_purchase\n- business.profile.acquisition.customer_journey.hesitation_points | label=\"Where do they hesitate?\" type=textarea action=fill dbColumn=acquisition.customer_journey.hesitation_points\n- business.profile.acquisition.acquisition_channels.channels_list | label=\"What channels will you use? (ads, outbound, content, etc.)\" type=textarea action=fill dbColumn=acquisition.acquisition_channels.channels_list\n- business.profile.acquisition.acquisition_channels.primary_channel | label=\"Which is your primary channel?\" type=textarea action=fill dbColumn=acquisition.acquisition_channels.primary_channel\n- business.profile.acquisition.acquisition_channels.why_channel_works | label=\"Why will this channel work?\" type=textarea action=fill dbColumn=acquisition.acquisition_channels.why_channel_works\n- business.profile.acquisition.sales_process.self_serve_or_sales | label=\"Is this self-serve or sales-driven?\" type=textarea action=fill dbColumn=acquisition.sales_process.self_serve_or_sales\n- business.profile.acquisition.sales_process.steps_to_close | label=\"What are the steps to close a customer?\" type=textarea action=fill dbColumn=acquisition.sales_process.steps_to_close\n- business.profile.acquisition.sales_process.sales_cycle | label=\"How long is the sales cycle?\" type=textarea action=fill dbColumn=acquisition.sales_process.sales_cycle\n- business.profile.acquisition.early_adopters_strategy.who_first | label=\"Who will adopt first?\" type=textarea action=fill dbColumn=acquisition.early_adopters_strategy.who_first\n- business.profile.acquisition.early_adopters_strategy.how_reach | label=\"How will you reach them?\" type=textarea action=fill dbColumn=acquisition.early_adopters_strategy.how_reach\n- business.profile.acquisition.early_adopters_strategy.why_try_early | label=\"Why will they try your product early?\" type=textarea action=fill dbColumn=acquisition.early_adopters_strategy.why_try_early\n- business.profile.monetization.revenue_model.charge_model | label=\"How do you charge? (subscription, one-time, etc.)\" type=textarea action=fill dbColumn=monetization.revenue_model.charge_model\n- business.profile.monetization.revenue_model.pricing_structure | label=\"What is your pricing structure?\" type=textarea action=fill dbColumn=monetization.revenue_model.pricing_structure\n- business.profile.monetization.revenue_model.why_model | label=\"Why this pricing model?\" type=textarea action=fill dbColumn=monetization.revenue_model.why_model\n- business.profile.monetization.willingness_to_pay.problem_worth | label=\"How much is the problem worth solving?\" type=textarea action=fill dbColumn=monetization.willingness_to_pay.problem_worth\n- business.profile.monetization.willingness_to_pay.current_spend | label=\"What do customers currently pay?\" type=textarea action=fill dbColumn=monetization.willingness_to_pay.current_spend\n- business.profile.monetization.willingness_to_pay.acceptable_price | label=\"What price feels acceptable?\" type=textarea action=fill dbColumn=monetization.willingness_to_pay.acceptable_price\n- business.profile.monetization.unit_economics.cac | label=\"Customer acquisition cost (CAC)?\" type=textarea action=fill dbColumn=monetization.unit_economics.cac\n- business.profile.monetization.unit_economics.ltv | label=\"Lifetime value (LTV)?\" type=textarea action=fill dbColumn=monetization.unit_economics.ltv\n- business.profile.monetization.unit_economics.gross_margin | label=\"Gross margin?\" type=textarea action=fill dbColumn=monetization.unit_economics.gross_margin\n- business.profile.monetization.scaling_revenue.increase_per_customer | label=\"How do you increase revenue per customer?\" type=textarea action=fill dbColumn=monetization.scaling_revenue.increase_per_customer\n- business.profile.monetization.scaling_revenue.upsell_expand | label=\"Can you upsell or expand?\" type=textarea action=fill dbColumn=monetization.scaling_revenue.upsell_expand\n- business.profile.monetization.scaling_revenue.long_term_growth | label=\"What drives long-term growth?\" type=textarea action=fill dbColumn=monetization.scaling_revenue.long_term_growth\n- business.profile.product_design.core_features.must_have | label=\"What are the must-have features?\" type=textarea action=fill dbColumn=product_design.core_features.must_have\n- business.profile.product_design.core_features.mvp | label=\"What is the MVP?\" type=textarea action=fill dbColumn=product_design.core_features.mvp\n- business.profile.product_design.core_features.exclude_now | label=\"What can be excluded for now?\" type=textarea action=fill dbColumn=product_design.core_features.exclude_now\n- business.profile.product_design.user_experience.journey | label=\"What does the user journey look like?\" type=textarea action=fill dbColumn=product_design.user_experience.journey\n- business.profile.product_design.user_experience.key_interactions | label=\"What are key interactions?\" type=textarea action=fill dbColumn=product_design.user_experience.key_interactions\n- business.profile.product_design.user_experience.effortless_where | label=\"Where must it feel effortless?\" type=textarea action=fill dbColumn=product_design.user_experience.effortless_where\n- business.profile.product_design.differentiation.stand_out | label=\"What makes your product stand out?\" type=textarea action=fill dbColumn=product_design.differentiation.stand_out\n- business.profile.product_design.differentiation.hard_to_replicate | label=\"What is hard to replicate?\" type=textarea action=fill dbColumn=product_design.differentiation.hard_to_replicate\n- business.profile.product_design.differentiation.unfair_advantage | label=\"What is your unfair advantage?\" type=textarea action=fill dbColumn=product_design.differentiation.unfair_advantage\n- business.profile.product_design.product_roadmap.after_mvp | label=\"What comes after MVP?\" type=textarea action=fill dbColumn=product_design.product_roadmap.after_mvp\n- business.profile.product_design.product_roadmap.next_features | label=\"What features come next?\" type=textarea action=fill dbColumn=product_design.product_roadmap.next_features\n- business.profile.product_design.product_roadmap.prioritization | label=\"How do you prioritize?\" type=textarea action=fill dbColumn=product_design.product_roadmap.prioritization\n- business.profile.building_scaling.go_to_market_plan.launch_plan | label=\"How do you launch?\" type=textarea action=fill dbColumn=building_scaling.go_to_market_plan.launch_plan\n- business.profile.building_scaling.go_to_market_plan.traction_strategy | label=\"What is your initial traction strategy?\" type=textarea action=fill dbColumn=building_scaling.go_to_market_plan.traction_strategy\n- business.profile.building_scaling.go_to_market_plan.success_metrics | label=\"What metrics define success?\" type=textarea action=fill dbColumn=building_scaling.go_to_market_plan.success_metrics\n- business.profile.building_scaling.operations.key_processes | label=\"What are the key processes?\" type=textarea action=fill dbColumn=building_scaling.operations.key_processes\n- business.profile.building_scaling.operations.tools_systems | label=\"What tools/systems are needed?\" type=textarea action=fill dbColumn=building_scaling.operations.tools_systems\n- business.profile.building_scaling.operations.daily_smooth | label=\"What must run smoothly daily?\" type=textarea action=fill dbColumn=building_scaling.operations.daily_smooth\n- business.profile.building_scaling.team.key_roles | label=\"Who are the key roles?\" type=textarea action=fill dbColumn=building_scaling.team.key_roles\n- business.profile.building_scaling.team.skills_required | label=\"What skills are required?\" type=textarea action=fill dbColumn=building_scaling.team.skills_required\n- business.profile.building_scaling.team.hire_first | label=\"What will you hire first?\" type=textarea action=fill dbColumn=building_scaling.team.hire_first\n- business.profile.building_scaling.scaling_strategy.when_grow | label=\"What happens when you grow?\" type=textarea action=fill dbColumn=building_scaling.scaling_strategy.when_grow\n- business.profile.building_scaling.scaling_strategy.breaks_first | label=\"What breaks first?\" type=textarea action=fill dbColumn=building_scaling.scaling_strategy.breaks_first\n- business.profile.building_scaling.scaling_strategy.efficient_scale | label=\"How do you scale efficiently?\" type=textarea action=fill dbColumn=building_scaling.scaling_strategy.efficient_scale\n- business.profile.save | label=\"Save business profile (sync)\" type=button action=click\n"
    },
    {
      "type": "form_schema",
      "id": "business.profile.assistant",
      "title": "Form — Business profile — voice assistant",
      "body": "# Form business.profile.assistant\n\nTitle: Business profile — voice assistant\nPage: /business-profile\nPurpose: Natural-language and voice input to map descriptions across Business Profile sections (sparse keys); staged UI apply.\n\n\n\n## Fields (target ids)\n- business.profile.assistant.describe | label=\"Describe your business\" type=textarea action=fill\n- business.profile.assistant.mic_toggle | label=\"Voice describe business profile\" type=button action=click\n- business.profile.assistant.generate | label=\"Fill profile from description\" type=button action=click\n"
    },
    {
      "type": "form_schema",
      "id": "build.persona.picker",
      "title": "Form — Build persona — pick mode",
      "body": "# Form build.persona.picker\n\nTitle: Build persona — pick mode\nPage: /build\nPurpose: Choose between Synthetic User and Advisor builders.\n\n\n\n## Fields (target ids)\n- build.persona.picker.choose_synthetic | label=\"Open Synthetic User builder\" type=button action=click\n- build.persona.picker.choose_advisor | label=\"Open Advisor builder\" type=button action=click\n- build.persona.picker.back | label=\"Back to selection\" type=button action=click\n"
    },
    {
      "type": "form_schema",
      "id": "build.persona.problem_solution",
      "title": "Form — Synthetic User — problem / solution",
      "body": "# Form build.persona.problem_solution\n\nTitle: Synthetic User — problem / solution\nPage: /build\nPurpose: Generate synthetic user personas from a problem/solution prompt.\nPersists to: personas, persona_files\nSubmit target id: build.persona.problem_solution.submit\n\n## Fields (target ids)\n- build.persona.problem_solution.problem | label=\"Problem or question\" type=textarea action=fill required\n- build.persona.problem_solution.solution | label=\"Solution or hypothesis\" type=textarea action=fill required\n- build.persona.problem_solution.differentiation | label=\"Differentiation\" type=textarea action=fill required\n- build.persona.problem_solution.alternatives | label=\"Existing alternatives\" type=textarea action=fill required\n- build.persona.problem_solution.context | label=\"Context (B2B or B2C)\" type=select action=fill options=[B2B, B2C]\n- build.persona.problem_solution.count | label=\"Number of personas to generate\" type=select action=fill options=[1, 2, 3, 4, 5]\n- build.persona.problem_solution.submit | label=\"Submit Blueprint\" type=button action=click\n"
    },
    {
      "type": "form_schema",
      "id": "build.persona.supporting_docs",
      "title": "Form — Synthetic User — supporting docs",
      "body": "# Form build.persona.supporting_docs\n\nTitle: Synthetic User — supporting docs\nPage: /build\nPurpose: Generate synthetic user personas from an uploaded business document.\nPersists to: personas, persona_files\nSubmit target id: build.persona.supporting_docs.submit\n\n## Fields (target ids)\n- build.persona.supporting_docs.file | label=\"Supporting docs file\" type=button action=click\n- build.persona.supporting_docs.count | label=\"Number of personas to generate\" type=select action=fill options=[1, 2, 3, 4, 5]\n- build.persona.supporting_docs.submit | label=\"Submit Blueprint\" type=button action=click\n"
    },
    {
      "type": "form_schema",
      "id": "build.persona.business_profile",
      "title": "Form — Synthetic User — from business profile",
      "body": "# Form build.persona.business_profile\n\nTitle: Synthetic User — from business profile\nPage: /build\nPurpose: Generate synthetic user personas using the runner saved business profile.\nPersists to: personas, persona_files\nSubmit target id: build.persona.business_profile.submit\n\n## Fields (target ids)\n- build.persona.business_profile.specific_user_type | label=\"Specific type of user (optional)\" type=text action=fill\n- build.persona.business_profile.count | label=\"Number of personas to generate\" type=select action=fill options=[1, 2, 3, 4, 5]\n- build.persona.business_profile.submit | label=\"Submit Blueprint\" type=button action=click\n"
    },
    {
      "type": "form_schema",
      "id": "build.persona.advisor_linkedin",
      "title": "Form — Advisor — LinkedIn paste",
      "body": "# Form build.persona.advisor_linkedin\n\nTitle: Advisor — LinkedIn paste\nPage: /build\nPurpose: Build an advisor persona from pasted LinkedIn or resume text.\nPersists to: personas, persona_files\nSubmit target id: build.persona.advisor_linkedin.submit\n\n## Fields (target ids)\n- build.persona.advisor_linkedin.linkedin_text | label=\"LinkedIn profile text\" type=textarea action=fill required\n- build.persona.advisor_linkedin.other_docs_file | label=\"Other docs (CV/portfolio) file\" type=button action=click\n- build.persona.advisor_linkedin.submit | label=\"Submit for Advisor Profiling\" type=button action=click\n"
    },
    {
      "type": "form_schema",
      "id": "build.persona.advisor_pdf",
      "title": "Form — Advisor — upload document",
      "body": "# Form build.persona.advisor_pdf\n\nTitle: Advisor — upload document\nPage: /build\nPurpose: Build an advisor persona from a PDF or document.\nPersists to: personas, persona_files\nSubmit target id: build.persona.advisor_pdf.submit\n\n## Fields (target ids)\n- build.persona.advisor_pdf.file | label=\"Expert source document\" type=button action=click\n- build.persona.advisor_pdf.submit | label=\"Submit for Advisor Profiling\" type=button action=click\n"
    },
    {
      "type": "form_schema",
      "id": "build.persona.advisor_free_text",
      "title": "Form — Advisor — describe expert (text)",
      "body": "# Form build.persona.advisor_free_text\n\nTitle: Advisor — describe expert (text)\nPage: /build\nPurpose: Build an advisor from freeform text; optional Improve with LLM normalizes notes into profile-style source, then the same pipeline as LinkedIn paste.\nPersists to: personas, persona_files\nSubmit target id: build.persona.advisor_free_text.submit\n\n## Fields (target ids)\n- build.persona.advisor_free_text.free_text | label=\"Expert description (notes or bio)\" type=textarea action=fill required\n- build.persona.advisor_free_text.improve_llm | label=\"Improve with LLM\" type=button action=click\n- build.persona.advisor_free_text.other_docs_file | label=\"Other docs (CV/portfolio) file\" type=button action=click\n- build.persona.advisor_free_text.submit | label=\"Submit for Advisor Profiling\" type=button action=click\n"
    },
    {
      "type": "form_schema",
      "id": "build.persona.visibility",
      "title": "Form — Build persona — visibility",
      "body": "# Form build.persona.visibility\n\nTitle: Build persona — visibility\nPage: /build\nPurpose: Choose private or public for the just-generated personas, then save.\nPersists to: personas\nSubmit target id: build.save\n\n## Fields (target ids)\n- build.persona.visibility.visibility | label=\"Persona visibility\" type=radio action=click options=[private, public]\n- build.persona.visibility.save | label=\"Save and go to My Personas\" type=button action=click\n"
    },
    {
      "type": "form_schema",
      "id": "simulations.template",
      "title": "Form — Simulation template editor",
      "body": "# Form simulations.template\n\nTitle: Simulation template editor\nPage: /simulations\nPurpose: Create or edit a simulation template that drives how a simulation runs.\nPersists to: simulations\nSubmit target id: simulations.template.save\n\n## Fields (target ids)\n- simulations.template.simulation_type | label=\"Simulation type\" type=select action=fill dbColumn=simulation_type options=[report, persuasion_simulation, response_simulation, survey, persona_conversation, idea_generation]\n- simulations.template.describe | label=\"Describe your simulation\" type=textarea action=fill\n- simulations.template.mic_toggle | label=\"Voice describe simulation\" type=button action=click\n- simulations.template.generate | label=\"Build simulation from description\" type=button action=click\n- simulations.template.continue_to_form | label=\"Continue to template details\" type=button action=click\n- simulations.template.title | label=\"Title\" type=text action=fill dbColumn=title required\n- simulations.template.description | label=\"What is this simulation about?\" type=textarea action=fill dbColumn=description required\n- simulations.template.allowed_persona_types | label=\"Allowed persona types\" type=checkbox action=click dbColumn=allowed_persona_types options=[synthetic_user, advisor]\n- simulations.template.persona_count_min | label=\"Minimum personas\" type=select action=fill dbColumn=persona_count_min options=[1, 2, 3, 4, 5]\n- simulations.template.persona_count_max | label=\"Maximum personas\" type=select action=fill dbColumn=persona_count_max options=[1, 2, 3, 4, 5]\n- simulations.template.visibility | label=\"Template visibility\" type=radio action=click dbColumn=visibility options=[private, public]\n- simulations.template.save | label=\"Save simulation template\" type=button action=click\n- simulations.template.cancel | label=\"Cancel\" type=button action=click\n- simulations.template.review_back | label=\"Back to form from review\" type=button action=click\n- simulations.template.review_save | label=\"Save reviewed system prompt\" type=button action=click\n- simulations.template.system_prompt | label=\"System prompt review\" type=textarea action=fill dbColumn=system_prompt\n"
    },
    {
      "type": "form_schema",
      "id": "simulate.run.assistant",
      "title": "Form — Run simulation — voice assistant",
      "body": "# Form simulate.run.assistant\n\nTitle: Run simulation — voice assistant\nPage: /simulate\nPurpose: Voice-first: tap the mic to describe the run, tap again to pick a template, personas, and pre-fill runner text fields. Does not start the simulation.\n\n\n\n## Fields (target ids)\n- simulate.run.assistant.mic_toggle | label=\"Tap to speak your run; tap again to build from what you said\" type=button action=click\n"
    },
    {
      "type": "form_schema",
      "id": "settings.tabs",
      "title": "Form — Settings — sidebar tabs",
      "body": "# Form settings.tabs\n\nTitle: Settings — sidebar tabs\nPage: /settings\nPurpose: Switch between Profile, Security, Notifications, Data, and AI usage sections.\n\n\n\n## Fields (target ids)\n- settings.tabs.profile | label=\"Profile tab\" type=tab action=click\n- settings.tabs.security | label=\"Security tab\" type=tab action=click\n- settings.tabs.notifications | label=\"Notifications tab\" type=tab action=click\n- settings.tabs.data | label=\"Data tab\" type=tab action=click\n- settings.tabs.usage | label=\"AI usage tab\" type=tab action=click\n- settings.tabs.reset_token_usage | label=\"Reset AI token usage counters\" type=button action=click\n- settings.tabs.sign_out | label=\"Sign out\" type=button action=click\n"
    },
    {
      "type": "form_schema",
      "id": "settings.profile",
      "title": "Form — Settings — profile",
      "body": "# Form settings.profile\n\nTitle: Settings — profile\nPage: /settings\nPurpose: Edit account-level profile fields and voice agent toggles.\nPersists to: users\nSubmit target id: settings.profile.save\n\n## Fields (target ids)\n- settings.profile.display_name | label=\"Display name\" type=text action=fill\n- settings.profile.username | label=\"Username\" type=text action=fill dbColumn=username\n- settings.profile.email | label=\"Email\" type=email action=fill dbColumn=email\n- settings.profile.bio | label=\"Bio\" type=textarea action=fill\n- settings.profile.voice_agent_enabled | label=\"Enable voice agent\" type=checkbox action=click\n- settings.profile.voice_tts_enabled | label=\"Speak confirmations\" type=checkbox action=click\n- settings.profile.save | label=\"Save profile changes\" type=button action=click\n"
    },
    {
      "type": "form_schema",
      "id": "chat.composer",
      "title": "Form — Chat — composer",
      "body": "# Form chat.composer\n\nTitle: Chat — composer\nPage: /chat\nPurpose: Send messages to a persona in an open chat thread.\nPersists to: messages\nSubmit target id: chat.composer.send\n\n## Fields (target ids)\n- chat.composer.message_input | label=\"Chat message\" type=textarea action=fill\n- chat.composer.send | label=\"Send chat message\" type=button action=click\n"
    },
    {
      "type": "form_schema",
      "id": "focus_groups.create",
      "title": "Form — Focus group — create",
      "body": "# Form focus_groups.create\n\nTitle: Focus group — create\nPage: /gallery?tab=focusGroups\nPurpose: Create a new focus group of personas. Persists to focus_groups.\nPersists to: focus_groups\nSubmit target id: focus_groups.create.submit\n\n## Fields (target ids)\n- focus_groups.create.name | label=\"Focus group name\" type=text action=fill dbColumn=name required\n- focus_groups.create.allowed_role | label=\"Allowed persona role\" type=select action=fill dbColumn=allowed_persona_types options=[, synthetic_user, advisor]\n- focus_groups.create.cancel | label=\"Cancel\" type=button action=click\n- focus_groups.create.submit | label=\"Create focus group\" type=button action=click\n"
    },
    {
      "type": "api_route",
      "id": "POST /api/auth/register",
      "title": "API — POST /api/auth/register",
      "body": "# API POST /api/auth/register\n\nController: authController.register\nAuth: none\nPurpose: Create a new user account.\n"
    },
    {
      "type": "api_route",
      "id": "POST /api/auth/login",
      "title": "API — POST /api/auth/login",
      "body": "# API POST /api/auth/login\n\nController: authController.login\nAuth: none\nPurpose: Authenticate and receive a JWT.\n"
    },
    {
      "type": "api_route",
      "id": "GET /api/personas/library",
      "title": "API — GET /api/personas/library",
      "body": "# API GET /api/personas/library\n\nController: personaController.getLibraryPersonas\nAuth: user\nPurpose: List all library-shared personas.\n"
    },
    {
      "type": "api_route",
      "id": "GET /api/personas/starred",
      "title": "API — GET /api/personas/starred",
      "body": "# API GET /api/personas/starred\n\nController: personaController.getStarredPersonas\nAuth: user\nPurpose: List personas the current user has starred.\n"
    },
    {
      "type": "api_route",
      "id": "GET /api/personas/available",
      "title": "API — GET /api/personas/available",
      "body": "# API GET /api/personas/available\n\nController: personaController.getAvailablePersonas\nAuth: user\nPurpose: List personas the user can use (own + library).\n"
    },
    {
      "type": "api_route",
      "id": "POST /api/personas/:id/star",
      "title": "API — POST /api/personas/:id/star",
      "body": "# API POST /api/personas/:id/star\n\nController: personaController.starPersona\nAuth: user\nPurpose: Star a persona for quick access.\n"
    },
    {
      "type": "api_route",
      "id": "DELETE /api/personas/:id/star",
      "title": "API — DELETE /api/personas/:id/star",
      "body": "# API DELETE /api/personas/:id/star\n\nController: personaController.unstarPersona\nAuth: user\nPurpose: Remove a star from a persona.\n"
    },
    {
      "type": "api_route",
      "id": "GET /api/personas",
      "title": "API — GET /api/personas",
      "body": "# API GET /api/personas\n\nController: personaController.getPersonas\nAuth: user\nPurpose: List the user's own personas.\n"
    },
    {
      "type": "api_route",
      "id": "GET /api/personas/:id",
      "title": "API — GET /api/personas/:id",
      "body": "# API GET /api/personas/:id\n\nController: personaController.getPersona\nAuth: user\nPurpose: Fetch a single persona.\n"
    },
    {
      "type": "api_route",
      "id": "POST /api/personas",
      "title": "API — POST /api/personas",
      "body": "# API POST /api/personas\n\nController: personaController.createPersona\nAuth: user\nPurpose: Create a new persona row in `personas`.\n"
    },
    {
      "type": "api_route",
      "id": "PUT /api/personas/:id",
      "title": "API — PUT /api/personas/:id",
      "body": "# API PUT /api/personas/:id\n\nController: personaController.updatePersona\nAuth: user\nPurpose: Update persona fields, including visibility.\n"
    },
    {
      "type": "api_route",
      "id": "DELETE /api/personas/:id",
      "title": "API — DELETE /api/personas/:id",
      "body": "# API DELETE /api/personas/:id\n\nController: personaController.deletePersona\nAuth: user\nPurpose: Delete a persona.\n"
    },
    {
      "type": "api_route",
      "id": "GET /api/personas/:personaId/files",
      "title": "API — GET /api/personas/:personaId/files",
      "body": "# API GET /api/personas/:personaId/files\n\nController: personaController.getPersonaFiles\nAuth: user\nPurpose: List blueprint files attached to a persona.\n"
    },
    {
      "type": "api_route",
      "id": "POST /api/personas/:personaId/files",
      "title": "API — POST /api/personas/:personaId/files",
      "body": "# API POST /api/personas/:personaId/files\n\nController: personaController.createPersonaFile\nAuth: user\nPurpose: Attach a blueprint markdown file to a persona.\n"
    },
    {
      "type": "api_route",
      "id": "GET /api/chat/sessions",
      "title": "API — GET /api/chat/sessions",
      "body": "# API GET /api/chat/sessions\n\nController: chatController.getChatSessions\nAuth: user\nPurpose: List chat sessions.\n"
    },
    {
      "type": "api_route",
      "id": "POST /api/chat/sessions",
      "title": "API — POST /api/chat/sessions",
      "body": "# API POST /api/chat/sessions\n\nController: chatController.createChatSession\nAuth: user\nPurpose: Create a new chat session.\n"
    },
    {
      "type": "api_route",
      "id": "GET /api/chat/sessions/:id",
      "title": "API — GET /api/chat/sessions/:id",
      "body": "# API GET /api/chat/sessions/:id\n\nController: chatController.getChatSession\nAuth: user\nPurpose: Fetch a single chat session.\n"
    },
    {
      "type": "api_route",
      "id": "PUT /api/chat/sessions/:id",
      "title": "API — PUT /api/chat/sessions/:id",
      "body": "# API PUT /api/chat/sessions/:id\n\nController: chatController.updateChatSession\nAuth: user\nPurpose: Rename a chat session.\n"
    },
    {
      "type": "api_route",
      "id": "DELETE /api/chat/sessions/:id",
      "title": "API — DELETE /api/chat/sessions/:id",
      "body": "# API DELETE /api/chat/sessions/:id\n\nController: chatController.deleteChatSession\nAuth: user\nPurpose: Delete a chat session.\n"
    },
    {
      "type": "api_route",
      "id": "GET /api/chat/sessions/:sessionId/personas",
      "title": "API — GET /api/chat/sessions/:sessionId/personas",
      "body": "# API GET /api/chat/sessions/:sessionId/personas\n\nController: chatController.getSessionPersonas\nAuth: user\nPurpose: List personas attached to a chat session.\n"
    },
    {
      "type": "api_route",
      "id": "GET /api/chat/sessions/:sessionId/messages",
      "title": "API — GET /api/chat/sessions/:sessionId/messages",
      "body": "# API GET /api/chat/sessions/:sessionId/messages\n\nController: chatController.getMessages\nAuth: user\nPurpose: Load chat messages.\n"
    },
    {
      "type": "api_route",
      "id": "POST /api/chat/sessions/:sessionId/messages",
      "title": "API — POST /api/chat/sessions/:sessionId/messages",
      "body": "# API POST /api/chat/sessions/:sessionId/messages\n\nController: chatController.createMessage\nAuth: user\nPurpose: Append a chat message.\n"
    },
    {
      "type": "api_route",
      "id": "DELETE /api/chat/sessions/:sessionId/messages/:messageId",
      "title": "API — DELETE /api/chat/sessions/:sessionId/messages/:messageId",
      "body": "# API DELETE /api/chat/sessions/:sessionId/messages/:messageId\n\nController: chatController.deleteMessage\nAuth: user\nPurpose: Delete a chat message.\n"
    },
    {
      "type": "api_route",
      "id": "POST /api/agent/turn",
      "title": "API — POST /api/agent/turn",
      "body": "# API POST /api/agent/turn\n\nController: agentController.turn\nAuth: user\nPurpose: Run one in-character persona turn (think + respond + validate).\n"
    },
    {
      "type": "api_route",
      "id": "POST /api/agent/index-context",
      "title": "API — POST /api/agent/index-context",
      "body": "# API POST /api/agent/index-context\n\nController: agentController.indexContext\nAuth: user\nPurpose: Index per-session context inputs.\n"
    },
    {
      "type": "api_route",
      "id": "POST /api/agent/retrieve",
      "title": "API — POST /api/agent/retrieve",
      "body": "# API POST /api/agent/retrieve\n\nController: agentController.retrieveContext\nAuth: user\nPurpose: Cosine-similarity retrieval over knowledge_chunks.\n"
    },
    {
      "type": "api_route",
      "id": "POST /api/agent/index-unindexed",
      "title": "API — POST /api/agent/index-unindexed",
      "body": "# API POST /api/agent/index-unindexed\n\nController: agentController.indexUnindexed\nAuth: user\nPurpose: Re-index personas missing chunks.\n"
    },
    {
      "type": "api_route",
      "id": "GET /api/simulations/templates/mine",
      "title": "API — GET /api/simulations/templates/mine",
      "body": "# API GET /api/simulations/templates/mine\n\nController: simulationTemplateUserController.getMine\nAuth: user\nPurpose: List the user's own templates.\n"
    },
    {
      "type": "api_route",
      "id": "GET /api/simulations/templates/library",
      "title": "API — GET /api/simulations/templates/library",
      "body": "# API GET /api/simulations/templates/library\n\nController: simulationTemplateUserController.getLibrary\nAuth: user\nPurpose: Library of public templates.\n"
    },
    {
      "type": "api_route",
      "id": "GET /api/simulations/templates/starred",
      "title": "API — GET /api/simulations/templates/starred",
      "body": "# API GET /api/simulations/templates/starred\n\nController: simulationTemplateUserController.getStarred\nAuth: user\nPurpose: List starred templates.\n"
    },
    {
      "type": "api_route",
      "id": "POST /api/simulations/templates/preview-prompt",
      "title": "API — POST /api/simulations/templates/preview-prompt",
      "body": "# API POST /api/simulations/templates/preview-prompt\n\nController: simulationTemplateUserController.previewSystemPromptUser\nAuth: user\nPurpose: Preview the generated system_prompt for a config.\n"
    },
    {
      "type": "api_route",
      "id": "POST /api/simulations/templates",
      "title": "API — POST /api/simulations/templates",
      "body": "# API POST /api/simulations/templates\n\nController: simulationTemplateUserController.createUserTemplate\nAuth: user\nPurpose: Create a new simulation template.\n"
    },
    {
      "type": "api_route",
      "id": "GET /api/simulations/templates/:id",
      "title": "API — GET /api/simulations/templates/:id",
      "body": "# API GET /api/simulations/templates/:id\n\nController: simulationTemplateUserController.getTemplateById\nAuth: user\nPurpose: Fetch one template.\n"
    },
    {
      "type": "api_route",
      "id": "PUT /api/simulations/templates/:id",
      "title": "API — PUT /api/simulations/templates/:id",
      "body": "# API PUT /api/simulations/templates/:id\n\nController: simulationTemplateUserController.updateUserTemplate\nAuth: user\nPurpose: Update an owned template.\n"
    },
    {
      "type": "api_route",
      "id": "DELETE /api/simulations/templates/:id",
      "title": "API — DELETE /api/simulations/templates/:id",
      "body": "# API DELETE /api/simulations/templates/:id\n\nController: simulationTemplateUserController.deleteUserTemplate\nAuth: user\nPurpose: Delete an owned template.\n"
    },
    {
      "type": "api_route",
      "id": "POST /api/simulations/templates/:id/star",
      "title": "API — POST /api/simulations/templates/:id/star",
      "body": "# API POST /api/simulations/templates/:id/star\n\nController: simulationTemplateUserController.starTemplate\nAuth: user\nPurpose: Star a template.\n"
    },
    {
      "type": "api_route",
      "id": "DELETE /api/simulations/templates/:id/star",
      "title": "API — DELETE /api/simulations/templates/:id/star",
      "body": "# API DELETE /api/simulations/templates/:id/star\n\nController: simulationTemplateUserController.unstarTemplate\nAuth: user\nPurpose: Unstar a template.\n"
    },
    {
      "type": "api_route",
      "id": "GET /api/simulations/templates",
      "title": "API — GET /api/simulations/templates",
      "body": "# API GET /api/simulations/templates\n\nController: simulationTemplateController.getActiveSimulations\nAuth: user\nPurpose: List active library templates.\n"
    },
    {
      "type": "api_route",
      "id": "GET /api/simulations",
      "title": "API — GET /api/simulations",
      "body": "# API GET /api/simulations\n\nController: simulationController.getSimulationSessions\nAuth: user\nPurpose: List simulation runs.\n"
    },
    {
      "type": "api_route",
      "id": "GET /api/simulations/:id",
      "title": "API — GET /api/simulations/:id",
      "body": "# API GET /api/simulations/:id\n\nController: simulationController.getSimulationSession\nAuth: user\nPurpose: Fetch a simulation run.\n"
    },
    {
      "type": "api_route",
      "id": "POST /api/simulations",
      "title": "API — POST /api/simulations",
      "body": "# API POST /api/simulations\n\nController: simulationController.createSimulationSession\nAuth: user\nPurpose: Start a simulation run.\n"
    },
    {
      "type": "api_route",
      "id": "POST /api/simulations/:id/messages",
      "title": "API — POST /api/simulations/:id/messages",
      "body": "# API POST /api/simulations/:id/messages\n\nController: simulationController.createSimulationMessage\nAuth: user\nPurpose: Append a message to a simulation run.\n"
    },
    {
      "type": "api_route",
      "id": "POST /api/simulations/:id/messages/bulk",
      "title": "API — POST /api/simulations/:id/messages/bulk",
      "body": "# API POST /api/simulations/:id/messages/bulk\n\nController: simulationController.createSimulationMessagesBulk\nAuth: user\nPurpose: Bulk insert simulation messages.\n"
    },
    {
      "type": "api_route",
      "id": "PUT /api/simulations/:id",
      "title": "API — PUT /api/simulations/:id",
      "body": "# API PUT /api/simulations/:id\n\nController: simulationController.updateSimulationSession\nAuth: user\nPurpose: Update a simulation run.\n"
    },
    {
      "type": "api_route",
      "id": "DELETE /api/simulations/:id",
      "title": "API — DELETE /api/simulations/:id",
      "body": "# API DELETE /api/simulations/:id\n\nController: simulationController.deleteSimulationSession\nAuth: user\nPurpose: Delete a simulation run.\n"
    },
    {
      "type": "api_route",
      "id": "GET /api/profile/business",
      "title": "API — GET /api/profile/business",
      "body": "# API GET /api/profile/business\n\nController: businessProfileController.getBusinessProfile\nAuth: user\nPurpose: Fetch the runner business profile.\n"
    },
    {
      "type": "api_route",
      "id": "PUT /api/profile/business",
      "title": "API — PUT /api/profile/business",
      "body": "# API PUT /api/profile/business\n\nController: businessProfileController.upsertBusinessProfile\nAuth: user\nPurpose: Upsert the runner business profile.\n"
    },
    {
      "type": "api_route",
      "id": "GET /api/focus-groups",
      "title": "API — GET /api/focus-groups",
      "body": "# API GET /api/focus-groups\n\nController: focusGroupController.listFocusGroups\nAuth: user\nPurpose: List focus groups.\n"
    },
    {
      "type": "api_route",
      "id": "GET /api/focus-groups/:id",
      "title": "API — GET /api/focus-groups/:id",
      "body": "# API GET /api/focus-groups/:id\n\nController: focusGroupController.getFocusGroup\nAuth: user\nPurpose: Fetch a focus group.\n"
    },
    {
      "type": "api_route",
      "id": "POST /api/focus-groups",
      "title": "API — POST /api/focus-groups",
      "body": "# API POST /api/focus-groups\n\nController: focusGroupController.createFocusGroup\nAuth: user\nPurpose: Create a focus group.\n"
    },
    {
      "type": "api_route",
      "id": "PUT /api/focus-groups/:id",
      "title": "API — PUT /api/focus-groups/:id",
      "body": "# API PUT /api/focus-groups/:id\n\nController: focusGroupController.updateFocusGroup\nAuth: user\nPurpose: Update or rename a focus group, change membership.\n"
    },
    {
      "type": "api_route",
      "id": "DELETE /api/focus-groups/:id",
      "title": "API — DELETE /api/focus-groups/:id",
      "body": "# API DELETE /api/focus-groups/:id\n\nController: focusGroupController.deleteFocusGroup\nAuth: user\nPurpose: Delete a focus group.\n"
    },
    {
      "type": "api_route",
      "id": "POST /api/voice/intent-public",
      "title": "API — POST /api/voice/intent-public",
      "body": "# API POST /api/voice/intent-public\n\nController: voiceController.intentPublic\nAuth: none\nPurpose: Anonymous voice intent (rate-limited).\n"
    },
    {
      "type": "api_route",
      "id": "POST /api/voice/intent",
      "title": "API — POST /api/voice/intent",
      "body": "# API POST /api/voice/intent\n\nController: voiceController.intent\nAuth: user\nPurpose: Authenticated voice intent. Returns single or batch.\n"
    },
    {
      "type": "api_route",
      "id": "POST /api/voice/plan",
      "title": "API — POST /api/voice/plan",
      "body": "# API POST /api/voice/plan\n\nController: voiceController.plan\nAuth: user\nPurpose: Create a multi-step plan for the navigator agent.\n"
    },
    {
      "type": "api_route",
      "id": "POST /api/voice/observe",
      "title": "API — POST /api/voice/observe",
      "body": "# API POST /api/voice/observe\n\nController: voiceController.observe\nAuth: user\nPurpose: Report an observation, get continue/replan/done.\n"
    },
    {
      "type": "api_route",
      "id": "POST /api/voice/cancel",
      "title": "API — POST /api/voice/cancel",
      "body": "# API POST /api/voice/cancel\n\nController: voiceController.cancel\nAuth: user\nPurpose: Cancel an in-flight plan.\n"
    },
    {
      "type": "api_route",
      "id": "GET /api/admin/users",
      "title": "API — GET /api/admin/users",
      "body": "# API GET /api/admin/users\n\nController: adminController.getUsers\nAuth: admin\nPurpose: Admin: list users.\n"
    },
    {
      "type": "api_route",
      "id": "GET /api/admin/personas",
      "title": "API — GET /api/admin/personas",
      "body": "# API GET /api/admin/personas\n\nController: adminController.getPersonas\nAuth: admin\nPurpose: Admin: list all personas.\n"
    },
    {
      "type": "api_route",
      "id": "POST /api/admin/reindex-all",
      "title": "API — POST /api/admin/reindex-all",
      "body": "# API POST /api/admin/reindex-all\n\nController: adminController.reindexAll\nAuth: admin\nPurpose: Admin: re-index all personas.\n"
    },
    {
      "type": "api_route",
      "id": "POST /api/admin/reindex-ui-semantics",
      "title": "API — POST /api/admin/reindex-ui-semantics",
      "body": "# API POST /api/admin/reindex-ui-semantics\n\nController: adminController.reindexUiSemantics\nAuth: admin\nPurpose: Admin: rebuild the UI semantics RAG corpus.\n"
    },
    {
      "type": "db_table",
      "id": "users",
      "title": "DB — users",
      "body": "# DB table users\n\nPurpose: Account records. JWT subject. Admin flag controls /admin access.\n\n## Columns\n- id: uuid\n- username: text\n- email: text\n- is_admin: boolean\n- created_at: timestamp\n"
    },
    {
      "type": "db_table",
      "id": "business_profiles",
      "title": "DB — business_profiles",
      "body": "# DB table business_profiles\n\nPurpose: One structured Business Profile per user (disciplined entrepreneurship frameworks). JSON answers keyed as section.framework.question.\n\n## Columns\n- id: uuid\n- user_id: uuid — fk users.id, unique\n- answers: jsonb — Map of answerKey -> string\n- created_at: timestamp\n- updated_at: timestamp\n"
    },
    {
      "type": "db_table",
      "id": "personas",
      "title": "DB — personas",
      "body": "# DB table personas\n\nPurpose: Synthetic users and advisors. Used by chat and simulations.\n\n## Columns\n- id: uuid\n- user_id: uuid\n- name: text\n- type: text — synthetic_user | advisor\n- description: text\n- avatar_url: text\n- visibility: text — private | public\n- last_embedded_at: timestamp\n"
    },
    {
      "type": "db_table",
      "id": "persona_files",
      "title": "DB — persona_files",
      "body": "# DB table persona_files\n\nPurpose: Blueprint and knowledge markdown files attached to a persona; chunked into knowledge_chunks.\n\n## Columns\n- id: uuid\n- persona_id: uuid\n- name: text\n- content: text\n- type: text\n"
    },
    {
      "type": "db_table",
      "id": "focus_groups",
      "title": "DB — focus_groups",
      "body": "# DB table focus_groups\n\nPurpose: User-curated cohorts of personas; can be added all at once in chat or simulation.\n\n## Columns\n- id: uuid\n- user_id: uuid\n- name: text\n- allowed_persona_types: text[]\n"
    },
    {
      "type": "db_table",
      "id": "focus_group_personas",
      "title": "DB — focus_group_personas",
      "body": "# DB table focus_group_personas\n\nPurpose: Membership table linking focus_groups to personas.\n\n## Columns\n- focus_group_id: uuid\n- persona_id: uuid\n"
    },
    {
      "type": "db_table",
      "id": "chat_sessions",
      "title": "DB — chat_sessions",
      "body": "# DB table chat_sessions\n\nPurpose: Persistent conversation threads with one or more personas.\n\n## Columns\n- id: uuid\n- user_id: uuid\n- name: text\n"
    },
    {
      "type": "db_table",
      "id": "chat_session_personas",
      "title": "DB — chat_session_personas",
      "body": "# DB table chat_session_personas\n\nPurpose: Membership table linking chat_sessions to personas.\n\n## Columns\n- session_id: uuid\n- persona_id: uuid\n"
    },
    {
      "type": "db_table",
      "id": "messages",
      "title": "DB — messages",
      "body": "# DB table messages\n\nPurpose: Individual chat messages within a chat_session.\n\n## Columns\n- id: uuid\n- session_id: uuid\n- sender_type: text — user | persona\n- persona_id: uuid\n- content: text\n- created_at: timestamp\n"
    },
    {
      "type": "db_table",
      "id": "simulations",
      "title": "DB — simulations",
      "body": "# DB table simulations\n\nPurpose: Simulation templates that drive how a simulation runs (type, prompts, inputs).\n\n## Columns\n- id: uuid\n- user_id: uuid\n- title: text\n- description: text\n- simulation_type: text\n- allowed_persona_types: text[]\n- persona_count_min: int\n- persona_count_max: int\n- system_prompt: text\n- visibility: text\n- is_active: boolean\n- icon: text\n- required_input_fields: jsonb\n- type_specific_config: jsonb\n"
    },
    {
      "type": "db_table",
      "id": "simulation_sessions",
      "title": "DB — simulation_sessions",
      "body": "# DB table simulation_sessions\n\nPurpose: Per-run state for a simulation execution: persona ids, status, runner inputs.\n\n## Columns\n- id: uuid\n- user_id: uuid\n- simulation_id: uuid\n- status: text\n- persona_ids: uuid[]\n"
    },
    {
      "type": "db_table",
      "id": "simulation_messages",
      "title": "DB — simulation_messages",
      "body": "# DB table simulation_messages\n\nPurpose: Per-turn messages within a simulation_session.\n\n## Columns\n- id: uuid\n- session_id: uuid\n- persona_id: uuid\n- content: text\n- created_at: timestamp\n"
    },
    {
      "type": "db_table",
      "id": "knowledge_chunks",
      "title": "DB — knowledge_chunks",
      "body": "# DB table knowledge_chunks\n\nPurpose: Vector index for RAG. Stores text + embedding rows scoped by persona/session/user, plus the global UI semantics corpus (NULL scope, source_type IN ui_node|form_schema|api_route|db_table|workflow).\n\n## Columns\n- id: uuid\n- persona_id: uuid\n- session_id: uuid\n- user_id: uuid\n- source_type: text\n- source_name: text\n- chunk_index: int\n- chunk_text: text\n- embedding: real[] — cosine similarity at query time\n"
    },
    {
      "type": "workflow",
      "id": "create_persona",
      "title": "Workflow — Create persona end-to-end",
      "body": "# Workflow: create a persona end-to-end\n\nThe user wants to build one or more synthetic personas (or an advisor).\n\nRecommended steps for the navigator:\n1. navigate /build (UI node `build.persona`).\n2. Choose a mode: action target_id `build.choose_synthetic` or `build.choose_advisor` (also `build.persona.picker.choose_synthetic` / `...choose_advisor`).\n3. For Synthetic User > Problem/Solution, fill the four `build.persona.problem_solution.*` fields the user described, set `...context` and `...count`, then click `build.persona.problem_solution.submit`.\n4. Wait for generation to finish — the page emits a visibility step.\n5. Choose `build.persona.visibility.visibility = private|public` then click `build.save`.\n\nReplan triggers:\n- If saved business profile is missing and the user picked the business_profile mode, ask the user or navigate to `/business-profile` first.\n"
    },
    {
      "type": "workflow",
      "id": "edit_business_profile",
      "title": "Workflow — Edit and save the business profile",
      "body": "# Workflow: edit business profile\n\nThe user wants to update the structured Business Profile on `/business-profile` (table `business_profiles`, column `answers` JSONB).\n\nSteps:\n1. navigate /business-profile if not there (UI node `business.profile`).\n2. For each question the user mentioned, action target_id `business.profile.<section>.<framework>.<questionKey>` value=<text>. Keys match the spec (e.g. `business.profile.who_is_customer.target_customer_persona.primary_customer`).\n3. Answers auto-save; optional: click `business.profile.save` (legacy alias `business.save`) to force sync.\n"
    },
    {
      "type": "workflow",
      "id": "configure_simulation_template",
      "title": "Workflow — Configure or create a simulation template",
      "body": "# Workflow: simulation template editor\n\nSteps:\n1. navigate /simulations (UI node `simulations.hub`).\n2. Open the create form. action target_id `simulations.template.simulation_type` value=<one of report|persuasion_simulation|response_simulation|survey|persona_conversation|idea_generation>.\n3. Click `simulations.template.continue_to_form`.\n4. Fill `simulations.template.title`, `simulations.template.description`.\n5. Toggle `simulations.template.allowed_persona_types` to the user's selection.\n6. Set `simulations.template.persona_count_min` / `persona_count_max`.\n7. Choose `simulations.template.visibility`.\n8. Click `simulations.template.save` (legacy alias `simulations.save_template`). Review the system prompt, then click again to finalize.\n"
    },
    {
      "type": "workflow",
      "id": "send_chat_message",
      "title": "Workflow — Send a chat message to a persona",
      "body": "# Workflow: chat with a persona\n\nSteps:\n1. If currently on /gallery and the user named a persona, action target_id `gallery.open_chat.<personaId>` (this navigates to /chat?personaId=...).\n2. Otherwise navigate /chat.\n3. action target_id `chat.composer.message_input` value=<message text>.\n4. action target_id `chat.composer.send` (legacy alias `chat.send`).\n"
    },
    {
      "type": "workflow",
      "id": "create_focus_group",
      "title": "Workflow — Create a focus group",
      "body": "# Workflow: create a focus group\n\nSteps:\n1. navigate /gallery?tab=focusGroups (UI node `gallery.focus`).\n2. action target_id `gallery.focus.new` if visible to open the create modal.\n3. action target_id `focus_groups.create.name` value=<name>.\n4. Optional: action target_id `focus_groups.create.allowed_role` value=synthetic_user|advisor|\"\".\n5. Click `focus_groups.create.submit`.\n"
    },
    {
      "type": "workflow",
      "id": "sign_in",
      "title": "Workflow — Sign the user in",
      "body": "# Workflow: sign in\n\nSteps (only when on /login or unauthenticated):\n1. action target_id `login.username` value=<username or email>.\n2. action target_id `login.password` value=<password>.\n3. Click `login.submit`.\n\nNever invent passwords. If missing, clarify.\n"
    }
  ]
} as UiSemanticsCorpus;

export const GENERATED_UI_SEMANTICS_DOCS: UiSemanticDoc[] = GENERATED_UI_SEMANTICS.docs;
