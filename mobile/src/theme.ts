import { StyleSheet } from 'react-native';

export const colors = {
  paper: '#f4f5f8',
  surface: '#ffffff',
  raised: '#edf0f5',
  ink: '#161d31',
  secondary: '#46516a',
  muted: '#626d82',
  rule: '#dbe0ea',
  primary: '#2947c6',
  primaryInk: '#203caa',
  primarySoft: '#eaf0ff',
  preview: '#edf1fc',
  error: '#a33240',
};

export const type = StyleSheet.create({
  headline: { color: colors.ink, fontSize: 36, lineHeight: 42, letterSpacing: -1.2, fontWeight: '600' },
  title: { color: colors.ink, fontSize: 20, lineHeight: 26, fontWeight: '600' },
  name: { color: colors.ink, fontSize: 16, lineHeight: 22, fontWeight: '600' },
  body: { color: colors.ink, fontSize: 15, lineHeight: 23 },
  supporting: { color: colors.secondary, fontSize: 14, lineHeight: 20 },
  meta: { color: colors.muted, fontSize: 12, lineHeight: 16, fontVariant: ['tabular-nums'] },
  action: { color: colors.primaryInk, fontSize: 14, lineHeight: 20, fontWeight: '600' },
});
