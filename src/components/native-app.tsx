"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { nativePush, nativePushState, registerNativePush } from "@/lib/native-push";

/**
 * Application iPhone uniquement : ouvre la bonne page quand on touche une
 * notification, et renouvelle le jeton de notification à chaque ouverture
 * (Apple peut le changer). Ne fait rien dans un navigateur.
 */
export function NativeApp() {
  const router = useRouter();
  useEffect(() => {
    const push = nativePush();
    if (!push) return;
    const tap = push.addListener("pushNotificationActionPerformed", ({ notification }) => {
      const url = notification.data?.url;
      if (url && url.startsWith("/")) router.push(url);
    });
    nativePushState(push)
      .then((s) => (s === "on" ? registerNativePush(push) : null))
      .catch(() => {});
    return () => {
      tap.then((l) => l.remove()).catch(() => {});
    };
  }, [router]);
  return null;
}
