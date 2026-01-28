/**
 * Secure Energy Shared Data Store v2.1
 * Centralized data management for LMP data, user authentication, and activity logging
 * Supports GitHub Pages hosting with JSON file persistence
 * 
 * v2.1 Updates:
 * - Added activity counting methods for dashboard stats
 * - Enhanced activity logging for exports
 */

// =====================================================
// LMP DATA STORE
// =====================================================
const SecureEnergyData = {
    STORAGE_KEY: 'secureEnergy_LMP_Data',
    DATA_URL: 'data/lmp-database.json', // Relative path for GitHub Pages
    GITHUB_RAW_URL: 'https://raw.githubusercontent.com/ClemmensSES/SESSalesResources/main/data/lmp-database.json',
    subscribers: [],
    data: null,
    isLoaded: false,

    /**
     * Initialize the data store - attempts to load from GitHub JSON first
     */
    async init() {
        console.log('[SecureEnergyData] Initializing...');
        
        // First try to load from localStorage (cached data)
        const cached = this.loadFromStorage();
        if (cached && cached.records && cached.records.length > 0) {
            this.data = cached;
            this.isLoaded = true;
            console.log(`[SecureEnergyData] Loaded ${cached.records.length} records from cache`);
        }
        
        // Then try to load fresh data from GitHub JSON
        try {
            await this.loadFromGitHub();
        } catch (e) {
            console.warn('[SecureEnergyData] Could not load from GitHub, using cached data');
        }
        
        this.notifySubscribers();
        return this.data;
    },

    /**
     * Load data from GitHub hosted JSON file
     */
    async loadFromGitHub() {
        // Try GitHub raw URL first, then relative path
        const urls = [this.GITHUB_RAW_URL, this.DATA_URL];
        
        for (const url of urls) {
            try {
                console.log(`[SecureEnergyData] Trying to load from: ${url}`);
                const response = await fetch(url + '?t=' + Date.now()); // Cache bust
                if (!response.ok) {
                    continue;
                }
                
                const jsonData = await response.json();
                
                if (jsonData && jsonData.records && jsonData.records.length > 0) {
                    this.data = {
                        records: jsonData.records,
                        meta: jsonData.meta || {
                            source: url.includes('raw.githubusercontent') ? 'GitHub Repository' : 'Local',
                            loadedAt: new Date().toISOString(),
                            version: jsonData.version,
                            recordCount: jsonData.records.length
                        }
                    };
                    this.isLoaded = true;
                    this.saveToStorage();
                    console.log(`[SecureEnergyData] Loaded ${jsonData.records.length} records from ${url.includes('raw.githubusercontent') ? 'GitHub' : 'local path'}`);
                    this.notifySubscribers();
                    return true;
                }
            } catch (e) {
                console.warn(`[SecureEnergyData] Failed to load from ${url}:`, e.message);
            }
        }
        
        return false;
    },

    /**
     * Load from localStorage
     */
    loadFromStorage() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (e) {
            console.error('[SecureEnergyData] Storage read error:', e);
        }
        return null;
    },

    /**
     * Save to localStorage (cache)
     */
    saveToStorage() {
        try {
            if (this.data) {
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
            }
        } catch (e) {
            console.error('[SecureEnergyData] Storage write error:', e);
        }
    },

    /**
     * Load data from CSV content
     */
    loadFromCSV(csvContent, source = 'CSV Upload') {
        try {
            const lines = csvContent.trim().split('\n');
            if (lines.length < 2) {
                throw new Error('CSV file is empty or has no data rows');
            }

            const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
            const records = [];

            for (let i = 1; i < lines.length; i++) {
                const values = this.parseCSVLine(lines[i]);
                if (values.length >= headers.length) {
                    const record = {};
                    headers.forEach((header, idx) => {
                        record[header] = values[idx]?.trim() || '';
                    });
                    
                    // Normalize field names
                    const normalized = this.normalizeRecord(record);
                    if (normalized.iso && normalized.zone) {
                        records.push(normalized);
                    }
                }
            }

            if (records.length === 0) {
                throw new Error('No valid records found in CSV');
            }

            this.data = {
                records: records,
                meta: {
                    source: source,
                    loadedAt: new Date().toISOString(),
                    recordCount: records.length
                }
            };
            
            this.isLoaded = true;
            this.saveToStorage();
            this.notifySubscribers();
            
            console.log(`[SecureEnergyData] Loaded ${records.length} records from CSV`);
            return { success: true, count: records.length };
        } catch (e) {
            console.error('[SecureEnergyData] CSV parse error:', e);
            return { success: false, error: e.message };
        }
    },

    /**
     * Parse CSV line handling quoted values
     */
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        result.push(current);
        return result;
    },

    /**
     * Normalize record field names
     */
    normalizeRecord(record) {
        return {
            iso: record.iso || record.isoname || record.iso_name || '',
            zone: record.zone || record.zonename || record.zone_name || record.pnodename || '',
            zoneId: record.zoneid || record.zone_id || record.pnodeid || '',
            year: record.year || '',
            month: record.month || '',
            lmp: parseFloat(record.lmp || record.avg_da_lmp || record.avgdalmp || record.da_lmp || record.price || record.averagelmp || 0),
            energy: parseFloat(record.energy || record.energycomponent || 0),
            congestion: parseFloat(record.congestion || record.congestioncomponent || 0),
            loss: parseFloat(record.loss || record.losscomponent || 0)
        };
    },

    /**
     * Get all records
     */
    getRecords() {
        return this.data?.records || [];
    },

    /**
     * Get records filtered by ISO
     */
    getByISO(iso) {
        const records = this.getRecords();
        return records.filter(r => r.iso?.toUpperCase() === iso?.toUpperCase());
    },

    /**
     * Get unique ISOs
     */
    getISOs() {
        const records = this.getRecords();
        return [...new Set(records.map(r => r.iso).filter(Boolean))];
    },

    /**
     * Get zones for an ISO
     */
    getZones(iso) {
        const records = this.getByISO(iso);
        const zones = [...new Set(records.map(r => r.zone).filter(Boolean))];
        return zones.sort();
    },

    /**
     * Get years available in data
     */
    getYears() {
        const records = this.getRecords();
        const years = [...new Set(records.map(r => r.year).filter(Boolean))];
        return years.sort();
    },

    /**
     * Get LMP data for specific zone and time period
     */
    getLMPData(iso, zone, year, month = null) {
        const records = this.getRecords();
        return records.filter(r => {
            const matchISO = r.iso?.toUpperCase() === iso?.toUpperCase();
            const matchZone = r.zone === zone;
            const matchYear = r.year == year;
            const matchMonth = month ? r.month == month : true;
            return matchISO && matchZone && matchYear && matchMonth;
        });
    },

    /**
     * Calculate average LMP
     */
    getAverageLMP(iso, zone, year, month = null) {
        const data = this.getLMPData(iso, zone, year, month);
        if (data.length === 0) return null;
        const sum = data.reduce((acc, r) => acc + (r.lmp || 0), 0);
        return sum / data.length;
    },

    /**
     * Get statistics
     */
    getStats() {
        const records = this.getRecords();
        const isos = this.getISOs();
        const years = this.getYears();
        
        return {
            totalRecords: records.length,
            isoCount: isos.length,
            isos: isos,
            yearRange: years.length > 0 ? [years[0], years[years.length - 1]] : null,
            lastUpdate: this.data?.meta?.loadedAt
        };
    },

    /**
     * Subscribe to data changes
     */
    subscribe(callback) {
        this.subscribers.push(callback);
    },

    /**
     * Notify all subscribers
     */
    notifySubscribers() {
        this.subscribers.forEach(cb => {
            try { cb(this.data); } catch (e) { console.error(e); }
        });
    },

    /**
     * Export for GitHub update
     */
    exportForGitHub() {
        return JSON.stringify({
            version: '1.0.0',
            lastUpdated: new Date().toISOString(),
            meta: this.data?.meta || {},
            records: this.getRecords()
        }, null, 2);
    }
};


