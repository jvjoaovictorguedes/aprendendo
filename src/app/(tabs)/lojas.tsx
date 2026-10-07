import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Linking, ScrollView, Text } from 'react-native';
import { Button, Card } from '../../components/ui';
import { useStore } from '../../context/StoreContext';
import { useCart } from '../../context/CartContext';
import { colors, spacing, typography } from '../../theme/tokens';
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
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfaceAlt }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
    >
      <Text style={{ ...typography.h1, color: colors.text }}>Escolha sua loja</Text>
      <Text style={{ color: colors.textMuted }}>
        A escolha filtra as ofertas. Você pode continuar sem selecionar uma loja.
      </Text>
      {pending ? (
        <Card>
          <Text>
            Trocar de loja limpa o carrinho para não misturar preços e benefícios de lojas
            diferentes.
          </Text>
          <Button
            label="Limpar carrinho e trocar"
            onPress={() => {
              clearCart();
              selectStore(pending.id);
              setPending(null);
            }}
          />
          <Button label="Manter loja atual" variant="ghost" onPress={() => setPending(null)} />
        </Card>
      ) : null}
      <Button
        label={storeId ? 'Ver ofertas de toda a rede' : 'Toda a rede selecionada ✓'}
        variant="secondary"
        onPress={() => choose(null)}
      />
      {loading ? <ActivityIndicator color={colors.brand} /> : null}
      {error ? (
        <>
          <Text style={{ color: colors.danger }}>{error}</Text>
          <Button label="Tentar novamente" onPress={() => void reload()} disabled={loading} />
        </>
      ) : null}
      {!loading && !error && !stores.length ? (
        <Text>Nenhuma loja cadastrada. As ofertas gerais continuam disponíveis.</Text>
      ) : null}
      {stores.map((s) => (
        <Card key={s.id} style={{ gap: spacing.sm }}>
          <Text style={{ ...typography.h2, color: colors.text }}>{s.name}</Text>
          <Text>{s.address}</Text>
          <Text>{s.hours}</Text>
          <Button
            label={storeId === s.id ? 'Loja selecionada ✓' : 'Escolher esta loja'}
            onPress={() => choose(s.id)}
            variant={storeId === s.id ? 'secondary' : 'primary'}
          />
          {s.address ? (
            <Button
              label="Ver rota"
              variant="ghost"
              onPress={() =>
                void Linking.openURL(
                  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address!)}`,
                )
              }
            />
          ) : null}
        </Card>
      ))}
    </ScrollView>
  );
}
