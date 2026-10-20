import { createHandler } from './handler.mjs';

const handler=createHandler({
 env:{
  SUPABASE_URL:Deno.env.get('SUPABASE_URL'),
  SUPABASE_PUBLISHABLE_KEY:Deno.env.get('DREAMSPEC_PUBLISHABLE_KEY')||Deno.env.get('SUPABASE_ANON_KEY'),
  DREAMSPEC_ALLOWED_ORIGINS:Deno.env.get('DREAMSPEC_ALLOWED_ORIGINS'),
  DREAMSPEC_DIAGNOSIS_MODEL:Deno.env.get('DREAMSPEC_DIAGNOSIS_MODEL')
 }
});
Deno.serve(handler);
