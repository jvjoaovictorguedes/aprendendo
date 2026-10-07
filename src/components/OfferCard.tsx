import { useState } from 'react';
import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card } from './ui';
import { useAuth } from '../context/AuthContext';
import { usePromotions } from '../context/PromotionsContext';
import { useLists } from '../context/ListsContext';
import { Offer } from '../services/offers';
import { offerConditions, offerPromotion } from '../utils/offers';
import { computeLineTotal, formatBRL } from '../utils/pricing';
import { colors, spacing, typography } from '../theme/tokens';
export function OfferCard({ offer: o }: { offer: Offer }) {
  const { user } = useAuth();
  const router = useRouter();
  const { isActivated, toggleActivation, pendingId } = usePromotions();
  const { lists, activeListId, createList, addItem, setActiveListId } = useLists();
  const [message, setMessage] = useState('');
  const club = o.audience === 'club',
    active = isActivated(o.id);
  const quantity = o.kind === 'buy_x_pay_y' ? (o.buy ?? 1) : 1;
  const line = computeLineTotal({
    product: { ...o.product, promotion: offerPromotion(o) },
    quantity,
  });
  function add() {
    const list =
      lists.find((l) => l.id === activeListId) ?? lists[0] ?? createList('Ofertas para comprar');
    if (!list.items.some((i) => i.barcode === o.product.barcode))
      addItem(list.id, o.product.name, o.product.barcode);
    setActiveListId(list.id);
    setMessage(`Na lista: ${list.name}`);
  }
  return (
    <Card style={{ gap: spacing.sm, marginTop: spacing.sm }}>
      <Text style={{ ...typography.small, color: colors.brandDark }}>
        {club ? 'EXCLUSIVA DO CLUBE' : 'OFERTA DA LOJA'}
      </Text>
      <Text style={{ ...typography.h2, color: colors.text }}>{o.product.name}</Text>
      <Text style={{ ...typography.bodyStrong, color: colors.brandDark }}>{o.label}</Text>
      {club ? (
        <Text style={{ ...typography.h2, color: colors.text }}>{o.percent}% de desconto extra</Text>
      ) : (
        <View>
          <Text style={{ ...typography.caption, color: colors.textMuted }}>
            Preço normal: {formatBRL(o.product.price)}/{o.product.unit}
          </Text>
          <Text style={{ ...typography.h2, color: colors.text }}>
            {formatBRL(line.finalTotal)}
            {o.kind === 'buy_x_pay_y' ? ` por ${quantity} unidades` : `/${o.product.unit}`}
          </Text>
        </View>
      )}
      <Text style={{ ...typography.caption, color: colors.textMuted }}>{offerConditions(o)}</Text>
      {club ? (
        <Button
          label={
            !user
              ? 'Entrar para ativar'
              : pendingId === o.id
                ? 'Atualizando…'
                : active
                  ? 'Ativada ✓ · Desativar'
                  : 'Ativar desconto'
          }
          variant={active ? 'secondary' : 'primary'}
          disabled={!!pendingId}
          onPress={() => (user ? void toggleActivation(o.id) : router.push('/profile'))}
        />
      ) : null}
      <Button label="Adicionar à lista" variant="ghost" onPress={add} />
      {message ? (
        <Text accessibilityLiveRegion="polite" style={{ color: colors.brandDark }}>
          {message}
        </Text>
      ) : null}
    </Card>
  );
}
