import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { Button, ErrorText, Field, LinkText, Screen, Subtitle, Title } from '../../components/ui';
import { t } from '../../i18n';
import { errorMessage } from '../../lib/errors';
import { supabase } from '../../lib/supabase';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onLogin() {
    setError(null);
    if (!email.trim() || !password) {
      setError(t.auth.fillAll);
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (err) setError(errorMessage(err));
  }

  async function onForgot() {
    setError(null);
    if (!email.trim()) {
      setError(t.auth.enterEmail);
      return;
    }
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (err) {
      setError(errorMessage(err));
      return;
    }
    Alert.alert(t.auth.resetTitle, t.auth.resetSent);
  }

  return (
    <Screen>
      <Title>{t.auth.loginTitle}</Title>
      <Subtitle>{t.auth.loginSubtitle}</Subtitle>
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
        autoComplete="password"
      />
      <ErrorText message={error} />
      <Button title={t.auth.login} onPress={onLogin} loading={busy} />
      <LinkText title={t.auth.forgotPassword} onPress={onForgot} />
      <LinkText title={t.auth.noAccount} onPress={() => router.push('/(auth)/register')} />
    </Screen>
  );
}
