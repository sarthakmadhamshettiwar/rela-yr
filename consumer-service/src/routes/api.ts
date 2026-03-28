import { Router, Request, Response } from 'express';
import { prisma } from '../../prisma/prisma';
import { eventBus } from '../eventBus';

const PRODUCER_URL = process.env.PRODUCER_URL || 'http://localhost:3000';

export const getApiRouter = (isKafkaConnected: () => boolean) => {
    const router = Router();

    router.get('/stats', async (_req: Request, res: Response) => {
        try {
            const total = await prisma.event.count();
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const last24h = await prisma.event.count({ where: { receivedAt: { gte: yesterday } } });
            const dead = await prisma.event.count({ where: { status: 'dead' } });
            res.json({ total, last24h, dead });
        } catch {
            res.status(500).json({ error: 'Failed to fetch stats' });
        }
    });

    router.get('/health', async (_req: Request, res: Response) => {
        let dbStatus = 'offline';
        try {
            await prisma.$queryRaw`SELECT 1`;
            dbStatus = 'online';
        } catch {}
        res.json({ db: dbStatus, kafka: isKafkaConnected() ? 'online' : 'offline' });
    });

    // SSE — must come before /events/:id
    router.get('/events/stream', (req: Request, res: Response) => {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        });

        res.write('retry: 3000\n\n');

        const sendEvent = (event: any) => {
            res.write(`data: ${JSON.stringify(event)}\n\n`);
        };

        eventBus.on('new-event', sendEvent);

        // Keepalive ping every 30s
        const keepalive = setInterval(() => res.write(': ping\n\n'), 30_000);

        req.on('close', () => {
            clearInterval(keepalive);
            eventBus.off('new-event', sendEvent);
        });
    });

    router.get('/events', async (req: Request, res: Response) => {
        try {
            const { type, from, to, status } = req.query;
            const where: any = {};
            if (type) where.eventType = type;
            if (status) where.status = status;
            if (from || to) {
                where.receivedAt = {};
                if (from) where.receivedAt.gte = new Date(from as string);
                if (to) where.receivedAt.lte = new Date(to as string);
            }

            const events = await prisma.event.findMany({
                where,
                orderBy: { receivedAt: 'desc' },
                take: 200,
            });

            res.json(events.map(e => ({
                ...e,
                repository:
                    (e.payload as any)?.repository?.full_name ||
                    (e.payload as any)?.repository?.name ||
                    'Unknown',
            })));
        } catch (error) {
            console.error('Error fetching events:', error);
            res.status(500).json({ error: 'Failed to fetch events' });
        }
    });

    router.get('/events/:id', async (req: Request, res: Response) => {
        try {
            const event = await prisma.event.findUnique({ where: { id: parseInt(req.params.id) } });
            if (!event) { res.status(404).json({ error: 'Event not found' }); return; }
            res.json({
                ...event,
                repository:
                    (event.payload as any)?.repository?.full_name ||
                    (event.payload as any)?.repository?.name ||
                    'Unknown',
            });
        } catch {
            res.status(500).json({ error: 'Failed to fetch event' });
        }
    });

    router.post('/events/:id/replay', async (req: Request, res: Response) => {
        try {
            const event = await prisma.event.findUnique({ where: { id: parseInt(req.params.id) } });
            if (!event) { res.status(404).json({ error: 'Event not found' }); return; }

            const response = await fetch(`${PRODUCER_URL}/webhook/github`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-github-event': event.eventType,
                    'x-github-delivery': `replay-${event.id}-${Date.now()}`,
                },
                body: JSON.stringify(event.payload),
            });

            if (!response.ok) {
                res.status(502).json({ error: 'Producer rejected the replayed event' });
                return;
            }

            res.json({ success: true, message: `Event #${event.id} replayed` });
        } catch (error) {
            console.error('Error replaying event:', error);
            res.status(500).json({ error: 'Failed to replay event' });
        }
    });

    router.delete('/events/all', async (_req: Request, res: Response) => {
        try {
            const result = await prisma.event.deleteMany({});
            res.json({ deleted: result.count });
        } catch {
            res.status(500).json({ error: 'Failed to delete all events' });
        }
    });

    router.delete('/events/old', async (req: Request, res: Response) => {
        try {
            const days = parseInt((req.query.days as string) || '30');
            const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
            const result = await prisma.event.deleteMany({ where: { receivedAt: { lt: cutoff } } });
            res.json({ deleted: result.count });
        } catch {
            res.status(500).json({ error: 'Failed to cleanup events' });
        }
    });

    return router;
};
