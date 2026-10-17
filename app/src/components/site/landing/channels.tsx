import { Hash, Mail, MessageCircle, Send, Users, Webhook, type LucideIcon } from "lucide-react";
import type { ChannelType } from "@/monitor/types";

/** Alert channels in the order they are presented, with a brand-ish tile colour. */
export const LANDING_CHANNELS: Array<{ type: ChannelType; icon: LucideIcon; tile: string }> = [
  { type: "email", icon: Mail, tile: "bg-primary" },
  { type: "slack", icon: Hash, tile: "bg-[#4a154b] dark:bg-[#7c3a7e]" },
  { type: "discord", icon: MessageCircle, tile: "bg-[#5865f2]" },
  { type: "telegram", icon: Send, tile: "bg-[#229ed9]" },
  { type: "teams", icon: Users, tile: "bg-[#4b53bc]" },
  { type: "webhook", icon: Webhook, tile: "bg-slate-800 dark:bg-slate-600" },
];
