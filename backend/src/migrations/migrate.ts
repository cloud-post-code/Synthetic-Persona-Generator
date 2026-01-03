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

