/**
 * Secure Energy Analytics Portal - Help System
 * Provides hover tooltips, contextual help, and enhanced AI assistant
 * 
 * Compatible with main.js v2.4
 * Handles async widget loading and login timing
 */

// =====================================================
// HELP CONTENT DATABASE
// =====================================================
const HELP_CONTENT = {
    widgets: {
        'user-admin': {
            title: 'User Administration',
            desc: 'Create and manage user accounts, set permissions, and view activity logs.',
            tips: ['Only administrators can access this widget', 'Use Activity tab to audit user actions']
        },
        'bid-management': {
            title: 'Bid Management',
            desc: 'Create and manage energy bids, generate bid sheets, and track supplier pricing.',
            tips: ['Add clients before creating bids', 'Export bid sheets to Excel format']
        },
        'ai-assistant': {
            title: 'AI Assistant',
            desc: 'Ask questions about the portal, your data, or get help navigating features.',
            tips: ['Try "help" for command list', 'Ask "what is LMP?" for explanations']
        },
        'lmp-analytics': {
            title: 'LMP Analytics Dashboard',
            desc: 'Visualize historical LMP trends, compare zones, and identify pricing patterns.',
            tips: ['Load data in Data Manager first', 'Use date filters to focus on specific periods']
        },
        'lmp-comparison': {
            title: 'LMP Comparison Portal',
            desc: 'Compare index vs fixed pricing to calculate potential savings for clients.',
            tips: ['Enter client usage in MWh', 'Results save to Analysis History automatically']
        },
        'data-manager': {
            title: 'LMP Data Manager',
            desc: 'Import, export, and manage LMP pricing data from CSV or JSON files.',
            tips: ['CSV needs: ISO, Zone, Date, LMP columns', 'Data is shared across all widgets']
        },
        'arcadia-fetcher': {
            title: 'Arcadia LMP Fetcher',
            desc: 'Fetch current LMP data from Arcadia API.',
            tips: ['Requires API credentials', 'Schedule regular fetches for current data']
        },
        'peak-demand': {
            title: 'Peak Demand Analytics',
            desc: 'Analyze peak demand periods and capacity requirements.',
            tips: ['Identify high-cost periods', 'Plan load management strategies']
        },
        'analysis-history': {
            title: 'My Analysis History',
            desc: 'View and reload past LMP analyses. Admins see all user analyses.',
            tips: ['Click Reload to restore an analysis', 'Click Show for full details']
        }
    },
    
    glossary: {
        'lmp': {
            term: 'Locational Marginal Pricing (LMP)',
            definition: 'The cost of supplying the next MW of electricity at a specific location, including energy, congestion, and loss components.'
        },
        'iso': {
            term: 'Independent System Operator',
            definition: 'Regional organizations (PJM, ISONE, NYISO, CAISO, ERCOT, MISO) that manage electricity grid operations and wholesale markets.'
        },
        'zone': {
            term: 'Pricing Zone',
            definition: 'Geographic area within an ISO with distinct LMP values based on local generation, demand, and transmission.'
        },
        'index': {
            term: 'Index Pricing',
            definition: 'Paying real-time or day-ahead market prices that fluctuate with supply and demand.'
        },
        'fixed': {
            term: 'Fixed Pricing',
            definition: 'Locked-in rate that doesn\'t change regardless of market conditions.'
        },
        'congestion': {
            term: 'Congestion Cost',
            definition: 'Price component reflecting transmission constraints when power can\'t flow freely.'
        }
    }
};

