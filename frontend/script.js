// ── State ──────────────────────────────────────────────────────────────
let currentEvents = [];
let filteredEvents = [];
let selectedEvent = null;
let eventSource = null;

// ── Boot ───────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    setupListeners();
    loadEvents();
    loadStats();
    checkHealth();
    connectSSE();
    document.getElementById('webhookUrl').value = 'http://localhost:3000/webhook/github';
});

// ── Tabs ───────────────────────────────────────────────────────────────
const PAGE_TITLES = { events: 'Events', replay: 'Replay', settings: 'Settings' };

function initTabs() {
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(tab).classList.add('active');
            document.getElementById('pageTitle').textContent = PAGE_TITLES[tab] || tab;
        });
    });
}

function setupListeners() {
    document.getElementById('searchInput').addEventListener('input', applyFilters);
    document.getElementById('eventTypeFilter').addEventListener('change', applyFilters);
    document.getElementById('statusFilter').addEventListener('change', applyFilters);

    document.getElementById('eventModal').addEventListener('click', e => {
        if (e.target === document.getElementById('eventModal')) closeModal();
    });

    // Auto-refresh stats every 60s (SSE handles real-time events)
    setInterval(loadStats, 60_000);
}

// ── SSE ────────────────────────────────────────────────────────────────
function connectSSE() {
    eventSource = new EventSource('/api/events/stream');

    eventSource.onopen = () => setDot('sseDot', 'online');

    eventSource.onmessage = e => {
        try {
            const event = JSON.parse(e.data);
            currentEvents.unshift(event);
            filteredEvents = applyCurrentFilters();
            renderEvents();
            loadStats();
            showToast(event);
        } catch { /* ignore malformed */ }
    };

    eventSource.onerror = () => setDot('sseDot', 'offline');
}

// ── Events ─────────────────────────────────────────────────────────────
async function loadEvents() {
    setLoading('eventsTable');
    try {
        const res = await fetch('/api/events');
        if (!res.ok) throw new Error();
        currentEvents = await res.json();
        filteredEvents = applyCurrentFilters();
        renderEvents();
    } catch {
        document.getElementById('eventsTable').innerHTML = `
            <div class="empty-state">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <h3>Could not load events</h3>
                <p>Is the consumer service running at port 4000?</p>
            </div>`;
    }
}

async function loadStats() {
    try {
        const res = await fetch('/api/stats');
        if (!res.ok) throw new Error();
        const { total, last24h, dead } = await res.json();
        document.getElementById('totalEvents').textContent   = total;
        document.getElementById('recentEvents').textContent  = last24h;
        document.getElementById('deadEvents').textContent    = dead;
        document.getElementById('navTotalEvents').textContent = total;
    } catch { /* keep last values */ }
}

function applyCurrentFilters() {
    const search    = document.getElementById('searchInput').value.toLowerCase();
    const typeVal   = document.getElementById('eventTypeFilter').value;
    const statusVal = document.getElementById('statusFilter').value;

    return currentEvents.filter(e => {
        const matchSearch = !search ||
            e.repository.toLowerCase().includes(search) ||
            e.eventType.toLowerCase().includes(search) ||
            (e.payload?.sender?.login || '').toLowerCase().includes(search);
        const matchType   = !typeVal   || e.eventType === typeVal;
        const matchStatus = !statusVal || e.status === statusVal;
        return matchSearch && matchType && matchStatus;
    });
}

function applyFilters() {
    filteredEvents = applyCurrentFilters();
    renderEvents();
}

function renderEvents() {
    const el = document.getElementById('eventsTable');
    if (filteredEvents.length === 0) {
        el.innerHTML = `
            <div class="empty-state">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <h3>No events</h3>
                <p>Push a commit or trigger a webhook to see events appear here.</p>
            </div>`;
        return;
    }

    el.innerHTML = filteredEvents.map(ev => {
        const retried = ev.status === 'received' && ev.retryCount > 0;
        const statusClass = retried ? 'retried' : ev.status;
        const statusLabel = retried ? `retried ×${ev.retryCount}` : ev.status;

        return `
        <div class="event-card" data-type="${ev.eventType}" onclick="showEventDetails(${ev.id})">
            <div class="event-main">
                <div class="event-top">
                    <span class="event-type-badge">${ev.eventType}</span>
                    <span class="event-repo">${ev.repository}</span>
                </div>
                <div class="event-bottom">
                    <span class="event-sender">${ev.payload?.sender?.login || 'unknown'}</span>
                    ${ev.commitId ? `<span class="event-commit">${ev.commitId.slice(0, 7)}</span>` : ''}
                </div>
            </div>
            <div class="event-right">
                <span class="event-time">${formatDate(ev.receivedAt)}</span>
                <span class="status-pill ${statusClass}">${statusLabel}</span>
            </div>
        </div>`;
    }).join('');
}

