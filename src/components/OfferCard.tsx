import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Badge, Button, Card } from './ui';
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
  const { isActivated, toggleActivation, pendingId, actionError } = usePromotions();
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
    <Card style={styles.card}>
      <Badge label={club ? 'Exclusiva do clube' : 'Oferta da loja'} variant={club ? 'brand' : 'danger'} />
      <View>
        <Text style={styles.name}>{o.product.name}</Text>
        <Text style={styles.label}>{o.label}</Text>
      </View>
      {club ? (
        <Text style={styles.price}>{o.percent}% de desconto extra</Text>
      ) : (
        <View>
          <Text style={styles.price}>
            {formatBRL(line.finalTotal)}
            <Text style={styles.priceUnit}>
              {o.kind === 'buy_x_pay_y' ? ` por ${quantity} unidades` : `/${o.product.unit}`}
            </Text>
          </Text>
          <Text style={styles.original}>
            Preço normal: {formatBRL(o.product.price)}/{o.product.unit}
          </Text>
        </View>
      )}
      <Text style={styles.conditions}>{offerConditions(o)}</Text>
      {club && actionError?.offerId === o.id ? (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {actionError.message}
        </Text>
      ) : null}
      <View style={styles.actions}>
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
            style={styles.actionMain}
          />
        ) : null}
        <Button
          label={message ? 'Na lista ✓' : 'Adicionar à lista'}
          variant={club ? 'ghost' : 'secondary'}
          onPress={add}
          style={club ? undefined : styles.actionMain}
        />
      </View>
      {message ? (
        <Text accessibilityLiveRegion="polite" style={styles.message}>
          {message}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  name: { ...typography.h2, color: colors.text },
  label: { ...typography.bodyStrong, color: colors.brandDark, marginTop: 2 },
  price: { ...typography.h2, color: colors.text },
  priceUnit: { ...typography.caption, color: colors.textMuted },
  original: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  conditions: { ...typography.small, color: colors.textMuted, lineHeight: 17 },
  error: { ...typography.caption, color: colors.danger },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  actionMain: { flex: 1 },
  message: { ...typography.caption, color: colors.brandDark },
});
