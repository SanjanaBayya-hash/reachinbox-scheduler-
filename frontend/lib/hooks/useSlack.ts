'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { API_URL, apiClient } from '../apiClient';
import type { SlackStatus } from '../types';

export function useSlackStatus() {
  return useQuery({
    queryKey: ['slack', 'status'],
    queryFn: () => apiClient.get<SlackStatus>('/api/slack/status'),
  });
}

export function connectSlack() {
  window.location.href = `${API_URL}/api/slack/install`;
}

export function useDisconnectSlack() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.delete('/api/slack'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['slack', 'status'] }),
  });
}