// ── Event detail modal ─────────────────────────────────────────────────
function showEventDetails(id) {
    selectedEvent = currentEvents.find(e => e.id === id);
    if (!selectedEvent) return;

    document.getElementById('modalBadge').textContent = selectedEvent.eventType;
    document.getElementById('modalRepo').textContent  = selectedEvent.repository;

    const retried = selectedEvent.status === 'received' && selectedEvent.retryCount > 0;
    const statusLabel = retried ? `retried ×${selectedEvent.retryCount}` : selectedEvent.status;
    const statusClass = retried ? 'retried' : selectedEvent.status;

    document.getElementById('eventDetails').innerHTML = `
        <div class="detail-section">
            <h4>Overview</h4>
            <div class="detail-grid">
                <div class="detail-item">
                    <span class="detail-item-label">Event ID</span>
                    <span class="detail-item-value">#${selectedEvent.id}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-item-label">Received</span>
                    <span class="detail-item-value">${new Date(selectedEvent.receivedAt).toLocaleString()}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-item-label">Status</span>
                    <span class="detail-item-value"><span class="status-pill ${statusClass}">${statusLabel}</span></span>
                </div>
                ${selectedEvent.commitId ? `
                <div class="detail-item">
                    <span class="detail-item-label">Commit</span>
                    <span class="detail-item-value" style="font-family:monospace;font-size:12px">${selectedEvent.commitId}</span>
                </div>` : ''}
            </div>
        </div>
        <div class="detail-section">
            <h4>Payload</h4>
            <div class="detail-code">${escapeHtml(JSON.stringify(selectedEvent.payload, null, 2))}</div>
        </div>
        <div class="detail-section">
            <h4>Metadata</h4>
            <div class="detail-code">${escapeHtml(JSON.stringify(selectedEvent.metadata, null, 2))}</div>
        </div>`;

    document.getElementById('eventModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('eventModal').style.display = 'none';
    selectedEvent = null;
}

async function replayEvent() {
    if (!selectedEvent) return;
    const btn = document.getElementById('replayBtn');
    try {
        btn.disabled = true;
        btn.innerHTML = `<span class="spinner"></span> Replaying...`;

        const res = await fetch(`/api/events/${selectedEvent.id}/replay`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Replay failed');

        closeModal();
        showToast({ eventType: 'replayed', repository: `Event #${selectedEvent.id} replayed` }, 'green');
    } catch (err) {
        alert(`Failed to replay: ${err.message}`);
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg> Replay`;
    }
}

async function refreshEvents() {
    const btn = document.querySelector('[onclick="refreshEvents()"]');
    btn.disabled = true;
    await Promise.all([loadEvents(), loadStats()]);
    btn.disabled = false;
}

// ── Replay tab ─────────────────────────────────────────────────────────
function getReplayEvents() {
    const start     = new Date(document.getElementById('startDate').value);
    const end       = new Date(document.getElementById('endDate').value);
    const eventType = document.getElementById('replayEventType').value;
    return currentEvents.filter(e => {
        const t = new Date(e.receivedAt);
        return t >= start && t <= end && (!eventType || e.eventType === eventType);
    });
}

function previewReplay() {
    const s = document.getElementById('startDate').value;
    const e = document.getElementById('endDate').value;
    if (!s || !e) { alert('Please select both dates'); return; }
    alert(`Found ${getReplayEvents().length} events matching your criteria.`);
}

async function startReplay() {
    const s = document.getElementById('startDate').value;
    const e = document.getElementById('endDate').value;
    if (!s || !e) { alert('Please select both dates'); return; }

    const events = getReplayEvents();
    if (events.length === 0) { alert('No events match your criteria'); return; }
    if (!confirm(`Replay ${events.length} events?`)) return;

    const statusEl   = document.getElementById('replayStatus');
    const fillEl     = document.getElementById('progressFill');
    const progressEl = document.getElementById('replayProgress');
    statusEl.style.display = 'block';

    let done = 0, failed = 0;
    for (const ev of events) {
        try {
            const res = await fetch(`/api/events/${ev.id}/replay`, { method: 'POST' });
            if (!res.ok) failed++;
        } catch { failed++; }
        done++;
        fillEl.style.width     = `${(done / events.length) * 100}%`;
        progressEl.textContent = `${done}/${events.length} events processed`;
    }

    statusEl.style.display = 'none';
    alert(`Done — ${done - failed} succeeded, ${failed} failed.`);
}

// ── Settings ───────────────────────────────────────────────────────────
async function checkHealth() {
    try {
        const res  = await fetch('/api/health');
        const data = await res.json();
        setDot('dbDot',    data.db    === 'online' ? 'online' : 'offline');
        setDot('kafkaDot', data.kafka === 'online' ? 'online' : 'offline');
        setStatusText('dbStatus',    data.db    === 'online');
        setStatusText('kafkaStatus', data.kafka === 'online');
    } catch {
        setDot('dbDot', 'offline');
        setDot('kafkaDot', 'offline');
        setStatusText('dbStatus', false);
        setStatusText('kafkaStatus', false);
    }
}

function setStatusText(id, online) {
    const el = document.getElementById(id);
    el.textContent  = online ? 'Connected' : 'Disconnected';
    el.className    = `status-text ${online ? 'online' : 'offline'}`;
}

function copyWebhookUrl() {
    const input = document.getElementById('webhookUrl');
    input.select();
    navigator.clipboard.writeText(input.value).catch(() => document.execCommand('copy'));
    showToast({ eventType: 'copied', repository: 'URL copied to clipboard' }, 'green');
}

async function deleteAllEvents() {
    if (!confirm('Delete ALL events? This cannot be undone.')) return;
    try {
        const res  = await fetch('/api/events/all', { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        await Promise.all([loadEvents(), loadStats()]);
        showToast({ eventType: 'cleanup', repository: `${data.deleted} events deleted` }, 'green');
    } catch (err) {
        alert(`Failed: ${err.message}`);
    }
}

async function cleanupOldEvents() {
    const days = document.getElementById('retentionPeriod').value;
    if (!confirm(`Delete events older than ${days} days?`)) return;
    try {
        const res  = await fetch(`/api/events/old?days=${days}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        await Promise.all([loadEvents(), loadStats()]);
        showToast({ eventType: 'cleanup', repository: `${data.deleted} events deleted` }, 'green');
    } catch (err) {
        alert(`Cleanup failed: ${err.message}`);
    }
}

// ── Helpers ────────────────────────────────────────────────────────────
function setDot(id, status) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = `dot${id === 'sseDot' ? ' pulse' : ''} ${status}`;
}

function setLoading(id) {
    document.getElementById(id).innerHTML = `
        <div class="loading-state"><span class="spinner"></span> Loading events...</div>`;
}

function showToast(event, color = 'accent') {
    const c   = document.getElementById('toastContainer');
    const t   = document.createElement('div');
    t.className = 'toast';
    const dotColor = color === 'green' ? 'var(--green)' : 'var(--accent)';
    t.innerHTML = `
        <span class="dot" style="background:${dotColor};flex-shrink:0"></span>
        <div>
            <div class="toast-title">${event.eventType}</div>
            <div class="toast-sub">${event.repository}</div>
        </div>`;
    c.appendChild(t);
    setTimeout(() => {
        t.classList.add('out');
        t.addEventListener('animationend', () => t.remove());
    }, 4000);
}

function formatDate(iso) {
    const date = new Date(iso);
    const diff = Date.now() - date;
    const m    = Math.floor(diff / 60_000);
    const h    = Math.floor(diff / 3_600_000);
    const d    = Math.floor(diff / 86_400_000);
    if (m < 1)  return 'just now';
    if (m < 60) return `${m}m ago`;
    if (h < 24) return `${h}h ago`;
    if (d < 7)  return `${d}d ago`;
    return date.toLocaleDateString();
}

function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
