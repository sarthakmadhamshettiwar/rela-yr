import crypto from 'crypto';
import { Request } from 'express';
const getClientIdFromRepo = (ownerName: string, repositoryName: string) => {
    return crypto.createHash('sha256')
               .update(`${ownerName}-${repositoryName}`)
               .digest('hex')
               .slice(0, 12);
} // TODO: understand about the library once 

const getMetaDataFromHeaders = (req: Request) => {
    const event_type = req.headers['x-github-event'] as string;
    const event_id = req.headers['x-github-delivery'] as string;
    const metaData = {
        event_type,
        delivery_status: 'received',
        delivery_attempts: 0
    }
    
    return {event_id, metaData};
}

export const getEventFromRequest = (req: Request) : any => {
    const repositoryName =  req.body.repository.name;
    const clientId = getClientIdFromRepo(req.body.repository.owner.name, repositoryName);
    const { event_id, metaData} = getMetaDataFromHeaders(req);
    const event = {
        repoName: repositoryName, 
        event_id,
        source: 'github',
        client_id: clientId,
        payload: req.body,
        metaData
    };
    return event;
}