// public/js/dashboard-main.js - VERSIONE COMPLETA E CORRETTA

// Configurazione API
const API_BASE = '/api';
const MONITORING_API = `${API_BASE}/monitoring`;

// Endpoints
const API_ENDPOINTS = {
    stats: `${MONITORING_API}/stats`,
    security: `${MONITORING_API}/security`,
    pool: `${MONITORING_API}/pool`,
    sessions: `${API_BASE}/auth/sessions`,
    revokeSession: `${API_BASE}/auth/revoke-session`,
    logout: `${API_BASE}/auth/logout`
};

API_ENDPOINTS.alertStatus = `${MONITORING_API}/alert-status`;
API_ENDPOINTS.testAlert = `${MONITORING_API}/test-alert`;

// Variabili per i grafici
let queryTypeChart = null;
let queryTimeChart = null;
let queryTimeData = {
    labels: [],
    datasets: [{
        label: 'Query al minuto',
        data: [],
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.1
    }]
};

// Utility per richieste autenticate
async function authenticatedFetch(url, options = {}) {
    const accessToken = localStorage.getItem('accessToken');
    
    if (!accessToken) {
        console.error('No access token found');
        window.location.href = '/login';
        return;
    }
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        },
        credentials: 'include'
    };
    
    const response = await fetch(url, { ...defaultOptions, ...options });
    
    if (response.status === 401) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return;
    }
    
    return response;
}

