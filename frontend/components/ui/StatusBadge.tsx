import clsx from 'clsx';
import type { EmailStatus } from '../../lib/types';

const STYLES: Record<EmailStatus, string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  sending: 'bg-amber-100 text-amber-700',
  sent: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  rate_limited: 'bg-orange-100 text-orange-700',
};

const LABELS: Record<EmailStatus, string> = {
  scheduled: 'Scheduled',
  sending: 'Sending',
  sent: 'Sent',
  failed: 'Failed',
  rate_limited: 'Rate limited',
};

export function StatusBadge({ status }: { status: EmailStatus }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        STYLES[status],
      )}
    >
      {LABELS[status]}
    </span>
  );
}
