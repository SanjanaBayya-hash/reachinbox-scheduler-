'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../apiClient';
import type { CreateCampaignInput, CreateCampaignResult } from '../types';

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCampaignInput) =>
      apiClient.post<CreateCampaignResult>('/api/campaigns', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emails'] });
    },
  });
}
