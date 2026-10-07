import { Alert, Platform } from 'react-native';

// Alert.alert não aparece no navegador (react-native-web): na web usamos o
// confirm/alert do próprio navegador, no celular o diálogo nativo.

export function confirmAction(options: {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm(`${options.title}\n\n${options.message}`)) options.onConfirm();
    return;
  }
  Alert.alert(options.title, options.message, [
    { text: 'Cancelar', style: 'cancel' },
    {
      text: options.confirmLabel,
      style: options.destructive ? 'destructive' : 'default',
      onPress: options.onConfirm,
    },
  ]);
}

export function showMessage(title: string, message: string, onClose?: () => void) {
  if (Platform.OS === 'web') {
    globalThis.alert(`${title}\n\n${message}`);
    onClose?.();
    return;
  }
  Alert.alert(title, message, [{ text: 'OK', onPress: onClose }]);
}
