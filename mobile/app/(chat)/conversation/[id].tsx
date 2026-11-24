import { useCallback, useMemo, useRef, useState, type ComponentRef } from 'react';
import { randomUUID } from 'expo-crypto';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  FlatList, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Avatar, Bar, Button, Icon, IconButton, Loading, Notice, Screen } from '../../../src/components/ui';
import { conversationPerson, conversationTitle, type Conversation, type Message } from '../../../src/contracts';
import { colors, type } from '../../../src/theme';
import { useWorkspace } from '../../../src/workspace';

const dateFormat = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
const timeFormat = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const noMessages: Message[] = [];

type Row = { kind: 'date'; id: string; label: string } | { kind: 'message'; message: Message; grouped: boolean };

function transcriptRows(messages: Message[]): Row[] {
  const rows: Row[] = [];

  for (let index = 0; index < messages.length; index++) {
    const message = messages[index];
    const previous = messages[index - 1];
    const date = new Date(message.createdAt);
    const firstOfDay = !previous || date.toDateString() !== new Date(previous.createdAt).toDateString();
    if (firstOfDay) rows.push({ kind: 'date', id: message._id, label: dateFormat.format(date) });
    const grouped = !firstOfDay && previous.senderId === message.senderId &&
      date.getTime() - Date.parse(previous.createdAt) < 5 * 60 * 1000;
    rows.push({ kind: 'message', message, grouped });
  }
  return rows.reverse();
}

