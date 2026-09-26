export const QUEUE_NAME = 'email-send';

export const EMAIL_STATUS = {
  SCHEDULED: 'scheduled',
  SENDING: 'sending',
  SENT: 'sent',
  FAILED: 'failed',
  RATE_LIMITED: 'rate_limited',
} as const;

export type EmailStatus = (typeof EMAIL_STATUS)[keyof typeof EMAIL_STATUS];

export const SCHEDULED_TAB_STATUSES: EmailStatus[] = [
  EMAIL_STATUS.SCHEDULED,
  EMAIL_STATUS.RATE_LIMITED,
  EMAIL_STATUS.SENDING,
];

export const SENT_TAB_STATUSES: EmailStatus[] = [EMAIL_STATUS.SENT, EMAIL_STATUS.FAILED];

export const BULK_CREATE_CHUNK_SIZE = 500;

export const JWT_COOKIE_NAME = 'reachinbox_token';
export const SLACK_STATE_COOKIE_TTL_MS = 10 * 60 * 1000;
