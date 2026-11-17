import { Text } from 'react-native';

import { useAuth } from '../../auth/AuthProvider';
import { Button, Card, Screen, Subtitle } from '../../components/ui';
import { nl } from '../../i18n/nl';
import { colors } from '../../theme';

export default function SettingsScreen() {
  const { household, signOut } = useAuth();

  return (
    <Screen>
      <Card>
        <Subtitle>{nl.settings.household}</Subtitle>
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>{household?.name}</Text>
      </Card>
      <Card>
        <Subtitle>{nl.settings.inviteCode}</Subtitle>
        <Text
          selectable
          style={{ fontSize: 32, fontWeight: '800', letterSpacing: 4, color: colors.primary }}
        >
          {household?.invite_code}
        </Text>
        <Subtitle>{nl.settings.inviteHint}</Subtitle>
      </Card>
      <Button title={nl.settings.logout} variant="danger" onPress={signOut} />
    </Screen>
  );
}
