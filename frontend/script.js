// Global state
let currentEvents = [];
let filteredEvents = [];
let selectedEvent = null;

document.addEventListener('DOMContentLoaded', () => {
    initializeTabs();
    loadEvents();
    loadStats();
    checkSystemStatus();
    setupEventListeners();
    document.getElementById('webhookUrl').value = 'http://localhost:3000/webhook/github';
});

// Tab Management
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            button.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
        });
    });
}

function setupEventListeners() {
    document.getElementById('searchInput').addEventListener('input', filterEvents);
    document.getElementById('eventTypeFilter').addEventListener('change', filterEvents);
    document.getElementById('eventModal').addEventListener('click', function(e) {
        if (e.target === this) closeModal();
    });
    // Auto-refresh every 30 seconds
    setInterval(() => { loadEvents(); loadStats(); }, 30000);
}

// Load Events from API
async function loadEvents() {
    try {
        showLoading('eventsTable');
        const response = await fetch('/api/events');
        if (!response.ok) throw new Error('API error');
        currentEvents = await response.json();
        filteredEvents = [...currentEvents];
        displayEvents();
    } catch (error) {
        console.error('Error loading events:', error);
        document.getElementById('eventsTable').innerHTML = `
            <div class="loading">
                <i class="fas fa-exclamation-circle"></i>
                Failed to load events. Is the consumer service running?
            </div>
        `;
    }
}

async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        if (!response.ok) throw new Error();
        const { total, last24h } = await response.json();
        document.getElementById('totalEvents').textContent = total;
        document.getElementById('recentEvents').textContent = last24h;
    } catch {
        // Keep current display on error
    }
}

// Display Events
function displayEvents() {
    const eventsTable = document.getElementById('eventsTable');
    if (filteredEvents.length === 0) {
        eventsTable.innerHTML = `
            <div class="loading">
                <i class="fas fa-inbox"></i>
                No events found
            </div>
        `;
        return;
    }
    eventsTable.innerHTML = filteredEvents.map(event => `
        <div class="event-card" onclick="showEventDetails(${event.id})">
            <div class="event-header">
                <span class="event-type">${event.eventType}</span>
                <span class="event-time">${formatDate(event.receivedAt)}</span>
            </div>
            <div class="event-info">
                <div class="event-detail"><strong>Repository:</strong> ${event.repository}</div>
                <div class="event-detail"><strong>Sender:</strong> ${event.payload?.sender?.login || 'Unknown'}</div>
                ${event.commitId ? `<div class="event-detail"><strong>Commit:</strong> ${event.commitId}</div>` : ''}
                <div class="event-detail"><strong>ID:</strong> #${event.id}</div>
            </div>
        </div>
    `).join('');
}

// Filter Events (client-side on loaded data)
function filterEvents() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const eventTypeFilter = document.getElementById('eventTypeFilter').value;
    filteredEvents = currentEvents.filter(event => {
        const matchesSearch = !searchTerm ||
            event.repository.toLowerCase().includes(searchTerm) ||
            event.eventType.toLowerCase().includes(searchTerm) ||
            (event.payload?.sender?.login || '').toLowerCase().includes(searchTerm);
        const matchesType = !eventTypeFilter || event.eventType === eventTypeFilter;
        return matchesSearch && matchesType;
    });
    displayEvents();
}

// Event Detail Modal
function showEventDetails(eventId) {
    selectedEvent = currentEvents.find(e => e.id === eventId);
    if (!selectedEvent) return;
    document.getElementById('eventDetails').innerHTML = `
        <div class="detail-section">
            <h4>Basic Information</h4>
            <div class="detail-content">
                <strong>Event Type:</strong> ${selectedEvent.eventType}<br>
                <strong>Repository:</strong> ${selectedEvent.repository}<br>
                <strong>Received At:</strong> ${formatDate(selectedEvent.receivedAt)}<br>
                <strong>Event ID:</strong> #${selectedEvent.id}
                ${selectedEvent.commitId ? `<br><strong>Commit ID:</strong> ${selectedEvent.commitId}` : ''}
            </div>
        </div>
        <div class="detail-section">
            <h4>Payload</h4>
            <div class="detail-content"><pre>${JSON.stringify(selectedEvent.payload, null, 2)}</pre></div>
        </div>
        <div class="detail-section">
            <h4>Metadata</h4>
            <div class="detail-content"><pre>${JSON.stringify(selectedEvent.metadata, null, 2)}</pre></div>
        </div>
    `;
    document.getElementById('eventModal').style.display = 'block';
}

