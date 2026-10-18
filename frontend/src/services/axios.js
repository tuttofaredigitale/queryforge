// src/services/axios.js

import axios from 'axios';
import store from '../store';
import AuthService from './authService';

// Crea istanza axios con configurazione base
const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Aggiungi interceptor per aggiungere token a tutte le richieste
axiosInstance.interceptors.request.use(
  async (config) => {
    // Se la richiesta è per il refresh token, non verificare la scadenza
    if (config.url === '/api/auth/refresh-token') {
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    }
    
    // Per altre richieste, verifica se il token sta per scadere
    try {
      await store.dispatch('auth/checkTokenExpiration');
      
      // Dopo il potenziale refresh, aggiungi il token aggiornato
      const token = localStorage.getItem('accessToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Errore nel refresh del token:', error);
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Aggiungi interceptor per gestire errori 401 (token non valido)
axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // Gestione errore 401 (Unauthorized)
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // Tenta di rinnovare il token
        await store.dispatch('auth/refreshToken');
        
        // Aggiorna header con nuovo token
        const token = localStorage.getItem('accessToken');
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        originalRequest.headers['Authorization'] = `Bearer ${token}`;
        
        // Ripeti la richiesta originale
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        // Se il refresh fallisce, reindirizza al login
        store.dispatch('auth/logout');
        window.location = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default axiosInstance;