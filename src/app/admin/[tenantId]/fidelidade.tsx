import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Text } from 'react-native';
import {
  AdminPage,
  AdminSection,
  Field,
  ToggleRow,
  Status,
  StatusMessage,
  Loading,
  parseDecimal,
} from '../../../components/admin/AdminUI';
import { Button } from '../../../components/ui';
import { describeError } from '../../../services/admin';
import {
  Loyalty,
  Reward,
  defaultLoyalty,
  fetchLoyalty,
  saveLoyalty,
  listAdminRewards,
  confirmReward,
  creditPoints,
} from '../../../services/offers';
export default function AdminLoyalty() {
  const { tenantId } = useLocalSearchParams<{ tenantId: string }>();
  const router = useRouter();
  const [rule, setRule] = useState<Loyalty>(defaultLoyalty),
    [points, setPoints] = useState('1000'),
    [rewards, setRewards] = useState<Reward[]>([]);
  const [rate, setRate] = useState('1');
  const [cpf, setCpf] = useState(''),
    [receipt, setReceipt] = useState(''),
    [total, setTotal] = useState('');
  const [status, setStatus] = useState<Status>(null),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [confirming, setConfirming] = useState<string | null>(null);
  async function credit() {
    setBusy(true);
    try {
      const result = await creditPoints(tenantId, {
        cpf: cpf.replace(/\D/g, ''),
        receipt,
        total: parseDecimal(total),
      });
      setReceipt('');
      setTotal('');
      setStatus({
        kind: 'success',
        message: `${result.points} pontos creditados ao cliente.`,
      });
    } catch (e) {
      setStatus({ kind: 'error', message: describeError(e) });
    } finally {
      setBusy(false);
    }
  }
  const reload = useCallback(async () => {
    try {
      const [l, r] = await Promise.all([fetchLoyalty(tenantId), listAdminRewards(tenantId)]);
      setRule(l);
      setRate(String(l.pointsPerReal));
      setPoints(String(l.pointsRequired));
      setRewards(r);
    } catch (e) {
      setStatus({ kind: 'error', message: describeError(e) });
    } finally {
      setLoading(false);
    }
  }, [tenantId]);
  useEffect(() => {
    const timer = setTimeout(() => void reload(), 0);
    return () => clearTimeout(timer);
  }, [reload]);
  async function save() {
    setBusy(true);
    try {
      if (!/^\d+$/.test(points) || Number(points) < 1)
        throw new Error('Informe uma quantidade inteira de pontos.');
      await saveLoyalty(tenantId, {
        ...rule,
        pointsRequired: Number(points),
        pointsPerReal: parseDecimal(rate),
      });
      setStatus({ kind: 'success', message: 'Benefício atualizado.' });
    } catch (e) {
      setStatus({ kind: 'error', message: describeError(e) });
    } finally {
      setBusy(false);
    }
  }
  async function confirm(id: string) {
    setBusy(true);
    try {
      await confirmReward(tenantId, id);
      setConfirming(null);
      await reload();
      setStatus({
        kind: 'success',
        message: 'Entrega registrada. Este benefício não pode ser usado novamente.',
      });
    } catch (e) {
      setStatus({ kind: 'error', message: describeError(e) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <AdminPage
      title="Fidelidade"
      subtitle="Configure uma recompensa real e registre a entrega no balcão."
      onBack={() => router.back()}
    >
      <StatusMessage status={status} />
      {loading ? (
        <Loading />
      ) : (
        <AdminSection
          title="Benefício por pontos"
          description="Configure a conversão de compras confirmadas em pontos. Finalizar a prévia no scanner não gera pontos."
        >
          <ToggleRow
            label="Programa ativo"
            value={rule.enabled}
            onChange={(enabled) => setRule({ ...rule, enabled })}
          />
          <Field
            label="Pontos por R$ 1"
            value={rate}
            keyboardType="decimal-pad"
            onChangeText={setRate}
          />
          <Field
            label="Recompensa"
            value={rule.rewardName}
            onChangeText={(rewardName) => setRule({ ...rule, rewardName })}
            placeholder="Ex.: 1 café no balcão"
          />
          <Field
            label="Pontos necessários"
            value={points}
            onChangeText={setPoints}
            keyboardType="number-pad"
          />
          <Field
            label="Condições do resgate"
            value={rule.conditions}
            onChangeText={(conditions) => setRule({ ...rule, conditions })}
            multiline
          />
          <Button
            label={busy ? 'Salvando…' : 'Salvar programa'}
            onPress={() => void save()}
            disabled={busy}
          />
        </AdminSection>
      )}
      <AdminSection
        title="Creditar compra confirmada"
        description="Confira o pagamento no caixa antes de creditar. O comprovante deve ser único na rede (inclua a loja e a data); repetir o comprovante não gera novos pontos."
      >
        <Field
          label="CPF do cliente cadastrado"
          value={cpf}
          onChangeText={setCpf}
          keyboardType="number-pad"
        />
        <Field
          label="Identificador do comprovante"
          value={receipt}
          onChangeText={setReceipt}
          placeholder="Loja-data-número"
        />
        <Field
          label="Total pago (R$)"
          value={total}
          onChangeText={setTotal}
          keyboardType="decimal-pad"
        />
        <Button
          label="Confirmar pagamento e creditar pontos"
          onPress={() => void credit()}
          disabled={busy}
        />
      </AdminSection>
      <AdminSection
        title="Benefícios emitidos"
        description="Confira o código completo apresentado pelo cliente antes de confirmar a entrega."
      >
        {!rewards.length ? <Text>Nenhum benefício emitido.</Text> : null}
        {rewards.map((r) => (
          <AdminSection
            key={r.id}
            title={r.rewardName}
            description={`${r.customerName} · ${r.pointsSpent} pontos`}
          >
            <Text selectable>{r.id}</Text>
            <Text>{r.conditions}</Text>
            {r.redeemedAt ? (
              <Text>Utilizado em {new Date(r.redeemedAt).toLocaleString('pt-BR')}</Text>
            ) : confirming === r.id ? (
              <>
                <Text>Confirmar que o benefício foi entregue ao cliente?</Text>
                <Button
                  label="Confirmar entrega"
                  onPress={() => void confirm(r.id)}
                  disabled={busy}
                />
                <Button
                  label="Cancelar"
                  variant="ghost"
                  onPress={() => setConfirming(null)}
                  disabled={busy}
                />
              </>
            ) : (
              <Button
                label="Registrar entrega"
                variant="secondary"
                onPress={() => setConfirming(r.id)}
                disabled={busy}
              />
            )}
          </AdminSection>
        ))}
      </AdminSection>
    </AdminPage>
  );
}