// =====================================================
// TOOLTIP SYSTEM
// =====================================================
const HelpTooltip = {
    tooltip: null,
    activeTarget: null,
    hideTimeout: null,
    initialized: false,
    
    init() {
        if (this.initialized) return;
        this.createTooltip();
        this.addGlobalListeners();
        this.initialized = true;
        
        // Start watching for widgets
        this.watchForWidgets();
    },
    
    createTooltip() {
        // Remove existing if any
        const existing = document.getElementById('helpTooltip');
        if (existing) existing.remove();
        
        const el = document.createElement('div');
        el.id = 'helpTooltip';
        el.className = 'help-tooltip';
        el.innerHTML = `
            <div class="help-tooltip-arrow"></div>
            <div class="help-tooltip-title"></div>
            <div class="help-tooltip-desc"></div>
            <div class="help-tooltip-tips"></div>
        `;
        document.body.appendChild(el);
        this.tooltip = el;
        
        el.addEventListener('mouseenter', () => this.cancelHide());
        el.addEventListener('mouseleave', () => this.scheduleHide());
    },
    
    watchForWidgets() {
        // Check every 500ms for new widgets that need help icons
        setInterval(() => this.attachTriggers(), 500);
    },
    
    attachTriggers() {
        const widgets = document.querySelectorAll('[data-widget-id]');
        
        widgets.forEach(widget => {
            const id = widget.dataset.widgetId;
            const help = HELP_CONTENT.widgets[id];
            if (!help) return;
            
            const header = widget.querySelector('.widget-header');
            if (!header) return;
            
            // Skip if already has help icon
            if (header.querySelector('.help-icon')) return;
            
            const icon = document.createElement('button');
            icon.className = 'help-icon';
            icon.setAttribute('aria-label', 'Help');
            icon.dataset.helpFor = id;
            icon.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><circle cx="12" cy="17" r="0.5" fill="currentColor"/></svg>`;
            
            icon.addEventListener('mouseenter', (e) => this.show(id, e.target));
            icon.addEventListener('mouseleave', () => this.scheduleHide());
            icon.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggle(id, e.target);
            });
            
            const title = header.querySelector('.widget-title');
            if (title) {
                title.after(icon);
            } else {
                header.appendChild(icon);
            }
            
            console.log(`[HelpSystem] Added help icon to: ${id}`);
        });
    },
    
    addGlobalListeners() {
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.help-tooltip') && !e.target.closest('.help-icon')) {
                this.hide();
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.hide();
        });
    },
    
    show(helpId, anchor) {
        this.cancelHide();
        const help = HELP_CONTENT.widgets[helpId];
        if (!help || !this.tooltip) return;
        
        this.activeTarget = anchor;
        this.tooltip.querySelector('.help-tooltip-title').textContent = help.title;
        this.tooltip.querySelector('.help-tooltip-desc').textContent = help.desc;
        
        const tipsEl = this.tooltip.querySelector('.help-tooltip-tips');
        if (help.tips?.length) {
            tipsEl.innerHTML = help.tips.map(t => `<span class="tip-item">💡 ${t}</span>`).join('');
            tipsEl.style.display = 'flex';
        } else {
            tipsEl.style.display = 'none';
        }
        
        this.position(anchor);
        this.tooltip.classList.add('visible');
    },
    
    position(anchor) {
        const rect = anchor.getBoundingClientRect();
        const tt = this.tooltip;
        
        let top = rect.bottom + 8;
        let left = rect.left + (rect.width / 2) - 140;
        
        left = Math.max(10, Math.min(left, window.innerWidth - 300));
        if (top + 200 > window.innerHeight) {
            top = rect.top - 200;
            tt.classList.add('above');
        } else {
            tt.classList.remove('above');
        }
        
        tt.style.top = `${top}px`;
        tt.style.left = `${left}px`;
    },
    
    hide() {
        if (this.tooltip) {
            this.tooltip.classList.remove('visible');
        }
        this.activeTarget = null;
    },
    
    scheduleHide() {
        this.hideTimeout = setTimeout(() => this.hide(), 200);
    },
    
    cancelHide() {
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }
    },
    
    toggle(helpId, anchor) {
        if (this.tooltip && this.tooltip.classList.contains('visible') && this.activeTarget === anchor) {
            this.hide();
        } else {
            this.show(helpId, anchor);
        }
    }
};

// =====================================================
// ENHANCED AI RESPONSE PROCESSING
// =====================================================
const EnhancedAI = {
    process(query) {
        const q = query.toLowerCase().trim();
        
        // Greeting
        if (/^(hi|hello|hey|howdy|yo)(\s|$|!|,)/.test(q)) {
            return this.greeting();
        }
        
        // Glossary / "What is" queries
        if (q.includes('what is') || q.includes('what\'s') || q.includes('explain') || q.includes('define')) {
            const match = this.matchGlossary(q);
            if (match) return match;
        }
        
        // How-to queries
        if (q.includes('how do i') || q.includes('how to') || q.includes('how can i')) {
            return this.howTo(q);
        }
        
        // Tour / Getting started
        if (q.includes('tour') || q.includes('walkthrough') || q.includes('getting started') || q.includes('new here')) {
            this.startTour();
            return `<strong>🚀 Starting guided tour!</strong><br>I'll walk you through each widget step by step.`;
        }
        
        // Data status
        if ((q.includes('data') && q.includes('status')) || q.includes('how much data') || q.includes('records loaded')) {
            return this.dataStatus();
        }
        
        // User queries
        if (q.includes('show') && q.includes('user')) {
            return this.showUsers();
        }
        
        // Navigation
        if (q.includes('go to') || q.includes('open') || q.includes('navigate')) {
            return this.navigate(q);
        }
        
        // Help command
        if (q === 'help' || q === '?' || q.includes('what can you')) {
            return this.helpMenu();
        }
        
        return this.fallback(q);
    },
    
    greeting() {
        const user = typeof currentUser !== 'undefined' ? currentUser : null;
        const name = user ? user.firstName : 'there';
        let msg = `<strong>👋 Hi ${name}!</strong> I'm your AI assistant for the Secure Energy Analytics Portal.<br><br>`;
        msg += `I can help you with:<br>`;
        msg += `• Understanding LMP data and energy concepts<br>`;
        msg += `• Navigating portal features<br>`;
        msg += `• Running analyses and comparisons<br><br>`;
        msg += `Type <strong>help</strong> for quick actions or just ask me anything!`;
        return msg;
    },
    
    matchGlossary(q) {
        for (const [key, item] of Object.entries(HELP_CONTENT.glossary)) {
            if (q.includes(key)) {
                return `<strong>📖 ${item.term}</strong><br><br>${item.definition}`;
            }
        }
        return null;
    },
    
    howTo(q) {
        const guides = [
            { match: ['upload', 'import', 'load', 'csv', 'add data'], widget: 'data-manager', 
              text: '<strong>To load data:</strong><br>1. Open the <strong>LMP Data Manager</strong><br>2. Click "Choose File" to select a CSV or JSON<br>3. Click Import<br><br>CSV should have columns: ISO, Zone, Date, LMP' },
            { match: ['compare', 'analysis', 'calculate', 'savings', 'run'], widget: 'lmp-comparison',
              text: '<strong>To run a comparison:</strong><br>1. Open <strong>LMP Comparison Portal</strong><br>2. Enter client name<br>3. Select ISO and Zone<br>4. Set term length and usage (MWh)<br>5. Click Calculate' },
            { match: ['bid', 'bidsheet', 'create bid'], widget: 'bid-management',
              text: '<strong>To create a bid:</strong><br>1. Open <strong>Bid Management</strong><br>2. Add a client if needed<br>3. Create a new bid<br>4. Add suppliers and pricing<br>5. Generate bid sheet' },
            { match: ['user', 'account', 'create user', 'add user'], widget: 'user-admin',
              text: '<strong>To create a user:</strong><br>1. Open <strong>User Administration</strong> (admin only)<br>2. Fill in the Create User form<br>3. Set permissions<br>4. Click Create' },
            { match: ['export', 'download'], widget: 'data-manager',
              text: '<strong>To export data:</strong><br>1. Open the relevant widget<br>2. Look for Export button<br>3. Choose format (CSV/JSON/Excel)<br>4. Click Export' },
            { match: ['history', 'past', 'previous'], widget: 'analysis-history',
              text: '<strong>To view past work:</strong><br>1. Open <strong>My Analysis History</strong><br>2. Browse or search your analyses<br>3. Click "Reload" to restore settings<br>4. Click "Show" for full details' },
            { match: ['theme', 'dark', 'light', 'color'], widget: null,
              text: '<strong>To change theme:</strong><br>Click the colored dots in the top-right corner. Your choice is saved automatically.' }
        ];
        
        for (const guide of guides) {
            if (guide.match.some(m => q.includes(m))) {
                let response = guide.text;
                if (guide.widget) {
                    response += `<br><br><a href="#" onclick="scrollToWidget('${guide.widget}');return false;" style="color:var(--se-green, #00c853);">→ Go to ${HELP_CONTENT.widgets[guide.widget]?.title || guide.widget}</a>`;
                }
                return response;
            }
        }
        
        return `I'm not sure about that specific task. Try asking about:<br>• Loading data<br>• Running comparisons<br>• Creating bids<br>• Managing users<br><br>Type <strong>help</strong> for all options.`;
    },
    
    dataStatus() {
        if (typeof SecureEnergyData !== 'undefined') {
            const stats = SecureEnergyData.getStats();
            if (stats && stats.totalRecords > 0) {
                return `<strong>📊 Data Status</strong><br><br>` +
                    `• <strong>${stats.totalRecords.toLocaleString()}</strong> records loaded<br>` +
                    `• <strong>${stats.isoCount || 'N/A'}</strong> ISOs available<br>` +
                    `• ISOs: ${stats.isos?.join(', ') || 'N/A'}<br><br>` +
                    `Data is ready for analysis!`;
            }
        }
        return `<strong>📊 Data Status</strong><br><br>No LMP data currently loaded.<br><br>` +
            `<a href="#" onclick="scrollToWidget('data-manager');return false;" style="color:var(--se-green, #00c853);">→ Open Data Manager to import data</a>`;
    },
    
    showUsers() {
        if (typeof UserStore !== 'undefined') {
            const users = UserStore.getAll();
            if (users && users.length > 0) {
                let html = `<strong>👥 Users (${users.length})</strong><br><br>`;
                users.forEach(u => {
                    html += `• <strong>${u.firstName} ${u.lastName}</strong> - ${u.email} <span style="opacity:0.7">(${u.role})</span><br>`;
                });
                return html;
            }
        }
        return 'Unable to load users.';
    },
    
    navigate(q) {
        const targets = {
            'bid': 'bid-management',
            'user': 'user-admin',
            'admin': 'user-admin',
            'comparison': 'lmp-comparison',
            'calculator': 'lmp-comparison',
            'analytics': 'lmp-analytics',
            'dashboard': 'lmp-analytics',
            'data': 'data-manager',
            'manager': 'data-manager',
            'arcadia': 'arcadia-fetcher',
            'fetcher': 'arcadia-fetcher',
            'history': 'analysis-history',
            'peak': 'peak-demand'
        };
        
        for (const [key, widgetId] of Object.entries(targets)) {
            if (q.includes(key)) {
                if (typeof scrollToWidget === 'function') {
                    setTimeout(() => scrollToWidget(widgetId), 100);
                }
                const name = HELP_CONTENT.widgets[widgetId]?.title || widgetId;
                return `Navigating to <strong>${name}</strong>...`;
            }
        }
        
        return 'I couldn\'t find that widget. Try: bid management, comparison, analytics, data manager, or history.';
    },
    
    helpMenu() {
        return `<strong>🤖 How can I help?</strong><br><br>
            <div class="ai-help-grid">
                <div class="ai-help-item" onclick="QuickActions.execute('tour')">🚀 Take a Tour</div>
                <div class="ai-help-item" onclick="QuickActions.execute('data status')">📊 Data Status</div>
                <div class="ai-help-item" onclick="QuickActions.execute('what is lmp')">📖 What is LMP?</div>
                <div class="ai-help-item" onclick="QuickActions.execute('how to load data')">📥 Load Data</div>
                <div class="ai-help-item" onclick="QuickActions.execute('how to run analysis')">📈 Run Analysis</div>
                <div class="ai-help-item" onclick="QuickActions.execute('show users')">👥 Show Users</div>
            </div>
            <br>Click a button above or type your question!`;
    },
    
    fallback(q) {
        return `I'm not sure how to help with "<em>${q}</em>".<br><br>` +
            `Try asking about:<br>` +
            `• <strong>Concepts:</strong> "What is LMP?", "Explain zones"<br>` +
            `• <strong>How-to:</strong> "How to load data", "How to create a bid"<br>` +
            `• <strong>Navigate:</strong> "Go to comparison", "Open data manager"<br>` +
            `• <strong>Status:</strong> "Data status", "Show users"<br><br>` +
            `Type <strong>help</strong> for quick action buttons.`;
    },
    
    startTour() {
        const steps = [
            { widget: 'data-manager', title: '📥 Step 1: Load Data', msg: 'Start here! Import LMP data from CSV or JSON files. This powers all other widgets.' },
            { widget: 'lmp-analytics', title: '📊 Step 2: Analyze Trends', msg: 'View LMP trends over time. Filter by ISO, zone, and date range.' },
            { widget: 'lmp-comparison', title: '💰 Step 3: Compare Pricing', msg: 'The main tool! Compare index vs fixed pricing to calculate client savings.' },
            { widget: 'bid-management', title: '📋 Step 4: Manage Bids', msg: 'Create bids, add suppliers, and generate professional bid sheets.' },
            { widget: 'analysis-history', title: '🕒 Step 5: Track History', msg: 'All your analyses are saved here. Reload any past analysis instantly.' }
        ];
        
        let current = 0;
        
        const showStep = () => {
            document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));
            document.querySelectorAll('.tour-popup').forEach(el => el.remove());
            
            if (current >= steps.length) {
                if (typeof showNotification === 'function') {
                    showNotification('🎉 Tour complete! Ask me anytime for help.', 'success');
                }
                return;
            }
            
            const step = steps[current];
            const widget = document.querySelector(`[data-widget-id="${step.widget}"]`);
            
            if (widget) {
                widget.scrollIntoView({ behavior: 'smooth', block: 'center' });
                widget.classList.add('tour-highlight');
                
                const popup = document.createElement('div');
                popup.className = 'tour-popup';
                popup.innerHTML = `
                    <div class="tour-popup-title">${step.title}</div>
                    <div class="tour-popup-msg">${step.msg}</div>
                    <div class="tour-popup-nav">
                        <span>${current + 1} / ${steps.length}</span>
                        <button class="tour-next-btn">${current < steps.length - 1 ? 'Next →' : 'Finish ✓'}</button>
                    </div>
                `;
                widget.style.position = 'relative';
                widget.appendChild(popup);
                
                popup.querySelector('.tour-next-btn').addEventListener('click', () => {
                    current++;
                    showStep();
                });
            } else {
                // Skip missing widgets
                current++;
                showStep();
            }
        };
        
        setTimeout(showStep, 300);
    }
};

