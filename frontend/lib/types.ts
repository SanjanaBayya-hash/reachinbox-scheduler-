export type EmailStatus = 'scheduled' | 'sending' | 'sent' | 'failed' | 'rate_limited';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
}

export interface Sender {
  id: string;
  name: string;
  email: string;
  hourlyLimit: number | null;
}

export interface Email {
  id: string;
  campaignId: string;
  toEmail: string;
  subject: string;
  status: EmailStatus;
  scheduledAt: string;
  sentAt: string | null;
  previewUrl: string | null;
  error: string | null;
  sender: { name: string; email: string };
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateCampaignInput {
  subject: string;
  body: string;
  leads: string[];
  startAt: string;
  delayBetweenMs: number;
  hourlyLimit: number;
}

export interface CreateCampaignResult {
  campaign: { id: string; totalCount: number };
  scheduledCount: number;
  duplicateCount: number;
}

export interface SlackStatus {
  connected: boolean;
  teamName?: string;
  connectedAt?: string;
}
