import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { AdminPage, Field, Loading, StatusMessage } from '../../../../components/admin/AdminUI';
import { useTenant } from '../../../../components/admin/tenantOptions';
import { Badge, Button } from '../../../../components/ui';
import { AdminProduct, describeError, listProducts } from '../../../../services/admin';
import { colors, radius, spacing, typography } from '../../../../theme/tokens';
import { formatBRL } from '../../../../utils/pricing';

const SEARCH_DEBOUNCE_MS = 300;

export default function ProductsScreen() {
  const router = useRouter();
  const { tenantId } = useLocalSearchParams<{ tenantId: string }>();
  const { tenant } = useTenant(tenantId);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [products, setProducts] = useState<AdminProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [search]);

  // Recarrega ao voltar da tela de edição.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      listProducts(tenantId, debouncedSearch)
        .then((result) => {
          if (cancelled) return;
          setProducts(result);
          setError(null);
        })
        .catch((err) => {
          if (!cancelled) setError(describeError(err));
        });
      return () => {
        cancelled = true;
      };
    }, [tenantId, debouncedSearch]),
  );

  const openProduct = (productId: string) =>
    router.push({ pathname: '/admin/[tenantId]/produtos/[productId]', params: { tenantId, productId } });

  return (
    <AdminPage
      title="Produtos"
      subtitle={tenant?.name}
      onBack={() => router.push({ pathname: '/admin/[tenantId]', params: { tenantId } })}
      backLabel={tenant?.name ?? 'Franquia'}
      actions={<Button label="Novo produto" onPress={() => openProduct('novo')} />}
    >
      <Field
        label="Buscar"
        value={search}
        onChangeText={setSearch}
        placeholder="Nome, código de barras ou PLU"
        autoCapitalize="none"
      />
      <StatusMessage status={error ? { kind: 'error', message: error } : null} />
      {products === null && !error ? <Loading /> : null}

      {products?.length === 0 ? (
        <Text style={styles.empty}>
          {debouncedSearch ? 'Nenhum produto encontrado.' : 'Nenhum produto cadastrado ainda.'}
        </Text>
      ) : null}

      <View style={styles.list}>
        {(products ?? []).map((product) => (
          <TouchableOpacity key={product.id} style={styles.row} onPress={() => openProduct(product.id)}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.name, !product.active && styles.inactive]}>{product.name}</Text>
              <Text style={styles.meta}>
                {[
                  product.category,
                  product.barcode ? `EAN ${product.barcode}` : null,
                  product.plu ? `PLU ${product.plu}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={styles.price}>
                {formatBRL(product.price)}
                <Text style={styles.meta}>/{product.unit}</Text>
              </Text>
              {!product.active ? <Badge label="Inativo" /> : product.plu ? <Badge label="Balança" variant="brand" /> : null}
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </AdminPage>
  );
}

const styles = StyleSheet.create({
  list: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  name: { ...typography.bodyStrong, color: colors.text },
  inactive: { color: colors.textFaint },
  meta: { ...typography.caption, color: colors.textMuted },
  price: { ...typography.bodyStrong, color: colors.text },
  empty: { ...typography.body, color: colors.textMuted, textAlign: 'center', padding: spacing.xl },
});
