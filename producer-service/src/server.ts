import express from 'express';
import {getKafkaProducerWithConnection} from './services/kafka';
import { getWebHookRouter } from './routes/webhook';

// setting up express server here 
const app = express();
app.use(express.json());

const startServer = async () => {
    try {
        const producer = await getKafkaProducerWithConnection();
        console.log('Kafka connected successfully');

        
        const webHookRouter = getWebHookRouter(producer);
        app.use('/webhook', webHookRouter);

        app.listen(3000, () => {
            console.log('PRODUCER running at 3000');
        });

    } catch (error) {
        console.error('Error connecting to Kafka:', error);
        process.exit(1);
    }
};
startServer();
// TODO: what the hell is typescript, and npx ts-node server.ts anyway and how is it different from node server.js? 
// isn't node the runtime environment for both of them? 

