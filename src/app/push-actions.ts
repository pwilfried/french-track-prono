"use server";

import { UseCaseError } from "@/application/errors";
import {
  type PushDevice,
  turnOffNotifications,
  turnOnNotifications,
} from "@/application/push-subscriptions";
import { createSupabasePushSubscriptionRepository } from "@/infra";

import { getSessionClient } from "./session";

/** The player turns notifications on for this device (#203). False when it could not be saved. */
export async function turnOnNotificationsAction(device: PushDevice): Promise<boolean> {
  try {
    await turnOnNotifications({
      devices: createSupabasePushSubscriptionRepository(await getSessionClient()),
    }).execute(device);
    return true;
  } catch (error) {
    if (error instanceof UseCaseError) return false;
    throw error;
  }
}

/** The player turns them off for this device. */
export async function turnOffNotificationsAction(endpoint: string): Promise<void> {
  try {
    await turnOffNotifications({
      devices: createSupabasePushSubscriptionRepository(await getSessionClient()),
    }).execute({ endpoint });
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
  }
}
