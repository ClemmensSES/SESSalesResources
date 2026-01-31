/**
 * Secure Energy Portal - Export Utilities
 * ========================================
 * 
 * Standardized export metadata and import template utilities.
 * Include this file in any widget to ensure consistent export formatting.
 * 
 * Usage:
 *   <script src="scripts/export-utilities.js"></script>
 * 
 * Then in your widget:
 *   SEExport.init('Widget Name', '1.0');
 *   const metadata = SEExport.generateMetadataRows({ customField: 'value' });
 */

const SEExport = (function() {
    'use strict';
    
    // Default configuration
    let config = {
        widgetName: 'Unknown Widget',
        widgetVersion: '1.0',
        companyName: 'SECURE ENERGY SERVICES'
    };
    
    /**
     * Initialize the export utility with widget-specific info
     * @param {string} widgetName - Name of the current widget
     * @param {string} version - Widget version
     */
    function init(widgetName, version = '1.0') {
        config.widgetName = widgetName;
        config.widgetVersion = version;
    }
    
    /**
     * Get current user information from various sources
     * @returns {Object} User info with name, email, role
     */
    function getCurrentUser() {
        // Try parent portal auth
        if (window.parent?.SecureEnergyAuth?.currentUser) {
            const user = window.parent.SecureEnergyAuth.currentUser;
            return {
                name: user.name || user.username || 'Unknown User',
                email: user.email || '',
                role: user.role || 'user'
            };
        }
        
        // Try localStorage
        try {
            const stored = localStorage.getItem('secure_energy_user');
            if (stored) {
                const user = JSON.parse(stored);
                return {
                    name: user.name || user.username || 'Unknown User',
                    email: user.email || '',
                    role: user.role || 'user'
                };
            }
        } catch (e) {
            console.warn('Could not retrieve user from localStorage:', e);
        }
        
        return { name: 'Unknown User', email: '', role: 'user' };
    }
    
    /**
     * Get active client information
     * @param {Object} activeClient - The currently active client object (optional)
     * @returns {Object} Client info
     */
    function getActiveClient(activeClient = null) {
        // Use passed client or try to get from window
        const client = activeClient || window.activeClient;
        
        if (client) {
            return {
                name: client.name || 'Unknown Client',
                id: client.id || '',
                iso: client.iso || '',
                accountNumber: client.accountNumber || '',
                address: client.address || '',
                contactName: client.contactName || '',
                contactEmail: client.contactEmail || ''
            };
        }
        
        return { 
            name: 'No Client Selected', 
            id: '', 
            iso: '', 
            accountNumber: '',
            address: '',
            contactName: '',
            contactEmail: ''
        };
    }
    
    /**
     * Generate standardized metadata header rows for Excel export
     * @param {Object} additionalInfo - Widget-specific additional fields to include
     * @param {Object} activeClient - Active client object (optional)
     * @returns {Array} Array of arrays representing rows
     */
    function generateMetadataRows(additionalInfo = {}, activeClient = null) {
        const user = getCurrentUser();
        const client = getActiveClient(activeClient);
        const now = new Date();
        
        const metadata = [
            [`${config.companyName} - EXPORT REPORT`],
            [''],
            ['EXPORT INFORMATION'],
            ['Export Date:', now.toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            })],
            ['Export Time:', now.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit', 
                timeZoneName: 'short' 
            })],
            ['Exported By:', user.name + (user.email ? ` (${user.email})` : '')],
            ['User Role:', formatRole(user.role)],
            [''],
            ['CLIENT INFORMATION'],
            ['Client Name:', client.name],
            ['Client ID:', client.id || 'N/A'],
            ['ISO/RTO:', client.iso || 'N/A'],
            ['Account Number:', client.accountNumber || 'N/A']
        ];
        
        // Add optional client fields if present
        if (client.address) {
            metadata.push(['Address:', client.address]);
        }
        if (client.contactName) {
            metadata.push(['Primary Contact:', client.contactName]);
        }
        if (client.contactEmail) {
            metadata.push(['Contact Email:', client.contactEmail]);
        }
        
        metadata.push(['']);
        metadata.push(['WIDGET INFORMATION']);
        metadata.push(['Widget:', config.widgetName]);
        metadata.push(['Version:', config.widgetVersion]);
        metadata.push(['']);
        
        // Add any additional custom info
        if (Object.keys(additionalInfo).length > 0) {
            metadata.push(['ADDITIONAL DETAILS']);
            for (const [key, value] of Object.entries(additionalInfo)) {
                metadata.push([key + ':', String(value)]);
            }
            metadata.push(['']);
        }
        
        return metadata;
    }
    
    /**
     * Generate a filename with client name and timestamp
     * @param {string} baseName - Base name for the file
     * @param {string} extension - File extension (default: xlsx)
     * @param {Object} activeClient - Active client object (optional)
     * @returns {string} Generated filename
     */
    function generateFilename(baseName, extension = 'xlsx', activeClient = null) {
        const client = getActiveClient(activeClient);
        const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const time = new Date().toTimeString().slice(0, 5).replace(':', ''); // HHMM
        
        const clientPart = client.name !== 'No Client Selected' 
            ? sanitizeFilename(client.name) + '_'
            : '';
            
        return `${clientPart}${baseName}_${timestamp}_${time}.${extension}`;
    }
    
    /**
     * Sanitize a string for use in filenames
     * @param {string} str - String to sanitize
     * @returns {string} Sanitized string
     */
    function sanitizeFilename(str) {
        return str.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_').substring(0, 50);
    }
    
    /**
     * Format role string for display
     * @param {string} role - Role string
     * @returns {string} Formatted role
     */
    function formatRole(role) {
        if (!role) return 'User';
        return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
    }
    
    /**
     * Apply professional styling to worksheet metadata section
     * @param {Object} ws - XLSX worksheet object
     * @param {number} dataStartRow - Row where actual data starts (0-indexed)
     * @returns {Object} Modified worksheet
     */
    function styleMetadataSheet(ws, dataStartRow = 0) {
        // Ensure columns array exists
        if (!ws['!cols']) ws['!cols'] = [];
        
        // Set reasonable default column widths
        ws['!cols'][0] = { wch: 22 };  // Label column
        ws['!cols'][1] = { wch: 50 };  // Value column
        
        // Ensure merges array exists
        if (!ws['!merges']) ws['!merges'] = [];
        
        // Merge title row (first row spanning 2 columns minimum)
        ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(1, (ws['!cols'].length || 2) - 1) } });
        
        return ws;
    }
    
    /**
     * Get row count from metadata generation (useful for positioning data)
     * @param {Object} additionalInfo - Same additionalInfo passed to generateMetadataRows
     * @returns {number} Number of rows the metadata will occupy
     */
    function getMetadataRowCount(additionalInfo = {}) {
        // Base rows: title(1) + blank(1) + export section(6) + blank(1) + 
        //            client section(5-8) + blank(1) + widget section(3) + blank(1) = ~19-22
        let count = 19;
        
        // Add for additional info
        if (Object.keys(additionalInfo).length > 0) {
            count += 1 + Object.keys(additionalInfo).length + 1; // Header + items + blank
        }
        
        return count;
    }
    
    // Public API
    return {
        init,
        getCurrentUser,
        getActiveClient,
        generateMetadataRows,
        generateFilename,
        sanitizeFilename,
        styleMetadataSheet,
        getMetadataRowCount,
        
        // Expose config for customization
        setCompanyName: (name) => { config.companyName = name; },
        getConfig: () => ({ ...config })
    };
})();

