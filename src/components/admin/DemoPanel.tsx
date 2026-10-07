import { useState } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card } from '../ui';
import { DEMO_TENANT, resetDemo } from '../../services/demo';
import { useResetDemoSession } from '../../hooks/useResetDemoSession';
import { typography, spacing } from '../../theme/tokens';

export function DemoPanel({ tenantId, onReset }: { tenantId: string; onReset: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const clearSession = useResetDemoSession();
  const router = useRouter();
  if (tenantId !== DEMO_TENANT) return null;
  async function restore() {
    setBusy(true);
    setMessage(null);
    try {
      await resetDemo(tenantId);
      await clearSession();
      onReset();
      setConfirming(false);
      setMessage(
        'Dados fictícios restaurados. Entre novamente como cliente para outra apresentação.',
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível restaurar.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card style={{ gap: spacing.md }}>
      <Text style={typography.h2}>Loja de demonstração</Text>
      <Text>
        Dados fictícios. A restauração substitui as alterações desta loja e encerra as sessões do
        cliente de exemplo.
      </Text>
      <Button
        label="Abrir roteiro de apresentação"
        variant="secondary"
        onPress={() => router.push('/demonstracao')}
      />
      {confirming ? (
        <>
          <Text>
            Restaurar catálogo, ofertas, pontos, avisos e sessão fictícia deste dispositivo?
          </Text>
          <Button
            label="Confirmar restauração dos exemplos"
            loading={busy}
            onPress={() => void restore()}
          />
          <Button
            label="Cancelar"
            variant="ghost"
            disabled={busy}
            onPress={() => setConfirming(false)}
          />
        </>
      ) : (
        <Button
          label="Restaurar dados da demonstração"
          variant="secondary"
          onPress={() => setConfirming(true)}
        />
      )}
      {message ? <Text>{message}</Text> : null}
    </Card>
  );
}