// =====================================================
// QUICK ACTION BUTTONS
// =====================================================
const QuickActions = {
    buttons: [
        { label: '🚀 Tour', query: 'tour', title: 'Take a guided tour' },
        { label: '❓ Help', query: 'help', title: 'Show help options' },
        { label: '📊 Status', query: 'data status', title: 'Check data status' },
        { label: '📖 LMP?', query: 'what is lmp', title: 'Learn about LMP' }
    ],
    injected: false,
    
    init() {
        // Watch for the chat container to appear
        this.watchForChat();
    },
    
    watchForChat() {
        const check = () => {
            const chatContainer = document.querySelector('.ai-chat-container');
            if (chatContainer && !chatContainer.querySelector('.quick-actions-bar')) {
                this.inject(chatContainer);
            }
        };
        
        // Check immediately and then periodically
        check();
        setInterval(check, 500);
    },
    
    inject(chatContainer) {
        if (!chatContainer) return;
        if (chatContainer.querySelector('.quick-actions-bar')) return;
        
        const bar = document.createElement('div');
        bar.className = 'quick-actions-bar';
        bar.innerHTML = `
            <div class="quick-actions-buttons">
                ${this.buttons.map(btn => `
                    <button class="quick-action-btn" 
                            data-query="${btn.query}" 
                            title="${btn.title}">
                        ${btn.label}
                    </button>
                `).join('')}
            </div>
        `;
        
        // Add click handlers
        bar.querySelectorAll('.quick-action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const query = btn.dataset.query;
                this.execute(query);
            });
        });
        
        chatContainer.insertBefore(bar, chatContainer.firstChild);
        console.log('[HelpSystem] Quick action buttons injected');
    },
    
    execute(query) {
        const input = document.getElementById('aiChatInput');
        const messages = document.getElementById('aiChatMessages');
        
        if (!messages) {
            console.warn('[HelpSystem] Chat messages container not found');
            return;
        }
        
        // Show user message
        const escapedQuery = query.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        messages.innerHTML += `<div class="ai-message user"><div class="ai-message-content">${escapedQuery}</div></div>`;
        
        if (input) input.value = '';
        
        // Get and show AI response
        const response = EnhancedAI.process(query);
        
        setTimeout(() => {
            messages.innerHTML += `<div class="ai-message assistant"><div class="ai-message-content">${response}</div></div>`;
            messages.scrollTop = messages.scrollHeight;
        }, 200);
        
        messages.scrollTop = messages.scrollHeight;
    }
};

