import { t } from '../i18n';

/** Map Supabase auth / RPC errors to translated text where obvious; otherwise the raw message. */
export function errorMessage(err: unknown): string {
  const raw =
    err && typeof err === 'object' && 'message' in err
      ? String((err as { message: unknown }).message)
      : String(err ?? t.common.error);
  const m = raw.toLowerCase();
  if (m.includes('invalid_code')) return t.household.invalidCode;
  if (m.includes('last_location')) return t.locations.lastLocation;
  if (m.includes('invalid_target')) return t.locations.pickTarget;
  if (m.includes('items_location_fk') || (m.includes('not_found') && m.includes('location'))) return t.locations.gone;
  if (m.includes('invalid login credentials')) return t.auth.invalidCredentials;
  if (m.includes('email not confirmed')) return t.auth.emailNotConfirmed;
  if (m.includes('user already registered')) return t.auth.userExists;
  if (m.includes('unable to validate email') || m.includes('invalid format')) return t.auth.invalidEmail;
  return raw || t.common.error;
}
