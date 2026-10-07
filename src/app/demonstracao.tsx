import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView, Text, View, StyleSheet } from 'react-native';
import { Button, Card } from '../components/ui';
import { useDemo } from '../context/DemoContext';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { usePromotions } from '../context/PromotionsContext';
import { useNotifications } from '../context/NotificationsContext';
import { apiRequest } from '../services/api';
import { useResetDemoSession } from '../hooks/useResetDemoSession';
import { computeCartTotals, formatBRL } from '../utils/pricing';
import { colors, spacing, typography } from '../theme/tokens';
export default function DemoScreen() {
  const insets = useSafeAreaInsets();
  const demo = useDemo(),
    router = useRouter();
  const { items, addByBarcode } = useCart();
  const { user, token, login } = useAuth();
  const { extraPercentOffFor } = usePromotions();
  const { refreshInbox } = useNotifications();
  const resetSession = useResetDemoSession();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState<string | null>(null),
    [receipt, setReceipt] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState(
    () => `demo-checkout-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const totals = computeCartTotals(items, extraPercentOffFor);
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Tente novamente.');
    } finally {
      setBusy(false);
    }
  }
  if (!demo.enabled)
    return (
      <View style={styles.page}>
        <Text>Esta loja não está em demonstração.</Text>
        <Button label="Voltar ao aplicativo" onPress={() => router.replace('/')} />
      </View>
    );
  return (
    <ScrollView
      contentContainerStyle={[styles.page, { paddingBottom: spacing.xxl + insets.bottom }]}
    >
      <Text style={typography.h1}>Conheça a experiência</Text>
      <Text style={styles.caption}>
        Loja, preços, contas e benefícios fictícios. Nenhum pagamento é realizado. O sistema do
        mercado ainda não está conectado.
      </Text>
      {!demo.toolsEnabled ? (
        <Text>As ferramentas desta apresentação estão desativadas no servidor.</Text>
      ) : null}
      <Card style={styles.card}>
        <Text style={typography.h2}>1. Experiência do cliente</Text>
        <Text style={styles.caption}>
          Entre na conta de exemplo, crie uma lista e ative o desconto do arroz em Ofertas.
        </Text>
        <Button
          label={user ? 'Conta de demonstração conectada' : 'Entrar como cliente de exemplo'}
          disabled={busy || !demo.toolsEnabled || !!user}
          onPress={() =>
            void action(async () => {
              const result = await login(demo.customerCpf!, demo.customerPassword!);
              if (result.status !== 'ok')
                throw new Error(result.message ?? 'Não foi possível entrar.');
            })
          }
        />
        <Button
          label="Ver ofertas e ativar benefício"
          variant="secondary"
          onPress={() => router.push('/promotions')}
        />
      </Card>
      <Card style={styles.card}>
        <Text style={typography.h2}>2. Scanner e etiquetas</Text>
        <Text style={styles.caption}>
          Use a câmera nas etiquetas imprimíveis ou adicione os exemplos abaixo. A carne traz R$
          19,60 na etiqueta; R$ 37,90 é o preço por kg. O peso é estimado.
        </Text>
        {(demo.products ?? [])
          .filter((p) => p.unit === 'un')
          .slice(0, 4)
          .map((p) => (
            <Button
              key={p.barcode}
              label={`Adicionar ${p.name}`}
              variant="secondary"
              disabled={busy || !demo.toolsEnabled}
              onPress={() =>
                void action(async () => {
                  const r = await addByBarcode(p.barcode);
                  if (r.status !== 'added')
                    throw new Error(r.status === 'error' ? r.message : 'Produto não encontrado.');
                  setMessage(p.name + ' adicionado.');
                })
              }
            />
          ))}
        <Button
          label="Adicionar carne de R$ 19,60"
          disabled={busy || !demo.toolsEnabled}
          onPress={() =>
            void action(async () => {
              const r = await addByBarcode(demo.meatLabel!);
              if (r.status !== 'added')
                throw new Error(r.status === 'error' ? r.message : 'Carne não encontrada.');
              setMessage('Carne adicionada por etiqueta, não por preço do kg.');
            })
          }
        />
        <Button
          label="Abrir scanner com câmera"
          variant="secondary"
          onPress={() => router.push('/comprar')}
        />
      </Card>
      <Card style={styles.card}>
        <Text style={typography.h2}>3. Caixa simulado</Text>
        <Text style={styles.caption}>
          O resumo demonstra a conferência dos benefícios. Não representa integração com PDV,
          comprovante fiscal ou cobrança.
        </Text>
        <Text>Subtotal: {formatBRL(totals.originalTotal)}</Text>
        <Text>Economia: {formatBRL(totals.savings)}</Text>
        <Text style={typography.bodyStrong}>
          Total da simulação: {formatBRL(totals.finalTotal)}
        </Text>
        <Button
          label="Simular conferência no caixa"
          disabled={busy || !token || !items.length || !demo.toolsEnabled || !!receipt}
          onPress={() =>
            void action(async () => {
              const r = await apiRequest<{ id: string }>('/demo/checkout', {
                method: 'POST',
                auth: token!,
                body: {
                  requestKey,
                  items: items.map((i) => ({
                    barcode: i.product.barcode,
                    quantity: i.quantity,
                  })),
                  originalTotal: totals.originalTotal,
                  finalTotal: totals.finalTotal,
                },
              });
              setReceipt(r.id);
            })
          }
        />
        {receipt ? (
          <Text style={styles.caption}>
            Simulação registrada: {receipt.slice(0, 8).toUpperCase()}. Sem cobrança, sem pontos
            automáticos.
          </Text>
        ) : null}
        <Button label="Ver carrinho" variant="secondary" onPress={() => router.push('/cart')} />
      </Card>
      <Card style={styles.card}>
        <Text style={typography.h2}>4. Retorno do cliente</Text>
        <Text style={styles.caption}>
          Visualize um aviso fictício na central e toque para abrir a oferta. A entrega com o
          celular bloqueado é uma etapa de validação física separada.
        </Text>
        <Button
          label="Simular aviso de oferta"
          disabled={busy || !token || !demo.toolsEnabled}
          onPress={() =>
            void action(async () => {
              await apiRequest('/demo/notification', {
                method: 'POST',
                auth: token!,
                body: { requestKey: `demo-preview-${Date.now()}` },
              });
              await refreshInbox();
              router.push('/notifications');
            })
          }
        />
      </Card>
      <Card style={styles.card}>
        <Text style={typography.h2}>5. Painel do lojista</Text>
        <Text style={styles.caption}>
          Entre com o acesso de apresentação, publique uma oferta e confira no app. No painel também
          é possível restaurar catálogo, ofertas e pontos da loja fictícia.
        </Text>
        <Button label="Abrir painel do lojista" onPress={() => router.push('/admin')} />
      </Card>
      {message ? <Text style={styles.caption}>{message}</Text> : null}
      <Button
        label="Limpar esta sessão de apresentação"
        variant="secondary"
        disabled={busy}
        onPress={() =>
          void action(async () => {
            await resetSession();
            setReceipt(null);
            setRequestKey(`demo-checkout-${Date.now()}-${Math.random().toString(36).slice(2)}`);
            setMessage(
              'Sessão limpa. Entre novamente na conta de exemplo para começar outra apresentação.',
            );
          })
        }
      />
      <Button label="Voltar ao início" variant="ghost" onPress={() => router.replace('/')} />
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  page: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.surfaceAlt,
  },
  caption: {
    ...typography.caption,
    color: colors.textMuted,
    marginVertical: spacing.sm,
  },
});
