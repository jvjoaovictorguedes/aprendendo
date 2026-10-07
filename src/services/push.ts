import Constants from 'expo-constants';
import { Platform } from 'react-native';

type Module = typeof import('expo-notifications');
let loaded: Promise<Module | null> | null = null;
export function loadPushModule(): Promise<Module | null> {
  if (Platform.OS === 'web' || Constants.executionEnvironment === 'storeClient')
    return Promise.resolve(null);
  return (loaded ??= (async () => {
    try {
      const module = await import('expo-notifications');
      module.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
        }),
      });
      return module;
    } catch {
      return null;
    }
  })());
}
export async function getPushRegistration(prompt: boolean) {
  const module = await loadPushModule();
  if (!module)
    throw new Error(
      'Notificações no celular exigem o aplicativo instalado por um build. Não estão disponíveis nesta versão web ou no Expo Go.',
    );
  if (Platform.OS === 'android')
    await module.setNotificationChannelAsync('shopping', {
      name: 'Ofertas e lembretes de compra',
      importance: module.AndroidImportance.DEFAULT,
      sound: 'default',
    });
  let permission = await module.getPermissionsAsync();
  if (!permission.granted && prompt && permission.canAskAgain)
    permission = await module.requestPermissionsAsync();
  if (!permission.granted)
    throw new Error(
      'Permissão de notificações não concedida. Você pode liberá-la nas configurações do celular.',
    );
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error('Não foi possível configurar as notificações deste aplicativo.');
  const pushToken = await module.getExpoPushTokenAsync({ projectId });
  return { token: pushToken.data, platform: Platform.OS as 'android' | 'ios' };
}
