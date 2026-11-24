import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { colors, type } from '../theme';

export type IconName = ComponentProps<typeof MaterialIcons>['name'];

export function Icon({ name, size = 22, color = colors.secondary }: { name: IconName; size?: number; color?: string }) {
  return <MaterialIcons name={name} size={size} color={color} accessible={false} />;
}

export function Screen({ children }: { children: ReactNode }) {
  return <SafeAreaView style={styles.screen}>{children}</SafeAreaView>;
}

export function Brand() {
  return (
    <View style={styles.brand} accessible accessibilityLabel="ChatSphere">
      <View style={styles.mark} importantForAccessibility="no-hide-descendants">
        <View style={styles.markLine} /><View style={styles.markLine} />
        <View style={[styles.markLine, styles.markLast]} />
      </View>
      <Text style={type.title}>ChatSphere</Text>
    </View>
  );
}

const avatarColors: Record<string, readonly [string, string]> = {
  maya: ['#e4eaff', '#3249a2'],
  jordan: ['#eee8df', '#6b5332'],
  priya: ['#e2ede8', '#355a4b'],
  eli: ['#e9edf4', '#435476'],
  sam: ['#f2e6e6', '#774654'],
};

export function Avatar({ name, id, compact = false }: { name: string; id?: string; compact?: boolean }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => Array.from(part)[0]).join('').toUpperCase();
  const [backgroundColor, color] = avatarColors[id ?? ''] ?? ['#e9edf4', '#435476'];
  return (
    <View style={[styles.avatar, compact && styles.avatarCompact, { backgroundColor }]} importantForAccessibility="no-hide-descendants">
      <Text style={[type.meta, { color, fontWeight: '600' }]} maxFontSizeMultiplier={1.4}>{initials}</Text>
    </View>
  );
}

export function IconButton({ icon, label, onPress, filled = false, disabled = false }: {
  icon: IconName;
  label: string;
  onPress: () => void;
  filled?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      android_ripple={{ color: filled ? '#425dd0' : colors.raised }}
      style={[styles.iconButton, filled && styles.filled, disabled && styles.disabled]}>
      <Icon name={icon} color={disabled ? colors.muted : filled ? colors.surface : colors.ink} />
    </Pressable>
  );
}

export function Button({ label, onPress, icon, variant = 'filled', disabled = false, busy = false }: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: 'filled' | 'outlined' | 'text';
  disabled?: boolean;
  busy?: boolean;
}) {
  const color = disabled && !busy ? colors.muted : variant === 'filled' ? colors.surface : colors.primaryInk;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      onPress={onPress}
      disabled={disabled || busy}
      android_ripple={{ color: variant === 'filled' ? '#425dd0' : colors.raised }}
      style={[styles.button, variant === 'filled' && styles.filled, variant === 'outlined' && styles.outlined, disabled && styles.disabled]}>
      {busy ? <ActivityIndicator size="small" color={color} /> : icon && <Icon name={icon} color={color} size={19} />}
      <Text style={[type.action, { color, flexShrink: 1 }]}>{label}</Text>
    </Pressable>
  );
}

export function Bar({ title, subtitle, onBack, trailing, avatar }: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  trailing?: ReactNode;
  avatar?: ReactNode;
}) {
  return (
    <View style={styles.bar}>
      {onBack && <IconButton icon="arrow-back" label="Back to inbox" onPress={onBack} />}
      {avatar}
      <View style={styles.barText}>
        <Text style={type.title} accessibilityRole="header" numberOfLines={2}>{title}</Text>
        {subtitle && <Text style={type.meta} numberOfLines={1}>{subtitle}</Text>}
      </View>
      {trailing}
    </View>
  );
}

export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={styles.field}>
      <Text style={type.action}>{label}</Text>
      <TextInput style={styles.input} accessibilityLabel={label} accessibilityHint={hint} placeholderTextColor={colors.muted}
        selectionColor={colors.primarySoft} {...props} />
      {hint && <Text style={type.meta}>{hint}</Text>}
    </View>
  );
}

export function SearchField(props: TextInputProps) {
  return (
    <View style={styles.search}>
      <Icon name="search" size={21} />
      <TextInput style={styles.searchInput} placeholderTextColor={colors.muted} autoCapitalize="none"
        autoCorrect={false} returnKeyType="search" {...props} />
    </View>
  );
}

export function Notice({ children, error = false }: { children: string; error?: boolean }) {
  return <Text accessibilityLiveRegion={error ? 'assertive' : 'polite'}
    style={[type.supporting, error && { color: colors.error }]}>{children}</Text>;
}

export function Loading({ label }: { label: string }) {
  return (
    <View style={styles.loading} accessibilityLiveRegion="polite">
      <ActivityIndicator color={colors.primary} />
      <Text style={type.supporting}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  mark: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center', gap: 4 },
  markLine: { height: 2, width: 18, borderRadius: 2, backgroundColor: colors.surface },
  markLast: { width: 11, alignSelf: 'flex-start', marginLeft: 9, backgroundColor: '#c7d4ff' },
  avatar: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  avatarCompact: { width: 32, height: 32, borderRadius: 8 },
  iconButton: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  button: { minHeight: 48, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, overflow: 'hidden' },
  filled: { backgroundColor: colors.primary },
  outlined: { borderWidth: 1, borderColor: colors.rule, backgroundColor: colors.surface },
  disabled: { backgroundColor: colors.raised },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 64, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.rule },
  barText: { flex: 1, minWidth: 0, gap: 2 },
  field: { gap: 8 },
  input: { minHeight: 52, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, borderWidth: 1, borderColor: colors.rule, backgroundColor: colors.paper, color: colors.ink, fontSize: 16 },
  search: { minHeight: 52, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.rule, alignItems: 'center', flexDirection: 'row', gap: 8, backgroundColor: colors.paper },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 12, color: colors.ink, fontSize: 16 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 16, minHeight: 104 },
});
