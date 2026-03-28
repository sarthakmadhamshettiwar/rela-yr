import express, { Request, Response } from 'express';
import { Producer } from 'kafkajs';
import { getEventFromRequest } from '../utils/webhook/utils';
const topic = process.env.KAFKA_TOPIC || 'github-webhooks';

export const getWebHookRouter = (producer: Producer) => {
    const webHookRouter =  express.Router();
    
    webHookRouter.post('/github', async(req: Request, res: Response) => {
        const event = getEventFromRequest(req);
        await producer.send({
            topic: topic,
            messages: [{ value: JSON.stringify(event) }],
        });
        console.log(`→ ${event.metaData?.event_type} from ${event.repoName}`);
        res.status(202).json({ message: "Webhook received and sent for processing" });
    });
    
    return webHookRouter;
};

// TODO: difference between module.exports and export const