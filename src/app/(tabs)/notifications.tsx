import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { EmptyState, Icon } from '../../components/ui';
import { useNotifications } from '../../context/NotificationsContext';
import { NotificationItem, NotificationKind } from '../../data/notifications';
import { colors, radius, spacing, typography } from '../../theme/tokens';

const KIND_ICON: Record<NotificationKind, Parameters<typeof Icon>[0]['name']> = {
  coupon: 'tag',
  budget: 'alert-circle',
  system: 'info',
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

export default function NotificationsScreen() {
  const { notifications, markAsRead, markAllAsRead, unreadCount } = useNotifications();

  if (notifications.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState title="Nenhuma notificação" subtitle="Avisos de cupons e orçamento aparecem aqui." emoji="🔔" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
      data={notifications}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        unreadCount > 0 ? (
          <TouchableOpacity onPress={markAllAsRead} style={styles.markAllButton}>
            <Text style={styles.markAllText}>Marcar tudo como lido</Text>
          </TouchableOpacity>
        ) : null
      }
      renderItem={({ item }: { item: NotificationItem }) => (
        <TouchableOpacity
          style={[styles.card, !item.read && styles.cardUnread]}
          onPress={() => markAsRead(item.id)}
        >
          <View style={styles.iconWrap}>
            <Icon name={KIND_ICON[item.kind]} size={18} color={colors.brand} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
            <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
          </View>
          {!item.read ? <View style={styles.unreadDot} /> : null}
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceAlt },
  markAllButton: { alignSelf: 'flex-end', marginBottom: spacing.sm },
  markAllText: { ...typography.caption, color: colors.brand, fontWeight: '700' },
  card: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    alignItems: 'flex-start',
  },
  cardUnread: { backgroundColor: colors.brandSoft },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.bodyStrong, color: colors.text },
  body: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  time: { ...typography.small, color: colors.textFaint, marginTop: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand, marginTop: 6 },
});
