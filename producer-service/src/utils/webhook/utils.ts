import crypto from 'crypto';

export const getClientIdFromRepo = (ownerName: string, repoId: string) => {
    return crypto.createHash('sha256')
               .update(`${ownerName}-${repoId}`)
               .digest('hex')
               .slice(0, 12);
} // TODO: understand about the library once 

