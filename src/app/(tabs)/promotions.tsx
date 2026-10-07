import { useState, useCallback } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from 'react-native';

import {
  Button,
  ChipRow,
  EmptyState,
  Notice,
  Screen,
  ScreenHeader,
  SearchField,
} from '../../components/ui';
import { StoreSelector } from '../../components/StoreSelector';
import { OfferCard } from '../../components/OfferCard';
import { LoyaltyCard } from '../../components/LoyaltyCard';
import { usePromotions } from '../../context/PromotionsContext';
import { useCart } from '../../context/CartContext';
import { colors, spacing, typography } from '../../theme/tokens';

const ALL = 'Todos';

export default function PromotionsScreen() {
  const router = useRouter();
  const { offerId } = useLocalSearchParams<{ offerId?: string }>();
  const { offers, loading, error, refresh } = usePromotions();
  const { refreshPrices } = useCart();
  const [category, setCategory] = useState(ALL);
  const [query, setQuery] = useState('');
  useFocusEffect(
    useCallback(() => {
      void refresh();
      void refreshPrices();
    }, [refresh, refreshPrices]),
  );
  const categories = [ALL, ...new Set(offers.map((o) => o.product.category))];
  const selectedOffer = offers.find((o) => o.id === offerId);
  const filtered = offers.filter(
    (o) =>
      (category === ALL || o.product.category === category) &&
      `${o.label} ${o.product.name}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <Screen
      header={
        <ScreenHeader
          title="Ofertas e cupons"
          subtitle="Ofertas da loja entram sozinhas; as do clube você ativa."
        />
      }
      refreshControl={
        <RefreshControl
          refreshing={loading}
          tintColor={colors.brand}
          onRefresh={() => {
            void refresh();
            void refreshPrices();
          }}
        />
      }
    >
      <StoreSelector />
      {offerId ? (
        <View style={styles.highlight}>
          <Text style={styles.sectionLabel}>Oferta do aviso</Text>
          {selectedOffer ? (
            <OfferCard offer={selectedOffer} />
          ) : !loading && !error ? (
            <Notice message="Essa oferta não está mais disponível na loja selecionada." />
          ) : null}
          <Button
            label="Ver todas as ofertas"
            variant="secondary"
            onPress={() => router.setParams({ offerId: '' })}
          />
        </View>
      ) : null}
      <SearchField placeholder="Buscar ofertas" value={query} onChangeText={setQuery} />
      {categories.length > 2 ? (
        <ChipRow options={categories} value={category} onChange={setCategory} />
      ) : null}
      <LoyaltyCard />
      {error ? (
        <Notice
          tone="error"
          title="Não foi possível carregar as ofertas"
          message={error}
          actionLabel="Tentar novamente"
          onAction={() => void refresh()}
        />
      ) : null}
      {loading && !offers.length ? <ActivityIndicator color={colors.brand} /> : null}
      {!loading && !error && !filtered.length ? (
        <EmptyState
          emoji="🏷️"
          title="Nenhuma oferta encontrada"
          subtitle="Troque a loja, a categoria ou limpe a busca."
        />
      ) : null}
      {filtered
        .filter((o) => o.id !== selectedOffer?.id)
        .map((o) => (
          <OfferCard key={o.id} offer={o} />
        ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  highlight: { gap: spacing.sm },
  sectionLabel: { ...typography.small, fontWeight: '700', color: colors.textMuted },
});
