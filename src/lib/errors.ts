import { nl } from '../i18n/nl';

/** Map Supabase auth / RPC errors to Dutch text where obvious; otherwise the raw message. */
export function errorMessage(err: unknown): string {
  const raw =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message: unknown }).message)
      : String(err ?? nl.common.error);
  const m = raw.toLowerCase();
  if (m.includes('invalid_code')) return nl.household.invalidCode;
  if (m.includes('invalid login credentials')) return nl.auth.invalidCredentials;
  if (m.includes('email not confirmed')) return nl.auth.emailNotConfirmed;
  if (m.includes('user already registered')) return nl.auth.userExists;
  if (m.includes('unable to validate email') || m.includes('invalid format')) return nl.auth.invalidEmail;
  return raw || nl.common.error;
}
