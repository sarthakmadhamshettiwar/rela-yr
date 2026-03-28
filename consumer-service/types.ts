export interface WebhookEvent {
    repoId?: number;
    event_type: string;
    commitId?: string;
    payload: any;
    metadata: any;
    retryCount?: number;
}