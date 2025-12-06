import { z } from 'zod';

const envSchema = z.object({
  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_KEY: z.string().min(1).optional(),

  // LLM
  LLM_PROVIDER: z.enum(['anthropic', 'openai']).default('anthropic'),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),

  // App
  USER_ID: z.string().uuid().default('00000000-0000-0000-0000-000000000001'),
  CRON_SECRET: z.string().min(1).optional(),
  TIMEZONE: z.string().default('America/Los_Angeles'),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('Invalid environment variables:', result.error.format());
    throw new Error('Invalid environment variables');
  }

  cachedEnv = result.data;
  return cachedEnv;
}