function ConversationView({ conversation, onBack }: { conversation: Conversation; onBack: () => void }) {
  const { user, demo, threads, focusThread, reloadThread, loadEarlier, send, suggest, summarize } = useWorkspace();
  const id = conversation._id;
  const thread = threads[id];
  const messages = thread?.messages ?? noMessages;
  const rows = useMemo(() => transcriptRows(messages), [messages]);
  const person = conversationPerson(conversation, user._id);
  const title = conversationTitle(conversation, user._id);
  const latest = messages.at(-1);
  const incoming = latest?.senderId !== user._id ? latest : undefined;
  const composer = useRef<ComponentRef<typeof TextInput>>(null);
  const list = useRef<FlatList<Row>>(null);
  const pendingMessage = useRef<{ content: string; id: string } | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<{ id: string; items: string[]; error?: string }>();
  const [showSummary, setShowSummary] = useState(false);
  const [summary, setSummary] = useState<{ latest?: string; text: string }>();
  const [summaryBusy, setSummaryBusy] = useState(false);
  const [summaryError, setSummaryError] = useState('');
  const choices = suggestions?.id === incoming?._id ? suggestions : undefined;

  useFocusEffect(useCallback(() => focusThread(id), [focusThread, id]));

  async function submit() {
    const content = draft.trim();
    if (sending || !content) return;
    setSending(true);
    setSendError('');
    try {
      const attempt = pendingMessage.current?.content === content
        ? pendingMessage.current : { content, id: randomUUID() };
      pendingMessage.current = attempt;
      await send(id, content, attempt.id);
      pendingMessage.current = null;
      setDraft((current) => current.trim() === content ? '' : current);
      list.current?.scrollToOffset({ offset: 0, animated: false });
    } catch {
      setSendError('Could not send the message. Your draft is still here.');
    } finally {
      setSending(false);
    }
  }

  async function offerReplies() {
    if (!incoming || suggesting) return;
    setSuggesting(true);
    setSuggestions(undefined);
    try {
      const items = await suggest(incoming);
      setSuggestions({ id: incoming._id, items, error: items.length ? undefined : 'No suggestions. You can write your own reply.' });
    } catch {
      setSuggestions({ id: incoming._id, items: [], error: 'Suggestions are unavailable. You can still write a reply.' });
    } finally {
      setSuggesting(false);
    }
  }

  async function toggleSummary() {
    setShowSummary(!showSummary);
    if (showSummary || summaryBusy || summary?.latest === latest?._id) return;
    setSummaryBusy(true);
    setSummaryError('');
    try {
      setSummary({ latest: latest?._id, text: await summarize(id) });
    } catch {
      setSummaryError('The summary could not load. Close it and try again.');
    } finally {
      setSummaryBusy(false);
    }
  }

  return (
    <Screen>
      <Bar title={title} subtitle={person?.username ? `@${person.username}` : undefined} onBack={onBack}
        avatar={<Avatar name={title} id={person?._id} compact />}
        trailing={<IconButton icon={showSummary ? 'close' : 'notes'} label={showSummary ? 'Close summary' : 'Open summary'}
          disabled={!messages.length && !showSummary} onPress={() => void toggleSummary()} />} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {showSummary && (
          <ScrollView style={styles.summary} contentContainerStyle={styles.summaryContent}>
            <Text style={type.name} accessibilityRole="header">{demo ? 'Sample summary' : 'Conversation summary'}</Text>
            <Notice error={!!summaryError}>{summaryBusy ? 'Summarizing…' : summaryError || summary?.text || ''}</Notice>
          </ScrollView>
        )}
        <FlatList
          ref={list}
          style={styles.transcript}
          contentContainerStyle={styles.transcriptContent}
          data={rows}
          inverted
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(row) => row.kind === 'date' ? `day-${row.id}` : row.message._id}
          ListEmptyComponent={thread?.status === 'ready'
            ? <View style={styles.empty}><Notice>{`Start the conversation with ${title}.`}</Notice></View>
            : thread?.status === 'error'
              ? <View style={styles.empty}><Notice error>Could not load messages.</Notice>
                <Button label="Try again" variant="outlined" onPress={() => void reloadThread(id)} />
              </View>
              : <Loading label="Loading messages…" />}
          ListFooterComponent={(
            <>
              {messages.length > 0 && thread?.status === 'error' &&
                <View style={styles.empty}><Notice error>Could not refresh the thread.</Notice>
                  <Button label="Retry" variant="text" onPress={() => void reloadThread(id)} />
                </View>}
              {thread?.before && <View style={styles.empty}>
                <Button label={thread.olderStatus === 'error' ? 'Retry earlier messages' : 'Load earlier messages'}
                  variant="outlined" busy={thread.olderStatus === 'loading'}
                  onPress={() => void loadEarlier(id, thread.before!)} />
              </View>}
            </>
          )}
          renderItem={({ item }) => {
            if (item.kind === 'date') {
              return (
                <View style={styles.day}>
                  <View style={styles.rule} /><Text style={type.meta}>{item.label}</Text><View style={styles.rule} />
                </View>
              );
            }
            const { message, grouped } = item;
            const own = message.senderId === user._id;
            const sender = own ? 'You' : conversation.participants.find((entry) => entry?._id === message.senderId)?.name ?? title;
            const time = timeFormat.format(new Date(message.createdAt));
            return (
              <View style={[styles.line, own && styles.myLine, grouped && styles.grouped]}
                accessible accessibilityLabel={`${sender}, ${message.content}, ${time}${own ? message.isRead ? ', read' : ', sent' : ''}`}>
                {!own && (grouped ? <View style={styles.avatarSpace} /> : <Avatar name={sender} id={message.senderId} compact />)}
                <View style={[styles.message, own && styles.myMessage]}>
                  <View style={[styles.bubble, own && styles.myBubble]}>
                    <Text style={[type.body, own && styles.onPrimary]}>{message.content}</Text>
                  </View>
                  <View style={styles.metadata}>
                    <Text style={type.meta}>{time}</Text>
                    {own && <Icon name={message.isRead ? 'done-all' : 'done'} size={14} color={colors.muted} />}
                  </View>
                </View>
              </View>
            );
          }}
        />
        <View style={styles.composerArea}>
          <View style={styles.composerContent}>
            {incoming && (
              <View style={styles.replyAction}>
                <Button label={demo ? 'Suggest sample replies' : 'Suggest replies'} variant="text" icon="chat-bubble-outline"
                  busy={suggesting} onPress={() => void offerReplies()} />
              </View>
            )}
            {choices?.error && <Notice error>{choices.error}</Notice>}
            {!!choices?.items.length && (
              <ScrollView horizontal keyboardShouldPersistTaps="handled" contentContainerStyle={styles.suggestions}
                showsHorizontalScrollIndicator={false}>
                {choices.items.map((reply, index) => (
                  <Button key={`${index}-${reply}`} label={reply} variant="outlined" onPress={() => {
                    setDraft(reply);
                    composer.current?.focus();
                  }} />
                ))}
              </ScrollView>
            )}
            <View style={styles.composer}>
              <TextInput ref={composer} multiline value={draft} onChangeText={setDraft} maxLength={4000}
                accessibilityLabel={`Message ${title}`} placeholder={`Message ${title.split(' ')[0]}`}
                placeholderTextColor={colors.muted} style={styles.input} />
              <IconButton icon="arrow-upward" label="Send message" filled disabled={!draft.trim() || sending}
                onPress={() => void submit()} />
            </View>
            {!!sendError && <Notice error>{sendError}</Notice>}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { conversations, inboxStatus, reloadInbox } = useWorkspace();
  const router = useRouter();
  const back = () => router.dismissTo('/inbox');
  const conversation = conversations.find(({ _id }) => _id === id);

  if (conversation) return <ConversationView key={conversation._id} conversation={conversation} onBack={back} />;
  return (
    <Screen>
      <Bar title="Conversation" onBack={back} />
      {inboxStatus === 'loading' ? <Loading label="Opening conversation…" /> : (
        <View style={styles.empty}>
          <Notice error={inboxStatus === 'error'}>{inboxStatus === 'error' ? 'Could not load the inbox.' : 'This conversation is unavailable.'}</Notice>
          {inboxStatus === 'error' && <Button label="Try again" variant="outlined" onPress={() => void reloadInbox()} />}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  transcript: { flex: 1, backgroundColor: colors.paper },
  transcriptContent: { width: '100%', alignSelf: 'center', maxWidth: 780, paddingVertical: 12, paddingHorizontal: 16 },
  summary: { maxHeight: 164, backgroundColor: colors.primarySoft, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.rule },
  summaryContent: { gap: 8, padding: 16, width: '100%', maxWidth: 780, alignSelf: 'center' },
  day: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, marginBottom: 8 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.rule },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 16 },
  myLine: { justifyContent: 'flex-end', paddingLeft: 40 },
  grouped: { marginTop: -8 },
  avatarSpace: { width: 32 },
  message: { flexShrink: 1, alignItems: 'flex-start', maxWidth: 560, gap: 4 },
  myMessage: { alignItems: 'flex-end' },
  bubble: { borderRadius: 12, borderTopLeftRadius: 4, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.rule, paddingVertical: 8, paddingHorizontal: 12 },
  myBubble: { borderTopLeftRadius: 12, borderTopRightRadius: 4, backgroundColor: colors.primary, borderColor: colors.primary },
  onPrimary: { color: colors.surface },
  metadata: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  empty: { padding: 24, alignItems: 'center', gap: 8 },
  composerArea: { backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.rule },
  composerContent: { width: '100%', maxWidth: 780, alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 4 },
  replyAction: { alignSelf: 'flex-start' },
  suggestions: { gap: 8 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 4, borderWidth: 1, borderColor: colors.rule, borderRadius: 12, backgroundColor: colors.paper },
  input: { flex: 1, minHeight: 48, maxHeight: 132, paddingHorizontal: 8, paddingVertical: 12, fontSize: 16, lineHeight: 22, color: colors.ink, textAlignVertical: 'center' },
});
