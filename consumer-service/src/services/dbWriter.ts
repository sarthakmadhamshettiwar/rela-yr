import { PrismaClient } from '@prisma/client';
import { WebhookEvent } from '../../types';
import { eventBus } from '../eventBus';

export const insertEventsInDB = async (events: WebhookEvent[], prisma: PrismaClient) => {
    for (const e of events) {
        const created = await prisma.event.create({
            data: {
                repoId: e.repoId,
                eventType: e.event_type,
                commitId: e.commitId,
                payload: e.payload,
                metadata: e.metadata,
                status: 'received',
                retryCount: e.retryCount || 0,
            },
        });

        console.log(`✓ event #${created.id} ${created.eventType}${created.retryCount > 0 ? ` (retry ${created.retryCount})` : ''}`);

        eventBus.emit('new-event', {
            ...created,
            repository:
                (created.payload as any)?.repository?.full_name ||
                (created.payload as any)?.repository?.name ||
                'Unknown',
        });
    }
    // Throws on error — callers handle retry logic
};
