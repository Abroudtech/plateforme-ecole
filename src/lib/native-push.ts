"use client";

import { subscribeNativePush, unsubscribeNativePush } from "@/app/actions/push";

/**
 * Notifications de l'application iPhone (App Store). Le site tourne alors dans
 * la coque Capacitor (mobile/ios), qui expose le module natif
 * « PushNotifications » sur window.Capacitor.Plugins.
 */
type Permission = "granted" | "denied" | "prompt" | "prompt-with-rationale";
type Listener = { remove: () => Promise<void> };
type PushPlugin = {
  checkPermissions: () => Promise<{ receive: Permission }>;
  requestPermissions: () => Promise<{ receive: Permission }>;
  register: () => Promise<void>;
  unregister: () => Promise<void>;
  addListener(event: "registration", fn: (t: { value: string }) => void): Promise<Listener>;
  addListener(event: "registrationError", fn: (e: unknown) => void): Promise<Listener>;
  addListener(event: "pushNotificationActionPerformed", fn: (a: { notification: { data?: { url?: string } } }) => void): Promise<Listener>;
};

declare global {
  interface Window {
    Capacitor?: { isNativePlatform?: () => boolean; Plugins?: { PushNotifications?: PushPlugin } };
  }
}

const TOKEN_KEY = "native-push-token";

export function nativePush(): PushPlugin | null {
  if (typeof window === "undefined" || !window.Capacitor?.isNativePlatform?.()) return null;
  return window.Capacitor.Plugins?.PushNotifications ?? null;
}

function savedToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Demande un jeton à Apple et l'enregistre pour le compte connecté. */
export function registerNativePush(push: PushPlugin): Promise<boolean> {
  return new Promise((resolve) => {
    const listeners: Promise<Listener>[] = [];
    const done = (ok: boolean) => {
      listeners.forEach((l) => l.then((x) => x.remove()).catch(() => {}));
      resolve(ok);
    };
    listeners.push(
      push.addListener("registration", async ({ value }) => {
        try {
          localStorage.setItem(TOKEN_KEY, value);
        } catch {}
        done((await subscribeNativePush(value)).ok);
      }),
      push.addListener("registrationError", () => done(false)),
    );
    push.register().catch(() => done(false));
  });
}

export async function enableNativePush(push: PushPlugin): Promise<"on" | "off" | "denied"> {
  let { receive } = await push.checkPermissions();
  if (receive !== "granted" && receive !== "denied") receive = (await push.requestPermissions()).receive;
  if (receive === "denied") return "denied";
  if (receive !== "granted") return "off";
  return (await registerNativePush(push)) ? "on" : "off";
}

export async function disableNativePush(push: PushPlugin) {
  const token = savedToken();
  if (token) await unsubscribeNativePush(token);
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
  await push.unregister().catch(() => {});
}

export async function nativePushState(push: PushPlugin): Promise<"on" | "off" | "denied"> {
  const { receive } = await push.checkPermissions();
  if (receive === "denied") return "denied";
  return receive === "granted" && savedToken() ? "on" : "off";
}
