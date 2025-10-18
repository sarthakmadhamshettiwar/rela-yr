import { Kafka } from 'kafkajs';
import express, { Request, Response } from 'express';
import { Server } from 'http';

// --- CONFIGURATION ---
const KAFKA_BROKERS = ['localhost:9092']; 
const CONSUMER_GROUP_ID = 'test-group';
const SERVICE_PORT = 3010; 

// --- STATE MANAGEMENT ---
let isConsuming = false; // Flag to ensure consumer.run() is only called once

// --- KAFKA SETUP ---
const kafka = new Kafka({
    clientId: 'my-app',
    brokers: KAFKA_BROKERS,
});

const producer = kafka.producer({
    allowAutoTopicCreation: false,
});

const consumer = kafka.consumer({
    groupId: CONSUMER_GROUP_ID,
});

// --- CORE KAFKA UTILITIES ---

/**
 * Sends a single message to a Kafka topic.
 */
const sendMessage = async (topic: string, message: { value: string, key?: string }) => {
    const messages = [{ 
        value: message.value, 
        key: message.key, 
    }];

    await producer.send({
        topic: topic,
        messages: messages,
    });
};

/**
 * Starts the continuous message consumption loop. This should only be called once.
 */
const runConsumer = async () => {
    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          console.log(`[Consumer] Message received on topic: ${topic}`);
          console.log({
            topic,
            partition,
            key: message.key ? message.key.toString() : null,
            value: message.value ? message.value.toString() : null,
            offset: message.offset,
            timestamp: message.timestamp,
          });
        },
    });
};

// --- EXPRESS SERVER ---

const app = express();
app.use(express.json());

// PRODUCER ENDPOINT (POST)
app.post('/send-message', async (req: Request, res: Response) => {
    try {
        const { topic, message } = req.body;
        
        // Basic check for stability
        if (!topic || !message || typeof message.value !== 'string') {
            return res.status(400).send('Missing topic or message.value');
        }

        await sendMessage(topic, message);
        res.status(200).send(`Message sent to topic: ${topic}`);
    } catch (error) {
        // TypeScript fix: Type narrowing to safely access .message
        if (error instanceof Error) {
            console.error("Producer Error:", error.message);
        } else {
            console.error("Producer Error: An unknown error occurred.", error);
        }
        res.status(500).send('Failed to send message.');
    }
});

// CONSUMER ENDPOINT (POST)
app.post('/subscribe-to-topic', async(req: Request, res: Response) => {
    try {
        const { topic } = req.body;
        
        if (!topic) {
            return res.status(400).send('Missing required body property: "topic"');
        }
        
        // 1. Always subscribe to the new topic
        await consumer.subscribe({ topic, fromBeginning: true });
        
        // 2. Start consumption loop only if it hasn't started yet
        if (!isConsuming) {
            await runConsumer(); 
            isConsuming = true;
            console.log(`Consumption loop started for the first time.`);
        }

        res.status(200).send(`Subscribed to topic: ${topic}. Consumer is now running.`);
    } catch (error) {
        // TypeScript fix: Type narrowing to safely access .message
        if (error instanceof Error) {
            console.error("Consumer Subscription Error:", error.message);
        } else {
            console.error("Consumer Subscription Error: An unknown error occurred.", error);
        }
        res.status(500).send('Failed to subscribe.');
    }
});

// --- LIFECYCLE MANAGEMENT ---

let httpServer: Server;

const startServices = async () => {
    // Connect both Kafka clients with sequential AWAIT
    try {
        await producer.connect();
        console.log("Producer connected successfully.");
        await consumer.connect();
        console.log("Consumer connected successfully.");
    } catch (error) {
        // TypeScript fix: Type narrowing in catch block
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        console.error("Failed to connect Kafka clients. Check broker:", errorMessage);
    }
    
    // Start the single Express Server
    httpServer = app.listen(SERVICE_PORT, () => {
        console.log(`[Service] running on http://localhost:${SERVICE_PORT}`);
    });
};

const shutdown = async () => {
    console.log('\n--- Initiating Shutdown ---');
    
    // Disconnect Kafka clients sequentially and simply
    try {
        await producer.disconnect();
        console.log('Producer disconnected.');
    } catch (error) {
        // TypeScript fix: Type narrowing in catch block
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during producer disconnect.";
        console.error('Producer disconnect error:', errorMessage);
    }

    try {
        await consumer.disconnect();
        console.log('Consumer disconnected.');
    } catch (error) {
        // TypeScript fix: Type narrowing in catch block
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during consumer disconnect.";
        console.error('Consumer disconnect error:', errorMessage);
    }
    
    // Stop the Express server
    httpServer.close(() => {
        console.log('Server shut down.');
        process.exit(0);
    });
};

// Listen for termination signals (Ctrl+C and external termination)
process.on('SIGTERM', shutdown); 
process.on('SIGINT', shutdown); 

// Start everything up
startServices();
