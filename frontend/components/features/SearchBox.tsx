'use client';

import { useEffect, useState } from 'react';
import { Input } from '../ui/Input';
import { Table } from '../ui/Table';
import { StatusBadge } from '../ui/StatusBadge';
import { useEmailSearch } from '../../lib/hooks/useEmails';

const DEBOUNCE_MS = 350;

export function SearchBox() {
  const [input, setInput] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(input), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [input]);

  const { data, isLoading } = useEmailSearch(debounced);

  return (
    <div className="space-y-3">
      <Input
        placeholder="Search by email, subject, or body…"
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />
      {debounced && (
        <Table
          columns={[
            { key: 'toEmail', header: 'Email', cell: (row: any) => row.toEmail },
            { key: 'subject', header: 'Subject', cell: (row: any) => row.subject },
            {
              key: 'status',
              header: 'Status',
              cell: (row: any) => <StatusBadge status={row.status} />,
            },
          ]}
          rows={data?.results ?? []}
          rowKey={(row: any) => row.id}
          loading={isLoading}
          emptyMessage="No matches."
        />
      )}
    </div>
  );
}
