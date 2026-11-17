import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { nl } from '../i18n/nl';
import { compressPhoto } from '../services/photos';
import { colors, radius, spacing } from '../theme';
import { Button, Spinner } from './ui';

type Props = {
  /** Called with a compressed local uri when the user accepts the photo. */
  onUse: (uri: string) => void;
  onSkip?: () => void;
  skipLabel?: string;
};

export function PhotoCapture({ onUse, onSkip, skipLabel = nl.add.skip }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!permission) return <Spinner />;
  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>{nl.add.cameraPermission}</Text>
        <Button title={nl.add.allowCamera} onPress={requestPermission} />
        {onSkip ? <Button title={skipLabel} variant="outline" onPress={onSkip} /> : null}
      </View>
    );
  }

  const take = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const pic = await camera.current?.takePictureAsync({ quality: 0.7 });
      if (pic?.uri) setPreview(pic.uri);
    } finally {
      setBusy(false);
    }
  };

  const use = async () => {
    if (!preview || busy) return;
    setBusy(true);
    try {
      onUse(await compressPhoto(preview));
    } catch {
      // Compression failed: fall back to the original capture.
      onUse(preview);
    } finally {
      setBusy(false);
    }
  };

  if (preview) {
    return (
      <View style={styles.flex}>
        <Image source={{ uri: preview }} style={styles.camera} contentFit="cover" />
        <View style={styles.actions}>
          <View style={styles.flex}>
            <Button title={nl.add.retake} variant="outline" onPress={() => setPreview(null)} disabled={busy} />
          </View>
          <View style={styles.flex}>
            <Button title={nl.add.usePhoto} onPress={use} loading={busy} />
          </View>
        </View>
        {onSkip ? <Button title={skipLabel} variant="outline" onPress={onSkip} disabled={busy} /> : null}
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <CameraView ref={camera} style={styles.camera} facing="back" />
      <Button title={nl.add.takePhoto} onPress={take} loading={busy} />
      {onSkip ? <Button title={skipLabel} variant="outline" onPress={onSkip} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: spacing.md },
  center: { flex: 1, justifyContent: 'center', gap: spacing.md },
  text: { fontSize: 16, color: colors.text, textAlign: 'center' },
  camera: { flex: 1, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#000' },
  actions: { flexDirection: 'row', gap: spacing.md },
});
