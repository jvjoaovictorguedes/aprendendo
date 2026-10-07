import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button } from '../../components/ui';
import { StoreSelector } from '../../components/StoreSelector';
import { OfferCard } from '../../components/OfferCard';
import { LoyaltyCard } from '../../components/LoyaltyCard';
import { usePromotions } from '../../context/PromotionsContext';
import { useCart } from '../../context/CartContext';
import { colors, radius, spacing, typography } from '../../theme/tokens';
export default function PromotionsScreen() {
  const { offers, loading, error, refresh } = usePromotions();
  const { refreshPrices } = useCart();
  const [category, setCategory] = useState('Todos'),
    [query, setQuery] = useState('');
  useFocusEffect(
    useCallback(() => {
      void refresh();
      void refreshPrices();
    }, [refresh, refreshPrices]),
  );
  const categories = ['Todos', ...new Set(offers.map((o) => o.product.category))];
  const filtered = offers.filter(
    (o) =>
      (category === 'Todos' || o.product.category === category) &&
      `${o.label} ${o.product.name}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => {
            void refresh();
            void refreshPrices();
          }}
        />
      }
    >
      <Text style={styles.title}>Ofertas e cupons</Text>
      <Text style={styles.caption}>
        Veja as condições e ative os benefícios do clube. O carrinho atualiza mesmo depois de
        escanear.
      </Text>
      <StoreSelector />
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Buscar ofertas"
        accessibilityLabel="Buscar ofertas"
        style={styles.search}
      />
      <View style={styles.categories}>
        {categories.map((c) => (
          <TouchableOpacity
            key={c}
            onPress={() => setCategory(c)}
            accessibilityRole="button"
            accessibilityState={{ selected: c === category }}
            style={[styles.chip, c === category && { backgroundColor: colors.brandSoft }]}
          >
            <Text style={{ color: colors.text }}>{c}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <LoyaltyCard />
      {error ? (
        <View>
          <Text style={{ color: colors.danger }}>{error}</Text>
          <Button label="Tentar novamente" onPress={() => void refresh()} disabled={loading} />
        </View>
      ) : null}
      {loading ? <ActivityIndicator color={colors.brand} /> : null}
      {!loading && !error && !filtered.length ? (
        <Text style={styles.caption}>
          Nenhuma oferta encontrada. Você pode trocar a loja ou limpar a busca.
        </Text>
      ) : null}
      {filtered.map((o) => (
        <OfferCard key={o.id} offer={o} />
      ))}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surfaceAlt },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  title: { ...typography.h1, color: colors.text },
  caption: { ...typography.caption, color: colors.textMuted },
  search: {
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    padding: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
});
