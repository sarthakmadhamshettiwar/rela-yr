process.env.KAFKAJS_NO_PARTITIONER_WARNING = '1';

import express from 'express';
import path from 'path';
import {
    getKafkaProducerWithConnection,
    getKafkaConsumerWithConnection,
    getKafkaAdminWithConnection,
    runConsumer,
    runRetryConsumer,
    subscribeToTopic,
} from './services/kafka';
import { getApiRouter } from './routes/api';

const TOPIC = process.env.KAFKA_TOPIC || 'github-webhooks';
const RETRY_TOPIC = `${TOPIC}-retry`;
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

    // Start Kafka infrastructure
    try {
        // Ensure required topics exist before subscribing
        const admin = await getKafkaAdminWithConnection();
        const existing = await admin.listTopics();
        const toCreate = [TOPIC, RETRY_TOPIC].filter(t => !existing.includes(t));
        if (toCreate.length > 0) {
            await admin.createTopics({
                topics: toCreate.map(topic => ({ topic, numPartitions: 1, replicationFactor: 1 })),
            });
        }
        await admin.disconnect();

        // Single producer shared by both consumers for retry messages
        const retryProducer = await getKafkaProducerWithConnection();

        // Main consumer
        const consumer = await getKafkaConsumerWithConnection();
        await subscribeToTopic(consumer, TOPIC);
        kafkaConnected = true;

        // Retry consumer (fromBeginning: false — only process new retry messages)
        const retryConsumer = await getKafkaConsumerWithConnection('webhook-retry-consumer-group');
        await subscribeToTopic(retryConsumer, RETRY_TOPIC, false);

        // Run both concurrently (long-running, not awaited)
        runConsumer(consumer, retryProducer);
        runRetryConsumer(retryConsumer, retryProducer);
    } catch (error) {
        console.error('Kafka startup error:', error);
        kafkaConnected = false;
    }
};

start();
