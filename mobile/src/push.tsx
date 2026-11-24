import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { randomUUID } from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import { usePathname, useRootNavigationState, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { accounts, createLiveChat } from './api';
import { hasUsername, useSession } from './session';

const installationKey = 'chatsphere.push-installation.v1';
const promptedKey = 'chatsphere.push-permission-prompted.v1';
const channel = 'messages';
let installation: Promise<string> | undefined;

function getInstallationId() {
  installation ??= (async () => {
    const existing = await SecureStore.getItemAsync(installationKey);
    if (existing) return existing;
    const id = randomUUID();
    await SecureStore.setItemAsync(installationKey, id);
    return id;
  })().catch((error) => {
    installation = undefined;
    throw error;
  });
  return installation;
}

function conversationId(notification: Notifications.Notification) {
  const id = notification.request.content.data?.conversationId;
  return typeof id === 'string' && /^[a-f0-9]{24}$/.test(id) ? id : null;
}

function useDeviceRegistration(sessionToken: string | undefined) {
  useEffect(() => {
    if (!sessionToken) return;
    const session = sessionToken;
    let cancelled = false;
    let registered: string | null | undefined;
    let task = Promise.resolve();

    function refresh(rotated?: string) {
      task = task.then(async () => {
        if (cancelled) return;
        await Notifications.setNotificationChannelAsync(channel, {
          name: 'Messages', importance: Notifications.AndroidImportance.HIGH,
        });
        let permission = await Notifications.getPermissionsAsync();
        if (!permission.granted && permission.canAskAgain && !await SecureStore.getItemAsync(promptedKey)) {
          if (cancelled) return;
          await SecureStore.setItemAsync(promptedKey, '1');
          permission = await Notifications.requestPermissionsAsync();
        }
        const token = permission.granted ? rotated ?? (await Notifications.getDevicePushTokenAsync()).data : null;
        if (cancelled || (token !== null && typeof token !== 'string') || token === registered) return;
        const id = await getInstallationId();
        if (cancelled) return;
        if (token === null) await accounts.unregisterDevice(session, id);
        else await accounts.registerDevice(session, id, token);
        registered = token;
      }).catch(() => {
        // Registration can be retried when the app returns to the foreground.
      });
    }

    refresh();
    const tokenListener = Notifications.addPushTokenListener(({ type, data }) => {
      if (type === 'android' && typeof data === 'string') refresh(data);
    });
    const foreground = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    return () => {
      cancelled = true;
      tokenListener.remove();
      foreground.remove();
    };
  }, [sessionToken]);
}

export function PushNotifications() {
  const { ready, session, expireToken } = useSession();
  const sessionToken = hasUsername(session) ? session?.token : undefined;
  const path = usePathname();
  const navigationReady = !!useRootNavigationState()?.key;
  const router = useRouter();
  const response = Notifications.useLastNotificationResponse();
  const previousSession = useRef<string | undefined>(undefined);

  useDeviceRegistration(sessionToken);

  useEffect(() => {
    Notifications.setNotificationHandler({
      async handleNotification(notification) {
        const id = conversationId(notification);
        const show = !!sessionToken && !!id && path !== `/conversation/${id}`;
        return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false };
      },
    });
    return () => Notifications.setNotificationHandler(null);
  }, [path, sessionToken]);

  useEffect(() => {
    const previous = previousSession.current;
    previousSession.current = sessionToken;
    if (previous && previous !== sessionToken) {
      Notifications.clearLastNotificationResponse();
      void Notifications.dismissAllNotificationsAsync().catch(() => undefined);
    }
  }, [sessionToken]);

  useEffect(() => {
    if (!ready || !navigationReady || !response) return;
    const id = conversationId(response.notification);
    if (!sessionToken || !id || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) {
      Notifications.clearLastNotificationResponse();
      return;
    }
    let cancelled = false;
    const service = createLiveChat(sessionToken, () => expireToken(sessionToken));
    void service.messages(id).then(() => {
      if (!cancelled && path !== `/conversation/${id}`) {
        router.push({ pathname: '/conversation/[id]', params: { id } });
      }
    }).catch(() => {
      // An unavailable or unauthorised conversation stays unopened.
    }).finally(() => {
      if (!cancelled) Notifications.clearLastNotificationResponse();
    });
    return () => { cancelled = true; };
  }, [ready, navigationReady, response, sessionToken, path, router, expireToken]);

  return null;
}
