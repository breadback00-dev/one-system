export type MessageChannel = "sms" | "email";

export interface OutboundMessage {
  workspaceId: string;
  contactId: string;
  channel: MessageChannel;
  body: string;
}

export interface InboundMessage {
  workspaceId: string;
  channel: MessageChannel;
  provider: string;
  from: string;
  body: string;
  receivedAt: string;
}

export interface QueuedMessage {
  queuedEventId: string;
  workspaceId: string;
  contactId: string;
  channel: MessageChannel;
  destination: string;
  body: string;
  reason: string;
  deliverAfter?: string;
}

export interface MessageDeliveryResult {
  provider: string;
  deliveredAt: string;
}

export interface MessageGateway {
  send(message: QueuedMessage): Promise<MessageDeliveryResult>;
}

export interface DeliveryStatusSnapshot {
  provider: string;
  queuedCount: number;
  deliveredCount: number;
  recentDelivered: Array<{
    queuedEventId: string;
    contactId: string;
    channel: MessageChannel;
    provider: string;
    deliveredAt: string;
  }>;
}

export interface MessageTimelineItem {
  messageId: string;
  conversationId?: string;
  contactId: string;
  channel: MessageChannel;
  direction: "outbound" | "inbound";
  provider: string;
  destination: string;
  body: string;
  status: string;
  createdAt: string;
  deliveredAt?: string;
}

export interface ConversationThread {
  conversationId: string;
  contactId: string;
  contactLabel: string;
  channel: MessageChannel;
  lastMessageAt: string;
  messages: MessageTimelineItem[];
}
