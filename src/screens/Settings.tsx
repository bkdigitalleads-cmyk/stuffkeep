import React, { useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTheme, fonts } from '../theme';
import { Card, SectionTitle, ProBadge } from '../components';
import { useApp } from '../state';
import { deleteAllData } from '../db';
import { deletePhotoFiles } from '../photos';
import { restorePurchases, isBillingAvailable } from '../purchases';

const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
const PRIVACY_URL = 'https://bkdigitalleads-cmyk.github.io/stuffkeep/privacy.html';

export default function SettingsScreen() {
  const theme = useTheme();
  const { settings, updateSettings, isPro, setIsPro, showPaywall, bumpItems } = useApp();
  const [busy, setBusy] = useState(false);

  const onToggleLock = async () => {
    if (!isPro) {
      showPaywall();
      return;
    }
    if (!settings.lockEnabled) {
      const hw = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hw || !enrolled) {
        Alert.alert(
          'Face ID unavailable',
          'Set up Face ID or a device passcode in iOS Settings first.'
        );
        return;
      }
    }
    await updateSettings({ lockEnabled: !settings.lockEnabled });
  };

  const onRestore = async () => {
    if (!isBillingAvailable()) {
      Alert.alert('Unavailable', 'Purchases are not available right now.');
      return;
    }
    setBusy(true);
    const res = await restorePurchases();
    setBusy(false);
    if (res.ok) {
      setIsPro(res.isPro);
      Alert.alert(
        res.isPro ? 'Restored!' : 'No purchases found',
        res.isPro
          ? 'Your Pro access is back.'
          : 'We couldn’t find a previous purchase on this Apple ID.'
      );
    } else {
      Alert.alert('Restore failed', res.error ?? 'Please try again.');
    }
  };

  const onDeleteAll = () => {
    Alert.alert(
      'Delete your entire inventory?',
      'Every item and photo is permanently erased from this device. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: async () => {
            const paths = await deleteAllData();
            deletePhotoFiles(paths);
            bumpItems();
          },
        },
      ]
    );
  };

  const rowText = (label: string, pro?: boolean) => (
    <View style={styles.rowLabel}>
      <Text style={[styles.rowText, { color: theme.text }]}>{label}</Text>
      {pro && !isPro ? <ProBadge theme={theme} /> : null}
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={[styles.title, { color: theme.text }]}>Settings</Text>

      {!isPro && (
        <Pressable onPress={showPaywall}>
          <Card theme={theme} style={{ ...styles.upsell, backgroundColor: theme.accentSoft }}>
            <Text style={[styles.upsellTitle, { color: theme.accent }]}>StuffKeep Pro</Text>
            <Text style={[styles.upsellSub, { color: theme.text }]}>
              Unlimited items · 6 photos per item · Insurance PDF · CSV export · Face ID lock
            </Text>
          </Card>
        </Pressable>
      )}

      <SectionTitle theme={theme}>Security</SectionTitle>
      <Card theme={theme}>
        <View style={styles.row}>
          {rowText('Lock with Face ID', true)}
          <Switch
            value={settings.lockEnabled}
            onValueChange={onToggleLock}
            trackColor={{ true: theme.accent }}
          />
        </View>
      </Card>

      <SectionTitle theme={theme}>Privacy & data</SectionTitle>
      <Card theme={theme}>
        <Text style={[styles.privacyNote, { color: theme.textSecondary }]}>
          Your inventory never leaves this iPhone. No account, no cloud, no tracking — your
          list of valuables is nobody’s business but yours. Use the Report tab to export a
          copy for safekeeping.
        </Text>
      </Card>

      <SectionTitle theme={theme}>Purchases</SectionTitle>
      <Card theme={theme}>
        <Pressable onPress={onRestore} disabled={busy} style={styles.row}>
          {rowText('Restore purchases')}
          <Text style={{ color: theme.textFaint }}>›</Text>
        </Pressable>
        <Pressable onPress={() => Linking.openURL(TERMS_URL)} style={styles.row}>
          {rowText('Terms of Use (EULA)')}
          <Text style={{ color: theme.textFaint }}>›</Text>
        </Pressable>
        <Pressable onPress={() => Linking.openURL(PRIVACY_URL)} style={styles.row}>
          {rowText('Privacy Policy')}
          <Text style={{ color: theme.textFaint }}>›</Text>
        </Pressable>
      </Card>

      <SectionTitle theme={theme}>Danger zone</SectionTitle>
      <Card theme={theme}>
        <Pressable onPress={onDeleteAll} style={styles.row}>
          <Text style={[styles.rowText, { color: theme.danger }]}>
            Delete all items & photos
          </Text>
        </Pressable>
      </Card>

      <Text style={[styles.version, { color: theme.textFaint }]}>
        StuffKeep v1.0.1 · Made with care in NYC
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingTop: 24, paddingBottom: 48 },
  title: { fontSize: 26, fontWeight: fonts.weight.bold, letterSpacing: -0.5, marginBottom: 8 },
  upsell: { marginTop: 8, borderWidth: 0 },
  upsellTitle: { fontSize: 17, fontWeight: fonts.weight.bold, marginBottom: 4 },
  upsellSub: { fontSize: 14, lineHeight: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    minHeight: 40,
  },
  rowLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowText: { fontSize: 16 },
  privacyNote: { fontSize: 13, lineHeight: 19, paddingVertical: 4 },
  version: { textAlign: 'center', marginTop: 28, fontSize: 12 },
});
