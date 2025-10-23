import { prisma } from './prisma';

export const getSomeEvents = async (columns: string []) => {
    console.log("query: ", `SELECT ${columns.join(', ')} FROM "Event" LIMIT 2`);
    return await prisma.$queryRawUnsafe(`SELECT * FROM "Event" LIMIT 10;`);
}

export const getSomeRepos = async (columns: string []) => {
    return await prisma.$queryRaw`SELECT ${columns.join(', ')} FROM "Repo" LIMIT 10`;
}

export const getSomeClients = async (columns: string []) => {
    return await prisma.$queryRaw`SELECT ${columns.join(', ')} FROM "Client" LIMIT 10`;
}

getSomeEvents(['id', 'eventType', 'metadata'])
.then((events) => {
    console.log("Events: ", events);
})
.catch((error) => {
    console.error("Error getting events: ", error);
})
