import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { CATEGORIES } from '../domain/categories';
import { useSignedPhotoUrl } from '../services/photos';
import { makeStyles, useColors, radius } from '../theme';
import type { Item } from '../types/db';

type Props = {
  item: Pick<Item, 'photo_path' | 'image_url' | 'category'>;
  size: number;
  /** Fill the parent's width instead (used for the large detail photo). */
  fill?: boolean;
};

/** Signed photo -> Open Food Facts image -> category icon on a tinted background. */
export function ItemImage({ item, size, fill }: Props) {
  const styles = useStyles();
  const c = useColors();
  const signed = useSignedPhotoUrl(item.photo_path);
  const uri = signed.data ?? (item.photo_path && signed.isPending ? null : item.image_url);
  const box = fill ? { width: '100%' as const, height: size } : { width: size, height: size };
  if (uri) {
    return <Image source={{ uri }} style={[styles.base, box]} contentFit="cover" transition={150} />;
  }
  return (
    <View style={[styles.base, styles.fallback, box]}>
      <Ionicons
        name={CATEGORIES[item.category].icon as keyof typeof Ionicons.glyphMap}
        size={Math.round(size * 0.45)}
        color={c.primary}
      />
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  base: { borderRadius: radius.md, overflow: 'hidden' },
  fallback: { backgroundColor: c.primaryLight, alignItems: 'center', justifyContent: 'center' },
}));
