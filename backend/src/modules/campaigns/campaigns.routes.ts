import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware';
import { createCampaignSchema } from './campaigns.schema';
import { createCampaign, NoActiveSendersError } from './campaigns.service';

export const campaignsRouter = Router();

campaignsRouter.post('/', requireAuth, async (req, res) => {
  const parsed = createCampaignSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  try {
    const result = await createCampaign(req.authUser!.id, parsed.data);
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof NoActiveSendersError) {
      res.status(422).json({ error: err.message });
      return;
    }
    throw err;
  }
});
