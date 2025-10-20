import {Kafka, Consumer, EachMessagePayload, Admin} from 'kafkajs';
import {prisma} from '../../prisma/prisma';
import { insertEventsInDB } from './dbWriter';
import { WebhookEvent } from '../../types';

export const getKafkaConsumerWithConnection = async () : Promise<Consumer> => {
    const kafka = new Kafka({
        clientId: 'my-app',
        brokers: ['localhost:9092'],
    });
    const consumer = kafka.consumer({ groupId: 'my-consumer-group' });
    await consumer.connect();
    return consumer;
}

export const getKafkaAdminWithConnection = async () : Promise<Admin> => {
    const kafka = new Kafka({
        clientId: 'my-app',
        brokers: ['localhost:9092'],
    });
    const admin = kafka.admin();
    await admin.connect();
    return admin;
}
export const subscribeToTopic = async (consumer: Consumer, topic: string) => {
    await consumer.subscribe({ topic, fromBeginning: true });
}

export const runConsumer = async (consumer: Consumer) => {
    await consumer.run({
        eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
            const msgBody = JSON.parse(message.value?.toString('utf-8') || '{}');
            const event: WebhookEvent = {
                // repoId: undefined, // Skip repoId for now since we don't have auth/repo mapping
                commitId: msgBody?.metadata?.commit_id as string,
                eventType: msgBody?.metadata?.event_type as string,
                payload: msgBody?.payload || {},
                metadata: msgBody?.metadata || {},
            }
            await insertEventsInDB([event], prisma);
        }
    });
}