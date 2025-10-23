import crypto from 'crypto';
import { Request } from 'express';
export const getClientIdFromRepo = (ownerName: string, repoId: string) => {
    return crypto.createHash('sha256')
               .update(`${ownerName}-${repoId}`)
               .digest('hex')
               .slice(0, 12);
} // TODO: understand about the library once 

export const getEventFromPayload = (req: Request) : any => {
    const payload = req.body;
    const headers = req.headers;
    const clientId = getClientIdFromRepo(payload?.repository?.owner.name || 'OWNER_NAME', payload?.repository?.name || 'REPO_NAME');
    const eventId = headers['x-github-delivery'] as string;
    const eventType = headers['x-github-event'] as string;
    const commitId = payload?.after || payload?.head_commit?.id || null;
    const event = {
        event_id: eventId,
        source: 'github',
        client_id: clientId,
        received_at: new Date().toISOString(),
        payload,
        metadata: {
          event_type: eventType,
          commit_id: commitId,
          delivery_status: 'received',
          delivery_attempts: 0
        }
    };
    return event;
}