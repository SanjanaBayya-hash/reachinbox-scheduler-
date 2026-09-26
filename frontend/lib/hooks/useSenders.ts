'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../apiClient';
import type { Sender } from '../types';

export function useSenders() {
  return useQuery({
    queryKey: ['senders'],
    queryFn: () => apiClient.get<{ senders: Sender[] }>('/api/senders'),
  });
}
