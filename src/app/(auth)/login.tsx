import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { Button, ErrorText, Field, LinkText, Screen, Subtitle, Title } from '../../components/ui';
import { nl } from '../../i18n/nl';
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
      setError(nl.auth.fillAll);
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
      setError(nl.auth.enterEmail);
      return;
    }
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (err) {
      setError(errorMessage(err));
      return;
    }
    Alert.alert(nl.auth.resetTitle, nl.auth.resetSent);
  }

  return (
    <Screen>
      <Title>{nl.auth.loginTitle}</Title>
      <Subtitle>{nl.auth.loginSubtitle}</Subtitle>
      <Field
        label={nl.auth.email}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      <Field
        label={nl.auth.password}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="password"
      />
      <ErrorText message={error} />
      <Button title={nl.auth.login} onPress={onLogin} loading={busy} />
      <LinkText title={nl.auth.forgotPassword} onPress={onForgot} />
      <LinkText title={nl.auth.noAccount} onPress={() => router.push('/(auth)/register')} />
    </Screen>
  );
}
