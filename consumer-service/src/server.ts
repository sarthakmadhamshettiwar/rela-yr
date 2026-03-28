import express from 'express';
import path from 'path';
import { getKafkaConsumerWithConnection, runConsumer, subscribeToTopic } from './services/kafka';
import { getApiRouter } from './routes/api';

const TOPIC = process.env.KAFKA_TOPIC || 'github-webhooks';
const PORT = parseInt(process.env.CONSUMER_PORT || '4000');

let kafkaConnected = false;

const start = async () => {
    const app = express();
    app.use(express.json());

    // Serve frontend static files
    const frontendPath = path.join(__dirname, '../../frontend');
    app.use(express.static(frontendPath));

    // API routes
    app.use('/api', getApiRouter(() => kafkaConnected));

    app.listen(PORT, () => {
        console.log(`Consumer API + UI running at http://localhost:${PORT}`);
    });

    // Start Kafka consumer (runs concurrently with HTTP server)
    try {
        const consumer = await getKafkaConsumerWithConnection();
        console.log('Kafka consumer connected');
        kafkaConnected = true;
        await subscribeToTopic(consumer, TOPIC);
        await runConsumer(consumer);
    } catch (error) {
        console.error('Kafka consumer error:', error);
        kafkaConnected = false;
    }
};

start();
