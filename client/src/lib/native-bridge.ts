/**
 * Capacitor Native Bridge — wrapper til native plugins
 * 
 * Detekterer om appen kører som native (iOS/Android) eller web.
 * Fallback til web APIs når ikke-native.
 * 
 * VIGTIGT: Alle Capacitor imports er dynamiske for at undgå
 * localStorage/sessionStorage brug i web preview (iframe).
 */

// Platform detection uden at importere Capacitor core
function detectNative(): boolean {
  try {
    // Capacitor injicerer denne global i native apps
    const cap = (window as any).Capacitor;
    return !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  } catch {
    return false;
  }
}

function detectPlatform(): 'ios' | 'android' | 'web' {
  try {
    const cap = (window as any).Capacitor;
    if (cap && cap.getPlatform) {
      return cap.getPlatform() as 'ios' | 'android' | 'web';
    }
  } catch {}
  return 'web';
}

export function isNative(): boolean {
  return detectNative();
}

export function getPlatform(): 'ios' | 'android' | 'web' {
  return detectPlatform();
}

// ── Camera ──

export async function takePhoto(quality: 'low' | 'high' = 'high'): Promise<string | null> {
  if (!isNative()) {
    // Web fallback: brug file input
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        } else {
          resolve(null);
        }
      };
      input.click();
    });
  }
  
  try {
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
    const photo = await Camera.getPhoto({
      quality: quality === 'high' ? 90 : 50,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: CameraSource.Camera,
      saveToGallery: true,
    });
    return `data:image/jpeg;base64,${photo.base64String}`;
  } catch (e) {
    console.warn('Camera plugin fejl:', e);
    return null;
  }
}

// ── Geolocation ──

export async function getCurrentPosition(): Promise<{ lat: number; lng: number } | null> {
  if (!isNative()) {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }
  
  try {
    const { Geolocation } = await import('@capacitor/geolocation');
    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  } catch (e) {
    console.warn('Geolocation plugin fejl:', e);
    return null;
  }
}

export async function watchPosition(callback: (pos: { lat: number; lng: number }) => void): Promise<string | null> {
  if (!isNative()) {
    if (!navigator.geolocation) return null;
    return navigator.geolocation.watchPosition(
      (pos) => callback({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000 }
    ).toString();
  }
  
  try {
    const { Geolocation } = await import('@capacitor/geolocation');
    const watchId = await Geolocation.watchPosition({ enableHighAccuracy: true }, (pos: any) => {
      if (pos) callback({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    });
    return watchId;
  } catch (e) {
    console.warn('Geolocation watch fejl:', e);
    return null;
  }
}

// ── Push Notifications ──

export async function initPushNotifications(): Promise<void> {
  if (!isNative()) return;
  
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    
    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }
    if (permStatus.receive !== 'granted') return;
    
    await PushNotifications.register();
    
    PushNotifications.addListener('registration', (token: { value: string }) => {
      console.log('Push token:', token.value);
    });
    
    PushNotifications.addListener('pushNotificationReceived', (notification: any) => {
      console.log('Push modtaget:', notification);
    });
    
    PushNotifications.addListener('pushNotificationActionPerformed', (action: any) => {
      if (action.notification?.data?.route) {
        window.location.hash = action.notification.data.route;
      }
    });
  } catch (e) {
    console.warn('Push notifications fejl:', e);
  }
}

// ── Local Notifications ──

export async function scheduleLocalNotification(
  title: string,
  body: string,
  scheduledAt: Date,
  id?: number
): Promise<void> {
  if (!isNative()) return;
  
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.schedule({
      notifications: [{
        id: id || Date.now(),
        title,
        body,
        schedule: { at: scheduledAt },
      }],
    });
  } catch (e) {
    console.warn('Local notification fejl:', e);
  }
}

// ── Haptics ──

