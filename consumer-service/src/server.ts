import { getKafkaConsumerWithConnection, runConsumer, subscribeToTopic } from './services/kafka';
const TOPIC = process.env.KAFKA_TOPIC || 'github-webhooks';
const startConsumerService = async () => {
    try { 
        const consumer = await getKafkaConsumerWithConnection();
        console.log('Kafka consumer connected successfully');
        subscribeToTopic(consumer, TOPIC);
        runConsumer(consumer);
    } catch (error) {
        console.error('Error connecting to Kafka consumer:', error);
        process.exit(1);
    }
}

startConsumerService();