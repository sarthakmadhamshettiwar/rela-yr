import express, { Request, Response } from 'express';
import { Producer } from 'kafkajs';
import { getClientIdFromRepo } from '../utils/webhook/utils';
const topic = process.env.KAFKA_TOPIC || 'github-webhooks';

export const getWebHookRouter = (producer: Producer) => {
    const webHookRouter =  express.Router();
    
    webHookRouter.post('/github', async(req: Request, res: Response) => {
        // all the requests coming to /webhook/github will be handled here
        const payload = req.body;
        const headers = req.headers;
        const clientId = getClientIdFromRepo(payload?.repository?.owner.name || 'OWNER_NAME', payload?.repository?.name || 'REPO_NAME');
        const eventId = headers['x-github-delivery'] as string;
        const eventType = headers['x-github-event'] as string;
        const commitId = payload?.after || payload?.head_commit?.id || null;
        const event = {
            event_id: eventId,
            source: 'github',
            client_id: clientId,
            received_at: new Date().toISOString(),
            payload,
            metadata: {
              event_type: eventType,
              commit_id: commitId,
              delivery_status: 'received',
              delivery_attempts: 0
            }
          };
        await producer.send({
            topic: topic,
            messages: [{ value: JSON.stringify(event) }],
        })
        // here the github webhook will be processed and the message will be sent to the kafka topic
        res.status(202).json({ message: "Webhook received and sent for processing" });
    });
    
    return webHookRouter;
};

// TODO: difference between module.exports and export const