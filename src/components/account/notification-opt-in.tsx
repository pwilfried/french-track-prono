"use client";

import { useEffect, useState } from "react";

import { messages } from "@/app/messages.fr";
import type { PushDevice } from "@/application/push-subscriptions";
import { buttonVariants } from "@/components/ui/button";
import { reportError } from "@/lib/report-error";

export type NotificationState = "unsupported" | "denied" | "off" | "on" | "busy" | "failed";

const text = messages.notifications;
const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/** The applicationServerKey the browser expects: the VAPID public key, base64url decoded. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = base64url.replaceAll("-", "+").replaceAll("_", "/");
  const raw = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** What this device does now: no push support, blocked by the player, or subscribed or not. */
async function currentState(): Promise<NotificationState> {
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return "unsupported";
  }
  if (Notification.permission === "denied") return "denied";
  try {
    const registration = await navigator.serviceWorker.ready;
    return (await registration.pushManager.getSubscription()) ? "on" : "off";
  } catch {
    return "unsupported";
  }
}

/** « Notifications » in the profile: what this device does, and the button (#203). */
export function NotificationToggle({
  state,
  onTurnOn,
  onTurnOff,
}: {
  state: NotificationState;
  onTurnOn: () => void;
  onTurnOff: () => void;
}) {
  const note = {
    unsupported: text.unsupported,
    denied: text.denied,
    on: text.on,
    failed: text.failed,
  }[state as "unsupported" | "denied" | "on" | "failed"];
  return (
    <div className="flex flex-col gap-2 rounded-card border border-border bg-card px-4 py-3">
      <p className="font-semibold">{text.title}</p>
      <p className="text-sm text-muted-foreground">{text.description}</p>
      {note && (
        <p role="status" className="text-sm">
          {note}
        </p>
      )}
      {state === "on" ? (
        <button
          type="button"
          className={buttonVariants({ variant: "outline" })}
          onClick={onTurnOff}
        >
          {text.turnOff}
        </button>
      ) : (
        state !== "unsupported" &&
        state !== "denied" && (
          <button
            type="button"
            className={buttonVariants()}
            onClick={onTurnOn}
            disabled={state === "busy"}
          >
            {text.turnOn}
          </button>
        )
      )}
    </div>
  );
}

/** The settings page row (#1137): the same states as a switch. */
export function NotificationSwitchRow({
  state,
  onTurnOn,
  onTurnOff,
}: {
  state: NotificationState;
  onTurnOn: () => void;
  onTurnOff: () => void;
}) {
  const note = {
    unsupported: text.unsupported,
    denied: text.denied,
    failed: text.failed,
  }[state as "unsupported" | "denied" | "failed"];
  const blocked = state === "unsupported" || state === "denied";
  return (
    <div className="flex min-h-[60px] items-center justify-between gap-3 px-4 py-2">
      <div className="min-w-0">
        <p className="font-bold">{messages.settings.phone}</p>
        {note && (
          <p role="status" className="text-sm text-muted-foreground">
            {note}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={state === "on"}
        aria-label={messages.settings.phone}
        disabled={blocked || state === "busy"}
        onClick={state === "on" ? onTurnOff : onTurnOn}
        className="relative inline-flex h-11 w-14 shrink-0 items-center disabled:opacity-50"
      >
        <span
          aria-hidden="true"
          className={`h-7 w-12 rounded-full border border-border transition-colors motion-reduce:transition-none ${state === "on" ? "bg-primary" : "bg-muted"}`}
        />
        <span
          aria-hidden="true"
          className={`absolute top-1/2 size-5 -translate-y-1/2 rounded-full bg-white shadow transition-all motion-reduce:transition-none ${state === "on" ? "left-7" : "left-1.5"}`}
        />
      </button>
    </div>
  );
}

/** Reads and changes this device's subscription. Hidden when the site has no push key. */
export function NotificationOptIn({
  turnOn,
  turnOff,
  layout = "card",
}: {
  layout?: "card" | "row";
  turnOn: (device: PushDevice) => Promise<boolean>;
  turnOff: (endpoint: string) => Promise<void>;
}) {
  const [state, setState] = useState<NotificationState>("busy");

  useEffect(() => {
    void currentState().then(setState);
  }, []);

  if (!PUBLIC_KEY) return null;
  const key = PUBLIC_KEY;

  async function onTurnOn() {
    setState("busy");
    try {
      if ((await Notification.requestPermission()) !== "granted") return setState("denied");
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(key),
      });
      const { endpoint, keys } = subscription.toJSON();
      const saved =
        endpoint && keys?.p256dh && keys.auth
          ? await turnOn({ endpoint, p256dh: keys.p256dh, auth: keys.auth })
          : false;
      if (!saved) await subscription.unsubscribe();
      setState(saved ? "on" : "failed");
    } catch (error) {
      reportError(error, "notifications-on");
      setState("failed");
    }
  }

  async function onTurnOff() {
    setState("busy");
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await turnOff(subscription.endpoint);
      await subscription.unsubscribe();
    }
    setState("off");
  }

  const View = layout === "row" ? NotificationSwitchRow : NotificationToggle;
  return <View state={state} onTurnOn={onTurnOn} onTurnOff={onTurnOff} />;
}
