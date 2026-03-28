export interface WebhookRequest {
    event_id: string,
    source: string,
    client_id: string, 
    received_at: string,
    payload: any,
    metadata: any
}
