import React, { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme, fonts } from '../theme';
import { Card } from '../components';
import { useApp, FREE_ITEM_LIMIT } from '../state';
import { getItems, getRooms, getTotals, Item, Room, Totals } from '../db';
import { photoUri } from '../photos';
import { formatCents } from '../money';

export default function HomeScreen({ onAddItem, onOpenItem }: {
  onAddItem: () => void;
  onOpenItem: (id: number) => void;
}) {
  const theme = useTheme();
  const { isPro, showPaywall, itemsVersion } = useApp();
  const [items, setItems] = useState<Item[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [roomFilter, setRoomFilter] = useState<number | 'all'>('all');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    const opts: { roomId?: number; query?: string } = {};
    if (roomFilter !== 'all') opts.roomId = roomFilter;
    if (query.trim()) opts.query = query.trim();
    setItems(await getItems(opts));
    setRooms(await getRooms());
    setTotals(await getTotals());
  }, [roomFilter, query]);

  useEffect(() => {
    load();
  }, [load, itemsVersion]);

  const atFreeLimit = !isPro && (totals?.itemCount ?? 0) >= FREE_ITEM_LIMIT;
  const nearFreeLimit =
    !isPro && !atFreeLimit && (totals?.itemCount ?? 0) >= FREE_ITEM_LIMIT - 5;

  const handleAdd = () => {
    if (atFreeLimit) {
      showPaywall();
      return;
    }
    onAddItem();
  };

  const renderItem = ({ item }: { item: Item }) => (
    <Pressable onPress={() => onOpenItem(item.id)}>
      <Card theme={theme} style={styles.itemCard}>
        <View style={styles.itemRow}>
          {item.coverPath ? (
            <Image source={{ uri: photoUri(item.coverPath) }} style={styles.thumb} />
          ) : (
            <View style={[styles.thumb, styles.thumbEmpty, { backgroundColor: theme.cardAlt }]}>
              <Text style={styles.thumbEmoji}>📦</Text>
            </View>
          )}
          <View style={styles.itemBody}>
            <Text style={[styles.itemName, { color: theme.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.itemMeta, { color: theme.textFaint }]} numberOfLines={1}>
              {item.roomName ?? 'No room'}
              {item.photoCount > 1 ? ` · ${item.photoCount} photos` : ''}
            </Text>
          </View>
          <Text style={[styles.itemValue, { color: theme.accent }]}>
            {item.valueCents > 0 ? formatCents(item.valueCents) : ''}
          </Text>
        </View>
      </Card>
    </Pressable>
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={items}
        keyExtractor={(it) => String(it.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View>
            <Text style={[styles.brand, { color: theme.textSecondary }]}>StuffKeep</Text>
            <Card theme={theme} style={styles.heroCard}>
              <Text style={[styles.heroLabel, { color: theme.textSecondary }]}>
                Your stuff is worth
              </Text>
              <Text style={[styles.heroValue, { color: theme.text }]}>
                {formatCents(totals?.totalCents ?? 0)}
              </Text>
              <Text style={[styles.heroMeta, { color: theme.textFaint }]}>
                {totals?.itemCount ?? 0} items · {totals?.photoCount ?? 0} photos ·{' '}
                {totals?.roomsUsed ?? 0} rooms
              </Text>
            </Card>

            {(atFreeLimit || nearFreeLimit) && (
              <Pressable onPress={showPaywall}>
                <Card theme={theme} style={{ ...styles.limitCard, backgroundColor: theme.accentSoft }}>
                  <Text style={[styles.limitText, { color: theme.accent }]}>
                    {atFreeLimit
                      ? `Free plan is full (${FREE_ITEM_LIMIT} items). Go Pro for unlimited →`
                      : `${FREE_ITEM_LIMIT - (totals?.itemCount ?? 0)} free items left. Go Pro for unlimited →`}
                  </Text>
                </Card>
              </Pressable>
            )}

            <TextInput
              style={[
                styles.search,
                { backgroundColor: theme.card, color: theme.text, borderColor: theme.border },
              ]}
              placeholder="Search items, serials, notes…"
              placeholderTextColor={theme.textFaint}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />

            <View style={styles.chips}>
              <Chip
                label="All"
                active={roomFilter === 'all'}
                onPress={() => setRoomFilter('all')}
                theme={theme}
              />
              {rooms.map((r) => (
                <Chip
                  key={r.id}
                  label={r.name}
                  active={roomFilter === r.id}
                  onPress={() => setRoomFilter(roomFilter === r.id ? 'all' : r.id)}
                  theme={theme}
                />
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={
          <Card theme={theme} style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🏠</Text>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>
              {query || roomFilter !== 'all' ? 'Nothing here yet' : 'Document your first item'}
            </Text>
            <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
              {query || roomFilter !== 'all'
                ? 'Try a different search or room.'
                : 'Pick any room, grab the most valuable thing in it, and add it with a photo. Ten minutes now pays for itself when you file a claim.'}
            </Text>
          </Card>
        }
      />
      <Pressable
        onPress={handleAdd}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 },
        ]}
        accessibilityLabel="Add item"
      >
        <Text style={styles.fabPlus}>＋</Text>
      </Pressable>
    </View>
  );
}

function Chip({ label, active, onPress, theme }: {
  label: string;
  active: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? theme.accent : theme.card,
          borderColor: active ? theme.accent : theme.border,
        },
      ]}
    >
      <Text
        style={[styles.chipText, { color: active ? '#FFFFFF' : theme.textSecondary }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { padding: 20, paddingBottom: 120 },
  brand: { fontSize: 14, fontWeight: fonts.weight.semibold, marginBottom: 8, letterSpacing: 0.3 },
  heroCard: { alignItems: 'center', paddingVertical: 22 },
  heroLabel: { fontSize: 13, fontWeight: fonts.weight.medium },
  heroValue: { fontSize: 40, fontWeight: fonts.weight.bold, letterSpacing: -1, marginVertical: 2 },
  heroMeta: { fontSize: 13 },
  limitCard: { marginTop: 10, paddingVertical: 12, borderWidth: 0 },
  limitText: { fontSize: 14, fontWeight: fonts.weight.semibold, textAlign: 'center' },
  search: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    marginTop: 14,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, marginBottom: 14 },
  chip: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: { fontSize: 13, fontWeight: fonts.weight.medium },
  itemCard: { marginBottom: 10, padding: 12 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 52, height: 52, borderRadius: 10 },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  thumbEmoji: { fontSize: 22 },
  itemBody: { flex: 1 },
  itemName: { fontSize: 16, fontWeight: fonts.weight.semibold },
  itemMeta: { fontSize: 13, marginTop: 2 },
  itemValue: { fontSize: 15, fontWeight: fonts.weight.bold },
  emptyCard: { alignItems: 'center', paddingVertical: 30 },
  emptyEmoji: { fontSize: 40, marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: fonts.weight.bold },
  emptyBody: { fontSize: 14, textAlign: 'center', marginTop: 6, lineHeight: 20 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  fabPlus: { color: '#FFFFFF', fontSize: 30, lineHeight: 34, fontWeight: fonts.weight.semibold },
});
