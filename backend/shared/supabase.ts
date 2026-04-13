import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnvFile } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(CURRENT_DIR, '..');
const REPO_ROOT = path.resolve(BACKEND_DIR, '..');

const ENV_FILES = [
  path.resolve(REPO_ROOT, 'supabase', '.env.local'),
  path.resolve(BACKEND_DIR, 'apigateway', '.env'),
];

for (const envFile of ENV_FILES) {
  loadEnvFile({ path: envFile, override: false });
}

const supabaseUrl = process.env.SUPABASE_URL?.trim() ?? '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY para los microservicios.');
}

export const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});