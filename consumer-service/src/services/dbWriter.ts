import { PrismaClient } from '@prisma/client';
import { WebhookEvent } from '../../types';

export const insertEventsInDB = async (events: WebhookEvent[], prisma: PrismaClient) => {
    try {
      await prisma.event.createMany({
        data: events.map(e => ({
          // repoId: e.repoId,
          eventType: e.eventType,
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
