import express, { Request, Response } from 'express';
import { Consumer, Producer } from 'kafkajs';

export const getWebHookRouter = (producer: Producer) => {
    const webHookRouter =  express.Router();
    
    webHookRouter.post('/github', async(req: Request, res: Response) => {
        // all the requests coming to /webhook/github will be handled here
        console.log(req.body);
        const {topic, message} = req.body;
        const {key, value} = message;

        await producer.send({
            topic: topic,
            messages: [{
                key, value
            }],
        })
        // here the github webhook will be processed and the message will be sent to the kafka topic
        res.sendStatus(202);
    });
    
    return webHookRouter;
};

// TODO: difference between module.exports and export const