export async function hapticFeedback(style: 'light' | 'medium' | 'heavy' = 'medium'): Promise<void> {
  if (!isNative()) return;
  
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    const impactStyle = style === 'light' ? ImpactStyle.Light : style === 'heavy' ? ImpactStyle.Heavy : ImpactStyle.Medium;
    await Haptics.impact({ style: impactStyle });
  } catch {}
}

export async function hapticSuccess(): Promise<void> {
  if (!isNative()) return;
  try {
    const { Haptics, NotificationType } = await import('@capacitor/haptics');
    await Haptics.notification({ type: NotificationType.Success });
  } catch {}
}

export async function hapticError(): Promise<void> {
  if (!isNative()) return;
  try {
    const { Haptics, NotificationType } = await import('@capacitor/haptics');
    await Haptics.notification({ type: NotificationType.Error });
  } catch {}
}

// ── Network ──

export async function getNetworkStatus(): Promise<{ connected: boolean; type: string }> {
  if (!isNative()) {
    return { connected: navigator.onLine, type: 'wifi' };
  }
  
  try {
    const { Network } = await import('@capacitor/network');
    const status = await Network.getStatus();
    return { connected: status.connected, type: status.connectionType };
  } catch {
    return { connected: navigator.onLine, type: 'unknown' };
  }
}

export function onNetworkChange(callback: (connected: boolean) => void): () => void {
  if (!isNative()) {
    const online = () => callback(true);
    const offline = () => callback(false);
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    return () => {
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
    };
  }
  
  (async () => {
    try {
      const { Network } = await import('@capacitor/network');
      Network.addListener('networkStatusChange', (status: any) => {
        callback(status.connected);
      });
    } catch {}
  })();
  
  return () => {};
}

// ── App Lifecycle ──

export function onAppStateChange(callback: (active: boolean) => void): void {
  if (!isNative()) return;
  
  (async () => {
    try {
      const { App } = await import('@capacitor/app');
      App.addListener('appStateChange', ({ isActive }: { isActive: boolean }) => {
        callback(isActive);
      });
    } catch {}
  })();
}

export function onBackButton(callback: () => void): void {
  if (!isNative()) return;
  
  (async () => {
    try {
      const { App } = await import('@capacitor/app');
      App.addListener('backButton', () => {
        callback();
      });
    } catch {}
  })();
}

// ── Share ──

export async function shareContent(title: string, text: string, url?: string): Promise<void> {
  if (!isNative()) {
    if (navigator.share) {
      await navigator.share({ title, text, url });
    }
    return;
  }
  
  try {
    const { Share } = await import('@capacitor/share');
    await Share.share({ title, text, url, dialogTitle: title });
  } catch {}
}

// ── Init native features ──

export async function initNative(): Promise<void> {
  if (!isNative()) return;
  
  try {
    // Status bar
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#1d4ed8' });
  } catch {}
  
  try {
    // Splash screen — hide after 2s
    const { SplashScreen } = await import('@capacitor/splash-screen');
    setTimeout(async () => {
      try { await SplashScreen.hide(); } catch {}
    }, 2000);
  } catch {}
  
  // Push notifications
  await initPushNotifications();
  
  // Keyboard (iOS)
  if (getPlatform() === 'ios') {
    try {
      const { Keyboard, KeyboardResize, KeyboardStyle } = await import('@capacitor/keyboard');
      Keyboard.setResizeMode({ mode: KeyboardResize.Native });
      Keyboard.setStyle({ style: KeyboardStyle.Dark });
    } catch {}
  }
  
  console.log('Native features initialized for platform:', getPlatform());
}

export default {
  isNative,
  getPlatform,
  takePhoto,
  getCurrentPosition,
  watchPosition,
  initPushNotifications,
  scheduleLocalNotification,
  hapticFeedback,
  hapticSuccess,
  hapticError,
  getNetworkStatus,
  onNetworkChange,
  onAppStateChange,
  onBackButton,
  shareContent,
  initNative,
};
