import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { isApiConfigured } from '../services/api';
import {
  defaultLoyalty,
  fetchLoyalty,
  listRewards,
  redeemPoints,
  Loyalty,
  Reward,
} from '../services/offers';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { Badge, Button, Card, Notice } from './ui';
export function LoyaltyCard() {
  const { user, token, refreshUser } = useAuth();
  const [rule, setRule] = useState<Loyalty>(defaultLoyalty),
    [rewards, setRewards] = useState<Reward[]>([]);
  const [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false);
  const requestKey = useRef<string | null>(null);
  const reload = useCallback(async () => {
    if (!isApiConfigured) return;
    try {
      const [l, r] = await Promise.all([
        fetchLoyalty(),
        token ? listRewards(token) : Promise.resolve([]),
        refreshUser(),
      ]);
      setRule(l);
      setRewards(r);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Benefícios indisponíveis.');
    }
  }, [token, refreshUser]);
  useFocusEffect(
    useCallback(() => {
      void reload();
      setConfirm(false);
    }, [reload]),
  );
  async function redeem() {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      requestKey.current ??= `reward-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      await redeemPoints(token, requestKey.current);
      requestKey.current = null;
      setConfirm(false);
      await refreshUser();
      await reload();
    } catch (e) {
      await reload();
      setError(
        e instanceof Error
          ? e.message
          : 'Falha no resgate. Confira os benefícios emitidos antes de tentar novamente.',
      );
    } finally {
      setBusy(false);
    }
  }
  if (!user) return null;
  const remaining = Math.max(0, rule.pointsRequired - user.points);
  const progress = rule.pointsRequired > 0 ? Math.min(100, (user.points / rule.pointsRequired) * 100) : 0;
  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.label}>Seus pontos</Text>
          <Text style={styles.points}>{user.points} pts</Text>
        </View>
        {rule.enabled && !remaining ? <Badge label="Recompensa liberada" variant="brand" /> : null}
      </View>
      {error ? (
        <Notice
          tone="error"
          message={error}
          actionLabel="Atualizar benefícios"
          onAction={() => void reload()}
        />
      ) : null}
      {rule.enabled ? (
        <>
          <Text style={styles.reward}>
            {rule.rewardName} · {rule.pointsRequired} pontos
          </Text>
          <View style={styles.track}>
            <View style={[styles.bar, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.muted}>
            {remaining
              ? `Faltam ${remaining} pontos para esta recompensa.`
              : 'Você já pode trocar seus pontos por este benefício.'}
          </Text>
          <Text style={styles.small}>
            Cada R$ 1 em compras confirmadas pelo mercado gera {rule.pointsPerReal} ponto(s).
            {rule.conditions ? ` ${rule.conditions}` : ''}
          </Text>
          {confirm ? (
            <Notice
              tone="warning"
              title="Confirmar troca?"
              message={`Serão descontados ${rule.pointsRequired} pontos e você recebe um código para apresentar na loja.`}
            />
          ) : null}
          {confirm ? (
            <View style={styles.row}>
              <Button
                label="Cancelar"
                variant="secondary"
                onPress={() => {
                  setConfirm(false);
                  requestKey.current = null;
                }}
                disabled={busy}
                style={styles.flex}
              />
              <Button
                label="Confirmar"
                onPress={() => void redeem()}
                loading={busy}
                style={styles.flex}
              />
            </View>
          ) : (
            <Button
              label="Trocar pontos"
              variant={remaining > 0 ? 'secondary' : 'primary'}
              onPress={() => setConfirm(true)}
              disabled={remaining > 0 || busy || !token || !!error}
            />
          )}
        </>
      ) : (
        <Text style={styles.muted}>
          O mercado ainda não configurou uma recompensa por pontos. As ofertas do clube podem ser
          ativadas separadamente.
        </Text>
      )}
      <Text style={styles.small}>
        O scanner é uma prévia: os pontos dependem da confirmação da compra pelo mercado.
      </Text>
      {rewards.map((r) => (
        <View key={r.id} style={styles.rewardItem}>
          <View style={styles.rewardHeader}>
            <Text style={styles.rewardName}>{r.rewardName}</Text>
            <Badge
              label={r.redeemedAt ? 'Utilizado' : 'Disponível'}
              variant={r.redeemedAt ? 'neutral' : 'brand'}
            />
          </View>
          {!r.redeemedAt ? <Text style={styles.small}>Apresente este código na loja:</Text> : null}
          <Text selectable style={styles.code}>
            {r.id}
          </Text>
          {r.conditions ? <Text style={styles.small}>{r.conditions}</Text> : null}
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { ...typography.small, color: colors.textMuted },
  points: { ...typography.h1, color: colors.text },
  reward: { ...typography.bodyStrong, color: colors.text },
  track: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceSunken,
    overflow: 'hidden',
  },
  bar: { height: 8, borderRadius: radius.pill, backgroundColor: colors.brand },
  muted: { ...typography.caption, color: colors.textMuted },
  small: { ...typography.small, color: colors.textMuted, lineHeight: 17 },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  rewardItem: {
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.brandSoft,
    gap: 4,
  },
  rewardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rewardName: { ...typography.bodyStrong, color: colors.text, flexShrink: 1 },
  code: { ...typography.bodyStrong, color: colors.brandDark, letterSpacing: 0.5 },
});
