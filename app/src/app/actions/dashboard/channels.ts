"use server";

import { redirect } from "next/navigation";
import { sendTestAlert } from "@/lib/alerts";
import { createChannel, deleteChannel, getOwnedChannel, updateChannel } from "@/lib/channels";
import { guardDashboard } from "@/lib/dashboard";
import { getT } from "@/lib/i18n/server";
import { rateLimit } from "@/lib/rate-limit";
import { isChannelType, normalizeChannelConfig } from "@/monitor/normalize";
import type { ChannelType } from "@/monitor/types";
import type { FormState } from "../types";
import { channelConfigError, idOf, str } from "./helpers";

function configFromForm(formData: FormData) {
  return {
    to: str(formData.get("to")),
    url: str(formData.get("url")),
    secret: str(formData.get("secret")),
    webhookUrl: str(formData.get("webhookUrl")),
    botToken: str(formData.get("botToken")),
    chatId: str(formData.get("chatId")),
  };
}

export async function saveChannelAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await guardDashboard();
  if (!guard.ok) return { error: guard.error };
  const t = await getT();
  const editing = str(formData.get("channel_id")) !== "";
  const existing = editing ? await getOwnedChannel(idOf(formData.get("channel_id")), guard.user.id) : undefined;
  if (editing && !existing) return { error: t("dash.err.channelNotFound") };
  const rawType = existing?.type ?? str(formData.get("type"));
  if (!isChannelType(rawType)) return { error: t("dash.err.type") };
  const type: ChannelType = rawType;

  const name = str(formData.get("name")).trim();
  if (name.length > 120) return { error: t("dash.err.name") };
  const config = normalizeChannelConfig(type, configFromForm(formData));
  const problem = channelConfigError(type, config as unknown as Record<string, unknown>, t);
  if (problem) return { error: problem };
  const label = name || t(`dash.channel.${type}`);

  if (existing) {
    await updateChannel(existing, { name: label, config, isActive: formData.get("active") === "on" });
    redirect("/dashboard/channels?saved=1");
  }
  await createChannel(guard.user.id, type, label, config);
  redirect("/dashboard/channels?created=1");
}

export async function toggleChannelAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await guardDashboard();
  if (!guard.ok) return { error: guard.error };
  const t = await getT();
  const channel = await getOwnedChannel(idOf(formData.get("channel_id")), guard.user.id);
  if (!channel) return { error: t("dash.err.channelNotFound") };
  await updateChannel(channel, { isActive: formData.get("active") === "1" });
  return {};
}

export async function deleteChannelAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await guardDashboard();
  if (!guard.ok) return { error: guard.error };
  const t = await getT();
  const channel = await getOwnedChannel(idOf(formData.get("channel_id")), guard.user.id);
  if (!channel) return { error: t("dash.err.channelNotFound") };
  await deleteChannel(channel.id);
  redirect("/dashboard/channels?deleted=1");
}

/** "Send test": deliver a sample alert to a saved channel. */
export async function testChannelAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await guardDashboard({ allowInDemo: true });
  if (!guard.ok) return { error: guard.error };
  const t = await getT();
  const channel = await getOwnedChannel(idOf(formData.get("channel_id")), guard.user.id);
  if (!channel) return { error: t("dash.err.channelNotFound") };
  if (!rateLimit(`sz-alert-test:${guard.user.id}`, 6, 60_000)) return { error: t("dash.err.testRate") };
  const result = await sendTestAlert(channel);
  return result.ok ? { success: t("dash.channels.testSent") } : { error: t("dash.channels.testFailed", { error: result.error ?? t("dash.err.generic") }) };
}
