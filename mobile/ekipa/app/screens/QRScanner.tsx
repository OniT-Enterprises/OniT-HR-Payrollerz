/**
 * QRScanner — full-screen barcode scanner for crew badge scanning
 * Scans QR/barcode, matches against worker list, adds to selection
 */
import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { X, Check, AlertCircle } from 'lucide-react-native';
import { colors } from '../../lib/colors';
import { useT } from '../../lib/i18n';
import { useCrewStore } from '../../stores/crewStore';

export default function QRScannerScreen() {
  const t = useT();
  const router = useRouter();
  const addWorkerByQR = useCrewStore((s) => s.addWorkerByQR);
  const [permission, requestPermission] = useCameraPermissions();
  const [lastScan, setLastScan] = useState<{ found: boolean; name?: string } | null>(null);
  const [scanning, setScanning] = useState(true);

  const handleBarCodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (!scanning) return;
      setScanning(false);

      const result = addWorkerByQR(data);
      setLastScan(result);

      if (result.found) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }

      // Allow next scan after 2s
      setTimeout(() => {
        setScanning(true);
        setLastScan(null);
      }, 2000);
    },
    [scanning, addWorkerByQR]
  );

  if (!permission?.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permText}>{t('crew.cameraRequired')}</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>{t('crew.enableCamera')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'code39', 'ean13'] }}
        onBarcodeScanned={scanning ? handleBarCodeScanned : undefined}
      >
        {/* Overlay */}
        <View style={styles.overlay}>
          {/* Top bar */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
              <X size={24} color="#fff" strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.topTitle}>{t('crew.scanBadge')}</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Scan frame */}
          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />
          </View>

          {/* Result flash */}
          {lastScan && (
            <View
              style={[
                styles.resultBadge,
                lastScan.found ? styles.resultSuccess : styles.resultError,
              ]}
            >
              {lastScan.found ? (
                <>
                  <Check size={18} color="#fff" strokeWidth={2.5} />
                  <Text style={styles.resultText}>{lastScan.name}</Text>
                </>
              ) : (
                <>
                  <AlertCircle size={18} color="#fff" strokeWidth={2} />
                  <Text style={styles.resultText}>{t('crew.workerNotFound')}</Text>
                </>
              )}
            </View>
          )}

          {/* Hint */}
          <Text style={styles.hint}>{t('crew.scanHint')}</Text>
        </View>
      </CameraView>
    </View>
  );
}

const CORNER_SIZE = 24;
const CORNER_BORDER = 3;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    paddingBottom: 60,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 16,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 20,
  },
  topTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  scanFrame: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: CORNER_SIZE,
    height: CORNER_SIZE,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_BORDER,
    borderLeftWidth: CORNER_BORDER,
    borderColor: colors.primary,
    borderTopLeftRadius: 8,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_BORDER,
    borderRightWidth: CORNER_BORDER,
    borderColor: colors.primary,
    borderTopRightRadius: 8,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_BORDER,
    borderLeftWidth: CORNER_BORDER,
    borderColor: colors.primary,
    borderBottomLeftRadius: 8,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_BORDER,
    borderRightWidth: CORNER_BORDER,
    borderColor: colors.primary,
    borderBottomRightRadius: 8,
  },
  resultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  resultSuccess: {
    backgroundColor: 'rgba(22, 163, 74, 0.9)',
  },
  resultError: {
    backgroundColor: 'rgba(220, 38, 38, 0.9)',
  },
  resultText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  hint: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    padding: 40,
    gap: 16,
  },
  permText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  permBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  permBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
