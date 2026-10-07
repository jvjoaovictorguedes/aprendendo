import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Text } from 'react-native';
import {
  AdminPage,
  AdminSection,
  Field,
  Status,
  StatusMessage,
  ToggleRow,
  Loading,
} from '../../../components/admin/AdminUI';
import { Button } from '../../../components/ui';
import { describeError } from '../../../services/admin';
import { Store, listAdminStores, saveStore } from '../../../services/offers';
export default function AdminStores() {
  const { tenantId } = useLocalSearchParams<{ tenantId: string }>();
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]),
    [draft, setDraft] = useState<(Omit<Store, 'id'> & { id?: string }) | null>(null);
  const [status, setStatus] = useState<Status>(null),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    try {
      setStores(await listAdminStores(tenantId));
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
    if (!draft) return;
    setBusy(true);
    try {
      await saveStore(tenantId, draft);
      setDraft(null);
      await reload();
      setStatus({ kind: 'success', message: 'Loja salva.' });
    } catch (e) {
      setStatus({ kind: 'error', message: describeError(e) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <AdminPage
      title="Lojas participantes"
      onBack={() => router.back()}
      actions={
        <Button
          label="Nova loja"
          onPress={() => setDraft({ name: '', address: '', hours: '', active: true })}
          disabled={busy}
        />
      }
    >
      <StatusMessage status={status} />
      {loading ? <Loading /> : null}
      {draft ? (
        <AdminSection title={draft.id ? 'Editar loja' : 'Nova loja'}>
          <Field
            label="Nome"
            value={draft.name}
            onChangeText={(name) => setDraft({ ...draft, name })}
          />
          <Field
            label="Endereço"
            value={draft.address ?? ''}
            onChangeText={(address) => setDraft({ ...draft, address })}
          />
          <Field
            label="Horários"
            value={draft.hours ?? ''}
            onChangeText={(hours) => setDraft({ ...draft, hours })}
          />
          <ToggleRow
            label="Loja ativa"
            description="Lojas inativas e suas ofertas exclusivas deixam de aparecer no app."
            value={draft.active}
            onChange={(active) => setDraft({ ...draft, active })}
          />
          <Button
            label={busy ? 'Salvando…' : 'Salvar'}
            onPress={() => void save()}
            disabled={busy}
          />
          <Button label="Cancelar" variant="ghost" onPress={() => setDraft(null)} disabled={busy} />
        </AdminSection>
      ) : null}
      {stores.map((s) => (
        <AdminSection key={s.id} title={`${s.name}${s.active ? '' : ' · Inativa'}`}>
          <Text>{s.address}</Text>
          <Text>{s.hours}</Text>
          <Button
            label="Editar"
            variant="secondary"
            onPress={() => setDraft({ ...s, address: s.address ?? '', hours: s.hours ?? '' })}
            disabled={busy}
          />
        </AdminSection>
      ))}
    </AdminPage>
  );
}
