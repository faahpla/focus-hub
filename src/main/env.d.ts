// Values from .env, baked in at build time. Only MAIN_VITE_* reach this
// process, so the Supabase key never enters the renderer bundle.
interface ImportMetaEnv {
  /** Supabase project URL. Absent in copies built without a .env: sharing is off. */
  readonly MAIN_VITE_SUPABASE_URL?: string
  /** Supabase publishable key. Public by design — the database rules guard the data. */
  readonly MAIN_VITE_SUPABASE_KEY?: string
  /**
   * Google OAuth client of the "Desktop app" kind, for reading the user's own
   * YouTube channels. Google treats an installed app's secret as not secret:
   * PKCE and the user's consent guard the access. Absent: YouTube is off.
   */
  readonly MAIN_VITE_GOOGLE_CLIENT_ID?: string
  readonly MAIN_VITE_GOOGLE_CLIENT_SECRET?: string
}
