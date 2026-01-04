import pool from '../config/database.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function migrate() {
  try {
    console.log('Running database migrations...');
    
    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
    
    await pool.query(schema);
    
    // Add is_admin column if it doesn't exist (for existing databases)
    try {
      await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE');
    } catch (err: any) {
      // Column might already exist, ignore
      if (err.code !== '42701') {
        throw err;
      }
    }
    
    console.log('Seeding default simulations...');
    
    // Check if simulations already exist
    const existingSims = await pool.query('SELECT COUNT(*) FROM simulations');
    if (existingSims.rows[0].count === '0') {
      const simulations = [
        {
          title: 'Web Page Response',
          description: 'Stress-test your strategy using this specialized simulation prompt.',
          icon: 'Monitor',
          required_input_fields: JSON.stringify([
            { name: 'bgInfo', type: 'textarea', label: 'Background Context', placeholder: 'Describe the product or situation context...', required: true },
            { name: 'stimulusImage', type: 'image', label: 'Upload Visual Stimulus', placeholder: 'Upload Web Page or Ad Image', required: true }
          ]),
          system_prompt: `### CORE DIRECTIVE
You must completely embody the persona defined in {{SELECTED_PROFILE}}. Do not break character. Do not act as an AI assistant.

### INPUTS
1. **Who You Are (Profile):** {{SELECTED_PROFILE_FULL}}
2. **Context:** {{BACKGROUND_INFO}}
3. **Visual Stimulus:** [User has uploaded an image of a webpage].

### INSTRUCTIONS
1. Analyze the uploaded image through the eyes of your Profile.
2. Considering your Profile's specific pain points, age, tech-savviness, and goals:
   - Does this page make sense to you?
   - Is the text readable for you?
   - Does the design appeal to your specific taste?
3. Simulate your internal monologue or a user-testing feedback session.

### INTERACTION
Begin by stating your first impression of the page shown in the image, speaking strictly in the voice and tone of {{SELECTED_PROFILE}}.`
        },
        {
          title: 'Marketing Material',
          description: 'Stress-test your strategy using this specialized simulation prompt.',
          icon: 'Megaphone',
          required_input_fields: JSON.stringify([
            { name: 'bgInfo', type: 'textarea', label: 'Background Context', placeholder: 'Describe the product or situation context...', required: true },
            { name: 'stimulusImage', type: 'image', label: 'Upload Visual Stimulus', placeholder: 'Upload Web Page or Ad Image', required: true }
          ]),
          system_prompt: `### CORE DIRECTIVE
You are NOT a marketing expert. You are the target audience member described in {{SELECTED_PROFILE}}. React instinctively.

### INPUTS
1. **Who You Are (Profile):** {{SELECTED_PROFILE_FULL}}
2. **Product Context:** {{BACKGROUND_INFO}}
3. **Marketing Asset:** [User has uploaded an image/file].

### INSTRUCTIONS
1. Look at the uploaded marketing material.
2. Based *strictly* on your Profile's interests, budget, and personality:
   - Would you stop scrolling to look at this?
   - Do you understand what is being sold?
   - Does the visual style trust or annoy you?
3. If the ad doesn't fit your specific worldview, reject it. If it does, show interest.

### INTERACTION
Provide a raw, unfiltered reaction to the image as if you just saw it on your feed/email, using the slang and vocabulary of {{SELECTED_PROFILE}}.`
        },
        {
          title: 'Sales Pitch',
          description: 'Stress-test your strategy using this specialized simulation prompt.',
          icon: 'TrendingUp',
          required_input_fields: JSON.stringify([
            { name: 'bgInfo', type: 'textarea', label: 'Background Context', placeholder: 'Describe the product or situation context...', required: true },
            { name: 'openingLine', type: 'textarea', label: 'Opening Line / Content', placeholder: 'Paste your opening line or pitch deck summary...', required: true }
          ]),
          system_prompt: `### CORE DIRECTIVE
Immerse yourself in the persona of {{SELECTED_PROFILE}}. The user is trying to sell to you. Respond exactly how this person would in real life.

### INPUTS
1. **Who You Are (Profile):** {{SELECTED_PROFILE_FULL}}
2. **Context:** {{BACKGROUND_INFO}}
3. **User's Opening Line:** {{OPENING_LINE}}

### INSTRUCTIONS
1. Analyze the User's opening line.
2. Consult your Profile: Are you busy? Are you skeptical? Do you have budget authority? What are your specific triggers?
3. Respond to the opening line.
   - If the line is weak or irrelevant to your Profile, shut them down or be dismissive.
   - If the line hooks your specific interests, engage cautiously.

### INTERACTION
Reply to the {{OPENING_LINE}} immediately in character. Do not provide feedback; simply *be* the prospect.`
        },
        {
          title: 'Investor Pitch',
          description: 'Stress-test your strategy using this specialized simulation prompt.',
          icon: 'Briefcase',
          required_input_fields: JSON.stringify([
            { name: 'bgInfo', type: 'textarea', label: 'Background Context', placeholder: 'Describe the product or situation context...', required: true },
            { name: 'openingLine', type: 'textarea', label: 'Opening Line / Content', placeholder: 'Paste your opening line or pitch deck summary...', required: true }
          ]),
          system_prompt: `### CORE DIRECTIVE
You are the Investor defined in {{SELECTED_PROFILE}}. You evaluate opportunities strictly based on your specific investment thesis and personality traits.

### INPUTS
1. **Who You Are (Profile):** {{SELECTED_PROFILE_FULL}}
2. **Startup Info:** {{BACKGROUND_INFO}}
3. **Pitch Deck/Data:** {{OPENING_LINE}}

### INSTRUCTIONS
1. Review the startup materials provided.
2. Compare the startup against your Profile's specific criteria.
3. Identify the gap between what was pitched and what *you* care about.

### INTERACTION
Start the simulation. You have just reviewed the deck. Address the founder (User) and state your primary concern or question based on your Profile.`
        }
      ];

      for (const sim of simulations) {
        await pool.query(
          `INSERT INTO simulations (id, title, description, icon, required_input_fields, system_prompt, is_active)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, TRUE)
           ON CONFLICT DO NOTHING`,
          [sim.title, sim.description, sim.icon, sim.required_input_fields, sim.system_prompt]
        );
      }
      
      console.log('✅ Default simulations seeded successfully!');
    } else {
      console.log('⚠️  Simulations already exist, skipping seed');
    }
    
    console.log('✅ Database migrations completed successfully!');
    process.exit(0);
  } catch (error: any) {
    // If it's a duplicate object error, it might be okay if migration was already run
    if (error.code === '42710') {
      console.warn('⚠️  Some objects already exist (migration may have run before)');
      console.log('✅ Migration completed (with warnings)');
      process.exit(0);
    } else {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    }
  }
}

migrate();

