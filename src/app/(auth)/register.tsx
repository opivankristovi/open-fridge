import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { Button, ErrorText, Field, LinkText, Screen, Title } from '../../components/ui';
import { t } from '../../i18n';
import { errorMessage } from '../../lib/errors';
import { supabase } from '../../lib/supabase';
import { useColors } from '../../theme';

export default function RegisterScreen() {
  const c = useColors();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onRegister() {
    setError(null);
    setNotice(null);
    if (!email.trim() || !password || !repeat) {
      setError(t.auth.fillAll);
      return;
    }
    if (password.length < 8) {
      setError(t.auth.passwordTooShort);
      return;
    }
    if (password !== repeat) {
      setError(t.auth.passwordMismatch);
      return;
    }
    setBusy(true);
    const { data, error: err } = await supabase.auth.signUp({ email: email.trim(), password });
    setBusy(false);
    if (err) {
      setError(errorMessage(err));
      return;
    }
    if (!data.session) setNotice(t.auth.checkEmail);
  }

  return (
    <Screen>
      <Title>{t.auth.registerTitle}</Title>
      <Field
        label={t.auth.email}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      <Field
        label={t.auth.password}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
      />
      <Field
        label={t.auth.repeatPassword}
        value={repeat}
        onChangeText={setRepeat}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
      />
      <ErrorText message={error} />
      {notice ? (
        <Text style={{ color: c.primary, fontSize: 15, fontWeight: '600' }}>{notice}</Text>
      ) : null}
      <Button title={t.auth.register} onPress={onRegister} loading={busy} />
      <LinkText title={t.auth.haveAccount} onPress={() => router.back()} />
    </Screen>
  );
}