function closeModal() {
    document.getElementById('eventModal').style.display = 'none';
    selectedEvent = null;
}

// Replay single event from modal
async function replayEvent() {
    if (!selectedEvent) return;
    const btn = document.querySelector('.modal-footer .btn-primary');
    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Replaying...';

        const response = await fetch(`/api/events/${selectedEvent.id}/replay`, { method: 'POST' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Replay failed');

        alert(`Event #${selectedEvent.id} replayed successfully!`);
        closeModal();
    } catch (error) {
        alert(`Failed to replay event: ${error.message}`);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-redo"></i> Replay This Event';
        }
    }
}

async function refreshEvents() {
    const refreshBtn = document.querySelector('[onclick="refreshEvents()"]');
    const originalText = refreshBtn.innerHTML;
    refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
    refreshBtn.disabled = true;
    await Promise.all([loadEvents(), loadStats()]);
    refreshBtn.innerHTML = originalText;
    refreshBtn.disabled = false;
}

// Replay Tab
function getReplayEvents(startDate, endDate, eventType) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return currentEvents.filter(event => {
        const eventDate = new Date(event.receivedAt);
        return eventDate >= start && eventDate <= end &&
               (!eventType || event.eventType === eventType);
    });
}

function previewReplay() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    if (!startDate || !endDate) { alert('Please select both start and end dates'); return; }
    const matched = getReplayEvents(startDate, endDate, document.getElementById('replayEventType').value);
    alert(`Found ${matched.length} events matching your criteria.`);
}

async function startReplay() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const eventType = document.getElementById('replayEventType').value;
    if (!startDate || !endDate) { alert('Please select both start and end dates'); return; }

    const eventsToReplay = getReplayEvents(startDate, endDate, eventType);
    if (eventsToReplay.length === 0) { alert('No events found matching your criteria'); return; }
    if (!confirm(`This will replay ${eventsToReplay.length} events. Continue?`)) return;

    const replayStatus = document.getElementById('replayStatus');
    const progressFill = document.getElementById('progressFill');
    const replayProgress = document.getElementById('replayProgress');
    replayStatus.style.display = 'block';

    let processed = 0;
    let failed = 0;

    for (const event of eventsToReplay) {
        try {
            const response = await fetch(`/api/events/${event.id}/replay`, { method: 'POST' });
            if (!response.ok) failed++;
        } catch {
            failed++;
        }
        processed++;
        progressFill.style.width = `${(processed / eventsToReplay.length) * 100}%`;
        replayProgress.textContent = `${processed}/${eventsToReplay.length} events processed`;
    }

    replayStatus.style.display = 'none';
    alert(`Replay completed: ${processed - failed} succeeded, ${failed} failed.`);
}

// Settings
async function checkSystemStatus() {
    try {
        const response = await fetch('/api/health');
        if (!response.ok) throw new Error();
        const { db, kafka } = await response.json();
        updateStatus('kafkaStatus', kafka, kafka === 'online' ? 'Connected' : 'Disconnected');
        updateStatus('dbStatus', db, db === 'online' ? 'Connected' : 'Disconnected');
    } catch {
        updateStatus('kafkaStatus', 'offline', 'Unknown');
        updateStatus('dbStatus', 'offline', 'Unknown');
    }
}

function updateStatus(elementId, status, text) {
    const element = document.getElementById(elementId);
    element.className = `status-indicator ${status}`;
    element.innerHTML = `<i class="fas fa-circle"></i> ${text}`;
}

function copyWebhookUrl() {
    const webhookUrl = document.getElementById('webhookUrl');
    webhookUrl.select();
    navigator.clipboard.writeText(webhookUrl.value).catch(() => {
        document.execCommand('copy');
    });
    alert('Webhook URL copied to clipboard!');
}

async function cleanupOldEvents() {
    const retentionPeriod = document.getElementById('retentionPeriod').value;
    if (!confirm(`This will delete events older than ${retentionPeriod} days. Continue?`)) return;
    try {
        const response = await fetch(`/api/events/old?days=${retentionPeriod}`, { method: 'DELETE' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        alert(`${data.deleted} events deleted.`);
        await Promise.all([loadEvents(), loadStats()]);
    } catch (error) {
        alert(`Failed to cleanup: ${error.message}`);
    }
}

// Utility Functions
function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

function showLoading(elementId) {
    document.getElementById(elementId).innerHTML = `
        <div class="loading">
            <i class="fas fa-spinner fa-spin"></i>
            Loading events...
        </div>
    `;
}
