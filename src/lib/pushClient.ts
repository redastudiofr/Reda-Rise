/**
 * Browser side of push notifications: where this device stands, and turning
 * it on. The server part lives in push.ts and the /api/push routes.
 */

export type PushState =
  /** Checking — nothing to show yet. */
  | 'unknown'
  /** No Push API here (old browser, or iPhone Safari outside the installed app). */
  | 'unsupported'
  /** iPhone/iPad in the browser: push only works once the app is on the home screen. */
  | 'needs-install'
  /** The user blocked notifications; only the browser settings can undo it. */
  | 'denied'
  /** Allowed or not asked yet, but this device is not subscribed. */
  | 'off'
  /** Subscribed: reminders reach this device even with the app closed. */
  | 'on';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) output[i] = raw.charCodeAt(i);
  return output;
}

function isAppleMobile(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export async function readPushState(): Promise<PushState> {
  const supported =
    'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined';
  if (!supported) return isAppleMobile() && !isStandalone() ? 'needs-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    return sub && Notification.permission === 'granted' ? 'on' : 'off';
  } catch {
    return 'off';
  }
}

/**
 * Asks for permission (must run from a tap), subscribes this device and
 * registers it with the server. Resolves to the resulting state.
 */
export async function enablePush(): Promise<PushState> {
  const perm = await Notification.requestPermission();
  if (perm === 'denied') return 'denied';
  if (perm !== 'granted') return 'off';

  const reg = await navigator.serviceWorker.ready;
  const res = await fetch('/api/push/key');
  const { key } = (await res.json()) as { key: string };
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key) as unknown as BufferSource,
    }));
  const saved = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ subscription: sub.toJSON() }),
  });
  if (!saved.ok) throw new Error("L'abonnement n'a pas pu être enregistré.");
  return 'on';
}
