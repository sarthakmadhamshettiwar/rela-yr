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
            console.log("Message received: ", message.value?.toString('utf-8'));
            const msgBody = JSON.parse(message.value?.toString('utf-8') || '{}');
            const event: WebhookEvent = {
                repoId: msgBody?.repo_id,
                commitId: msgBody?.metaData?.commit_id as string,
                event_type: msgBody?.metaData?.event_type as string,
                payload: msgBody?.payload || {},
                metadata: msgBody?.metaData || {},
            }
            await insertEventsInDB([event], prisma);
        }
    });
}

export async function clearMessagesFromTopic(topic: string) {
    const admin = await getKafkaAdminWithConnection();
    try {
        // Fetch the latest offsets for all partitions
        const offsets = await admin.fetchTopicOffsets(topic);
        
        // Map the offsets to the format required by deleteTopicRecords
        const partitionsToDelete = offsets.map(o => ({
            partition: o.partition,
            offset: o.offset
        }));

        if (partitionsToDelete.length > 0) {
            await admin.deleteTopicRecords({
                topic,
                partitions: partitionsToDelete
            });
            console.log(`Successfully deleted messages from all partitions of topic: ${topic}`);
        } else {
            console.log(`No partitions found for topic: ${topic}`);
        }
    } catch (error) {
        console.error(`Error clearing topic ${topic}:`, error);
    } finally {
        await admin.disconnect();
    }
}