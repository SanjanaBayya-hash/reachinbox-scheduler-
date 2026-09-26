'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../apiClient';
import type { User } from '../types';

export function useAuth() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => apiClient.get<{ user: User }>('/api/auth/me'),
    retry: false,
  });
}
