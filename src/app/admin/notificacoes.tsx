import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, Switch, View } from 'react-native';
import {
  AdminPage,
  AdminSection,
  Field,
  FieldRow,
  Loading,
  Status,
  StatusMessage,
} from '../../components/admin/AdminUI';
import { Button } from '../../components/ui';
import { useAdminAuth } from '../../context/AdminAuthContext';
import {
  fetchNotificationPolicy,
  saveNotificationPolicy,
  NotificationPolicy,
  PolicyResponse,
} from '../../services/platformNotifications';

const fields = [
  ['startHour', 'Começar às (hora)', '0 a 23; início incluído.'],
  ['endHour', 'Encerrar às (hora)', '1 a 24; fim não incluído. 0 até 24 = dia inteiro.'],
  ['cartReminderMinutes', 'Lembrar carrinho após (min)', '1 a 1440 minutos sem atividade.'],
  [
    'minimumIntervalMinutes',
    'Intervalo mínimo por cliente (min)',
    '1 a 10080; padrão: 1440 (24 horas).',
  ],
  [
    'minimumPurchases',
    'Compras para considerar recorrência',
    '1 a 50 compras declaradas distintas.',
  ],
  ['purchaseWindowDays', 'Histórico considerado (dias)', '1 a 365 dias.'],
] as const;
type NumericKey = (typeof fields)[number][0];
export default function PlatformNotificationsScreen() {
  const router = useRouter();
  const { isPlatformAdmin } = useAdminAuth();
  const [data, setData] = useState<PolicyResponse | null>(null);
  const [form, setForm] = useState<NotificationPolicy | null>(null);
  const [numbers, setNumbers] = useState<Record<NumericKey, string>>(
    {} as Record<NumericKey, string>,
  );
  const [status, setStatus] = useState<Status>(null);
  const [saving, setSaving] = useState(false);
  function fill(v: NotificationPolicy) {
    setForm(v);
    setNumbers(
      Object.fromEntries(fields.map(([k]) => [k, String(v[k])])) as Record<NumericKey, string>,
    );
  }
  useEffect(() => {
    if (isPlatformAdmin)
      fetchNotificationPolicy()
        .then((v) => {
          setData(v);
          fill(v.settings);
        })
        .catch((e) => setStatus({ kind: 'error', message: e.message }));
  }, [isPlatformAdmin]);
  if (!isPlatformAdmin) return <Redirect href="/admin" />;
  async function save() {
    if (!form) return;
    setSaving(true);
    setStatus(null);
    try {
      for (const [key, label] of fields)
        if (!/^\d+$/.test(numbers[key] ?? ''))
          throw new Error(`${label}: informe um número inteiro.`);
      const next = { ...form, ...Object.fromEntries(fields.map(([k]) => [k, Number(numbers[k])])) };
      const result = await saveNotificationPolicy(next);
      setData(result);
      fill(result.settings);
      setStatus({
        kind: 'success',
        message: 'Regras salvas. A rotina lê os valores na próxima rodada, em até um minuto.',
      });
    } catch (e) {
      setStatus({
        kind: 'error',
        message: e instanceof Error ? e.message : 'Não foi possível salvar.',
      });
    } finally {
      setSaving(false);
    }
  }
  return (
    <AdminPage
      title="Notificações da plataforma"
      subtitle="Acesso exclusivo da equipe ScanMercado. Estas regras valem para todas as franquias."
      onBack={() => router.push('/admin')}
    >
      <StatusMessage status={status} />
      {!form ? (
        !status ? (
          <Loading />
        ) : null
      ) : (
        <>
          <AdminSection
            title="Envio e horário"
            description="As alterações não substituem o consentimento do cliente e não habilitam push na loja fictícia de demonstração."
          >
            <Text>
              {data?.serverPushEnabled
                ? 'PUSH_ENABLED está ativo no servidor.'
                : 'PUSH_ENABLED está desligado no servidor. Ative no Railway para envio real; credenciais FCM/APNs e build instalado também são necessários.'}
            </Text>
            <View>
              <Text>Permitir campanhas automáticas</Text>
              <Switch
                accessibilityLabel="Permitir campanhas automáticas"
                value={form.enabled}
                onValueChange={(enabled) => setForm({ ...form, enabled })}
              />
            </View>
            <Field
              label="Fuso horário"
              value={form.timezone}
              onChangeText={(timezone) => setForm({ ...form, timezone })}
              autoCapitalize="none"
              hint="Ex.: America/Sao_Paulo. Horários usam este fuso, inclusive janelas que atravessam a meia-noite."
            />
            <FieldRow>
              {fields.slice(0, 2).map(([k, label, hint]) => (
                <Field
                  key={k}
                  label={label}
                  hint={hint}
                  value={numbers[k]}
                  onChangeText={(v) => setNumbers({ ...numbers, [k]: v })}
                  keyboardType="number-pad"
                />
              ))}
            </FieldRow>
          </AdminSection>
          <AdminSection
            title="Carrinho e recorrência"
            description="Reduzir intervalos afeta todos os clientes autorizados. Um mesmo carrinho/oferta continua sem avisos repetidos."
          >
            {fields.slice(2).map(([k, label, hint]) => (
              <Field
                key={k}
                label={label}
                hint={hint}
                value={numbers[k]}
                onChangeText={(v) => setNumbers({ ...numbers, [k]: v })}
                keyboardType="number-pad"
              />
            ))}
            <Button
              label="Preencher valores para teste"
              variant="secondary"
              disabled={saving}
              onPress={() => {
                fill({
                  ...form,
                  startHour: 0,
                  endHour: 24,
                  cartReminderMinutes: 1,
                  minimumIntervalMinutes: 1,
                  minimumPurchases: 1,
                });
                setStatus({
                  kind: 'success',
                  message:
                    'Valores de teste preenchidos. Revise e salve para aplicar a todas as franquias.',
                });
              }}
            />
            <Button
              label="Preencher valores padrão"
              variant="secondary"
              disabled={saving}
              onPress={() => data && fill(data.defaults)}
            />
            <Button
              label="Salvar regras de notificações"
              loading={saving}
              onPress={() => void save()}
            />
          </AdminSection>
          <AdminSection title="Como testar">
            <Text>
              Use uma conta de teste em uma franquia que não seja a loja fictícia de demonstração.
              Autorize notificações, adicione um item e pare de mexer no carrinho. A rotina executa
              a cada minuto. Para outro lembrete, conclua ou limpe o carrinho e inicie outro.
              Recorrência exige compras declaradas; apenas escanear não conta. Após o teste,
              restaure os valores padrão e salve.
            </Text>
          </AdminSection>
        </>
      )}
    </AdminPage>
  );
}
