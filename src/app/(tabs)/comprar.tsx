import { useIsFocused, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';

import { StoreSelector } from '../../components/StoreSelector';
import { OfferCard } from '../../components/OfferCard';
import { cartItemKey } from '../../types';
import { Button, Icon } from '../../components/ui';
import { useBudget } from '../../context/BudgetContext';
import { useCart } from '../../context/CartContext';
import { useLists } from '../../context/ListsContext';
import { useNotifications } from '../../context/NotificationsContext';
import { usePromotions } from '../../context/PromotionsContext';
import { useTenantSettings } from '../../context/TenantSettingsContext';
import { brand, colors, radius, spacing, typography } from '../../theme/tokens';
import { computeCartTotals, computeCartLines, formatBRL, formatKg } from '../../utils/pricing';

type Feedback =
  | { type: 'checking' }
  | {
      type: 'added';
      key: string;
      name: string;
      price: string;
      weight?: string;
      fromList?: string;
      offline?: boolean;
    }
  | { type: 'error'; message: string }
  | { type: 'not_found'; barcode: string; offline?: boolean };

export default function ComprarScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const { items, addByBarcode, decrementItem } = useCart();
  const { extraPercentOffFor, offersFor } = usePromotions();
  const [lastKey, setLastKey] = useState<string | null>(null);
  const lastItem = items.find((item) => cartItemKey(item) === lastKey);
  const lastOffers = lastItem ? offersFor(lastItem.product.barcode) : [];
  const lastTotal = lastItem
    ? computeCartLines(items, extraPercentOffFor)[items.indexOf(lastItem)]
    : null;
  const { markBoughtByBarcode, activeListId, lists } = useLists();
  const { limit } = useBudget();
  const { notify } = useNotifications();
  const { scanCooldownMs, budgetWarningPercent } = useTenantSettings();
  const budgetWarningThreshold = budgetWarningPercent / 100;
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const lockRef = useRef(false);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasWarnedRef = useRef(false);
  const hasExceededRef = useRef(false);

  const totals = computeCartTotals(items, extraPercentOffFor);
  const activeList = lists.find((list) => list.id === activeListId);

  useEffect(() => {
    hasWarnedRef.current = false;
    hasExceededRef.current = false;
  }, [limit]);

  useEffect(() => {
    if (limit == null) return;

    if (totals.finalTotal > limit && !hasExceededRef.current) {
      hasExceededRef.current = true;
      notify({
        title: 'Orçamento estourado',
        body: `Sua compra já passou do limite de ${formatBRL(limit)}.`,
        kind: 'budget',
      });
    } else if (totals.finalTotal / limit >= budgetWarningThreshold && !hasWarnedRef.current) {
      hasWarnedRef.current = true;
      notify({
        title: 'Atenção ao orçamento',
        body: `Você já usou ${Math.round((totals.finalTotal / limit) * 100)}% do seu limite de compra.`,
        kind: 'budget',
      });
    }
  }, [totals.finalTotal, limit, notify, budgetWarningThreshold]);

  const clearFeedbackLater = useCallback(() => {
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = setTimeout(() => {
      lockRef.current = false;
      setFeedback(null);
    }, scanCooldownMs);
  }, [scanCooldownMs]);

  useEffect(
    () => () => {
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    },
    [],
  );

  const handleScanned = useCallback(
    async (result: BarcodeScanningResult) => {
      if (lockRef.current) return;
      lockRef.current = true;
      setFeedback({ type: 'checking' });

      const outcome = await addByBarcode(result.data);

      if (outcome.status === 'added') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setLastKey(outcome.key);
        const listMatch = markBoughtByBarcode(outcome.product.barcode);
        setFeedback({
          type: 'added',
          key: outcome.key,
          name: outcome.product.name,
          price: formatBRL(outcome.weighed ? outcome.weighed.labelTotal : outcome.product.price),
          weight: outcome.weighed
            ? formatKg(outcome.weighed.weightKg, outcome.weighed.weightIsEstimated)
            : undefined,
          fromList: listMatch?.listName,
          offline: outcome.source === 'mock',
        });
      } else if (outcome.status === 'error') {
        setFeedback({ type: 'error', message: outcome.message });
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
    decrementItem(feedback.key);
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    lockRef.current = false;
    setFeedback(null);
  }, [feedback, decrementItem]);

  const budgetRemaining = limit != null ? limit - totals.finalTotal : null;
  const isNearBudget =
    limit != null && budgetRemaining != null && totals.finalTotal / limit >= budgetWarningThreshold;

  if (!permission) {
    return <View style={styles.center} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Icon name="camera" size={40} color={colors.brand} />
        <Text style={styles.permissionTitle}>Câmera necessária</Text>
        <Text style={styles.permissionText}>
          Para bipar os produtos, o {brand.name} precisa acessar a câmera do seu celular.
        </Text>
        <Button label="Permitir acesso à câmera" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StoreSelector />
      <View style={styles.cameraArea}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          active={isFocused}
          onBarcodeScanned={isFocused ? handleScanned : undefined}
          barcodeScannerSettings={{
            barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'],
          }}
        />
        <View style={[StyleSheet.absoluteFill, styles.scanFrameWrapper]} pointerEvents="none">
          <View style={styles.scanFrame} />
        </View>
      </View>

      {activeList ? (
        <View style={styles.listBanner}>
          <Text style={styles.listBannerText}>
            📋 Comprando a partir de &quot;{activeList.name}&quot;
          </Text>
        </View>
      ) : null}

      {feedback ? (
        <View
          style={[
            styles.feedbackBanner,
            (feedback.type === 'not_found' || feedback.type === 'error') &&
              styles.feedbackBannerError,
          ]}
        >
          {feedback.type === 'checking' ? (
            <Text style={styles.feedbackTitle}>Verificando produto…</Text>
          ) : feedback.type === 'added' ? (
            <>
              <Text style={styles.feedbackTitle}>✓ Produto adicionado</Text>
              <Text style={styles.feedbackName}>{feedback.name}</Text>
              <View style={styles.feedbackRow}>
                <Text style={styles.feedbackPrice}>
                  {feedback.weight ? `${feedback.weight} · ` : ''}
                  {feedback.price}
                </Text>
                <TouchableOpacity onPress={handleUndo} hitSlop={8}>
                  <Text style={styles.feedbackUndo}>Desfazer</Text>
                </TouchableOpacity>
              </View>
              {feedback.fromList ? (
                <Text style={styles.feedbackListMatch}>✓ Item da sua lista</Text>
              ) : null}
              {feedback.offline ? (
                <Text style={styles.feedbackOffline}>
                  ⚠ Catálogo local (sem conexão com o servidor)
                </Text>
              ) : null}
            </>
          ) : feedback.type === 'error' ? (
            <>
              <Text style={styles.feedbackTitle}>Não foi possível consultar o preço</Text>
              <Text style={styles.feedbackOffline}>{feedback.message} · Escaneie novamente.</Text>
            </>
          ) : (
            <>
              <Text style={styles.feedbackTitle}>Produto não cadastrado ({feedback.barcode})</Text>
              <Text style={styles.feedbackOffline}>
                {feedback.offline
                  ? '⚠ Buscado no catálogo local — sem conexão com o servidor'
                  : '✓ Verificado no catálogo da loja — código não cadastrado'}
              </Text>
            </>
          )}
        </View>
      ) : (
        <View style={styles.hintBanner}>
          <Text style={styles.hintText}>Aponte a câmera para o código de barras</Text>
        </View>
      )}

      {lastItem && lastTotal ? (
        <ScrollView
          style={{ maxHeight: 240, backgroundColor: colors.surface }}
          contentContainerStyle={{ padding: spacing.md }}
        >
          <Text style={{ ...typography.bodyStrong, color: colors.text }}>
            {lastItem.product.name} · {lastItem.quantity} item(ns)
          </Text>
          <Text style={{ color: colors.textMuted }}>
            Normal: {formatBRL(lastTotal.originalTotal)} · Economia: {formatBRL(lastTotal.savings)}
          </Text>
          <Text style={{ ...typography.h2, color: colors.brandDark }}>
            No carrinho: {formatBRL(lastTotal.finalTotal)}
          </Text>
          {lastOffers
            .filter((o) => o.audience === 'club')
            .map((o) => (
              <OfferCard key={o.id} offer={o} />
            ))}
          {lastItem.product.promotion ? (
            <Text style={{ ...typography.caption, color: colors.textMuted }}>
              {lastItem.product.promotion.label} · {lastItem.product.promotion.conditions} ·{' '}
              {lastItem.product.promotion.endsAt
                ? `Até ${new Date(lastItem.product.promotion.endsAt).toLocaleString('pt-BR')}`
                : 'Oferta sem data de encerramento'}
            </Text>
          ) : null}
        </ScrollView>
      ) : null}
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
  cameraArea: { flex: 1 },
  scanFrameWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: 260,
    height: 160,
    borderWidth: 3,
    borderColor: colors.brand,
    borderRadius: radius.xl,
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
  permissionTitle: {
    ...typography.h1,
    color: colors.text,
    marginTop: spacing.sm,
  },
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
  feedbackUndo: {
    color: '#fff',
    ...typography.caption,
    textDecorationLine: 'underline',
  },
  feedbackListMatch: {
    color: '#fff',
    ...typography.small,
    marginTop: spacing.xs,
    fontWeight: '700',
  },
  feedbackOffline: {
    color: '#fff',
    ...typography.small,
    marginTop: spacing.xs,
    opacity: 0.85,
  },
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
