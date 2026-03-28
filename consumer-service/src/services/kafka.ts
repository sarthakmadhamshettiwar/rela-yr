import { Kafka, Consumer, Producer, Admin, EachMessagePayload } from 'kafkajs';
import { prisma } from '../../prisma/prisma';
import { insertEventsInDB } from './dbWriter';
import { WebhookEvent } from '../../types';

const RETRY_TOPIC = 'github-webhooks-retry';
const MAX_RETRIES = 3;
const BACKOFF_MS = [10_000, 30_000, 120_000]; // 10s, 30s, 2min

const makeKafka = () =>
    new Kafka({ clientId: 'webhook-replayer', brokers: ['localhost:9092'] });

export const getKafkaProducerWithConnection = async (): Promise<Producer> => {
    const producer = makeKafka().producer();
    await producer.connect();
    return producer;
};

export const getKafkaConsumerWithConnection = async (
    groupId = 'webhook-consumer-group'
): Promise<Consumer> => {
    const consumer = makeKafka().consumer({
        groupId,
        sessionTimeout: 300_000,   // 5min — needed for retry backoff waits
        heartbeatInterval: 3_000,
    });
    await consumer.connect();
    return consumer;
};

export const getKafkaAdminWithConnection = async (): Promise<Admin> => {
    const admin = makeKafka().admin();
    await admin.connect();
    return admin;
};

export const subscribeToTopic = async (
    consumer: Consumer,
    topic: string,
    fromBeginning = true
) => {
    await consumer.subscribe({ topic, fromBeginning });
};

// Main consumer — on failure sends to retry topic
export const runConsumer = async (consumer: Consumer, retryProducer: Producer) => {
    await consumer.run({
        eachMessage: async ({ message }: EachMessagePayload) => {
            const msgBody = JSON.parse(message.value?.toString('utf-8') || '{}');
            const event: WebhookEvent = {
                repoId: msgBody?.repo_id,
                commitId: msgBody?.metaData?.commit_id,
                event_type: msgBody?.metaData?.event_type,
                payload: msgBody?.payload || {},
                metadata: msgBody?.metaData || {},
            };

            try {
                await insertEventsInDB([event], prisma);
            } catch (error) {
                console.error(`✗ DB write failed, scheduling retry:`, (error as Error).message);
                await retryProducer.send({
                    topic: RETRY_TOPIC,
                    messages: [{
                        value: JSON.stringify({
                            event,
                            retryCount: 0,
                            retryAfter: Date.now() + BACKOFF_MS[0],
                        }),
                    }],
                });
            }
        },
    });
};

// Retry consumer — waits backoff time then retries; sends to DLQ after MAX_RETRIES
export const runRetryConsumer = async (consumer: Consumer, producer: Producer) => {
    await consumer.run({
        eachMessage: async ({ message, heartbeat }: EachMessagePayload) => {
            const body = JSON.parse(message.value?.toString('utf-8') || '{}');
            const { event, retryCount = 0, retryAfter = Date.now() } = body;

            // Wait until retryAfter, keeping consumer alive with heartbeats
            const waitMs = Math.max(0, retryAfter - Date.now());
            if (waitMs > 0) {
                console.log(`  retry #${retryCount + 1} for ${event.event_type} in ${Math.round(waitMs / 1000)}s`);
                const end = Date.now() + waitMs;
                while (Date.now() < end) {
                    const remaining = end - Date.now();
                    await new Promise(resolve => setTimeout(resolve, Math.min(3000, remaining)));
                    if (Date.now() < end) await heartbeat();
                }
            }

            try {
                await insertEventsInDB([{ ...event, retryCount: retryCount + 1 }], prisma);
            } catch (error) {
                if (retryCount + 1 >= MAX_RETRIES) {
                    console.error(`✗ event dead after ${MAX_RETRIES} attempts (${event.event_type})`);
                    try {
                        await prisma.event.create({
                            data: {
                                eventType: event.event_type || 'unknown',
                                payload: event.payload,
                                metadata: event.metadata || {},
                                status: 'dead',
                                retryCount: retryCount + 1,
                            },
                        });
                    } catch (dbErr) {
                        console.error('✗ could not write dead event to DB:', (dbErr as Error).message);
                    }
                } else {
                    const nextCount = retryCount + 1;
                    const nextRetryAfter = Date.now() + BACKOFF_MS[nextCount];
                    await producer.send({
                        topic: RETRY_TOPIC,
                        messages: [{
                            value: JSON.stringify({ event, retryCount: nextCount, retryAfter: nextRetryAfter }),
                        }],
                    });
                    console.log(`  retry #${nextCount + 1} scheduled in ${BACKOFF_MS[nextCount] / 1000}s`);
                }
            }
        },
    });
};

export const clearMessagesFromTopic = async (topic: string) => {
    const admin = await getKafkaAdminWithConnection();
    try {
        const offsets = await admin.fetchTopicOffsets(topic);
        const partitions = offsets.map(o => ({ partition: o.partition, offset: o.offset }));
        if (partitions.length > 0) {
            await admin.deleteTopicRecords({ topic, partitions });
            console.log(`Cleared topic: ${topic}`);
        }
    } catch (error) {
        console.error(`Error clearing topic ${topic}:`, error);
    } finally {
        await admin.disconnect();
    }
};