async function loadAlertStatus() {
    try {
        const response = await authenticatedFetch(API_ENDPOINTS.alertStatus);
        
        if (!response || !response.ok) {
            throw new Error(`HTTP error! status: ${response?.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            updateAlertStatusDisplay(data);
        }
    } catch (error) {
        console.error('Error loading alert status:', error);
        document.getElementById('alert-status').innerHTML = 
            '<div class="alert alert-warning">⚠️ Impossibile caricare stato alert</div>';
    }
}

function updateAlertStatusDisplay(data) {
    const alertContainer = document.getElementById('alert-status');
    if (!alertContainer) return;

    const { health, alertCounts, thresholds } = data;
    
    // Determina stato generale del sistema
    const diskCritical = health.diskUsage > thresholds.diskSpacePercent;
    const memoryCritical = health.memoryUsage > thresholds.memoryPercent;
    const systemCritical = diskCritical || memoryCritical;
    
    // Aggiorna badge se ci sono problemi
    const badge = document.getElementById('alert-system-badge');
    if (badge) {
        if (systemCritical || (alertCounts.security + alertCounts.errors) > 0) {
            badge.classList.remove('d-none');
        } else {
            badge.classList.add('d-none');
        }
    }
    
    const alertHtml = `
        <div class="row">
            <div class="col-md-6">
                <div class="alert-system-section">
                    <h6><i class="fas fa-heartbeat"></i> Salute Sistema</h6>
                    <div class="metric">
                        <span class="metric-label">💾 Utilizzo Disco:</span>
                        <span class="metric-value ${diskCritical ? 'health-critical' : 'health-good'}">
                            ${health.diskUsage}%
                        </span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">🧠 Utilizzo Memoria:</span>
                        <span class="metric-value ${memoryCritical ? 'health-critical' : 'health-good'}">
                            ${health.memoryUsage}%
                        </span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">⚡ Utilizzo CPU:</span>
                        <span class="metric-value ${health.cpuUsage > 80 ? 'health-warning' : 'health-good'}">
                            ${health.cpuUsage}%
                        </span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">⏰ Ultimo Check:</span>
                        <span class="metric-value text-muted">
                            ${new Date(health.timestamp).toLocaleTimeString()}
                        </span>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="alert-system-section">
                    <h6><i class="fas fa-bell"></i> Alert Inviati (ultima ora)</h6>
                    <div class="metric">
                        <span class="metric-label">🔒 Sicurezza:</span>
                        <span class="metric-value ${alertCounts.security > 0 ? 'health-warning' : 'health-good'}">
                            ${alertCounts.security || 0}
                        </span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">❌ Errori:</span>
                        <span class="metric-value ${alertCounts.errors > 0 ? 'health-warning' : 'health-good'}">
                            ${alertCounts.errors || 0}
                        </span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">💾 Sistema:</span>
                        <span class="metric-value ${(alertCounts.diskSpace + alertCounts.memory) > 0 ? 'health-warning' : 'health-good'}">
                            ${(alertCounts.diskSpace || 0) + (alertCounts.memory || 0)}
                        </span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">🔄 Reset Automatico:</span>
                        <span class="metric-value text-muted">
                            ${new Date(alertCounts.lastReset).toLocaleTimeString()}
                        </span>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Sezione controlli -->
        <div class="row mt-3">
            <div class="col-md-6">
                <div class="alert-system-section">
                    <h6><i class="fas fa-cog"></i> Soglie Alert</h6>
                    <div class="metric">
                        <span class="metric-label">Disco:</span>
                        <span class="metric-value">${thresholds.diskSpacePercent}%</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Memoria:</span>
                        <span class="metric-value">${thresholds.memoryPercent}%</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Max/ora:</span>
                        <span class="metric-value">${thresholds.maxAlertsPerHour}</span>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="alert-system-section">
                    <h6><i class="fas fa-vial"></i> Test & Controllo</h6>
                    <button onclick="testAlertSystem()" class="btn btn-test-alert btn-sm w-100 mb-2">
                        <i class="fas fa-paper-plane"></i> Test Email Alert
                    </button>
                    <button onclick="forceHealthCheck()" class="btn btn-outline-info btn-sm w-100">
                        <i class="fas fa-sync-alt"></i> Forza Health Check
                    </button>
                </div>
            </div>
        </div>
        
        ${systemCritical ? `
        <div class="alert alert-danger mt-3">
            <i class="fas fa-exclamation-triangle"></i>
            <strong>Attenzione!</strong> Il sistema ha raggiunto soglie critiche.
            ${diskCritical ? ` Disco: ${health.diskUsage}%.` : ''}
            ${memoryCritical ? ` Memoria: ${health.memoryUsage}%.` : ''}
        </div>
        ` : ''}
    `;
    
    alertContainer.innerHTML = alertHtml;
}

async function testAlertSystem() {
    const button = event.target.closest('button');
    const originalText = button.innerHTML;
    
    try {
        // Disabilita il pulsante e mostra loading
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Invio in corso...';
        
        const response = await authenticatedFetch(API_ENDPOINTS.testAlert, {
            method: 'POST'
        });
        
        if (!response || !response.ok) {
            throw new Error(`HTTP error! status: ${response?.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('✅ Test alert inviato con successo! Controlla la tua email.', 'success');
            
            // Aggiorna immediatamente lo stato degli alert
            setTimeout(() => loadAlertStatus(), 2000);
        } else {
            throw new Error(result.message || 'Errore nell\'invio del test alert');
        }
    } catch (error) {
        console.error('Test alert error:', error);
        showNotification('❌ Errore durante il test: ' + error.message, 'danger');
    } finally {
        // Ripristina il pulsante
        button.disabled = false;
        button.innerHTML = originalText;
    }
}

async function forceHealthCheck() {
    const button = event.target.closest('button');
    const originalText = button.innerHTML;
    
    try {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Controllo...';
        
        showNotification('🔄 Esecuzione health check forzato...', 'info');
        
        // Ricarica lo stato degli alert che triggera un nuovo health check
        await loadAlertStatus();
        
        showNotification('✅ Health check completato!', 'success');
    } catch (error) {
        console.error('Force health check error:', error);
        showNotification('❌ Errore durante health check: ' + error.message, 'danger');
    } finally {
        button.disabled = false;
        button.innerHTML = originalText;
    }
}

// Inizializza i grafici
function initializeCharts() {
    const ctxPie = document.getElementById('queryTypeChart');
    if (ctxPie) {
        queryTypeChart = new Chart(ctxPie, {
            type: 'doughnut',
            data: {
                labels: ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'OTHER'],
                datasets: [{
                    data: [0, 0, 0, 0, 0],
                    backgroundColor: [
                        'rgba(54, 162, 235, 0.8)',
                        'rgba(75, 192, 192, 0.8)',
                        'rgba(255, 206, 86, 0.8)',
                        'rgba(255, 99, 132, 0.8)',
                        'rgba(153, 102, 255, 0.8)'
                    ],
                    borderColor: [
                        'rgba(54, 162, 235, 1)',
                        'rgba(75, 192, 192, 1)',
                        'rgba(255, 206, 86, 1)',
                        'rgba(255, 99, 132, 1)',
                        'rgba(153, 102, 255, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                    }
                }
            }
        });
    }
    
    const ctxLine = document.getElementById('queryTimeChart');
    if (ctxLine) {
        queryTimeChart = new Chart(ctxLine, {
            type: 'line',
            data: queryTimeData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }
}

// Aggiorna i grafici
function updateCharts(stats) {
    if (queryTypeChart && stats) {
        queryTypeChart.data.datasets[0].data = [
            stats.select || 0,
            stats.insert || 0,
            stats.update || 0,
            stats.delete || 0,
            stats.other || 0
        ];
        queryTypeChart.update();
    }
    
    if (queryTimeChart && stats.queriesPerMinute) {
        const now = new Date().toLocaleTimeString();
        queryTimeData.labels.push(now);
        queryTimeData.datasets[0].data.push(parseFloat(stats.queriesPerMinute));
        
        if (queryTimeData.labels.length > 20) {
            queryTimeData.labels.shift();
            queryTimeData.datasets[0].data.shift();
        }
        
        queryTimeChart.update();
    }
}

// Funzioni per caricare i dati
async function loadStats() {
    try {
        const response = await authenticatedFetch(API_ENDPOINTS.stats);
        
        if (!response || !response.ok) {
            throw new Error(`HTTP error! status: ${response?.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.stats) {
            updateStatsDisplay(data.stats);
        }
    } catch (error) {
        console.error('Error loading stats:', error);
        document.getElementById('stats-container').innerHTML = 
            '<div class="alert alert-danger">Errore nel caricamento delle statistiche</div>';
    }
}

async function loadPoolMetrics() {
    try {
        const response = await authenticatedFetch(API_ENDPOINTS.pool);
        
        if (!response || !response.ok) {
            throw new Error(`HTTP error! status: ${response?.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.data) {
            updatePoolDisplay(data.data);
        }
    } catch (error) {
        console.error('Error loading pool metrics:', error);
        document.getElementById('pool-metrics').innerHTML = 
            '<div class="alert alert-danger">Errore nel caricamento delle metriche del pool</div>';
    }
}

async function loadSecurityEvents() {
    try {
        const response = await authenticatedFetch(API_ENDPOINTS.security);
        
        if (!response || !response.ok) {
            throw new Error(`HTTP error! status: ${response?.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            updateSecurityDisplay(data.securityEvents, data.threatSummary);
        }
    } catch (error) {
        console.error('Error loading security events:', error);
        document.getElementById('security-events').innerHTML = 
            '<div class="alert alert-danger">Errore nel caricamento degli eventi di sicurezza</div>';
    }
}

async function loadSessions() {
    try {
        const response = await authenticatedFetch(API_ENDPOINTS.sessions);
        
        if (!response || !response.ok) {
            throw new Error(`HTTP error! status: ${response?.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.sessions) {
            updateSessionsDisplay(data.sessions);
        } else {
            console.warn('No sessions data in response');
            updateSessionsDisplay([]);
        }
    } catch (error) {
        console.error('Error loading sessions:', error);
        document.getElementById('sessions-container').innerHTML = 
            '<div class="alert alert-danger">Errore nel caricamento delle sessioni</div>';
    }
}

// Funzioni di aggiornamento UI
function updateStatsDisplay(stats) {
    // Leggi i dati nel formato corretto da sqlMonitor
    const elements = {
        'total-queries': stats.total || 0,
        'select-queries': stats.select || 0,
        'insert-queries': stats.insert || 0,
        'update-queries': stats.update || 0,
        'delete-queries': stats.delete || 0,
        'suspicious-queries': stats.suspiciousCount || 0,
        'active-users': stats.activeUsers || 0,
        'queries-per-minute': stats.queriesPerMinute || '0.00'
    };
    
    for (const [id, value] of Object.entries(elements)) {
        const element = document.getElementById(id);
        if (element) {
            const oldValue = element.textContent;
            element.textContent = value;
            
            if (oldValue !== value.toString()) {
                element.classList.add('updated');
                setTimeout(() => element.classList.remove('updated'), 500);
            }
        }
    }
    
    // Aggiorna i grafici
    updateCharts(stats);
}

function updatePoolDisplay(poolData) {
    const container = document.getElementById('pool-metrics');
    if (!container) return;
    
    let html = '<div class="row">';
    
    // Usa i dati da poolMetrics.current se disponibili (più accurati)
    if (poolData.poolMetrics && poolData.poolMetrics.current) {
        const current = poolData.poolMetrics.current;
        
        html += `
            <div class="col-md-6">
                <h5>Auth Pool</h5>
                <div class="pool-stats">
                    <div class="stat-item">
                        <span class="stat-label">Connessioni Attive:</span>
                        <span class="stat-value">${current.auth?.active || 0}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Connessioni Idle:</span>
                        <span class="stat-value">${current.auth?.idle || 0}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">In Coda:</span>
                        <span class="stat-value">${current.auth?.queue || 0}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Limite Connessioni:</span>
                        <span class="stat-value">${current.auth?.connectionLimit || 0}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Utilizzo:</span>
                        <span class="stat-value ${parseFloat(current.auth?.utilizationPercentage) > 80 ? 'text-danger' : ''}">${current.auth?.utilizationPercentage || '0'}%</span>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <h5>Template Pool</h5>
                <div class="pool-stats">
                    <div class="stat-item">
                        <span class="stat-label">Connessioni Attive:</span>
                        <span class="stat-value">${current.template?.active || 0}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Connessioni Idle:</span>
                        <span class="stat-value">${current.template?.idle || 0}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">In Coda:</span>
                        <span class="stat-value">${current.template?.queue || 0}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Limite Connessioni:</span>
                        <span class="stat-value">${current.template?.connectionLimit || 0}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Utilizzo:</span>
                        <span class="stat-value ${parseFloat(current.template?.utilizationPercentage) > 80 ? 'text-danger' : ''}">${current.template?.utilizationPercentage || '0'}%</span>
                    </div>
                </div>
            </div>
        `;
        
        // Mostra trend se disponibili
        if (poolData.poolMetrics.trends) {
            html += `
                <div class="col-12 mt-3">
                    <h6>Trend</h6>
                    <p>Auth Pool: <span class="badge bg-${getTrendColor(poolData.poolMetrics.trends.auth)}">${poolData.poolMetrics.trends.auth}</span></p>
                    <p>Template Pool: <span class="badge bg-${getTrendColor(poolData.poolMetrics.trends.template)}">${poolData.poolMetrics.trends.template}</span></p>
                </div>
            `;
        }
    } else if (poolData.poolStatus) {
        // Fallback ai dati da poolStatus
        const authPool = poolData.poolStatus.authPool || {};
        const mainPool = poolData.poolStatus.mainPool || poolData.poolStatus.templatePool || {};
        
        html += `
            <div class="col-md-6">
                <h5>Auth Pool</h5>
                <ul class="list-unstyled">
                    <li>Active: ${authPool.active || 0}</li>
                    <li>Waiting: ${authPool.queue || 0}</li>
                    <li>Total: ${authPool.total || 0}</li>
                    <li>Utilizzo: ${authPool.utilizationPercentage || '0%'}</li>
                </ul>
            </div>
            <div class="col-md-6">
                <h5>Main Pool</h5>
                <ul class="list-unstyled">
                    <li>Active: ${mainPool.active || 0}</li>
                    <li>Waiting: ${mainPool.queue || 0}</li>
                    <li>Total: ${mainPool.total || 0}</li>
                    <li>Utilizzo: ${mainPool.utilizationPercentage || '0%'}</li>
                </ul>
            </div>
        `;
    }
    
    html += '</div>';
    
    if (poolData.recommendations && poolData.recommendations.length > 0) {
        html += '<div class="mt-3"><h5>Raccomandazioni</h5><ul>';
        poolData.recommendations.forEach(rec => {
            html += `<li>${rec}</li>`;
        });
        html += '</ul></div>';
    }
    
    container.innerHTML = html;
}

function getTrendColor(trend) {
    switch(trend) {
        case 'increasing': return 'warning';
        case 'decreasing': return 'success';
        case 'stable': return 'info';
        default: return 'secondary';
    }
}

function updateSecurityDisplay(events, summary) {
    const container = document.getElementById('security-events');
    if (!container) return;
    
    let html = '';
    
    if (summary) {
        html += `
            <div class="alert alert-info">
                <h5>Riepilogo Minacce</h5>
                <p>Totale eventi: ${summary.totalThreats || 0}</p>
                <p>Tentativi SQL Injection: ${summary.threatsByType?.SUSPICIOUS_QUERY || 0}</p>
                <p>Login falliti: ${summary.threatsByType?.LOGIN_FAILURE || 0}</p>
            </div>
        `;
    }
    
    if (events && events.events && events.events.length > 0) {
        html += '<h5>Eventi Recenti</h5><div class="table-responsive"><table class="table table-sm">';
        html += '<thead><tr><th>Timestamp</th><th>Tipo</th><th>Severità</th><th>Descrizione</th></tr></thead><tbody>';
        
        events.events.slice(0, 10).forEach(event => {
            const severityClass = event.severity === 'high' ? 'danger' : 
                                event.severity === 'medium' ? 'warning' : 'info';
            html += `
                <tr>
                    <td>${new Date(event.timestamp).toLocaleString()}</td>
                    <td>${event.type}</td>
                    <td><span class="badge bg-${severityClass}">${event.severity}</span></td>
                    <td>${event.details || event.description || 'N/A'}</td>
                </tr>
            `;
        });
        
        html += '</tbody></table></div>';
    } else {
        html += '<p class="text-muted">Nessun evento di sicurezza recente</p>';
    }
    
    container.innerHTML = html;
}

function updateSessionsDisplay(sessions) {
    const container = document.getElementById('sessions-container');
    if (!container) {
        console.error('Sessions container not found');
        return;
    }
    
    if (!sessions || sessions.length === 0) {
        container.innerHTML = '<p class="text-muted">Nessuna sessione attiva</p>';
        return;
    }
    
    let html = '<div class="table-responsive"><table class="table">';
    html += '<thead><tr><th>Device</th><th>IP</th><th>Creata</th><th>Ultimo Uso</th><th>Azioni</th></tr></thead><tbody>';
    
    sessions.forEach(session => {
        const deviceInfo = session.device_info || session.deviceInfo || {};
        const createdAt = session.created_at || session.createdAt;
        const lastUsed = session.last_used || session.lastUsed || createdAt;
        
        html += `
            <tr>
                <td>${deviceInfo.platform || deviceInfo.userAgent || 'Unknown'}</td>
                <td>${deviceInfo.ip || 'N/A'}</td>
                <td>${createdAt ? new Date(createdAt).toLocaleString() : 'N/A'}</td>
                <td>${lastUsed ? new Date(lastUsed).toLocaleString() : 'N/A'}</td>
                <td>
                    <button class="btn btn-sm btn-danger revoke-session-btn" data-session-id="${session.id}">
                        Revoca
                    </button>
                </td>
            </tr>
        `;
    });
    
    html += '</tbody></table></div>';
    container.innerHTML = html;
    
    // Aggiungi event listeners ai pulsanti revoca
    document.querySelectorAll('.revoke-session-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const sessionId = this.getAttribute('data-session-id');
            revokeSession(sessionId);
        });
    });
}

// Funzione per revocare sessioni
async function revokeSession(sessionId) {
    if (!confirm('Sei sicuro di voler revocare questa sessione?')) return;
    
    try {
        const response = await authenticatedFetch(API_ENDPOINTS.revokeSession, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ sessionId })
        });
        
        if (response && response.ok) {
            showNotification('Sessione revocata con successo', 'success');
            loadSessions();
        } else {
            const error = await response.json();
            throw new Error(error.message || 'Errore nella revoca della sessione');
        }
    } catch (error) {
        console.error('Error revoking session:', error);
        showNotification('Errore nella revoca della sessione: ' + error.message, 'danger');
    }
}

// Funzione per mostrare notifiche
function showNotification(message, type = 'info') {
    const alertContainer = document.getElementById('alert-container');
    if (!alertContainer) return;
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    alertContainer.appendChild(alert);
    
    setTimeout(() => {
        alert.remove();
    }, 5000);
}

// Funzione di logout
async function logout() {
    try {
        const refreshToken = localStorage.getItem('refreshToken');
        await authenticatedFetch(API_ENDPOINTS.logout, {
            method: 'POST',
            body: JSON.stringify({ refreshToken })
        });
    } catch (error) {
        console.error('Logout error:', error);
    } finally {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
    }
}

// Funzione di refresh
function refreshDashboard() {
    showNotification('Aggiornamento dashboard...', 'info');
    loadStats();
    loadPoolMetrics();
    loadSecurityEvents();
    loadSessions();
    loadAlertStatus();
}

// Auto-refresh
function startAutoRefresh() {
    setInterval(() => {
        loadStats();
        loadPoolMetrics();
        loadAlertStatus();
    }, 30000);
    
    setInterval(() => {
        loadSecurityEvents();
    }, 60000);
}

// Inizializzazione
document.addEventListener('DOMContentLoaded', () => {
    
    const accessToken = localStorage.getItem('accessToken');
    if (!accessToken) {
        window.location.href = '/login';
        return;
    }
    
    // Inizializza i grafici
    setTimeout(() => {
        initializeCharts();
    }, 100);
    
    // Carica tutti i dati
    loadStats();
    loadPoolMetrics();
    loadSecurityEvents();
    loadSessions();
    loadAlertStatus();
    
    // Avvia auto-refresh
    startAutoRefresh();
    
    // Setup event listeners
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', (e) => {
            e.preventDefault();
            refreshDashboard();
        });
    }
    
});