import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import {
  AdminPage,
  AdminSection,
  Field,
  FieldRow,
  formatDecimalInput,
  Loading,
  parseDecimal,
  Segmented,
  Status,
  StatusMessage,
  ToggleRow,
} from '../../../../components/admin/AdminUI';
import { Button } from '../../../../components/ui';
import { describeError, fetchProduct, saveProduct } from '../../../../services/admin';

const NEW_PRODUCT_ID = 'novo';

type Form = {
  name: string;
  category: string;
  barcode: string;
  plu: string;
  price: string;
  unit: 'un' | 'kg';
  active: boolean;
};

const EMPTY_FORM: Form = {
  name: '',
  category: '',
  barcode: '',
  plu: '',
  price: '',
  unit: 'un',
  active: true,
};

const UNIT_OPTIONS: { value: Form['unit']; label: string }[] = [
  { value: 'un', label: 'Unidade' },
  { value: 'kg', label: 'Quilo (balança)' },
];

function validate(form: Form): Partial<Record<keyof Form, string>> {
  const errors: Partial<Record<keyof Form, string>> = {};
  if (!form.name.trim()) errors.name = 'Informe o nome.';
  if (!form.category.trim()) errors.category = 'Informe a categoria.';
  const price = parseDecimal(form.price);
  if (Number.isNaN(price) || price < 0) errors.price = 'Preço inválido.';
  if (form.barcode && !/^[0-9]{8,14}$/.test(form.barcode)) errors.barcode = 'Use de 8 a 14 dígitos.';
  if (form.plu && !/^[0-9]{1,6}$/.test(form.plu)) errors.plu = 'Use até 6 dígitos.';
  if (form.plu && /^0+$/.test(form.plu)) errors.plu = 'O PLU não pode ser zero.';
  if (!form.barcode && !form.plu) errors.barcode = 'Informe o código de barras, o PLU ou os dois.';
  if (form.unit === 'kg' && !form.plu) errors.plu = 'Produto vendido por kg precisa do PLU da balança.';
  return errors;
}

export default function ProductEditScreen() {
  const router = useRouter();
  const { tenantId, productId } = useLocalSearchParams<{ tenantId: string; productId: string }>();
  const isNew = productId === NEW_PRODUCT_ID;
  const [form, setForm] = useState<Form | null>(isNew ? EMPTY_FORM : null);
  const [status, setStatus] = useState<Status>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isNew) return;
    fetchProduct(productId)
      .then((product) =>
        setForm({
          name: product.name,
          category: product.category,
          barcode: product.barcode ?? '',
          plu: product.plu ?? '',
          price: formatDecimalInput(product.price),
          unit: product.unit,
          active: product.active,
        }),
      )
      .catch((err) => setStatus({ kind: 'error', message: describeError(err) }));
  }, [isNew, productId]);

  const goBack = () =>
    router.push({ pathname: '/admin/[tenantId]/produtos', params: { tenantId } });

  const update = (patch: Partial<Form>) => {
    setForm((current) => (current ? { ...current, ...patch } : current));
    setStatus(null);
  };

  const errors = form ? validate(form) : {};
  const visibleErrors = showErrors ? errors : {};

  const handleSave = async () => {
    if (!form) return;
    setShowErrors(true);
    if (Object.keys(errors).length > 0) return;
    setIsSaving(true);
    try {
      await saveProduct(tenantId, {
        id: isNew ? undefined : productId,
        name: form.name,
        category: form.category,
        barcode: form.barcode || null,
        plu: form.plu || null,
        price: parseDecimal(form.price),
        unit: form.unit,
        active: form.active,
      });
      goBack();
    } catch (err) {
      setStatus({ kind: 'error', message: describeError(err) });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AdminPage
      title={isNew ? 'Novo produto' : (form?.name ?? 'Produto')}
      onBack={goBack}
      backLabel="Produtos"
    >
      {!form ? (
        status ? <StatusMessage status={status} /> : <Loading />
      ) : (
        <>
          <AdminSection title="Produto">
            <FieldRow>
              <Field label="Nome" value={form.name} onChangeText={(name) => update({ name })} error={visibleErrors.name} />
              <Field
                label="Categoria"
                value={form.category}
                onChangeText={(category) => update({ category })}
                placeholder="Ex.: Hortifruti"
                error={visibleErrors.category}
              />
            </FieldRow>
            <Segmented
              label="Vendido por"
              options={UNIT_OPTIONS}
              value={form.unit}
              onChange={(unit) => update({ unit })}
            />
            <FieldRow>
              <Field
                label={form.unit === 'kg' ? 'Preço do kg (R$)' : 'Preço (R$)'}
                value={form.price}
                onChangeText={(price) => update({ price })}
                keyboardType="decimal-pad"
                placeholder="0,00"
                error={visibleErrors.price}
              />
              <Field
                label="Código de barras (EAN)"
                value={form.barcode}
                onChangeText={(barcode) => update({ barcode: barcode.replace(/\D/g, '') })}
                keyboardType="number-pad"
                maxLength={14}
                error={visibleErrors.barcode}
                hint={form.unit === 'kg' ? 'Opcional para produtos de balança.' : undefined}
              />
              <Field
                label="PLU da balança"
                value={form.plu}
                onChangeText={(plu) => update({ plu: plu.replace(/\D/g, '') })}
                keyboardType="number-pad"
                maxLength={6}
                error={visibleErrors.plu}
                hint="O mesmo código cadastrado na balança. Zeros à esquerda não importam."
              />
            </FieldRow>
            <ToggleRow
              label="Ativo"
              description="Produto inativo não aparece no scanner do app."
              value={form.active}
              onChange={(active) => update({ active })}
            />
          </AdminSection>
          <StatusMessage status={status} />
          <Button label={isNew ? 'Cadastrar produto' : 'Salvar alterações'} onPress={handleSave} loading={isSaving} />
        </>
      )}
    </AdminPage>
  );
}
