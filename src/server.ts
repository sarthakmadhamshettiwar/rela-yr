import express, { Request, Response } from 'express';
import {Kafka, Producer} from 'kafkajs';
import { getWebHookRouter } from './routes/webhook';


const getKafkaProducerWithConnection = async () => {
    // setting up kakfa for webhooks
    const kafka = new Kafka({
        clientId: 'my-app',
        brokers: ['localhost:9092'],
    });

    const producer = kafka.producer();
    await producer.connect();
    return producer;
}
// setting up db


// making some router objects


// setting up express server here 
const app = express();
app.use(express.json());


const startServer = async () => {
    app.listen(3000, async () => {
        // connect the database and kafka here 
        try{
            const producer = await getKafkaProducerWithConnection();
            console.log('Kafka connected successfully');

            const webHookRouter = getWebHookRouter(producer);
            app.use('/webhook', webHookRouter);     // all the webhook requests will be handled by the webhookRoutes

        }
        catch(error){
            console.error('Error connecting to Kafka:', error);
        }
        console.log('Server is running on port 3000');
    });
    
}

startServer();
// TODO: what the hell is typescript, and npx ts-node server.ts anyway

