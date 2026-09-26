'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '../../components/features/Header';
import { Tabs } from '../../components/ui/Tabs';
import { Button } from '../../components/ui/Button';
import { EmailTable } from '../../components/features/EmailTable';
import { ComposeForm } from '../../components/features/ComposeForm';
import { SearchBox } from '../../components/features/SearchBox';
import { useAuth } from '../../lib/hooks/useAuth';

export default function DashboardPage() {
  const router = useRouter();
  const { data, isLoading, isError } = useAuth();
  const [tab, setTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [composeOpen, setComposeOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && isError) {
      router.push('/login');
    }
  }, [isLoading, isError, router]);

  if (isLoading || !data?.user) {
    return <div className="flex min-h-screen items-center justify-center text-gray-500">Loading…</div>;
  }

  return (
    <div className="min-h-screen">
      <Header user={data.user} />
      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <div className="flex items-center justify-between">
          <Tabs
            value={tab}
            onChange={(v) => setTab(v as 'scheduled' | 'sent')}
            tabs={[
              { value: 'scheduled', label: 'Scheduled' },
              { value: 'sent', label: 'Sent' },
            ]}
          />
          <Button onClick={() => setComposeOpen(true)}>Compose new email</Button>
        </div>

        <SearchBox />

        <EmailTable tab={tab} />
      </main>

      <ComposeForm open={composeOpen} onClose={() => setComposeOpen(false)} />
    </div>
  );
}
