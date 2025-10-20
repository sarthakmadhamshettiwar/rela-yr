-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Clients table
CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    client_uid UUID DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    auth_token_hash VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Repositories table
CREATE TABLE IF NOT EXISTS repositories (
    id SERIAL PRIMARY KEY,
    client_id INT REFERENCES clients(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    full_name VARCHAR(300) UNIQUE NOT NULL,
    url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook events table
CREATE TABLE IF NOT EXISTS webhook_events (
    id SERIAL PRIMARY KEY,
    repo_id INT REFERENCES repositories(id) ON DELETE CASCADE,
    event_type VARCHAR(100),
    commit_id VARCHAR(255),
    received_at TIMESTAMPTZ DEFAULT NOW(),
    payload JSONB,
    metadata JSONB
);

-- Helpful index for querying recent events
CREATE INDEX IF NOT EXISTS idx_webhook_events_repo_time
    ON webhook_events (repo_id, received_at DESC);