import express, { Request, Response } from 'express';
import { Producer } from 'kafkajs';
import { getClientIdFromRepo, getEventFromPayload } from '../utils/webhook/utils';
const topic = process.env.KAFKA_TOPIC || 'github-webhooks';

export const getWebHookRouter = (producer: Producer) => {
    const webHookRouter =  express.Router();
    
    webHookRouter.post('/github', async(req: Request, res: Response) => {
        // all the requests coming to /webhook/github will be handled here
        const event = getEventFromPayload(req);
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