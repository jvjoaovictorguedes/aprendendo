import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import {
  AdminPage,
  AdminSection,
  Field,
  FieldRow,
  Segmented,
  ToggleRow,
  StatusMessage,
  Loading,
  Status,
  parseDecimal,
  formatDecimalInput,
} from '../../../components/admin/AdminUI';
import { Button } from '../../../components/ui';
import { AdminProduct, listProducts, describeError } from '../../../services/admin';
import {
  Offer,
  OfferDraft,
  Store,
  listAdminOffers,
  listAdminStores,
  saveOffer,
  archiveOffer,
} from '../../../services/offers';
import { colors, spacing, typography } from '../../../theme/tokens';
import { offerConditions } from '../../../utils/offers';

function dateInput(iso: string) {
  const d = new Date(iso);
  const n = (v: number) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${n(d.getMonth() + 1)}-${n(d.getDate())} ${n(d.getHours())}:${n(d.getMinutes())}`;
}
function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value))
    throw new Error('Use AAAA-MM-DD HH:mm nas datas.');
  const date = new Date(value.replace(' ', 'T'));
  if (!Number.isFinite(date.getTime()) || dateInput(date.toISOString()) !== value)
    throw new Error('Data ou hora inválida.');
  return date.toISOString();
}
export default function AdminOffers() {
  const { tenantId } = useLocalSearchParams<{ tenantId: string }>();
  const router = useRouter();
  const [offers, setOffers] = useState<Offer[]>([]),
    [products, setProducts] = useState<AdminProduct[]>([]),
    [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState<Status>(null);
  const [now, setNow] = useState(() => Date.now());
  const [editing, setEditing] = useState<string | null>(null),
    [open, setOpen] = useState(false);
  const [productId, setProduct] = useState(''),
    [search, setSearch] = useState(''),
    [label, setLabel] = useState('');
  const [audience, setAudience] = useState<'all' | 'club'>('all'),
    [kind, setKind] = useState<Offer['kind']>('percent_off');
  const [value, setValue] = useState(''),
    [buy, setBuy] = useState('3'),
    [pay, setPay] = useState('2');
  const [storeId, setStore] = useState<string | null>(null),
    [conditions, setConditions] = useState(''),
    [limit, setLimit] = useState('');
  const [starts, setStarts] = useState(''),
    [ends, setEnds] = useState(''),
    [active, setActive] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    setNow(Date.now());
    try {
      const [o, p, s] = await Promise.all([
        listAdminOffers(tenantId),
        listProducts(tenantId, ''),
        listAdminStores(tenantId),
      ]);
      setOffers(o);
      setProducts(p);
      setStores(s);
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
  useEffect(() => {
    const timer = setTimeout(() => {
      listProducts(tenantId, search)
        .then(setProducts)
        .catch((e) => setStatus({ kind: 'error', message: describeError(e) }));
    }, 300);
    return () => clearTimeout(timer);
  }, [search, tenantId]);
  function edit(o?: Offer) {
    setEditing(o?.id ?? null);
    setProduct(o?.productId ?? '');
    setLabel(o?.label ?? '');
    setAudience(o?.audience ?? 'all');
    setKind(o?.kind ?? 'percent_off');
    setValue(
      o ? formatDecimalInput(o.kind === 'fixed_price' ? (o.price ?? 0) : (o.percent ?? 0)) : '',
    );
    setBuy(String(o?.buy ?? 3));
    setPay(String(o?.pay ?? 2));
    setStore(o?.storeId ?? null);
    setConditions(o?.conditions ?? '');
    setLimit(o?.maxQuantity ? String(o.maxQuantity) : '');
    setStarts(dateInput(o?.startsAt ?? new Date().toISOString()));
    setEnds(dateInput(o?.endsAt ?? new Date(Date.now() + 7 * 86400000).toISOString()));
    setActive(o?.active ?? true);
    setOpen(true);
    setStatus(null);
  }
  async function save() {
    setBusy(true);
    setStatus(null);
    try {
      const draft: OfferDraft = {
        id: editing ?? undefined,
        productId,
        label,
        audience,
        kind,
        percent: kind === 'percent_off' ? parseDecimal(value) : null,
        price: kind === 'fixed_price' ? parseDecimal(value) : null,
        buy: kind === 'buy_x_pay_y' ? Number(buy) : null,
        pay: kind === 'buy_x_pay_y' ? Number(pay) : null,
        storeId,
        conditions,
        maxQuantity: limit.trim() ? parseDecimal(limit) : null,
        startsAt: parseDate(starts),
        endsAt: parseDate(ends),
        active,
      };
      if (!productId || !label.trim())
        throw new Error('Escolha um produto e informe o título da oferta.');
      const numeric = [draft.percent, draft.price, draft.buy, draft.pay, draft.maxQuantity].filter(
        (v) => v !== null,
      );
      if (numeric.some((v) => !Number.isFinite(v)))
        throw new Error('Confira os valores numéricos.');
      await saveOffer(tenantId, draft);
      setOpen(false);
      await reload();
      setStatus({
        kind: 'success',
        message: 'Oferta salva. O app atualiza ao abrir a tela de ofertas ou atualizar o carrinho.',
      });
    } catch (e) {
      setStatus({ kind: 'error', message: describeError(e) });
    } finally {
      setBusy(false);
    }
  }
  async function pause(id: string) {
    setBusy(true);
    try {
      await archiveOffer(tenantId, id);
      await reload();
    } catch (e) {
      setStatus({ kind: 'error', message: describeError(e) });
    } finally {
      setBusy(false);
    }
  }
  return (
    <AdminPage
      title="Promoções e cupons"
      subtitle="Defina o benefício, a validade e onde ele pode ser usado."
      onBack={() => router.back()}
      actions={<Button label="Nova oferta" onPress={() => edit()} disabled={busy} />}
    >
      <StatusMessage status={status} />
      {loading ? <Loading /> : null}
      {open ? (
        <AdminSection
          title={editing ? 'Editar oferta' : 'Nova oferta'}
          description="Datas no horário local deste dispositivo. Ofertas do clube dão desconto percentual extra; entre cupons ativos vale o maior desconto efetivo."
        >
          <Field
            label="Buscar produto"
            value={search}
            onChangeText={setSearch}
            placeholder="Nome, EAN ou PLU"
          />
          <View style={{ gap: spacing.xs }}>
            {products
              .filter((p) => p.active)
              .slice(0, 20)
              .map((p) => (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => setProduct(p.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: productId === p.id }}
                  style={{
                    padding: spacing.sm,
                    backgroundColor: productId === p.id ? colors.brandSoft : colors.surfaceAlt,
                  }}
                >
                  <Text style={{ color: colors.text }}>
                    {p.name} ·{' '}
                    {p.price.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                    /{p.unit}
                  </Text>
                </TouchableOpacity>
              ))}
          </View>
          <Text style={{ color: colors.textMuted }}>
            Produto selecionado:{' '}
            {products.find((p) => p.id === productId)?.name ??
              offers.find((o) => o.productId === productId)?.product.name ??
              'Nenhum'}
          </Text>
          <Field label="Título da oferta" value={label} onChangeText={setLabel} maxLength={120} />
          <Segmented
            label="Público"
            value={audience}
            options={[
              { value: 'all', label: 'Todos' },
              { value: 'club', label: 'Clube (CPF + ativação)' },
            ]}
            onChange={(v) => {
              setAudience(v);
              if (v === 'club') setKind('percent_off');
            }}
          />
          <Segmented
            label="Tipo"
            value={kind}
            options={
              audience === 'club'
                ? [{ value: 'percent_off', label: '% extra' }]
                : [
                    { value: 'percent_off', label: '% de desconto' },
                    { value: 'fixed_price', label: 'Preço promocional' },
                    { value: 'buy_x_pay_y', label: 'Leve / pague' },
                  ]
            }
            onChange={setKind}
          />
          {kind === 'buy_x_pay_y' ? (
            <FieldRow>
              <Field label="Leve" value={buy} onChangeText={setBuy} keyboardType="number-pad" />
              <Field label="Pague" value={pay} onChangeText={setPay} keyboardType="number-pad" />
            </FieldRow>
          ) : (
            <Field
              label={
                kind === 'fixed_price'
                  ? 'Preço promocional (R$, por unidade ou kg)'
                  : 'Desconto (%)'
              }
              value={value}
              onChangeText={setValue}
              keyboardType="decimal-pad"
            />
          )}
          <Segmented
            label="Loja participante"
            value={storeId ?? 'all'}
            options={[
              { value: 'all', label: 'Todas as lojas' },
              ...stores
                .filter((s) => s.active || s.id === storeId)
                .map((s) => ({ value: s.id, label: s.name })),
            ]}
            onChange={(v) => setStore(v === 'all' ? null : v)}
          />
          <FieldRow>
            <Field label="Início" value={starts} onChangeText={setStarts} hint="AAAA-MM-DD HH:mm" />
            <Field label="Fim" value={ends} onChangeText={setEnds} hint="AAAA-MM-DD HH:mm" />
          </FieldRow>
          <Field
            label="Limite por compra (unidades ou kg)"
            value={limit}
            onChangeText={setLimit}
            keyboardType="decimal-pad"
            hint="Vazio = sem limite. Leve/pague: use múltiplo da quantidade leve."
          />
          <Field
            label="Condições"
            value={conditions}
            onChangeText={setConditions}
            multiline
            hint="Ex.: não cumulativa com convênios; limite por compra. As condições aparecem ao cliente; regras adicionais do caixa precisam de integração."
          />
          <ToggleRow label="Oferta publicada" value={active} onChange={setActive} />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button
              label={busy ? 'Salvando…' : 'Salvar oferta'}
              onPress={() => void save()}
              disabled={busy}
            />
            <Button
              label="Cancelar"
              variant="ghost"
              onPress={() => setOpen(false)}
              disabled={busy}
            />
          </View>
        </AdminSection>
      ) : null}
      {!loading && !offers.length ? (
        <Text>Nenhuma oferta cadastrada. Crie a primeira para aparecer no aplicativo.</Text>
      ) : null}
      {offers.map((o) => {
        const state = !o.active
          ? 'Pausada'
          : Date.parse(o.startsAt) > now
            ? 'Agendada'
            : o.endsAt && Date.parse(o.endsAt) <= now
              ? 'Encerrada'
              : 'Ativa';
        return (
          <AdminSection
            key={o.id}
            title={`${o.label} · ${state}`}
            description={`${o.product.name} · ${o.audience === 'club' ? 'Clube' : 'Todos'}`}
          >
            <Text style={{ ...typography.caption, color: colors.textMuted }}>
              {offerConditions(o)}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button label="Editar" variant="secondary" onPress={() => edit(o)} disabled={busy} />
              {o.active ? (
                <Button
                  label="Pausar"
                  variant="ghost"
                  onPress={() => void pause(o.id)}
                  disabled={busy}
                />
              ) : null}
            </View>
          </AdminSection>
        );
      })}
    </AdminPage>
  );
}