// =====================================================
// USER STORE
// =====================================================
const UserStore = {
    STORAGE_KEY: 'secureEnergy_users',
    SESSION_KEY: 'secureEnergy_currentUser',
    USERS_URL: 'data/users.json',
    users: [],

    /**
     * Initialize
     */
    async init() {
        console.log('[UserStore] Initializing...');
        
        // Try GitHub first
        try {
            await this.loadFromGitHub();
        } catch (e) {
            console.warn('[UserStore] GitHub load failed');
        }
        
        // Load from localStorage
        const cached = this.loadFromStorage();
        if (cached && cached.length > 0) {
            // Merge - avoid duplicates by email
            const existingEmails = new Set(this.users.map(u => u.email.toLowerCase()));
            cached.forEach(u => {
                if (!existingEmails.has(u.email.toLowerCase())) {
                    this.users.push(u);
                }
            });
        }
        
        // Ensure default admin exists
        if (this.users.length === 0 || !this.users.some(u => u.email === 'admin@sesenergy.org')) {
            this.users.unshift({
                id: 'admin-default',
                email: 'admin@sesenergy.org',
                password: 'admin123',
                firstName: 'Admin',
                lastName: 'User',
                role: 'admin',
                status: 'active',
                createdAt: new Date().toISOString(),
                permissions: {
                    'user-admin': true,
                    'ai-assistant': true,
                    'lmp-comparison': true,
                    'lmp-analytics': true,
                    'analysis-history': true,
                    'data-manager': true,
                    'arcadia-fetcher': true
                }
            });
        }
        
        this.saveToStorage();
        console.log(`[UserStore] ${this.users.length} users loaded`);
        return this.users;
    },

    /**
     * Load from GitHub
     */
    async loadFromGitHub() {
        const response = await fetch(this.USERS_URL + '?t=' + Date.now());
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        if (data && data.users) {
            this.users = data.users;
            return true;
        }
        return false;
    },

    /**
     * Load from localStorage
     */
    loadFromStorage() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            return [];
        }
    },

    /**
     * Save to localStorage
     */
    saveToStorage() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.users));
    },

    /**
     * Get all users
     */
    getAll() {
        return this.users;
    },

    /**
     * Find user by email
     */
    findByEmail(email) {
        return this.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    },

    /**
     * Find user by ID
     */
    findById(id) {
        return this.users.find(u => u.id === id);
    },

    /**
     * Create new user
     */
    create(userData) {
        if (this.findByEmail(userData.email)) {
            throw new Error('Email already exists');
        }
        
        const newUser = {
            id: 'user-' + Date.now(),
            ...userData,
            status: 'active',
            createdAt: new Date().toISOString()
        };
        
        this.users.push(newUser);
        this.saveToStorage();
        return newUser;
    },

    /**
     * Update user
     */
    update(id, updates) {
        const index = this.users.findIndex(u => u.id === id);
        if (index === -1) throw new Error('User not found');
        
        // Check email uniqueness
        if (updates.email && updates.email !== this.users[index].email) {
            if (this.findByEmail(updates.email)) {
                throw new Error('Email already exists');
            }
        }
        
        this.users[index] = { ...this.users[index], ...updates };
        this.saveToStorage();
        return this.users[index];
    },

    /**
     * Delete user
     */
    delete(id) {
        const index = this.users.findIndex(u => u.id === id);
        if (index === -1) throw new Error('User not found');
        if (this.users[index].email === 'admin@sesenergy.org') {
            throw new Error('Cannot delete default admin');
        }
        
        this.users.splice(index, 1);
        this.saveToStorage();
    },

    /**
     * Authenticate user
     */
    authenticate(email, password) {
        console.log('[UserStore] Authenticating:', email);
        console.log('[UserStore] Available users:', this.users.map(u => u.email));
        
        const user = this.findByEmail(email);
        if (!user) {
            console.log('[UserStore] User not found');
            return { success: false, error: 'User not found' };
        }
        if (user.password !== password) {
            console.log('[UserStore] Invalid password');
            return { success: false, error: 'Invalid password' };
        }
        if (user.status !== 'active') {
            console.log('[UserStore] Account inactive');
            return { success: false, error: 'Account is inactive' };
        }
        console.log('[UserStore] Authentication successful');
        return { success: true, user };
    },

    /**
     * Session management
     */
    setCurrentUser(user) {
        const sessionUser = { ...user };
        delete sessionUser.password;
        localStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionUser));
    },

    getCurrentUser() {
        try {
            const data = localStorage.getItem(this.SESSION_KEY);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    },

    clearSession() {
        localStorage.removeItem(this.SESSION_KEY);
    },

    /**
     * Export users for GitHub update
     */
    exportForGitHub() {
        return JSON.stringify({
            version: '1.0.0',
            lastUpdated: new Date().toISOString(),
            users: this.users
        }, null, 2);
    }
};


