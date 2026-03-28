import { PrismaClient } from '@prisma/client';
import { WebhookEvent } from '../../types';

export const insertEventsInDB = async (events: WebhookEvent[], prisma: PrismaClient) => {
    try {
      // we need to write in multiple tables here
      // 1. writing the payload in event table
      await prisma.event.createMany({
        data: events.map(e => ({
          repoId: e.repoId,
          eventType: e.event_type,
          commitId: e.commitId,
          payload: e.payload,
          metadata: e.metadata,
        })),
        skipDuplicates: true, // important for idempotency
      });
      console.log(`Inserted ${events.length} events`);
    } catch (error) {
      console.error('Error inserting events:', error);
      // optionally implement retry logic here
    }
}
