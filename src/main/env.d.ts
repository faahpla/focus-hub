// Values from .env, baked in at build time. Only MAIN_VITE_* reach this
// process, so the Supabase key never enters the renderer bundle.
interface ImportMetaEnv {
  /** Supabase project URL. Absent in copies built without a .env: sharing is off. */
  readonly MAIN_VITE_SUPABASE_URL?: string
  /** Supabase publishable key. Public by design — the database rules guard the data. */
  readonly MAIN_VITE_SUPABASE_KEY?: string
}
