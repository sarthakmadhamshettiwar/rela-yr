// Global variables
let currentEvents = [];
let filteredEvents = [];
let selectedEvent = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeTabs();
    loadEvents();
    checkSystemStatus();
    setupEventListeners();
    updateStats();
});

// Tab Management
function initializeTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            
            // Remove active class from all tabs and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding content
            button.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
        });
    });
}

// Event Listeners Setup
function setupEventListeners() {
    // Search functionality
    document.getElementById('searchInput').addEventListener('input', filterEvents);
    document.getElementById('eventTypeFilter').addEventListener('change', filterEvents);
    
    // Modal close functionality
    document.getElementById('eventModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeModal();
        }
    });
    
    // Auto-refresh events every 30 seconds
    setInterval(loadEvents, 30000);
}

// Load Events from Backend
async function loadEvents() {
    try {
        showLoading('eventsTable');
        
        // Mock data for now - replace with actual API call
        const mockEvents = generateMockEvents();
        currentEvents = mockEvents;
        filteredEvents = [...currentEvents];
        
        displayEvents();
        updateStats();
    } catch (error) {
        console.error('Error loading events:', error);
        showError('Failed to load events');
    }
}

// Generate Mock Events (replace with actual API call)
function generateMockEvents() {
    const eventTypes = ['push', 'pull_request', 'issues', 'release', 'fork', 'star'];
    const repositories = ['user/repo1', 'user/repo2', 'org/project'];
    const events = [];
    
    for (let i = 0; i < 20; i++) {
        const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        const repo = repositories[Math.floor(Math.random() * repositories.length)];
        const date = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
        
        events.push({
            id: i + 1,
            eventType: eventType,
            repository: repo,
            commitId: eventType === 'push' ? generateCommitId() : null,
            receivedAt: date.toISOString(),
            payload: generateMockPayload(eventType, repo),
            metadata: {
                source: 'github',
                event_type: eventType,
                user_agent: 'GitHub-Hookshot/abc123'
            }
        });
    }
    
    return events.sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt));
}

function generateCommitId() {
    return Math.random().toString(36).substring(2, 9);
}

function generateMockPayload(eventType, repo) {
    const basePayload = {
        repository: {
            name: repo.split('/')[1],
            full_name: repo,
            owner: {
                login: repo.split('/')[0]
            }
        },
        sender: {
            login: 'developer' + Math.floor(Math.random() * 100)
        }
    };

    switch (eventType) {
        case 'push':
            return {
                ...basePayload,
                commits: [
                    {
                        id: generateCommitId(),
                        message: 'Fix bug in authentication',
                        author: { name: 'Developer', email: 'dev@example.com' }
                    }
                ],
                ref: 'refs/heads/main'
            };
        case 'pull_request':
            return {
                ...basePayload,
                pull_request: {
                    number: Math.floor(Math.random() * 1000),
                    title: 'Add new feature',
                    state: 'open'
                },
                action: 'opened'
            };
        case 'issues':
            return {
                ...basePayload,
                issue: {
                    number: Math.floor(Math.random() * 500),
                    title: 'Bug report',
                    state: 'open'
                },
                action: 'opened'
            };
        default:
            return basePayload;
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
                <div class="event-detail">
                    <strong>Repository:</strong> ${event.repository}
                </div>
                <div class="event-detail">
                    <strong>Sender:</strong> ${event.payload.sender?.login || 'Unknown'}
                </div>
                ${event.commitId ? `
                    <div class="event-detail">
                        <strong>Commit:</strong> ${event.commitId}
                    </div>
                ` : ''}
                <div class="event-detail">
                    <strong>ID:</strong> #${event.id}
                </div>
            </div>
        </div>
    `).join('');
}

// Filter Events
function filterEvents() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const eventTypeFilter = document.getElementById('eventTypeFilter').value;
    
    filteredEvents = currentEvents.filter(event => {
        const matchesSearch = !searchTerm || 
            event.repository.toLowerCase().includes(searchTerm) ||
            event.eventType.toLowerCase().includes(searchTerm) ||
            (event.payload.sender?.login || '').toLowerCase().includes(searchTerm);
            
        const matchesType = !eventTypeFilter || event.eventType === eventTypeFilter;
        
        return matchesSearch && matchesType;
    });
    
    displayEvents();
}

// Show Event Details Modal
function showEventDetails(eventId) {
    selectedEvent = currentEvents.find(event => event.id === eventId);
    if (!selectedEvent) return;
    
    const eventDetails = document.getElementById('eventDetails');
    eventDetails.innerHTML = `
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
            <div class="detail-content">
                <pre>${JSON.stringify(selectedEvent.payload, null, 2)}</pre>
            </div>
        </div>
        
        <div class="detail-section">
            <h4>Metadata</h4>
            <div class="detail-content">
                <pre>${JSON.stringify(selectedEvent.metadata, null, 2)}</pre>
            </div>
        </div>
    `;
    
    document.getElementById('eventModal').style.display = 'block';
}

// Close Modal
function closeModal() {
    document.getElementById('eventModal').style.display = 'none';
    selectedEvent = null;
}

// Replay Single Event
async function replayEvent() {
    if (!selectedEvent) return;
    
    try {
        // Mock replay - replace with actual API call
        console.log('Replaying event:', selectedEvent);
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        alert(`Event #${selectedEvent.id} has been replayed successfully!`);
        closeModal();
    } catch (error) {
        console.error('Error replaying event:', error);
        alert('Failed to replay event. Please try again.');
    }
}

