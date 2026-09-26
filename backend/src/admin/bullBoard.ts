import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { emailQueue } from '../queue/queues';

export function createBullBoardRouter(basePath: string) {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath(basePath);

  createBullBoard({
    queues: [new BullMQAdapter(emailQueue)],
    serverAdapter,
  });

  return serverAdapter.getRouter();
}
