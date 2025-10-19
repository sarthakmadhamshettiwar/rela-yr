import {Kafka, Consumer, EachMessagePayload} from 'kafkajs';

const fs = require('fs').promises;
const path = require('path');

// Define the file path where messages will be stored.
// The file will store an array of JSON objects.
const MESSAGE_LOG_FILE = path.join(__dirname, 'consumed_messages.json');

/**
 * Appends the new message body to a JSON file.
 * It reads the existing array, pushes the new message, and writes the array back.
 * If the file doesn't exist, it is initialized as an empty array.
 * @param {Object} messageBody The parsed JSON object from the message value.
 */
const appendMessageToFile = async (messageBody: any) => {
    let messageArray = [];
    
    try {
        // 1. Read existing content, defaulting to '[]' if file doesn't exist
        let fileContent = '[]';
        try {
            fileContent = await fs.readFile(MESSAGE_LOG_FILE, 'utf8');
        } catch (error: any) {
            // Ignore 'ENOENT' (File Not Found) errors, and use the default '[]'
            if (error.code !== 'ENOENT') {
                throw error;
            }
            console.log(`[File Logger] Initializing new log file at ${MESSAGE_LOG_FILE}`);
        }

        // 2. Parse the array and append the new message body
        // Ensure to handle empty/invalid content gracefully
        messageArray = fileContent.trim() ? JSON.parse(fileContent) : [];
        
        // Push the new message along with a timestamp for context
        messageArray.push({
            timestamp: new Date().toISOString(),
            data: messageBody
        });

        // 3. Write the updated array back to the file (formatted nicely with 2 spaces)
        await fs.writeFile(MESSAGE_LOG_FILE, JSON.stringify(messageArray, null, 2), 'utf8');
        console.log(`[File Logger] Message appended successfully.`);

    } catch (error) {
        console.error(`[File Logger] ERROR writing to file ${MESSAGE_LOG_FILE}:`, error);
        // You may want to implement more robust error handling for production
    }
};


export const getKafkaConsumerWithConnection = async () : Promise<Consumer> => {
    const kafka = new Kafka({
        clientId: 'my-app',
        brokers: ['localhost:9092'],
    });
    const consumer = kafka.consumer({ groupId: 'my-consumer-group' });
    await consumer.connect();
    return consumer;
}

export const subscribeToTopic = async (consumer: Consumer, topic: string) => {
    await consumer.subscribe({ topic, fromBeginning: true });
}

export const runConsumer = async (consumer: Consumer) => {
    await consumer.run({
        eachMessage: async ({ topic, partition, message }: EachMessagePayload) => {
            console.log(`[Consumer] Message received on topic: ${topic}`);
            console.log({
                topic,
                partition,
                messageValue: JSON.parse(message.value?.toString('utf-8') || '{}')
            });
            await appendMessageToFile(JSON.parse(message.value?.toString('utf-8') || '{}'));
        }
    });
}