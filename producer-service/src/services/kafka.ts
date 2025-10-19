import {Kafka, Producer} from 'kafkajs';

export const getKafkaProducerWithConnection = async () : Promise<Producer> => {
    // setting up kakfa for webhooks
    const kafka = new Kafka({
        clientId: 'my-app',
        brokers: ['localhost:9092'],
    });

    const producer = kafka.producer();
    await producer.connect();
    return producer;
}