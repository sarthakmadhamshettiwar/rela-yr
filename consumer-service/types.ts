export interface WebhookEvent {
    repoId?: number;
    eventType: string;
    commitId?: string;
    payload: any;
    metadata: any;
}