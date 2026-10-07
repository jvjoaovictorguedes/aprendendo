import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';

import { EmptyState, Icon, Screen, ScreenHeader } from '../../components/ui';
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
  const { notifications, openNotification, markAllAsRead, unreadCount, refreshInbox } =
    useNotifications();
  useFocusEffect(
    useCallback(() => {
      void refreshInbox().catch(() => {});
    }, [refreshInbox]),
  );

  const header = (
    <ScreenHeader
      title="Notificações"
      subtitle={unreadCount > 0 ? `${unreadCount} não lida(s)` : undefined}
      back
      right={
        unreadCount > 0 ? (
          <TouchableOpacity onPress={markAllAsRead} accessibilityRole="button">
            <Text style={styles.markAllText}>Marcar como lidas</Text>
          </TouchableOpacity>
        ) : null
      }
    />
  );

  if (notifications.length === 0) {
    return (
      <Screen header={header}>
        <EmptyState
          emoji="🔔"
          title="Nenhuma notificação"
          subtitle="Avisos de cupons e orçamento aparecem aqui."
        />
      </Screen>
    );
  }

  return (
    <Screen header={header} scroll={false}>
      <FlatList
        contentContainerStyle={styles.list}
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }: { item: NotificationItem }) => (
          <TouchableOpacity
            style={[styles.card, !item.read && styles.cardUnread]}
            onPress={() => openNotification(item)}
            accessibilityRole="button"
          >
            <View style={styles.iconWrap}>
              <Icon name={KIND_ICON[item.kind]} size={18} color={colors.brandDark} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
              <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
            </View>
            {!item.read ? <View style={styles.unreadDot} /> : null}
          </TouchableOpacity>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  flex: { flex: 1 },
  markAllText: { ...typography.caption, color: colors.brandDark, fontWeight: '700' },
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'flex-start',
  },
  cardUnread: { borderColor: colors.brand },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.bodyStrong, color: colors.text },
  body: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  time: { ...typography.small, color: colors.textFaint, marginTop: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand, marginTop: 6 },
});
