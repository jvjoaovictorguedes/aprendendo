import { useIsFocused, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';

import { Button } from '../components/ui';
import { useBudget } from '../context/BudgetContext';
import { useCart } from '../context/CartContext';
import { useLists } from '../context/ListsContext';
import { usePromotions } from '../context/PromotionsContext';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { computeCartTotals, formatBRL } from '../utils/pricing';

const SCAN_COOLDOWN_MS = 1200;
const BUDGET_WARNING_THRESHOLD = 0.9;

type Feedback =
  | { type: 'checking' }
  | { type: 'added'; barcode: string; name: string; price: string; fromList?: string; offline?: boolean }
  | { type: 'not_found'; barcode: string; offline?: boolean };

export default function ComprarScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const { items, addByBarcode, decrementItem } = useCart();
  const { extraPercentOffFor } = usePromotions();
  const { markBoughtByBarcode, activeListId, lists } = useLists();
  const { limit } = useBudget();
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const lockRef = useRef(false);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totals = computeCartTotals(items, extraPercentOffFor);
  const activeList = lists.find((list) => list.id === activeListId);

  const clearFeedbackLater = useCallback(() => {
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = setTimeout(() => {
      lockRef.current = false;
      setFeedback(null);
    }, SCAN_COOLDOWN_MS);
  }, []);

  const handleScanned = useCallback(
    async (result: BarcodeScanningResult) => {
      if (lockRef.current) return;
      lockRef.current = true;
      setFeedback({ type: 'checking' });

      const outcome = await addByBarcode(result.data);

      if (outcome.status === 'added') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        const listMatch = markBoughtByBarcode(result.data);
        setFeedback({
          type: 'added',
          barcode: result.data,
          name: outcome.product.name,
          price: formatBRL(outcome.product.price),
          fromList: listMatch?.listName,
          offline: outcome.source === 'mock',
        });
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        setFeedback({
          type: 'not_found',
          barcode: outcome.barcode,
          offline: outcome.source === 'mock',
        });
      }

      clearFeedbackLater();
    },
    [addByBarcode, markBoughtByBarcode, clearFeedbackLater],
  );

  const handleUndo = useCallback(() => {
    if (feedback?.type !== 'added') return;
    decrementItem(feedback.barcode);
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    lockRef.current = false;
    setFeedback(null);
  }, [feedback, decrementItem]);

  const budgetRemaining = limit != null ? limit - totals.finalTotal : null;
  const isNearBudget =
    limit != null && budgetRemaining != null && totals.finalTotal / limit >= BUDGET_WARNING_THRESHOLD;

  if (!permission) {
    return <View style={styles.center} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionEmoji}>📷</Text>
        <Text style={styles.permissionTitle}>Câmera necessária</Text>
        <Text style={styles.permissionText}>
          Para bipar os produtos, o ScanMercado precisa acessar a câmera do seu celular.
        </Text>
        <Button label="Permitir acesso à câmera" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        active={isFocused}
        onBarcodeScanned={isFocused ? handleScanned : undefined}
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'],
        }}
      >
        <View style={styles.scanFrame} />
      </CameraView>

      {activeList ? (
        <View style={styles.listBanner}>
          <Text style={styles.listBannerText}>📋 Comprando a partir de &quot;{activeList.name}&quot;</Text>
        </View>
      ) : null}

      {feedback ? (
        <View
          style={[styles.feedbackBanner, feedback.type === 'not_found' && styles.feedbackBannerError]}
        >
          {feedback.type === 'checking' ? (
            <Text style={styles.feedbackTitle}>Verificando produto…</Text>
          ) : feedback.type === 'added' ? (
            <>
              <Text style={styles.feedbackTitle}>✓ Produto adicionado</Text>
              <Text style={styles.feedbackName}>{feedback.name}</Text>
              <View style={styles.feedbackRow}>
                <Text style={styles.feedbackPrice}>{feedback.price}</Text>
                <TouchableOpacity onPress={handleUndo} hitSlop={8}>
                  <Text style={styles.feedbackUndo}>Desfazer</Text>
                </TouchableOpacity>
              </View>
              {feedback.fromList ? (
                <Text style={styles.feedbackListMatch}>✓ Item da sua lista</Text>
              ) : null}
              {feedback.offline ? (
                <Text style={styles.feedbackOffline}>⚠ Catálogo local (sem conexão com o servidor)</Text>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.feedbackTitle}>Produto não cadastrado ({feedback.barcode})</Text>
              <Text style={styles.feedbackOffline}>
                {feedback.offline
                  ? '⚠ Buscado no catálogo local — Supabase não conectado'
                  : '✓ Verificado no Supabase, código não existe na tabela products'}
              </Text>
            </>
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
          {limit != null ? (
            <Text style={[styles.budgetText, isNearBudget && styles.budgetTextWarning]}>
              {budgetRemaining != null && budgetRemaining >= 0
                ? `Restam ${formatBRL(budgetRemaining)} do seu orçamento`
                : 'Você passou do seu orçamento'}
            </Text>
          ) : null}
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
    borderColor: colors.brand,
    borderRadius: radius.lg,
    backgroundColor: 'transparent',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  permissionEmoji: { fontSize: 40, marginBottom: spacing.sm },
  permissionTitle: { ...typography.h1, color: colors.text },
  permissionText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  listBanner: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.overlay,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  listBannerText: { color: '#fff', ...typography.small },
  hintBanner: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.overlay,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  hintText: { color: '#fff', ...typography.caption },
  feedbackBanner: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  feedbackBannerError: { backgroundColor: colors.danger },
  feedbackTitle: { color: '#fff', fontWeight: '700', fontSize: 15 },
  feedbackName: { color: '#fff', ...typography.h2, marginTop: 2 },
  feedbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  feedbackPrice: { color: '#fff', ...typography.bodyStrong },
  feedbackUndo: { color: '#fff', ...typography.caption, textDecorationLine: 'underline' },
  feedbackListMatch: { color: '#fff', ...typography.small, marginTop: spacing.xs, fontWeight: '700' },
  feedbackOffline: { color: '#fff', ...typography.small, marginTop: spacing.xs, opacity: 0.85 },
  totalBar: {
    backgroundColor: colors.surface,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalBarLabel: { ...typography.caption, color: colors.textMuted },
  totalBarValue: { ...typography.h1, color: colors.text },
  totalBarAction: { ...typography.bodyStrong, color: colors.brand },
  budgetText: { ...typography.small, color: colors.textMuted, marginTop: 2 },
  budgetTextWarning: { color: colors.warning, fontWeight: '700' },
});
