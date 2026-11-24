import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { makeStyles, useColors, radius, spacing } from '../theme';

export function Screen({
  children,
  bottomInset = true,
  top = false,
}: {
  children: React.ReactNode;
  /** Start the content at the top instead of centring it (forms below a header). */
  top?: boolean;
  /** Reserve space for the Android system buttons. Set false inside the tab navigator (the tab bar handles it). */
  bottomInset?: boolean;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.screen, top && styles.top, bottomInset && { paddingBottom: spacing.lg + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function Card({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  return <View style={styles.card}>{children}</View>;
}

export function Title({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  return <Text style={styles.title}>{children}</Text>;
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  return <Text style={styles.subtitle}>{children}</Text>;
}

export function Field(props: TextInputProps & { label: string }) {
  const styles = useStyles();
  const c = useColors();
  const { label, style, ...rest } = props;
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={c.textMuted}
        style={[styles.input, style]}
        {...rest}
      />
    </View>
  );
}

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'outline' | 'danger';
}) {
  const styles = useStyles();
  const c = useColors();
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        variant === 'outline' && styles.buttonOutline,
        variant === 'danger' && styles.buttonDanger,
        isDisabled && styles.buttonDisabled,
        pressed && { opacity: 0.85 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? c.onPrimary : c.primary} />
      ) : (
        <Text
          style={[
            styles.buttonText,
            variant === 'outline' && { color: c.primary },
            variant === 'danger' && { color: c.danger },
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function LinkText({ title, onPress }: { title: string; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable onPress={onPress} style={styles.link} accessibilityRole="link">
      <Text style={styles.linkText}>{title}</Text>
    </Pressable>
  );
}

export function ErrorText({ message }: { message: string | null }) {
  const styles = useStyles();
  if (!message) return null;
  return <Text style={styles.error}>{message}</Text>;
}

export function Spinner() {
  const styles = useStyles();
  const c = useColors();
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={c.primary} />
    </View>
  );
}

export function Placeholder({ text }: { text: string }) {
  const styles = useStyles();
  return (
    <View style={styles.center}>
      <Text style={styles.subtitle}>{text}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: c.background },
  screen: { padding: spacing.lg, gap: spacing.md, flexGrow: 1, justifyContent: 'center' },
  top: { justifyContent: 'flex-start' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background },
  card: {
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: c.border,
  },
  title: { fontSize: 28, fontWeight: '700', color: c.text },
  subtitle: { fontSize: 16, color: c.textMuted },
  fieldWrap: { gap: spacing.xs },
  label: { fontSize: 14, fontWeight: '600', color: c.text },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 16,
    color: c.text,
    backgroundColor: c.surface,
  },
  button: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  buttonOutline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: c.primary },
  buttonDanger: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: c.danger },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: c.onPrimary, fontSize: 16, fontWeight: '700' },
  link: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  linkText: { color: c.primary, fontSize: 15, fontWeight: '600' },
  error: { color: c.danger, fontSize: 14 },
}));
