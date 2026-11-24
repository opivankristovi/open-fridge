import { router } from 'expo-router';
import { useState } from 'react';

import { LocationForm } from '../../components/LocationForm';
import { Button, ErrorText, Screen } from '../../components/ui';
import { useCreateLocation } from '../../data/hooks';
import type { LocationKind } from '../../domain/locations';
import { t } from '../../i18n';
import { errorMessage } from '../../lib/errors';

export default function NewLocationScreen() {
  const create = useCreateLocation();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<LocationKind>('fridge');
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    try {
      await create.mutateAsync({ name: name.trim() || null, kind });
      router.back();
    } catch (e) {
      setError(errorMessage(e) || t.locations.saveFailed);
    }
  };

  return (
    <Screen>
      <LocationForm name={name} onNameChange={setName} kind={kind} onKindChange={setKind} />
      <ErrorText message={error} />
      <Button title={t.locations.save} onPress={save} loading={create.isPending} />
    </Screen>
  );
}
