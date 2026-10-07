import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  Notice,
  Screen,
  ScreenHeader,
} from '../../components/ui';
import { useStore } from '../../context/StoreContext';
import { useCart } from '../../context/CartContext';
import { colors, radius, spacing, typography } from '../../theme/tokens';

export default function StoresScreen() {
  const { stores, storeId, selectStore, loading, error, reload } = useStore();
  const { items, clearCart } = useCart();
  const [pending, setPending] = useState<{ id: string | null } | null>(null);
  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );
  function choose(id: string | null) {
    if (id === storeId) return;
    if (items.length) {
      setPending({ id });
      return;
    }
    selectStore(id);
  }
  return (
    <Screen
      header={
        <ScreenHeader
          title="Lojas"
          subtitle="A loja escolhida define as ofertas e os preços."
          back
        />
      }
    >
      {pending ? (
        <Card style={styles.stack}>
          <Notice
            tone="warning"
            title="Trocar de loja limpa o carrinho"
            message="Assim não se misturam preços e benefícios de lojas diferentes."
          />
          <View style={styles.row}>
            <Button
              label="Manter loja"
              variant="secondary"
              onPress={() => setPending(null)}
              style={styles.flex}
            />
            <Button
              label="Limpar e trocar"
              onPress={() => {
                clearCart();
                selectStore(pending.id);
                setPending(null);
              }}
              style={styles.flex}
            />
          </View>
        </Card>
      ) : null}

      <StoreOption
        title="Toda a rede"
        subtitle="Só ofertas válidas em todas as lojas."
        selected={!storeId}
        onSelect={() => choose(null)}
      />

      {loading && !stores.length ? <ActivityIndicator color={colors.brand} /> : null}
      {error ? (
        <Notice
          tone="error"
          title="Não foi possível carregar as lojas"
          message={error}
          actionLabel="Tentar novamente"
          onAction={() => void reload()}
        />
      ) : null}
      {!loading && !error && !stores.length ? (
        <EmptyState
          emoji="🏬"
          title="Nenhuma loja cadastrada"
          subtitle="As ofertas gerais continuam disponíveis."
        />
      ) : null}
      {stores.map((s) => (
        <StoreOption
          key={s.id}
          title={s.name}
          subtitle={[s.address, s.hours].filter(Boolean).join(' · ')}
          selected={storeId === s.id}
          onSelect={() => choose(s.id)}
          onRoute={
            s.address
              ? () =>
                  void Linking.openURL(
                    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address!)}`,
                  )
              : undefined
          }
        />
      ))}
    </Screen>
  );
}

function StoreOption({
  title,
  subtitle,
  selected,
  onSelect,
  onRoute,
}: {
  title: string;
  subtitle?: string;
  selected: boolean;
  onSelect: () => void;
  onRoute?: () => void;
}) {
  return (
    <Card style={[styles.stack, selected && styles.selected]}>
      <View style={styles.optionHeader}>
        <View style={styles.iconWrap}>
          <Icon name="map-pin" size={18} color={colors.brandDark} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {selected ? <Badge label="Selecionada" variant="brand" /> : null}
      </View>
      {!selected || onRoute ? (
        <View style={styles.row}>
          {onRoute ? (
            <Button label="Ver rota" variant="secondary" onPress={onRoute} style={styles.flex} />
          ) : null}
          {!selected ? (
            <Button label="Escolher" onPress={onSelect} style={styles.flex} />
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  selected: { borderWidth: 2, borderColor: colors.brand },
  optionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.bodyStrong, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
});
