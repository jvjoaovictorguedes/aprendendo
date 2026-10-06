import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Icon } from '../components/ui';
import { STORES } from '../data/stores';
import { colors, radius, spacing, typography } from '../theme/tokens';

export default function StoresScreen() {
  const openMaps = (mapsQuery: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`;
    Linking.openURL(url).catch(() => {});
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      {STORES.map((store) => (
        <View key={store.id} style={styles.card}>
          <View style={styles.iconWrap}>
            <Icon name="map-pin" size={20} color={colors.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{store.name}</Text>
            <Text style={styles.address}>{store.address}</Text>
            <Text style={styles.hours}>{store.hours}</Text>
            <TouchableOpacity style={styles.routeButton} onPress={() => openMaps(store.mapsQuery)}>
              <Icon name="navigation" size={14} color={colors.brand} />
              <Text style={styles.routeButtonText}>Ver rota</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceAlt },
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { ...typography.bodyStrong, color: colors.text, fontSize: 16 },
  address: { ...typography.body, color: colors.textMuted, marginTop: 4 },
  hours: { ...typography.caption, color: colors.textFaint, marginTop: 2 },
  routeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  routeButtonText: { ...typography.caption, color: colors.brand, fontWeight: '700' },
});
