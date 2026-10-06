import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Badge, Button, Card, EmptyState } from '../../components/ui';
import { useLists } from '../../context/ListsContext';
import { findProductByName } from '../../data/products';
import { colors, radius, spacing, typography } from '../../theme/tokens';

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
    Alert.alert('Remover lista', `Remover "${name}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Remover',
        style: 'destructive',
        onPress: () => {
          removeList(listId);
          if (selectedListId === listId) setSelectedListId(null);
        },
      },
    ]);
  };

  const handleStartShopping = () => {
    if (!selectedList) return;
    setActiveListId(selectedList.id);
    router.push('/comprar');
  };

  if (selectedList) {
    const boughtCount = selectedList.items.filter((item) => item.bought).length;
    return (
      <View style={styles.container}>
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={() => setSelectedListId(null)} hitSlop={8}>
            <Text style={styles.backLink}>‹ Listas</Text>
          </TouchableOpacity>
          <Text style={styles.detailTitle}>{selectedList.name}</Text>
          <Text style={styles.detailSubtitle}>
            {boughtCount}/{selectedList.items.length} itens comprados
          </Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}>
          {selectedList.items.length === 0 ? (
            <EmptyState emoji="📝" title="Lista vazia" subtitle="Adicione o primeiro item abaixo." />
          ) : (
            selectedList.items.map((item) => (
              <TouchableOpacity
                key={item.id}
                onPress={() => toggleBought(selectedList.id, item.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: item.bought }}
              >
                <Card style={styles.itemRow} padded={false}>
                  <View style={styles.itemLeft}>
                    <View style={[styles.checkbox, item.bought && styles.checkboxChecked]}>
                      {item.bought ? <Text style={styles.checkboxMark}>✓</Text> : null}
                    </View>
                    <Text style={[styles.itemName, item.bought && styles.itemNameBought]}>
                      {item.name}
                    </Text>
                    {item.barcode ? <Badge label="no catálogo" variant="brand" /> : null}
                  </View>
                  <TouchableOpacity
                    onPress={() => removeItem(selectedList.id, item.id)}
                    hitSlop={8}
                  >
                    <Text style={styles.removeText}>remover</Text>
                  </TouchableOpacity>
                </Card>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.addItemRow}>
            <TextInput
              style={styles.input}
              placeholder="Adicionar item (ex: Leite)"
              value={newItemName}
              onChangeText={setNewItemName}
              onSubmitEditing={handleAddItem}
              returnKeyType="done"
            />
            <Button label="Add" onPress={handleAddItem} />
          </View>
          <Button
            label="Iniciar compra a partir desta lista"
            onPress={handleStartShopping}
            fullWidth
            style={{ marginTop: spacing.sm }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.footer}>
        <View style={styles.addItemRow}>
          <TextInput
            style={styles.input}
            placeholder="Nome da nova lista (ex: Compras da semana)"
            value={newListName}
            onChangeText={setNewListName}
            onSubmitEditing={handleCreateList}
            returnKeyType="done"
          />
          <Button label="Criar" onPress={handleCreateList} />
        </View>
      </View>

      {lists.length === 0 ? (
        <EmptyState
          emoji="📝"
          title="Nenhuma lista ainda"
          subtitle="Crie uma lista acima para organizar suas compras."
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}>
          {lists.map((list) => {
            const boughtCount = list.items.filter((item) => item.bought).length;
            return (
              <TouchableOpacity key={list.id} onPress={() => setSelectedListId(list.id)}>
                <Card style={styles.listCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listName}>{list.name}</Text>
                    <Text style={styles.listProgress}>
                      {boughtCount}/{list.items.length} itens comprados
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRemoveList(list.id, list.name)}
                    hitSlop={8}
                  >
                    <Text style={styles.removeText}>remover</Text>
                  </TouchableOpacity>
                </Card>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceAlt },
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  addItemRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
  },
  listCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  listName: { ...typography.bodyStrong, color: colors.text },
  listProgress: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  removeText: { ...typography.small, color: colors.danger },
  detailHeader: {
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backLink: { ...typography.bodyStrong, color: colors.brand },
  detailTitle: { ...typography.h1, color: colors.text, marginTop: spacing.sm },
  detailSubtitle: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  itemLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.brand, borderColor: colors.brand },
  checkboxMark: { color: '#fff', fontWeight: '700', fontSize: 13 },
  itemName: { ...typography.body, color: colors.text, flexShrink: 1 },
  itemNameBought: { color: colors.textFaint, textDecorationLine: 'line-through' },
});
