import { Router } from 'express';
import { env } from '../../config/env';
import { requireAuth } from '../auth/auth.middleware';
import { signSlackState, verifySlackState } from './slack.state';
import {
  disconnectSlack,
  exchangeSlackCode,
  getSlackStatus,
  upsertSlackConnection,
} from './slack.service';

export const slackRouter = Router();

slackRouter.get('/install', requireAuth, (req, res) => {
  const state = signSlackState(req.authUser!.id);
  const params = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID,
    scope: 'incoming-webhook,chat:write',
    redirect_uri: env.SLACK_REDIRECT_URI,
    state,
  });
  res.redirect(`https://slack.com/oauth/v2/authorize?${params.toString()}`);
});

slackRouter.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  if (typeof code !== 'string' || typeof state !== 'string') {
    res.redirect(`${env.FRONTEND_URL}/dashboard?slack=error`);
    return;
  }

  try {
    const userId = verifySlackState(state);
    const oauth = await exchangeSlackCode(code);
    await upsertSlackConnection(userId, oauth);
    res.redirect(`${env.FRONTEND_URL}/dashboard?slack=connected`);
  } catch {
    res.redirect(`${env.FRONTEND_URL}/dashboard?slack=error`);
  }
});

slackRouter.get('/status', requireAuth, async (req, res) => {
  res.json(await getSlackStatus(req.authUser!.id));
});

slackRouter.delete('/', requireAuth, async (req, res) => {
  await disconnectSlack(req.authUser!.id);
  res.status(204).end();
});
