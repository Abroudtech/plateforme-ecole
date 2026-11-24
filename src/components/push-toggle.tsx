"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Download } from "lucide-react";
import { subscribePush, unsubscribePush } from "@/app/actions/push";
import { disableNativePush, enableNativePush, nativePush, nativePushState } from "@/lib/native-push";

type Labels = { title: string; intro: string; enable: string; disable: string; enabled: string; denied: string; iphone: string; install: string };
type State = "loading" | "unsupported" | "off" | "on" | "denied" | "busy";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type InstallEvent = Event & { prompt: () => Promise<void> };

/**
 * Carte « Recevoir les alertes sur ce téléphone » : active les notifications
 * et propose d'installer l'application sur l'écran d'accueil.
 * `compact` : se cache une fois les notifications activées (accueil).
 */
export function PushToggle({ publicKey, labels, compact = false }: { publicKey: string; labels: Labels; compact?: boolean }) {
  const [state, setState] = useState<State>("loading");
  const [install, setInstall] = useState<InstallEvent | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    (async () => {
      // Application iPhone : notifications natives d'Apple.
      const native = nativePush();
      if (native) return setState(await nativePushState(native));
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("unsupported");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.register("/sw.js");
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function enable() {
    setState("busy");
    const native = nativePush();
    if (native) return setState(await enableNativePush(native).catch(() => "off" as const));
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return setState(permission === "denied" ? "denied" : "off");
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
      const res = await subscribePush(sub.toJSON());
      setState(res.ok ? "on" : "off");
    } catch {
      setState("off");
    }
  }

  async function disable() {
    setState("busy");
    const native = nativePush();
    if (native) {
      await disableNativePush(native).catch(() => {});
      return setState("off");
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await unsubscribePush(sub.endpoint);
        await sub.unsubscribe();
      }
    } finally {
      setState("off");
    }
  }

  if (state === "loading" || (compact && (state === "on" || state === "denied"))) return null;
  // Ancienne version de l'application iPhone, sans notifications natives : rien à proposer.
  if (state === "unsupported" && typeof window !== "undefined" && window.Capacitor) return null;
  // iPhone : les notifications ne marchent qu'une fois l'app ajoutée à l'écran d'accueil.
  const ios = typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent);

  return (
    <div className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/80">
      <p className="flex items-center gap-2 font-semibold text-blue-900">
        <Bell size={18} aria-hidden /> {labels.title}
      </p>
      <p className="mt-1 text-sm text-slate-600">{state === "on" ? labels.enabled : labels.intro}</p>
      {state === "denied" && <p className="mt-2 text-sm text-amber-800">{labels.denied}</p>}
      {state === "unsupported" && <p className="mt-2 text-sm text-slate-600">{ios ? labels.iphone : labels.denied}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {(state === "off" || state === "busy") && (
          <button onClick={enable} disabled={state === "busy"} className="inline-flex items-center gap-2 rounded-xl bg-blue-900 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
            <Bell size={16} aria-hidden /> {labels.enable}
          </button>
        )}
        {state === "on" && !compact && (
          <button onClick={disable} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold">
            <BellOff size={16} aria-hidden /> {labels.disable}
          </button>
        )}
        {install && (
          <button
            onClick={async () => {
              await install.prompt();
              setInstall(null);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold"
          >
            <Download size={16} aria-hidden /> {labels.install}
          </button>
        )}
      </div>
    </div>
  );
}
