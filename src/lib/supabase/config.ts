export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://jqhsuytsjgdxzkkriukt.supabase.co";

// Supabase publishable keys are designed to be exposed to browser clients.
// Authorization is enforced by Postgres RLS; never place a secret/service-role key here.
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_kAkQWSn0z9dW_U0_wr93yg_h_rq2jME";
