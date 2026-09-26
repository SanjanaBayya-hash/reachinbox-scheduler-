import { z } from 'zod';

export const createCampaignSchema = z.object({
  subject: z.string().min(1).max(500),
  body: z.string().min(1),
  leads: z.array(z.string().email()).min(1).max(50000),
  startAt: z.coerce.date(),
  delayBetweenMs: z.coerce.number().int().min(0),
  hourlyLimit: z.coerce.number().int().positive(),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