/**
 * Import Template Utilities
 * =========================
 * 
 * Generates downloadable import templates for various widget types.
 */
const SEImportTemplates = (function() {
    'use strict';
    
    // Template registry - add templates for different widgets
    const templates = {};
    
    /**
     * Register a template generator function
     * @param {string} name - Template name/key
     * @param {Function} generator - Function that creates and returns the workbook
     */
    function registerTemplate(name, generator) {
        templates[name] = generator;
    }
    
    /**
     * Generate and download a template
     * @param {string} name - Template name to generate
     */
    function downloadTemplate(name) {
        if (!templates[name]) {
            console.error(`Template "${name}" not found`);
            return false;
        }
        
        try {
            templates[name]();
            return true;
        } catch (e) {
            console.error(`Error generating template "${name}":`, e);
            return false;
        }
    }
    
    /**
     * Create a standard instructions sheet
     * @param {Array} instructions - Array of instruction strings
     * @returns {Object} XLSX worksheet
     */
    function createInstructionsSheet(instructions) {
        const data = instructions.map(line => [line]);
        const ws = XLSX.utils.aoa_to_sheet(data);
        ws['!cols'] = [{ wch: 80 }];
        return ws;
    }
    
    // Built-in template: Energy Utilization
    registerTemplate('energy-utilization', function() {
        const wb = XLSX.utils.book_new();
        
        // Instructions sheet
        const instructions = [
            'ENERGY UTILIZATION IMPORT TEMPLATE',
            '',
            'Instructions:',
            '1. Enter your 12-month usage data in the "Usage Data" sheet',
            '2. Electric usage should be in kWh (kilowatt-hours)',
            '3. Gas usage should be in Therms',
            '4. Leave cells blank or enter 0 for months with no data',
            '5. Save the file and import using the Import button',
            '',
            'Import Options:',
            '• Electric Only: Only the Electric (kWh) column will be imported',
            '• Gas Only: Only the Gas (Therms) column will be imported',
            '• Both: Both columns will be imported',
            '',
            'Notes:',
            '• Data should be for a rolling 12-month period',
            '• Months should be in calendar order starting from January',
            '• Do not change the column headers'
        ];
        XLSX.utils.book_append_sheet(wb, createInstructionsSheet(instructions), 'Instructions');
        
        // Data template
        const template = [
            ['Month', 'Electric (kWh)', 'Gas (Therms)'],
            ['January', '', ''],
            ['February', '', ''],
            ['March', '', ''],
            ['April', '', ''],
            ['May', '', ''],
            ['June', '', ''],
            ['July', '', ''],
            ['August', '', ''],
            ['September', '', ''],
            ['October', '', ''],
            ['November', '', ''],
            ['December', '', '']
        ];
        const wsData = XLSX.utils.aoa_to_sheet(template);
        wsData['!cols'] = [{ wch: 12 }, { wch: 15 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, wsData, 'Usage Data');
        
        XLSX.writeFile(wb, 'Energy_Utilization_Import_Template.xlsx');
    });
    
    // Built-in template: Client Import (Salesforce format)
    registerTemplate('client-import', function() {
        const wb = XLSX.utils.book_new();
        
        // Instructions
        const instructions = [
            'CLIENT IMPORT TEMPLATE',
            '',
            'Instructions:',
            '1. Enter client data in the "Client Data" sheet',
            '2. Required fields: Parent Account: Account Name',
            '3. All other fields are optional but recommended',
            '4. Do not change column headers',
            '',
            'Field Descriptions:',
            '• Parent Account: Account Name - Primary client name (REQUIRED)',
            '• ISO - Independent System Operator (e.g., PJM, ISO-NE, NYISO)',
            '• Annual Usage (MWh) - Annual electricity usage in megawatt-hours',
            '• Contract End Date - Current contract expiration date',
            '• Account Number - Utility account number',
            '• Address - Service address',
            '• City, State, Zip - Location details',
            '• Primary Contact - Main contact name',
            '• Contact Email - Primary contact email',
            '• Contact Phone - Primary contact phone',
            '• Notes - Any additional notes'
        ];
        XLSX.utils.book_append_sheet(wb, createInstructionsSheet(instructions), 'Instructions');
        
        // Data template
        const template = [
            ['Parent Account: Account Name', 'ISO', 'Annual Usage (MWh)', 'Contract End Date', 
             'Account Number', 'Address', 'City', 'State', 'Zip', 
             'Primary Contact', 'Contact Email', 'Contact Phone', 'Notes'],
            ['Example Client LLC', 'PJM', '5000', '2025-12-31', 
             'ACC-001234', '123 Energy Way', 'Philadelphia', 'PA', '19101',
             'John Smith', 'jsmith@example.com', '215-555-0100', 'Key account']
        ];
        const wsData = XLSX.utils.aoa_to_sheet(template);
        wsData['!cols'] = [
            { wch: 30 }, { wch: 8 }, { wch: 18 }, { wch: 16 },
            { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 6 }, { wch: 8 },
            { wch: 20 }, { wch: 25 }, { wch: 15 }, { wch: 30 }
        ];
        XLSX.utils.book_append_sheet(wb, wsData, 'Client Data');
        
        XLSX.writeFile(wb, 'Client_Import_Template.xlsx');
    });
    
    // Built-in template: Supplier Import
    registerTemplate('supplier-import', function() {
        const wb = XLSX.utils.book_new();
        
        const instructions = [
            'SUPPLIER IMPORT TEMPLATE',
            '',
            'Instructions:',
            '1. Enter supplier data in the "Supplier Data" sheet',
            '2. Required field: Supplier Name',
            '3. Do not change column headers',
            '',
            'Field Descriptions:',
            '• Supplier Name - Company name (REQUIRED)',
            '• Contact Name - Primary contact',
            '• Contact Email - Contact email address',
            '• Contact Phone - Contact phone number',
            '• ISOs Served - Comma-separated list (e.g., PJM, ISO-NE)',
            '• Rating - Supplier rating (1-5)',
            '• Status - Active, Inactive, or Pending',
            '• Notes - Additional notes'
        ];
        XLSX.utils.book_append_sheet(wb, createInstructionsSheet(instructions), 'Instructions');
        
        const template = [
            ['Supplier Name', 'Contact Name', 'Contact Email', 'Contact Phone', 
             'ISOs Served', 'Rating', 'Status', 'Notes'],
            ['Example Energy Co', 'Jane Doe', 'jdoe@example.com', '800-555-0100',
             'PJM, ISO-NE, NYISO', '4', 'Active', 'Preferred supplier']
        ];
        const wsData = XLSX.utils.aoa_to_sheet(template);
        wsData['!cols'] = [
            { wch: 25 }, { wch: 20 }, { wch: 25 }, { wch: 15 },
            { wch: 20 }, { wch: 8 }, { wch: 10 }, { wch: 30 }
        ];
        XLSX.utils.book_append_sheet(wb, wsData, 'Supplier Data');
        
        XLSX.writeFile(wb, 'Supplier_Import_Template.xlsx');
    });
    
    // Built-in template: LMP Data Import
    registerTemplate('lmp-data-import', function() {
        const wb = XLSX.utils.book_new();
        
        const instructions = [
            'LMP DATA IMPORT TEMPLATE',
            '',
            'Instructions:',
            '1. Enter LMP data in the "LMP Data" sheet',
            '2. Date format: YYYY-MM-DD or MM/DD/YYYY',
            '3. Hour should be 1-24 (hour ending)',
            '4. LMP values in $/MWh',
            '',
            'Required Fields:',
            '• Date - The date of the price',
            '• Hour - Hour ending (1-24)',
            '• LMP - Locational Marginal Price in $/MWh',
            '',
            'Optional Fields:',
            '• Energy Component - Energy portion of LMP',
            '• Congestion Component - Congestion portion',
            '• Loss Component - Loss portion',
            '• Node/Zone - Pricing node or zone name'
        ];
        XLSX.utils.book_append_sheet(wb, createInstructionsSheet(instructions), 'Instructions');
        
        const template = [
            ['Date', 'Hour', 'LMP ($/MWh)', 'Energy Component', 'Congestion Component', 'Loss Component', 'Node/Zone'],
            ['2025-01-01', '1', '45.23', '42.10', '2.50', '0.63', 'ZONE_A'],
            ['2025-01-01', '2', '43.15', '40.20', '2.35', '0.60', 'ZONE_A']
        ];
        const wsData = XLSX.utils.aoa_to_sheet(template);
        wsData['!cols'] = [
            { wch: 12 }, { wch: 6 }, { wch: 14 }, { wch: 18 }, 
            { wch: 20 }, { wch: 16 }, { wch: 15 }
        ];
        XLSX.utils.book_append_sheet(wb, wsData, 'LMP Data');
        
        XLSX.writeFile(wb, 'LMP_Data_Import_Template.xlsx');
    });
    
    // Public API
    return {
        registerTemplate,
        downloadTemplate,
        createInstructionsSheet,
        getAvailableTemplates: () => Object.keys(templates)
    };
})();

// CSS styles for import template button (can be injected)
const SEImportButtonStyles = `
/* Import button group with template icon */
.se-import-btn-group {
    display: inline-flex;
    align-items: center;
    gap: 0;
}
.se-import-btn-group .btn {
    border-radius: 6px 0 0 6px;
}
.se-template-download-btn {
    padding: 10px 12px;
    background: var(--bg-input, #0f1629);
    border: 1px solid var(--border, #2d3748);
    border-left: none;
    border-radius: 0 6px 6px 0;
    cursor: pointer;
    color: var(--text-secondary, #a0aec0);
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
}
.se-template-download-btn:hover {
    background: var(--border, #2d3748);
    color: var(--accent, #FF6B35);
}
.se-template-download-btn svg {
    width: 16px;
    height: 16px;
}

/* Template info banner in modals */
.se-template-info {
    background: rgba(0,51,102,0.2);
    border: 1px solid rgba(0,51,102,0.4);
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
}
.se-template-info svg {
    flex-shrink: 0;
    color: #4da6ff;
}
.se-template-info-text {
    flex: 1;
}
.se-template-info-text strong {
    display: block;
    color: #4da6ff;
    font-size: 0.85rem;
    margin-bottom: 2px;
}
.se-template-info-text span {
    font-size: 0.75rem;
    color: var(--text-secondary, #a0aec0);
}
.se-template-download-link {
    color: var(--accent, #FF6B35);
    cursor: pointer;
    text-decoration: underline;
    font-size: 0.8rem;
    white-space: nowrap;
}
.se-template-download-link:hover {
    color: var(--accent-hover, #e85a28);
}
`;

/**
 * Inject import button styles into document
 */
function injectSEImportStyles() {
    if (document.getElementById('se-import-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'se-import-styles';
    style.textContent = SEImportButtonStyles;
    document.head.appendChild(style);
}

/**
 * Generate HTML for import button with template download
 * @param {string} templateName - Name of template to download
 * @param {string} importFunction - Name of import function to call
 * @returns {string} HTML string
 */
function generateImportButtonHTML(templateName, importFunction = 'showImportModal') {
    return `
        <div class="se-import-btn-group">
            <button class="btn btn-secondary" onclick="${importFunction}()">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Import
            </button>
            <button class="se-template-download-btn" onclick="SEImportTemplates.downloadTemplate('${templateName}')" title="Download Import Template">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="12" y1="18" x2="12" y2="12"/>
                    <line x1="9" y1="15" x2="12" y2="18"/>
                    <line x1="15" y1="15" x2="12" y2="18"/>
                </svg>
            </button>
        </div>
    `;
}

/**
 * Generate HTML for template info banner in import modals
 * @param {string} templateName - Name of template
 * @param {string} description - Description text
 * @returns {string} HTML string
 */
function generateTemplateInfoHTML(templateName, description = 'Download the import template to ensure your data imports correctly.') {
    return `
        <div class="se-template-info">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
            </svg>
            <div class="se-template-info-text">
                <strong>Need the correct format?</strong>
                <span>${description}</span>
            </div>
            <span class="se-template-download-link" onclick="SEImportTemplates.downloadTemplate('${templateName}')">Download Template</span>
        </div>
    `;
}
