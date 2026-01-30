# Client Administration System & Widget Updates
## Secure Energy Analytics Portal

This package contains:
1. **Client Administration Widget** - Full admin panel for managing clients (2x2 size)
2. **Client Lookup Widget** - Lightweight client selector for all users
3. **Client Store** - Data management for client records
4. **Updated Widgets** - All widgets now include client context integration

---

## Quick Start

### Step 1: Add the Client Store Script

Copy `scripts/client-store.js` to your `scripts/` folder.

In your `index.html`, add this script **BEFORE** `main.js`:

```html
<script src="scripts/client-store.js"></script>
```

### Step 2: Add Widget Files

Copy all files from `widgets/` folder to your `widgets/` folder:
- `client-admin-widget.html` - Admin client management (NEW)
- `client-lookup-widget.html` - Client selector (NEW)
- `lmp-comparison-portal.html` - **REPLACE** existing
- `lmp-analytics.html` - **REPLACE** existing
- `peak-demand-widget.html` - **REPLACE** existing
- `bid-management-widget.html` - **REPLACE** existing

### Step 3: Update main.js

Add the new widgets to your WIDGETS array:

```javascript
// Client Administration (Admin only - 2x2 size)
{ 
    id: 'client-admin', 
    name: 'Client Administration', 
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>', 
    src: 'widgets/client-admin-widget.html',
    adminOnly: true, 
    fullWidth: true, 
    height: 700,
    doubleHeight: true
},

// Client Lookup (All users)
{ 
    id: 'client-lookup', 
    name: 'Client Lookup', 
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>', 
    src: 'widgets/client-lookup-widget.html',
    fullWidth: false, 
    height: 220
},
```

Also update your User Administration widget to be 2x2:
```javascript
{ 
    id: 'user-admin', 
    name: 'User Administration', 
    // ... existing properties ...
    fullWidth: true, 
    height: 700,
    doubleHeight: true,  // ADD THIS
    embedded: true 
},
```

### Step 4: Add CSS for Double-Height Widgets

Add to your styles:
```css
.widget.double-height {
    grid-row: span 2;
    min-height: 700px;
}

.widget.double-height iframe {
    min-height: 680px;
}
```

### Step 5: Initialize Client Store

In your `main.js` DOMContentLoaded handler, add:

```javascript
// Initialize Client Store
if (typeof SecureEnergyClients !== 'undefined') {
    SecureEnergyClients.init();
    console.log('[Portal] Client store initialized');
}
```

### Step 6: Add Client Message Handler

Update your `handleWidgetMessage` function to include:

```javascript
case 'LINK_LMP_TO_CLIENT':
    if (data.analysis && window.SecureEnergyClients) {
        const activeId = SecureEnergyClients.getActiveClientId();
        if (activeId) {
            SecureEnergyClients.linkAnalysis(activeId, data.analysis);
        }
    }
    break;

case 'REQUEST_ACTIVE_CLIENT':
    if (event.source) {
        const client = window.SecureEnergyClients?.getActiveClient?.();
        event.source.postMessage({
            type: 'ACTIVE_CLIENT_RESPONSE',
            client: client,
            clientId: client?.id || null
        }, '*');
    }
    break;

case 'SCROLL_TO_WIDGET':
    if (data.widgetId) {
        const widget = document.querySelector(`[data-widget-id="${data.widgetId}"]`);
        if (widget) widget.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    break;
```

---

## How Client Context Works

### For Users:
1. **Select a client** in Client Lookup or Client Admin
2. The selected client becomes the **Active Client**
3. All widgets automatically show a banner with the active client
4. When you run analyses (LMP, Peak Demand, etc.), they're **linked to the client**
5. Bid Management uses the client for new bids

### For Admins:
1. **Client Administration** allows full CRUD on clients
2. Import from Salesforce (CSV or JSON)
3. View all linked analyses and bids per client
4. Export client data

---

## File Structure

```
updated-portal/
├── scripts/
│   └── client-store.js          # Client data management
├── widgets/
│   ├── client-admin-widget.html # Full admin widget (2x2) - NEW
│   ├── client-lookup-widget.html # Compact lookup widget - NEW
│   ├── lmp-comparison-portal.html # Updated with client context
│   ├── lmp-analytics.html        # Updated with client context
│   ├── peak-demand-widget.html   # Updated with client context
│   └── bid-management-widget.html # Updated with client context
├── data/
│   └── clients.json             # Client data storage
├── MAIN-JS-UPDATES.js           # Code to add to main.js
├── INDEX-HTML-UPDATES.html      # CSS and script tag additions
└── CLIENT-CONTEXT-SNIPPET.html  # How to add context to any widget
```

---

## Why Client Admin Might Not Show

If the Client Administration widget isn't appearing:

1. **Check adminOnly flag**: The widget has `adminOnly: true` - ensure you're logged in as an admin
2. **Check the WIDGETS array**: Make sure the widget is added correctly
3. **Check script loading order**: `client-store.js` must load BEFORE `main.js`
4. **Check console for errors**: Look for any JavaScript errors
5. **Check the widget src path**: Ensure `widgets/client-admin-widget.html` exists

---

## Troubleshooting

### Client not showing in widgets
- Make sure you've selected a client (check Client Lookup banner)
- Refresh the widgets after selecting a client

### Analyses not linking to client
- Ensure the client is selected BEFORE running the analysis
- Check that `handleWidgetMessage` includes the `LINK_LMP_TO_CLIENT` case

### Import from Salesforce not working
- Ensure your CSV has headers that match Salesforce field names
- Check the browser console for parsing errors
