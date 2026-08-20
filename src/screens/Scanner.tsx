import React, { useRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTheme, fonts } from '../theme';
import { PillButton } from '../components';

/**
 * Barcode / serial capture. Fully offline: we record the code itself
 * (great for insurance claims) — no product database lookup, no network.
 */
export default function BarcodeScanner({ visible, onClose, onScanned }: {
  visible: boolean;
  onClose: () => void;
  onScanned: (code: string) => void;
}) {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const firedRef = useRef(false);

  const handleScan = (data: string) => {
    if (firedRef.current) return; // scanner fires repeatedly; take the first
    firedRef.current = true;
    onScanned(data);
    setTimeout(() => {
      firedRef.current = false;
    }, 1500);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: '#000' }]}>
        {permission?.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            barcodeScannerSettings={{
              barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr', 'datamatrix'],
            }}
            onBarcodeScanned={(res) => handleScan(res.data)}
          />
        ) : (
          <View style={styles.permBox}>
            <Text style={styles.permEmoji}>▦</Text>
            <Text style={styles.permTitle}>Camera access needed</Text>
            <Text style={styles.permBody}>
              StuffKeep scans barcodes and serial numbers so your claim records are exact.
            </Text>
            <View style={{ marginTop: 16 }}>
              <PillButton theme={theme} label="Allow camera" onPress={requestPermission} />
            </View>
          </View>
        )}
        {permission?.granted && (
          <View style={styles.overlay} pointerEvents="none">
            <View style={styles.frame} />
            <Text style={styles.overlayText}>Point at a barcode</Text>
          </View>
        )}
        <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  frame: {
    width: 250,
    height: 150,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  overlayText: { color: 'rgba(255,255,255,0.85)', marginTop: 14, fontSize: 15 },
  closeBtn: {
    position: 'absolute',
    top: 64,
    right: 24,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: '#FFF', fontSize: 16, fontWeight: fonts.weight.bold },
  permBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  permEmoji: { fontSize: 40, color: '#FFF', marginBottom: 10 },
  permTitle: { color: '#FFF', fontSize: 20, fontWeight: fonts.weight.bold },
  permBody: { color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center', marginTop: 8 },
});