// =====================================================
// ACTIVITY LOG STORE
// =====================================================
const ActivityLog = {
    STORAGE_KEY: 'secureEnergy_activityLog',
    LOG_URL: 'data/activity-log.json',
    activities: [],

    /**
     * Initialize
     */
    async init() {
        console.log('[ActivityLog] Initializing...');
        
        // Try GitHub first
        try {
            await this.loadFromGitHub();
        } catch (e) {
            console.warn('[ActivityLog] GitHub load failed');
        }
        
        // Load from localStorage
        const cached = this.loadFromStorage();
        if (cached && cached.length > 0) {
            // Merge - avoid duplicates by ID
            const existingIds = new Set(this.activities.map(a => a.id));
            cached.forEach(a => {
                if (!existingIds.has(a.id)) {
                    this.activities.push(a);
                }
            });
        }
        
        console.log(`[ActivityLog] ${this.activities.length} activities loaded`);
        return this.activities;
    },

    /**
     * Load from GitHub
     */
    async loadFromGitHub() {
        const response = await fetch(this.LOG_URL + '?t=' + Date.now());
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        if (data && data.activities) {
            this.activities = data.activities;
            return true;
        }
        return false;
    },

    /**
     * Load from localStorage
     */
    loadFromStorage() {
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch (e) {
            return [];
        }
    },

    /**
     * Save to localStorage
     */
    saveToStorage() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.activities));
    },

    /**
     * Log an activity
     */
    log(activity) {
        const entry = {
            id: 'activity-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
            timestamp: new Date().toISOString(),
            userId: activity.userId || null,
            userEmail: activity.userEmail || null,
            userName: activity.userName || null,
            widget: activity.widget || 'unknown',
            action: activity.action || 'unknown',
            clientName: activity.clientName || null,
            data: activity.data || {},
            notes: activity.notes || null
        };

        this.activities.unshift(entry); // Add to beginning
        this.saveToStorage();
        
        console.log('[ActivityLog] Logged:', entry.action, entry.widget);
        return entry;
    },

    /**
     * Log LMP Analysis
     */
    logLMPAnalysis(params) {
        return this.log({
            userId: params.userId,
            userEmail: params.userEmail,
            userName: params.userName,
            widget: 'lmp-comparison',
            action: 'LMP Analysis',
            clientName: params.clientName,
            data: {
                clientName: params.clientName, // Also store in data for consistency
                iso: params.iso,
                zone: params.zone,
                startDate: params.startDate,
                termMonths: params.termMonths,
                fixedPrice: params.fixedPrice,
                lmpAdjustment: params.lmpAdjustment,
                totalAnnualUsage: params.usage || params.totalAnnualUsage,
                baselineYear: params.baselineYear,
                comparisonYears: params.comparisonYears,
                rate: params.rate,
                usage: params.usage,
                results: params.results
            },
            notes: params.notes
        });
    },

    /**
     * Log LMP Analytics Export
     */
    logLMPExport(params) {
        return this.log({
            userId: params.userId,
            userEmail: params.userEmail,
            userName: params.userName,
            widget: 'lmp-analytics',
            action: 'LMP Export',
            clientName: params.clientName || null,
            data: {
                exportType: params.exportType || 'chart',
                iso: params.iso,
                zone: params.zone,
                format: params.format || 'PNG'
            },
            notes: params.notes
        });
    },

    /**
     * Log Analysis History Export (user exporting their records)
     */
    logHistoryExport(params) {
        return this.log({
            userId: params.userId,
            userEmail: params.userEmail,
            userName: params.userName,
            widget: 'analysis-history',
            action: 'History Export',
            data: {
                recordCount: params.recordCount || 0,
                format: params.format || 'CSV'
            },
            notes: params.notes
        });
    },

    /**
     * Get all activities
     */
    getAll() {
        return this.activities;
    },

    /**
     * Get activities by user
     */
    getByUser(userId) {
        return this.activities.filter(a => a.userId === userId);
    },

    /**
     * Get activities by widget
     */
    getByWidget(widget) {
        return this.activities.filter(a => a.widget === widget);
    },

    /**
     * Get activities by action
     */
    getByAction(action) {
        return this.activities.filter(a => a.action === action);
    },

    /**
     * Get activities by client
     */
    getByClient(clientName) {
        return this.activities.filter(a => 
            a.clientName?.toLowerCase().includes(clientName.toLowerCase())
        );
    },

    /**
     * Get recent activities
     */
    getRecent(count = 50) {
        return this.activities.slice(0, count);
    },

    /**
     * Get today's start timestamp (midnight local time)
     */
    getTodayStart() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today.toISOString();
    },

    /**
     * Count activities by action type
     * @param {string} action - Action type to count (e.g., 'Login', 'LMP Analysis', 'LMP Export')
     * @param {boolean} todayOnly - If true, only count today's activities
     * @returns {number} Count of matching activities
     */
    countByAction(action, todayOnly = false) {
        const todayStart = this.getTodayStart();
        return this.activities.filter(a => {
            const matchesAction = a.action === action;
            if (!matchesAction) return false;
            if (todayOnly) {
                return a.timestamp >= todayStart;
            }
            return true;
        }).length;
    },

    /**
     * Count activities by widget type
     * @param {string} widget - Widget name to count
     * @param {boolean} todayOnly - If true, only count today's activities
     * @returns {number} Count of matching activities
     */
    countByWidget(widget, todayOnly = false) {
        const todayStart = this.getTodayStart();
        return this.activities.filter(a => {
            const matchesWidget = a.widget === widget;
            if (!matchesWidget) return false;
            if (todayOnly) {
                return a.timestamp >= todayStart;
            }
            return true;
        }).length;
    },

    /**
     * Count portal logins
     * @param {boolean} todayOnly - If true, only count today's logins
     * @returns {number} Login count
     */
    countLogins(todayOnly = false) {
        return this.countByAction('Login', todayOnly);
    },

    /**
     * Count LMP Comparison calculations/analyses
     * @param {boolean} todayOnly - If true, only count today's analyses
     * @returns {number} Analysis count
     */
    countLMPAnalyses(todayOnly = false) {
        return this.countByAction('LMP Analysis', todayOnly);
    },

    /**
     * Count LMP Analytics exports
     * @param {boolean} todayOnly - If true, only count today's exports
     * @returns {number} Export count
     */
    countLMPExports(todayOnly = false) {
        return this.countByAction('LMP Export', todayOnly);
    },

    /**
     * Get comprehensive activity statistics
     * @returns {Object} Statistics object with counts
     */
    getActivityStats() {
        return {
            logins: {
                today: this.countLogins(true),
                total: this.countLogins(false)
            },
            lmpAnalyses: {
                today: this.countLMPAnalyses(true),
                total: this.countLMPAnalyses(false)
            },
            lmpExports: {
                today: this.countLMPExports(true),
                total: this.countLMPExports(false)
            },
            totalActivities: this.activities.length
        };
    },

    /**
     * Export for GitHub
     */
    exportForGitHub() {
        return JSON.stringify({
            version: '1.0.0',
            lastUpdated: new Date().toISOString(),
            activities: this.activities
        }, null, 2);
    }
};


// =====================================================
// INITIALIZATION
// =====================================================
// Auto-initialize when script loads
if (typeof window !== 'undefined') {
    window.SecureEnergyData = SecureEnergyData;
    window.UserStore = UserStore;
    window.ActivityLog = ActivityLog;
    
    // Debug/Reset function - call from console: resetUserStore()
    window.resetUserStore = function() {
        localStorage.removeItem('secureEnergy_users');
        localStorage.removeItem('secureEnergy_currentUser');
        console.log('[UserStore] Reset complete. Refresh the page.');
        location.reload();
    };
    
    // Listen for cross-window messages
    window.addEventListener('message', function(event) {
        if (event.data?.type === 'LMP_DATA_REQUEST') {
            window.postMessage({
                type: 'LMP_DATA_RESPONSE',
                data: SecureEnergyData.data,
                stats: SecureEnergyData.getStats()
            }, '*');
        }
    });
}

// Export for module environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SecureEnergyData, UserStore, ActivityLog };
}
