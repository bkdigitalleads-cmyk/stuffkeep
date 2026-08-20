import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useTheme, fonts } from '../theme';
import { Card, PillButton, ProBadge } from '../components';
import { useApp, FREE_PHOTOS_PER_ITEM, PRO_PHOTOS_PER_ITEM } from '../state';
import {
  addPhoto,
  addRoom,
  countItems,
  deleteItem,
  deletePhoto,
  getItem,
  getPhotos,
  getRooms,
  insertItem,
  Photo,
  Room,
  updateItem,
} from '../db';
import { deletePhotoFile, deletePhotoFiles, photoUri, storePhoto } from '../photos';
import { centsToEditable, parseDollarsToCents } from '../money';
import { maybeRequestReview } from '../reviews';
import BarcodeScanner from './Scanner';

interface Props {
  visible: boolean;
  itemId: number | null; // null = new item
  onClose: () => void;
}

export default function ItemFormModal({ visible, itemId, onClose }: Props) {
  const theme = useTheme();
  const { isPro, showPaywall, bumpItems } = useApp();
  const [name, setName] = useState('');
  const [valueText, setValueText] = useState('');
  const [serial, setSerial] = useState('');
  const [notes, setNotes] = useState('');
  const [roomId, setRoomId] = useState<number | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<string[]>([]); // stored filenames for a NEW item
  const [scannerOpen, setScannerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const editing = itemId !== null;

  const reset = useCallback(() => {
    setName('');
    setValueText('');
    setSerial('');
    setNotes('');
    setRoomId(null);
    setPhotos([]);
    setPendingPhotos([]);
  }, []);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      setRooms(await getRooms());
      if (itemId !== null) {
        const it = await getItem(itemId);
        if (it) {
          setName(it.name);
          setValueText(centsToEditable(it.valueCents));
          setSerial(it.serial);
          setNotes(it.notes);
          setRoomId(it.roomId);
          setPhotos(await getPhotos(itemId));
        }
      } else {
        reset();
      }
    })();
  }, [visible, itemId, reset]);

  const photoCount = editing ? photos.length : pendingPhotos.length;
  const photoCap = isPro ? PRO_PHOTOS_PER_ITEM : FREE_PHOTOS_PER_ITEM;

  const pickPhoto = async (fromCamera: boolean) => {
    if (photoCount >= photoCap) {
      if (!isPro) {
        showPaywall();
      } else {
        Alert.alert('Photo limit', `Up to ${PRO_PHOTOS_PER_ITEM} photos per item.`);
      }
      return;
    }
    try {
      let result: ImagePicker.ImagePickerResult;
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Camera unavailable', 'Allow camera access in iOS Settings to photograph items.');
          return;
        }
        result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 });
      } else {
        result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 });
      }
      if (result.canceled || !result.assets?.length) return;
      const stored = await storePhoto(result.assets[0].uri);
      if (editing && itemId !== null) {
        await addPhoto(itemId, stored);
        setPhotos(await getPhotos(itemId));
        bumpItems();
      } else {
        setPendingPhotos((p) => [...p, stored]);
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch (e: any) {
      Alert.alert('Photo failed', e?.message ?? 'Please try again.');
    }
  };

  const removePhoto = async (index: number) => {
    if (editing) {
      const p = photos[index];
      const path = await deletePhoto(p.id);
      if (path) deletePhotoFile(path);
      setPhotos(photos.filter((_, i) => i !== index));
      bumpItems();
    } else {
      deletePhotoFile(pendingPhotos[index]);
      setPendingPhotos(pendingPhotos.filter((_, i) => i !== index));
    }
  };

  const onAddRoom = () => {
    Alert.prompt(
      'New room',
      'Name the room or place (e.g. Attic, Shed, Storage unit).',
      async (text) => {
        const room = await addRoom(text ?? '');
        if (room) {
          setRooms(await getRooms());
          setRoomId(room.id);
        }
      }
    );
  };

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Give the item a name — e.g. “65-inch LG TV”.');
      return;
    }
    setSaving(true);
    try {
      const input = {
        name: trimmed,
        roomId,
        valueCents: parseDollarsToCents(valueText),
        serial,
        notes,
      };
      if (editing && itemId !== null) {
        await updateItem(itemId, input);
      } else {
        const newId = await insertItem(input);
        for (const p of pendingPhotos) await addPhoto(newId, p);
        maybeRequestReview(await countItems());
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      bumpItems();
      reset();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const onDelete = () => {
    if (!editing || itemId === null) return;
    Alert.alert('Delete this item?', 'Its photos are removed too. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const paths = await deleteItem(itemId);
          deletePhotoFiles(paths);
          bumpItems();
          onClose();
        },
      },
    ]);
  };

  const cancel = () => {
    if (!editing && pendingPhotos.length) {
      deletePhotoFiles(pendingPhotos);
    }
    reset();
    onClose();
  };

  const photoTiles = editing
    ? photos.map((p) => ({ key: String(p.id), uri: photoUri(p.path) }))
    : pendingPhotos.map((f, i) => ({ key: `${f}-${i}`, uri: photoUri(f) }));

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={cancel}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: theme.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.header, { borderBottomColor: theme.border }]}>
          <Pressable onPress={cancel} hitSlop={10}>
            <Text style={[styles.headerBtn, { color: theme.textSecondary }]}>Cancel</Text>
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>
            {editing ? 'Edit item' : 'Add item'}
          </Text>
          <Pressable onPress={save} hitSlop={10} disabled={saving}>
            <Text style={[styles.headerBtn, { color: theme.accent, fontWeight: fonts.weight.bold }]}>
              {saving ? '…' : 'Save'}
            </Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.photoRow}>
            {photoTiles.map((t, i) => (
              <View key={t.key} style={styles.photoWrap}>
                <Image source={{ uri: t.uri }} style={styles.photo} />
                <Pressable
                  onPress={() => removePhoto(i)}
                  style={[styles.photoX, { backgroundColor: theme.danger }]}
                  hitSlop={8}
                >
                  <Text style={styles.photoXText}>✕</Text>
                </Pressable>
              </View>
            ))}
            {photoTiles.length < PRO_PHOTOS_PER_ITEM && (
              <Pressable
                onPress={() => pickPhoto(true)}
                onLongPress={() => pickPhoto(false)}
                style={[styles.photoAdd, { borderColor: theme.border, backgroundColor: theme.card }]}
              >
                <Text style={styles.photoAddIcon}>📷</Text>
                <Text style={[styles.photoAddText, { color: theme.textSecondary }]}>
                  {photoTiles.length === 0 ? 'Add photo' : 'More'}
                </Text>
                {!isPro && photoTiles.length >= FREE_PHOTOS_PER_ITEM && <ProBadge theme={theme} />}
              </Pressable>
            )}
          </View>
          <Text style={[styles.hint, { color: theme.textFaint }]}>
            Tap for camera · hold to pick from library
          </Text>

          <Card theme={theme} style={styles.fieldCard}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Item name</Text>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              value={name}
              onChangeText={setName}
              placeholder="65-inch LG TV"
              placeholderTextColor={theme.textFaint}
              returnKeyType="done"
            />
          </Card>

          <Card theme={theme} style={styles.fieldCard}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Estimated value</Text>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              value={valueText}
              onChangeText={setValueText}
              placeholder="$0"
              placeholderTextColor={theme.textFaint}
              keyboardType="decimal-pad"
            />
          </Card>

          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Room</Text>
          <View style={styles.roomChips}>
            {rooms.map((r) => {
              const active = roomId === r.id;
              return (
                <Pressable
                  key={r.id}
                  onPress={() => setRoomId(active ? null : r.id)}
                  style={[
                    styles.roomChip,
                    {
                      backgroundColor: active ? theme.accent : theme.card,
                      borderColor: active ? theme.accent : theme.border,
                    },
                  ]}
                >
                  <Text style={[styles.roomChipText, { color: active ? '#FFF' : theme.textSecondary }]}>
                    {r.name}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={onAddRoom}
              style={[styles.roomChip, { backgroundColor: theme.cardAlt, borderColor: theme.border }]}
            >
              <Text style={[styles.roomChipText, { color: theme.accent }]}>+ New room</Text>
            </Pressable>
          </View>

          <Card theme={theme} style={styles.fieldCard}>
            <View style={styles.serialRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>
                  Serial / model number
                </Text>
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  value={serial}
                  onChangeText={setSerial}
                  placeholder="Scan or type"
                  placeholderTextColor={theme.textFaint}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
              </View>
              <Pressable
                onPress={() => setScannerOpen(true)}
                style={[styles.scanBtn, { backgroundColor: theme.accentSoft }]}
              >
                <Text style={[styles.scanBtnText, { color: theme.accent }]}>▦ Scan</Text>
              </Pressable>
            </View>
          </Card>

          <Card theme={theme} style={styles.fieldCard}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Notes</Text>
            <TextInput
              style={[styles.input, styles.notes, { color: theme.text }]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Bought 2024 at Best Buy, receipt in email…"
              placeholderTextColor={theme.textFaint}
              multiline
            />
          </Card>

          {editing && (
            <View style={{ marginTop: 18 }}>
              <PillButton theme={theme} label="Delete item" kind="ghost" onPress={onDelete} />
            </View>
          )}
        </ScrollView>

        <BarcodeScanner
          visible={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onScanned={(code) => {
            setSerial(code);
            setScannerOpen(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          }}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 64,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: { fontSize: 16 },
  headerTitle: { fontSize: 17, fontWeight: fonts.weight.bold },
  scroll: { padding: 20, paddingBottom: 60 },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoWrap: { position: 'relative' },
  photo: { width: 84, height: 84, borderRadius: 12 },
  photoX: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoXText: { color: '#FFF', fontSize: 11, fontWeight: fonts.weight.bold },
  photoAdd: {
    width: 84,
    height: 84,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  photoAddIcon: { fontSize: 20 },
  photoAddText: { fontSize: 11 },
  hint: { fontSize: 12, marginTop: 8, marginBottom: 14 },
  fieldCard: { marginBottom: 12, paddingVertical: 12 },
  label: { fontSize: 12, fontWeight: fonts.weight.semibold, marginBottom: 4 },
  input: { fontSize: 17, paddingVertical: 2 },
  notes: { minHeight: 60, textAlignVertical: 'top' },
  sectionLabel: { fontSize: 12, fontWeight: fonts.weight.semibold, marginBottom: 8, marginTop: 4 },
  roomChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  roomChip: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  roomChipText: { fontSize: 13, fontWeight: fonts.weight.medium },
  serialRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  scanBtn: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  scanBtnText: { fontSize: 14, fontWeight: fonts.weight.semibold },
});
