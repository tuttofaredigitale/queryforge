// public/js/auth-init.js - Inizializzazione autenticazione

(function() {
    'use strict';
    
    // Configurazione token
    const TOKEN_KEY = 'accessToken';
    const REFRESH_TOKEN_KEY = 'refreshToken';
    
    // Verifica se l'utente è autenticato
    function checkAuth() {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) {
            console.log('No token found, redirecting to login');
            window.location.href = '/login';
            return false;
        }
        
        // Verifica se il token è scaduto (decodifica JWT)
        try {
            const payload = parseJWT(token);
            if (payload.exp && payload.exp * 1000 < Date.now()) {
                console.log('Token expired, attempting refresh...');
                return refreshAccessToken();
            }
            return true;
        } catch (error) {
            console.error('Invalid token:', error);
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(REFRESH_TOKEN_KEY);
            window.location.href = '/login';
            return false;
        }
    }
    
    // Parse JWT token
    function parseJWT(token) {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        } catch (error) {
            throw new Error('Invalid token format');
        }
    }
    
    // Refresh access token
    async function refreshAccessToken() {
        const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
        if (!refreshToken) {
            console.log('No refresh token, redirecting to login');
            window.location.href = '/login';
            return false;
        }
        
        try {
            const response = await fetch('/api/auth/refresh-token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ refreshToken })
            });
            
            if (response.ok) {
                const data = await response.json();
                localStorage.setItem(TOKEN_KEY, data.accessToken);
                localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
                console.log('Token refreshed successfully');
                return true;
            } else {
                console.error('Failed to refresh token');
                localStorage.removeItem(TOKEN_KEY);
                localStorage.removeItem(REFRESH_TOKEN_KEY);
                window.location.href = '/login';
                return false;
            }
        } catch (error) {
            console.error('Error refreshing token:', error);
            window.location.href = '/login';
            return false;
        }
    }
    
    // Setup auto-refresh
    function setupAutoRefresh() {
        // Check token every 5 minutes
        setInterval(async () => {
            const token = localStorage.getItem(TOKEN_KEY);
            if (token) {
                try {
                    const payload = parseJWT(token);
                    // Refresh if token expires in less than 5 minutes
                    if (payload.exp && payload.exp * 1000 - Date.now() < 5 * 60 * 1000) {
                        console.log('Token expiring soon, refreshing...');
                        await refreshAccessToken();
                    }
                } catch (error) {
                    console.error('Error checking token:', error);
                }
            }
        }, 5 * 60 * 1000); // 5 minutes
    }
    
    // Interceptor per aggiungere token alle richieste
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        let [url, options = {}] = args;
        
        // Aggiungi token solo per le API
        if (url.startsWith('/api/')) {
            const token = localStorage.getItem(TOKEN_KEY);
            if (token) {
                options.headers = {
                    ...options.headers,
                    'Authorization': `Bearer ${token}`
                };
            }
        }
        
        return originalFetch.apply(this, [url, options])
            .then(async response => {
                // Se ricevi 401, prova a refreshare il token
                if (response.status === 401 && url.startsWith('/api/') && !url.includes('refresh-token')) {
                    console.log('Got 401, attempting token refresh...');
                    const refreshed = await refreshAccessToken();
                    if (refreshed) {
                        // Riprova la richiesta originale con il nuovo token
                        const newToken = localStorage.getItem(TOKEN_KEY);
                        options.headers = {
                            ...options.headers,
                            'Authorization': `Bearer ${newToken}`
                        };
                        return originalFetch.apply(this, [url, options]);
                    }
                }
                return response;
            });
    };
    
    // Inizializzazione
    if (window.location.pathname === '/monitoring') {
        // Verifica autenticazione solo per la pagina di monitoring
        if (checkAuth()) {
            setupAutoRefresh();
            console.log('Authentication initialized');
        }
    }
    
    // Esporta funzioni utili
    window.authUtils = {
        checkAuth,
        refreshAccessToken,
        parseJWT,
        getToken: () => localStorage.getItem(TOKEN_KEY),
        logout: () => {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(REFRESH_TOKEN_KEY);
            window.location.href = '/login';
        }
    };
})();