// Refresh Events
async function refreshEvents() {
    const refreshBtn = document.querySelector('[onclick="refreshEvents()"]');
    const originalText = refreshBtn.innerHTML;
    
    refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
    refreshBtn.disabled = true;
    
    await loadEvents();
    
    refreshBtn.innerHTML = originalText;
    refreshBtn.disabled = false;
}

// Update Statistics
function updateStats() {
    const totalEvents = currentEvents.length;
    const last24h = currentEvents.filter(event => {
        const eventDate = new Date(event.receivedAt);
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        return eventDate > yesterday;
    }).length;
    
    document.getElementById('totalEvents').textContent = totalEvents;
    document.getElementById('recentEvents').textContent = last24h;
}

// Replay Functionality
function previewReplay() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const eventType = document.getElementById('replayEventType').value;
    
    if (!startDate || !endDate) {
        alert('Please select both start and end dates');
        return;
    }
    
    const filteredForReplay = currentEvents.filter(event => {
        const eventDate = new Date(event.receivedAt);
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        const inDateRange = eventDate >= start && eventDate <= end;
        const matchesType = !eventType || event.eventType === eventType;
        
        return inDateRange && matchesType;
    });
    
    alert(`Found ${filteredForReplay.length} events matching your criteria.`);
}

async function startReplay() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const eventType = document.getElementById('replayEventType').value;
    
    if (!startDate || !endDate) {
        alert('Please select both start and end dates');
        return;
    }
    
    const filteredForReplay = currentEvents.filter(event => {
        const eventDate = new Date(event.receivedAt);
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        const inDateRange = eventDate >= start && eventDate <= end;
        const matchesType = !eventType || event.eventType === eventType;
        
        return inDateRange && matchesType;
    });
    
    if (filteredForReplay.length === 0) {
        alert('No events found matching your criteria');
        return;
    }
    
    const confirmed = confirm(`This will replay ${filteredForReplay.length} events. Continue?`);
    if (!confirmed) return;
    
    // Show replay status
    const replayStatus = document.getElementById('replayStatus');
    const progressFill = document.getElementById('progressFill');
    const replayProgress = document.getElementById('replayProgress');
    
    replayStatus.style.display = 'block';
    
    // Simulate replay process
    for (let i = 0; i < filteredForReplay.length; i++) {
        const progress = ((i + 1) / filteredForReplay.length) * 100;
        progressFill.style.width = `${progress}%`;
        replayProgress.textContent = `${i + 1}/${filteredForReplay.length} events processed`;
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    alert('Replay completed successfully!');
    replayStatus.style.display = 'none';
}

// System Status Check
async function checkSystemStatus() {
    // Mock status check - replace with actual API calls
    setTimeout(() => {
        updateStatus('kafkaStatus', 'online', 'Connected');
        updateStatus('dbStatus', 'online', 'Connected');
    }, 1000);
}

function updateStatus(elementId, status, text) {
    const element = document.getElementById(elementId);
    element.className = `status-indicator ${status}`;
    element.innerHTML = `<i class="fas fa-circle"></i> ${text}`;
}

// Settings Functions
function copyWebhookUrl() {
    const webhookUrl = document.getElementById('webhookUrl');
    webhookUrl.value = `${window.location.origin}/webhook`;
    webhookUrl.select();
    document.execCommand('copy');
    alert('Webhook URL copied to clipboard!');
}

async function cleanupOldEvents() {
    const retentionPeriod = document.getElementById('retentionPeriod').value;
    const confirmed = confirm(`This will delete events older than ${retentionPeriod} days. Continue?`);
    
    if (!confirmed) return;
    
    // Mock cleanup - replace with actual API call
    const cutoffDate = new Date(Date.now() - retentionPeriod * 24 * 60 * 60 * 1000);
    const eventsToDelete = currentEvents.filter(event => new Date(event.receivedAt) < cutoffDate);
    
    alert(`${eventsToDelete.length} old events would be deleted.`);
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

function showError(message) {
    console.error(message);
    // Could implement a toast notification system here
}

// API Integration Functions (to be implemented when backend APIs are ready)
async function fetchEvents() {
    // Replace with actual API endpoint
    const response = await fetch('/api/events');
    return await response.json();
}

async function replayEventAPI(eventId) {
    // Replace with actual API endpoint
    const response = await fetch(`/api/events/${eventId}/replay`, {
        method: 'POST'
    });
    return await response.json();
}

async function replayMultipleEventsAPI(eventIds) {
    // Replace with actual API endpoint
    const response = await fetch('/api/events/replay', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ eventIds })
    });
    return await response.json();
}
