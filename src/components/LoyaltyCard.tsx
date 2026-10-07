import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Text, View } from 'react-native';
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
import { colors, spacing, typography } from '../theme/tokens';
import { Button, Card } from './ui';
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
  return (
    <Card style={{ marginTop: spacing.sm, gap: spacing.sm }}>
      <Text style={{ ...typography.h2, color: colors.text }}>{user.points} pontos</Text>
      {error ? (
        <>
          <Text style={{ color: colors.danger }}>{error}</Text>
          <Button label="Atualizar benefícios" variant="ghost" onPress={() => void reload()} />
        </>
      ) : null}
      {rule.enabled ? (
        <>
          <Text style={{ ...typography.bodyStrong, color: colors.text }}>
            {rule.rewardName} · {rule.pointsRequired} pontos
          </Text>
          <Text style={{ color: colors.textMuted }}>
            {remaining
              ? `Faltam ${remaining} pontos para esta recompensa.`
              : 'Você já pode trocar seus pontos por este benefício.'}
          </Text>
          <View style={{ height: 8, backgroundColor: colors.surfaceAlt }}>
            <View
              style={{
                height: 8,
                width: `${Math.min(100, (user.points / rule.pointsRequired) * 100)}%`,
                backgroundColor: colors.brand,
              }}
            />
          </View>
          <Text style={{ ...typography.caption, color: colors.textMuted }}>
            Cada R$ 1 em compras confirmadas pelo mercado gera {rule.pointsPerReal} ponto(s).{' '}
            {rule.conditions}
          </Text>
          {confirm ? (
            <>
              <Text>
                A troca desconta {rule.pointsRequired} pontos da sua conta e gera um código para
                apresentar na loja. Confirmar?
              </Text>
              <Button
                label={busy ? 'Emitindo…' : 'Confirmar troca'}
                onPress={() => void redeem()}
                disabled={busy}
              />
              <Button
                label="Cancelar"
                variant="ghost"
                onPress={() => {
                  setConfirm(false);
                  requestKey.current = null;
                }}
                disabled={busy}
              />
            </>
          ) : (
            <Button
              label="Trocar pontos"
              onPress={() => setConfirm(true)}
              disabled={remaining > 0 || busy || !token || !!error}
            />
          )}
        </>
      ) : (
        <Text style={{ ...typography.caption, color: colors.textMuted }}>
          O mercado ainda não configurou uma recompensa por pontos. As ofertas do clube podem ser
          ativadas separadamente.
        </Text>
      )}
      <Text style={{ ...typography.small, color: colors.textMuted }}>
        O scanner é uma prévia: pontos de compras dependem da confirmação do mercado no caixa.
      </Text>
      {rewards.map((r) => (
        <View
          key={r.id}
          style={{
            padding: spacing.sm,
            backgroundColor: colors.brandSoft,
            gap: 4,
          }}
        >
          <Text style={{ ...typography.bodyStrong, color: colors.text }}>
            {r.rewardName} · {r.redeemedAt ? 'Utilizado' : 'Apresente este código na loja'}
          </Text>
          <Text selectable style={{ ...typography.small, color: colors.text }}>
            {r.id}
          </Text>
          <Text style={{ ...typography.caption, color: colors.textMuted }}>{r.conditions}</Text>
        </View>
      ))}
    </Card>
  );
}
