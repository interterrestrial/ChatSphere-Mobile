import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar, Bar, Button, Icon, Loading, Notice, Screen, SearchField } from '../../src/components/ui';
import type { Person } from '../../src/contracts';
import { colors, type } from '../../src/theme';
import { useWorkspace } from '../../src/workspace';

export default function NewConversation() {
  const { search, start } = useWorkspace();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchError, setSearchError] = useState(false);
  const [startError, setStartError] = useState('');
  const [starting, setStarting] = useState('');
  const [retry, setRetry] = useState(0);
  const term = query.trim().replace(/^@/, '');
  const focused = useRef(false);

  useFocusEffect(useCallback(() => {
    focused.current = true;
    return () => { focused.current = false; };
  }, []));

  useEffect(() => {
    const controller = new AbortController();
    const task = setTimeout(() => {
      void search(term, controller.signal).then(
        (results) => {
          if (controller.signal.aborted) return;
          setPeople(results);
          setLoading(false);
        },
        () => {
          if (controller.signal.aborted) return;
          setSearchError(true);
          setLoading(false);
        },
      );
    }, term ? 180 : 0);
    return () => {
      clearTimeout(task);
      controller.abort();
    };
  }, [term, search, retry]);

  async function open(person: Person) {
    if (starting) return;
    setStarting(person._id);
    setStartError('');
    try {
      const conversation = await start(person._id);
      if (focused.current) {
        router.replace({ pathname: '/conversation/[id]', params: { id: conversation._id } });
      }
    } catch {
      setStartError('Could not start this conversation. Try again.');
    } finally {
      setStarting('');
    }
  }

  return (
    <Screen>
      <Bar title="New conversation" onBack={() => router.dismissTo('/inbox')} />
      <View style={styles.content}>
        <View style={styles.search}>
          <SearchField accessibilityLabel="Search people" placeholder="Name or username" value={query}
            editable={!starting} autoFocus onChangeText={(text) => {
              if (text.trim().replace(/^@/, '') !== term) {
                setLoading(true);
                setPeople([]);
                setSearchError(false);
              }
              setQuery(text);
            }} />
          {!!startError && <Notice error>{startError}</Notice>}
        </View>
        <FlatList data={people} keyExtractor={({ _id }) => _id} keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.results}
          renderItem={({ item }) => (
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!starting, busy: starting === item._id }}
              disabled={!!starting} onPress={() => void open(item)} style={styles.row} android_ripple={{ color: colors.primarySoft }}>
              <Avatar name={item.name} id={item._id} />
              <View style={styles.person}>
                <Text style={type.name} numberOfLines={1}>{item.name}</Text>
                {item.username && <Text style={type.meta} numberOfLines={1}>@{item.username}</Text>}
              </View>
              {starting === item._id ? <Text style={type.meta}>Opening…</Text> : <Icon name="chevron-right" />}
            </Pressable>
          )}
          ListEmptyComponent={loading ? <Loading label="Searching…" /> : (
            <View style={styles.empty}>
              <Notice error={searchError}>{searchError ? 'Search could not load.' : 'No people found.'}</Notice>
              {searchError && <Button variant="outlined" label="Try again" onPress={() => {
                setSearchError(false);
                setLoading(true);
                setRetry((previous) => previous + 1);
              }} />}
            </View>
          )} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, alignSelf: 'center', width: '100%', maxWidth: 680 },
  search: { padding: 16, gap: 8 },
  results: { paddingHorizontal: 12, paddingBottom: 12 },
  empty: { alignItems: 'center', padding: 16, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, padding: 12, borderRadius: 12, overflow: 'hidden' },
  person: { flex: 1, minWidth: 0, gap: 2 },
});
