'use client';

import { Button } from '../ui/Button';
import { connectSlack, useDisconnectSlack, useSlackStatus } from '../../lib/hooks/useSlack';

export function SlackConnect() {
  const { data, isLoading } = useSlackStatus();
  const disconnect = useDisconnectSlack();

  if (isLoading) return null;

  if (data?.connected) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-600">Slack: {data.teamName}</span>
        <Button variant="ghost" onClick={() => disconnect.mutate()} loading={disconnect.isPending}>
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <Button variant="secondary" onClick={connectSlack}>
      Connect Slack
    </Button>
  );
}