// Make globally accessible
window.QuickActions = QuickActions;
window.EnhancedAI = EnhancedAI;

// =====================================================
// OVERRIDE sendAIMessage
// =====================================================
function setupAIOverride() {
    // Check if sendAIMessage exists and override it
    const doOverride = () => {
        if (typeof window.sendAIMessage === 'function' && !window._helpSystemOverridden) {
            const original = window.sendAIMessage;
            
            window.sendAIMessage = function() {
                const input = document.getElementById('aiChatInput');
                const messages = document.getElementById('aiChatMessages');
                
                if (!input || !messages) {
                    console.warn('[HelpSystem] AI chat elements not found');
                    return;
                }
                
                const text = input.value.trim();
                if (!text) return;
                
                // Add user message
                const escapedText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
                messages.innerHTML += `<div class="ai-message user"><div class="ai-message-content">${escapedText}</div></div>`;
                input.value = '';
                
                // Get enhanced AI response
                const response = EnhancedAI.process(text);
                
                // Add AI response
                setTimeout(() => {
                    messages.innerHTML += `<div class="ai-message assistant"><div class="ai-message-content">${response}</div></div>`;
                    messages.scrollTop = messages.scrollHeight;
                }, 200);
                
                messages.scrollTop = messages.scrollHeight;
            };
            
            window._helpSystemOverridden = true;
            console.log('[HelpSystem] sendAIMessage enhanced successfully');
            return true;
        }
        return false;
    };
    
    // Try immediately
    if (!doOverride()) {
        // Keep trying every 500ms until it works
        const interval = setInterval(() => {
            if (doOverride()) {
                clearInterval(interval);
            }
        }, 500);
        
        // Give up after 30 seconds
        setTimeout(() => clearInterval(interval), 30000);
    }
}

// =====================================================
// INITIALIZATION
// =====================================================
function initHelpSystem() {
    console.log('[HelpSystem] Initializing...');
    
    // Initialize tooltip system
    HelpTooltip.init();
    console.log('[HelpSystem] Tooltip system initialized');
    
    // Initialize quick action buttons
    QuickActions.init();
    console.log('[HelpSystem] Quick actions watcher started');
    
    // Setup AI override
    setupAIOverride();
    
    console.log('[HelpSystem] Initialization complete');
}

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHelpSystem);
} else {
    initHelpSystem();
}

// Also re-check after a delay in case widgets load later
setTimeout(initHelpSystem, 2000);
