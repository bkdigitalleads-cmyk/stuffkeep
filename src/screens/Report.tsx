import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme, fonts } from '../theme';
import { Card, PillButton, ProBadge, SectionTitle } from '../components';
import { useApp } from '../state';
import { getTotals, Totals, exportCsv } from '../db';
import { generateAndSharePdf } from '../report';
import { formatCents } from '../money';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';

export default function ReportScreen() {
  const theme = useTheme();
  const { isPro, showPaywall, itemsVersion } = useApp();
  const [totals, setTotals] = useState<Totals | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getTotals().then(setTotals);
  }, [itemsVersion]);

  const requirePro = (fn: () => void) => () => {
    if (!isPro) {
      showPaywall();
      return;
    }
    fn();
  };

  const onPdf = requirePro(async () => {
    if ((totals?.itemCount ?? 0) === 0) {
      Alert.alert('Nothing to report yet', 'Add a few items first, then generate your report.');
      return;
    }
    try {
      setBusy(true);
      await generateAndSharePdf();
    } catch (e: any) {
      Alert.alert('Report failed', e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  });

  const onCsv = requirePro(async () => {
    try {
      setBusy(true);
      const csv = await exportCsv();
      const file = new File(Paths.cache, 'stuffkeep-inventory.csv');
      if (file.exists) file.delete();
      file.write(csv);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export your inventory',
        });
      }
    } catch (e: any) {
      Alert.alert('Export failed', e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  });

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={[styles.title, { color: theme.text }]}>Insurance report</Text>
      <Text style={[styles.sub, { color: theme.textSecondary }]}>
        After a fire, flood, or break-in, insurers ask for proof of what you owned. This
        report is that proof: every item, photo, serial number, and value — organized by
        room and totaled.
      </Text>

      <Card theme={theme} style={styles.statsCard}>
        <View style={styles.statRow}>
          <Stat label="Items" value={String(totals?.itemCount ?? 0)} theme={theme} />
          <Stat label="Photos" value={String(totals?.photoCount ?? 0)} theme={theme} />
          <Stat label="Rooms" value={String(totals?.roomsUsed ?? 0)} theme={theme} />
        </View>
        <View style={[styles.totalBar, { backgroundColor: theme.accentSoft }]}>
          <Text style={[styles.totalLabel, { color: theme.accent }]}>Documented value</Text>
          <Text style={[styles.totalValue, { color: theme.accent }]}>
            {formatCents(totals?.totalCents ?? 0)}
          </Text>
        </View>
      </Card>

      <SectionTitle theme={theme}>Export</SectionTitle>
      <Card theme={theme} style={styles.exportCard}>
        <View style={styles.exportRow}>
          <View style={{ flex: 1 }}>
            <View style={styles.exportTitleRow}>
              <Text style={[styles.exportTitle, { color: theme.text }]}>PDF report</Text>
              {!isPro && <ProBadge theme={theme} />}
            </View>
            <Text style={[styles.exportBody, { color: theme.textSecondary }]}>
              Claim-ready document with photos. Email it to yourself so a copy lives outside
              your home.
            </Text>
          </View>
        </View>
        <PillButton theme={theme} label={busy ? 'Working…' : 'Generate PDF'} onPress={onPdf} disabled={busy} />
      </Card>

      <Card theme={theme} style={styles.exportCard}>
        <View style={styles.exportRow}>
          <View style={{ flex: 1 }}>
            <View style={styles.exportTitleRow}>
              <Text style={[styles.exportTitle, { color: theme.text }]}>CSV spreadsheet</Text>
              {!isPro && <ProBadge theme={theme} />}
            </View>
            <Text style={[styles.exportBody, { color: theme.textSecondary }]}>
              Every item as a spreadsheet — handy for insurance agents and estate planning.
            </Text>
          </View>
        </View>
        <PillButton theme={theme} label={busy ? 'Working…' : 'Export CSV'} onPress={onCsv} disabled={busy} kind="ghost" />
      </Card>

      <Text style={[styles.tip, { color: theme.textFaint }]}>
        Tip: most insurers recommend updating your inventory once a year and after any big
        purchase.
      </Text>
    </ScrollView>
  );
}

function Stat({ label, value, theme }: { label: string; value: string; theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.textFaint }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 60 },
  title: { fontSize: 26, fontWeight: fonts.weight.bold, letterSpacing: -0.5 },
  sub: { fontSize: 14, lineHeight: 20, marginTop: 6 },
  statsCard: { marginTop: 16, paddingBottom: 12 },
  statRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12 },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: fonts.weight.bold },
  statLabel: { fontSize: 12, marginTop: 2 },
  totalBar: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: { fontSize: 13, fontWeight: fonts.weight.semibold },
  totalValue: { fontSize: 17, fontWeight: fonts.weight.bold },
  exportCard: { marginBottom: 12, gap: 12 },
  exportRow: { flexDirection: 'row' },
  exportTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exportTitle: { fontSize: 16, fontWeight: fonts.weight.semibold },
  exportBody: { fontSize: 13, lineHeight: 18, marginTop: 3 },
  tip: { fontSize: 12, textAlign: 'center', marginTop: 8, lineHeight: 17 },
});
