'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../apiClient';
import type { Email, Paginated } from '../types';

const REFRESH_INTERVAL_MS = 5000;

export function useEmails(tab: 'scheduled' | 'sent', page: number) {
  return useQuery({
    queryKey: ['emails', tab, page],
    queryFn: () =>
      apiClient.get<Paginated<Email>>(`/api/emails?tab=${tab}&page=${page}&limit=20`),
    refetchInterval: REFRESH_INTERVAL_MS,
    placeholderData: (prev) => prev,
  });
}

export function useEmailSearch(query: string, status?: string) {
  return useQuery({
    queryKey: ['emails', 'search', query, status],
    queryFn: () =>
      apiClient.get<{ results: Email[] }>(
        `/api/emails/search?q=${encodeURIComponent(query)}${status ? `&status=${status}` : ''}`,
      ),
    enabled: query.length > 0,
  });
}
