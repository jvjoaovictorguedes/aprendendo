import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import {
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  ListRow,
  Screen,
  ScreenHeader,
  TextField,
} from '../../components/ui';
import { useLists } from '../../context/ListsContext';
import { findProductByName } from '../../data/products';
import { colors, hitSlop, radius, spacing, typography } from '../../theme/tokens';
import { confirmAction } from '../../utils/dialogs';

function progressText(bought: number, total: number) {
  if (total === 0) return 'Lista vazia';
  return `${bought} de ${total} ${total === 1 ? 'item comprado' : 'itens comprados'}`;
}

export default function ListsScreen() {
  const router = useRouter();
  const { lists, createList, removeList, addItem, removeItem, toggleBought, setActiveListId } =
    useLists();
  const [newListName, setNewListName] = useState('');
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');

  const selectedList = lists.find((list) => list.id === selectedListId) ?? null;

  const handleCreateList = () => {
    if (!newListName.trim()) return;
    const list = createList(newListName);
    setNewListName('');
    setSelectedListId(list.id);
  };

  const handleAddItem = () => {
    if (!selectedList || !newItemName.trim()) return;
    const matchedProduct = findProductByName(newItemName);
    addItem(selectedList.id, newItemName, matchedProduct?.barcode);
    setNewItemName('');
  };

  const handleRemoveList = (listId: string, name: string) => {
    confirmAction({
      title: 'Remover lista',
      message: `Remover "${name}" e todos os itens dela?`,
      confirmLabel: 'Remover',
      destructive: true,
      onConfirm: () => {
        removeList(listId);
        if (selectedListId === listId) setSelectedListId(null);
      },
    });
  };

  const handleStartShopping = () => {
    if (!selectedList) return;
    setActiveListId(selectedList.id);
    router.push('/comprar');
  };

  if (selectedList) {
    const boughtCount = selectedList.items.filter((item) => item.bought).length;
    return (
      <Screen
        header={
          <ScreenHeader
            title={selectedList.name}
            subtitle={progressText(boughtCount, selectedList.items.length)}
            onBack={() => setSelectedListId(null)}
          />
        }
        footer={
          <>
            <View style={styles.inlineForm}>
              <TextField
                placeholder="Adicionar item (ex.: Leite)"
                value={newItemName}
                onChangeText={setNewItemName}
                onSubmitEditing={handleAddItem}
                returnKeyType="done"
                accessibilityLabel="Novo item"
              />
              <Button label="Adicionar" onPress={handleAddItem} disabled={!newItemName.trim()} />
            </View>
            <Button
              label="Comprar a partir desta lista"
              onPress={handleStartShopping}
              disabled={selectedList.items.length === 0}
              fullWidth
            />
          </>
        }
      >
        {selectedList.items.length === 0 ? (
          <EmptyState emoji="📝" title="Lista vazia" subtitle="Adicione o primeiro item abaixo." />
        ) : (
          <Card padded={false}>
            {selectedList.items.map((item, index) => (
              <View key={item.id} style={[styles.itemRow, index > 0 && styles.divider]}>
                <TouchableOpacity
                  style={styles.itemToggle}
                  onPress={() => toggleBought(selectedList.id, item.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: item.bought }}
                  accessibilityLabel={item.name}
                >
                  <View style={[styles.checkbox, item.bought && styles.checkboxChecked]}>
                    {item.bought ? <Icon name="check" size={14} color={colors.onBrand} /> : null}
                  </View>
                  <Text style={[styles.itemName, item.bought && styles.itemNameBought]}>
                    {item.name}
                  </Text>
                  {item.barcode ? <Badge label="no catálogo" variant="brand" /> : null}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => removeItem(selectedList.id, item.id)}
                  hitSlop={hitSlop}
                  accessibilityRole="button"
                  accessibilityLabel={`Remover ${item.name}`}
                >
                  <Icon name="trash-2" size={17} color={colors.textFaint} />
                </TouchableOpacity>
              </View>
            ))}
          </Card>
        )}
      </Screen>
    );
  }

  return (
    <Screen header={<ScreenHeader title="Listas" subtitle="Organize o que precisa comprar." />}>
      <Card style={styles.createCard}>
        <TextField
          label="Nova lista"
          placeholder="Ex.: Compras da semana"
          value={newListName}
          onChangeText={setNewListName}
          onSubmitEditing={handleCreateList}
          returnKeyType="done"
        />
        <Button label="Criar lista" onPress={handleCreateList} disabled={!newListName.trim()} />
      </Card>

      {lists.length === 0 ? (
        <EmptyState
          emoji="📝"
          title="Nenhuma lista ainda"
          subtitle="Crie uma lista para marcar os itens enquanto compra."
        />
      ) : (
        <Card padded={false}>
          {lists.map((list, index) => {
            const boughtCount = list.items.filter((item) => item.bought).length;
            return (
              <ListRow
                key={list.id}
                icon="list"
                title={list.name}
                subtitle={progressText(boughtCount, list.items.length)}
                divider={index > 0}
                onPress={() => setSelectedListId(list.id)}
                right={
                  <TouchableOpacity
                    onPress={() => handleRemoveList(list.id, list.name)}
                    hitSlop={hitSlop}
                    accessibilityRole="button"
                    accessibilityLabel={`Remover lista ${list.name}`}
                  >
                    <Icon name="trash-2" size={17} color={colors.textFaint} />
                  </TouchableOpacity>
                }
              />
            );
          })}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  createCard: { gap: spacing.md },
  inlineForm: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  itemToggle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.brand, borderColor: colors.brand },
  itemName: { ...typography.body, color: colors.text, flexShrink: 1 },
  itemNameBought: { color: colors.textFaint, textDecorationLine: 'line-through' },
});
