/**
 * RoutoX Real-time Tracking Module
 * Handles WebSocket connection for live vehicle positions and ETA updates
 */

class RoutoXRealtime {
  constructor(options = {}) {
    this.wsUrl = options.wsUrl || this._getWsUrl();
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 2000;
    this.listeners = new Map();
    this.isConnected = false;
    this.vehiclePositions = new Map();
    this.lastUpdate = null;
    
    // Auto-connect if token exists
    const token = localStorage.getItem('auth_token');
    if (token && !token.startsWith('demo_')) {
      this.connect(token);
    }
  }
  
  _getWsUrl() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.port === '8080' 
      ? window.location.host 
      : 'localhost:8000';
    return `${protocol}//${host}/api/v1/ws`;
  }
  
  connect(token) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }
    
    const url = `${this.wsUrl}?token=${encodeURIComponent(token)}`;
    
    try {
      this.ws = new WebSocket(url);
      
      this.ws.onopen = () => {
        console.log('[RoutoX RT] Connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this._emit('connected', { timestamp: new Date() });
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this._handleMessage(data);
        } catch (e) {
          console.error('[RoutoX RT] Failed to parse message:', e);
        }
      };
      
      this.ws.onclose = (event) => {
        console.log('[RoutoX RT] Disconnected:', event.code);
        this.isConnected = false;
        this._emit('disconnected', { code: event.code });
        
        // Auto-reconnect
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          setTimeout(() => {
            this.reconnectAttempts++;
            console.log(`[RoutoX RT] Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            this.connect(token);
          }, this.reconnectDelay * Math.min(this.reconnectAttempts + 1, 5));
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('[RoutoX RT] WebSocket error:', error);
        this._emit('error', { error });
      };
      
    } catch (e) {
      console.error('[RoutoX RT] Failed to create WebSocket:', e);
    }
  }
  
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
  
  _handleMessage(data) {
    this.lastUpdate = new Date();
    
    switch (data.type) {
      case 'connected':
        this._emit('ready', data);
        break;
        
      case 'telemetry.ingested':
        this._emit('telemetry', data);
        this._refreshPositions();
        break;
        
      case 'position.update':
        this._updatePosition(data);
        this._emit('position', data);
        break;
        
      case 'geozone.events':
        this._emit('geozone', data);
        break;
        
      case 'alert.created':
        this._emit('alert', data);
        break;
        
      case 'vehicle.updated':
        this._emit('vehicle', data);
        break;
        
      default:
        this._emit('message', data);
    }
  }
  
  _updatePosition(data) {
    if (data.vehicle_id && data.lat && data.lon) {
      this.vehiclePositions.set(data.vehicle_id, {
        lat: data.lat,
        lon: data.lon,
        speed: data.speed_kph,
        heading: data.heading,
        eta: data.eta,
        timestamp: new Date()
      });
    }
  }
  
  async _refreshPositions() {
    // Fetch latest positions from API
    try {
      const token = localStorage.getItem('auth_token');
      if (!token || token.startsWith('demo_')) return;
      
      const response = await fetch(
        `${window.location.port === '8080' ? '' : 'http://localhost:8000'}/api/v1/telemetry/positions/latest`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      
      if (response.ok) {
        const data = await response.json();
        data.positions?.forEach(p => {
          this.vehiclePositions.set(p.vehicle_id, {
            lat: p.lat,
            lon: p.lon,
            speed: p.speed_kph,
            heading: p.heading,
            eta: p.eta,
            remaining_km: p.remaining_km,
            timestamp: new Date(p.recorded_at)
          });
        });
        this._emit('positions.refreshed', { positions: data.positions });
      }
    } catch (e) {
      console.error('[RoutoX RT] Failed to refresh positions:', e);
    }
  }
  
  // Event handling
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }
  
  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback);
    }
  }
  
  _emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => {
        try {
          cb(data);
        } catch (e) {
          console.error(`[RoutoX RT] Error in ${event} handler:`, e);
        }
      });
    }
  }
  
  // Public API
  getPosition(vehicleId) {
    return this.vehiclePositions.get(vehicleId);
  }
  
  getAllPositions() {
    return Array.from(this.vehiclePositions.entries()).map(([id, pos]) => ({
      vehicle_id: id,
      ...pos
    }));
  }
}

// Create global instance
window.routoxRT = new RoutoXRealtime();

// Export for modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RoutoXRealtime;
}
