'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Table, type Column } from '../ui/Table';
import { StatusBadge } from '../ui/StatusBadge';
import { useEmails } from '../../lib/hooks/useEmails';
import type { Email } from '../../lib/types';

export function EmailTable({ tab }: { tab: 'scheduled' | 'sent' }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useEmails(tab, page);

  const columns: Column<Email>[] =
    tab === 'scheduled'
      ? [
          { key: 'toEmail', header: 'Email', cell: (row) => row.toEmail },
          { key: 'subject', header: 'Subject', cell: (row) => row.subject },
          {
            key: 'scheduledAt',
            header: 'Scheduled time',
            cell: (row) => format(new Date(row.scheduledAt), 'PPp'),
          },
          { key: 'status', header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
        ]
      : [
          { key: 'toEmail', header: 'Email', cell: (row) => row.toEmail },
          { key: 'subject', header: 'Subject', cell: (row) => row.subject },
          {
            key: 'sentAt',
            header: 'Sent time',
            cell: (row) => (row.sentAt ? format(new Date(row.sentAt), 'PPp') : '—'),
          },
          { key: 'status', header: 'Status', cell: (row) => <StatusBadge status={row.status} /> },
          {
            key: 'preview',
            header: 'Preview',
            cell: (row) =>
              row.previewUrl ? (
                <a
                  href={row.previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-600 hover:underline"
                >
                  View
                </a>
              ) : (
                '—'
              ),
          },
        ];

  return (
    <div className="space-y-3">
      <Table
        columns={columns}
        rows={data?.items ?? []}
        rowKey={(row) => row.id}
        loading={isLoading}
        emptyMessage={tab === 'scheduled' ? 'No emails scheduled yet.' : 'Nothing sent yet.'}
      />
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm text-gray-600">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-card px-2 py-1 hover:bg-gray-100 disabled:opacity-40"
          >
            Prev
          </button>
          <span>
            Page {data.page} of {data.totalPages}
          </span>
          <button
            disabled={page >= data.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-card px-2 py-1 hover:bg-gray-100 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
