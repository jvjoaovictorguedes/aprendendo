import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';

import { useCart } from '../context/CartContext';
import { usePromotions } from '../context/PromotionsContext';
import { computeCartTotals, formatBRL } from '../utils/pricing';

const SCAN_COOLDOWN_MS = 1500;

type Feedback = { type: 'added'; name: string; price: string } | { type: 'not_found'; barcode: string };

export default function ScannerScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const { items, addByBarcode } = useCart();
  const { extraPercentOffFor } = usePromotions();
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const lockRef = useRef(false);

  const totals = computeCartTotals(items, extraPercentOffFor);

  const handleScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (lockRef.current) return;
      lockRef.current = true;

      const outcome = addByBarcode(result.data);
      if (outcome.status === 'added') {
        setFeedback({
          type: 'added',
          name: outcome.product.name,
          price: formatBRL(outcome.product.price),
        });
      } else {
        setFeedback({ type: 'not_found', barcode: outcome.barcode });
      }

      setTimeout(() => {
        lockRef.current = false;
        setFeedback(null);
      }, SCAN_COOLDOWN_MS);
    },
    [addByBarcode],
  );

  if (!permission) {
    return <View style={styles.center} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionText}>
          Para bipar os produtos, o ScanMercado precisa acessar a câmera do seu celular.
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={requestPermission}>
          <Text style={styles.primaryButtonText}>Permitir acesso à câmera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={handleScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'],
        }}
      >
        <View style={styles.scanFrame} />
      </CameraView>

      {feedback ? (
        <View
          style={[
            styles.feedbackBanner,
            feedback.type === 'not_found' && styles.feedbackBannerError,
          ]}
        >
          {feedback.type === 'added' ? (
            <>
              <Text style={styles.feedbackTitle}>✓ {feedback.name}</Text>
              <Text style={styles.feedbackSubtitle}>{feedback.price} adicionado ao carrinho</Text>
            </>
          ) : (
            <Text style={styles.feedbackTitle}>Produto não cadastrado ({feedback.barcode})</Text>
          )}
        </View>
      ) : (
        <View style={styles.hintBanner}>
          <Text style={styles.hintText}>Aponte a câmera para o código de barras</Text>
        </View>
      )}

      <TouchableOpacity style={styles.totalBar} onPress={() => router.push('/cart')}>
        <View>
          <Text style={styles.totalBarLabel}>{totals.itemCount} item(ns) escaneado(s)</Text>
          <Text style={styles.totalBarValue}>{formatBRL(totals.finalTotal)}</Text>
        </View>
        <Text style={styles.totalBarAction}>Ver carrinho ›</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scanFrame: {
    width: 260,
    height: 160,
    borderWidth: 3,
    borderColor: '#1DB954',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  permissionText: { textAlign: 'center', fontSize: 15, color: '#333', marginBottom: 16 },
  primaryButton: {
    backgroundColor: '#1DB954',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  primaryButtonText: { color: '#fff', fontWeight: '700' },
  hintBanner: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  hintText: { color: '#fff', fontSize: 13 },
  feedbackBanner: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: '#1DB954',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  feedbackBannerError: { backgroundColor: '#C0392B' },
  feedbackTitle: { color: '#fff', fontWeight: '700', fontSize: 15 },
  feedbackSubtitle: { color: '#fff', fontSize: 13, marginTop: 2 },
  totalBar: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalBarLabel: { fontSize: 12, color: '#777' },
  totalBarValue: { fontSize: 20, fontWeight: '700', color: '#1A1A1A' },
  totalBarAction: { fontSize: 14, color: '#1DB954', fontWeight: '600' },
});
