'use client';

import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { apiClient, API_URL } from '../../lib/apiClient';
import type { User } from '../../lib/types';
import { SlackConnect } from './SlackConnect';

export function Header({ user }: { user: User }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  async function logout() {
    await apiClient.post('/api/auth/logout');
    queryClient.clear();
    router.push('/login');
  }

  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
      <h1 className="text-lg font-semibold text-gray-900">ReachInbox Scheduler</h1>
      <div className="flex items-center gap-4">
        <SlackConnect />
        <a
          href={`${API_URL}/admin/queues`}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-gray-500 hover:text-gray-800"
        >
          Bull Board
        </a>
        <div className="flex items-center gap-2">
          <Avatar src={user.avatarUrl} name={user.name} />
          <div className="text-sm">
            <p className="font-medium leading-tight text-gray-900">{user.name}</p>
            <p className="leading-tight text-gray-500">{user.email}</p>
          </div>
        </div>
        <Button variant="ghost" onClick={logout}>
          Logout
        </Button>
      </div>
    </header>
  );
}
