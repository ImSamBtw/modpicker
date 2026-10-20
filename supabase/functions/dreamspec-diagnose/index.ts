import { createHandler } from './handler.mjs';

const handler=createHandler({
 env:{
  SUPABASE_URL:Deno.env.get('SUPABASE_URL'),
  SUPABASE_PUBLISHABLE_KEY:Deno.env.get('DREAMSPEC_PUBLISHABLE_KEY')||Deno.env.get('SUPABASE_ANON_KEY')||'sb_publishable_qaHgWysflXZuQ6E_-zYQ6A_UWEKi7W1',
  DREAMSPEC_CATALOG_URL:Deno.env.get('DREAMSPEC_CATALOG_URL')||'https://pzxofwrdidvqhdlqbehk.supabase.co',
  DREAMSPEC_CATALOG_KEY:Deno.env.get('DREAMSPEC_CATALOG_KEY')||'sb_publishable_C8d6CWAvqo85Cy_iGT3DZA_pfis07Xq',
  DREAMSPEC_ALLOWED_ORIGINS:Deno.env.get('DREAMSPEC_ALLOWED_ORIGINS'),
  DREAMSPEC_DIAGNOSIS_MODEL:Deno.env.get('DREAMSPEC_DIAGNOSIS_MODEL')
 }
});
Deno.serve(handler);
