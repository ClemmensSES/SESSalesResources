/**
 * API Key Setup - Auto-configured for all users
 * Version: 1.1.0
 * 
 * This script automatically configures the Azure API connection.
 * No user interaction required - the API key is embedded.
 */

(function() {
    'use strict';
    
    // =============================================
    // CONFIGURATION - Set your API key here
    // =============================================
    const API_CONFIG = {
        // Your Azure Function API endpoint
        apiEndpoint: 'https://ses-data-api-gpaqghfbehhrb6c2.eastus-01.azurewebsites.net/api/data',
        
        // Admin API key - all portal users will use this
        // Replace with your production key when ready
        apiKey: 'ses-admin-abc123def456',
        
        // Set to true to skip validation (faster startup)
        skipValidation: false
    };
    
    // =============================================
    // AUTO-INITIALIZATION
    // =============================================
    
    async function initializeAzureConnection() {
        console.log('[API Setup] Auto-configuring Azure connection...');
        
        // Check if AzureDataService exists
        if (typeof AzureDataService === 'undefined') {
            console.error('[API Setup] AzureDataService not found. Make sure azure-data-service.js is loaded first.');
            return false;
        }
        
        // Configure the service
        AzureDataService.configure(API_CONFIG.apiEndpoint, API_CONFIG.apiKey);
        
        // Optionally validate the connection
        if (!API_CONFIG.skipValidation) {
            try {
                // Try a simple request to verify connection
                const testResult = await AzureDataService.list();
                console.log('[API Setup] Azure connection verified. Files:', testResult?.length || 0);
            } catch (e) {
                console.warn('[API Setup] Could not verify Azure connection:', e.message);
                console.warn('[API Setup] Portal will use local fallback data.');
                // Don't block - let the portal continue with fallback
            }
        }
        
        // Signal that Azure is ready
        window.dispatchEvent(new CustomEvent('azureDataReady', { 
            detail: { 
                configured: true,
                endpoint: API_CONFIG.apiEndpoint
            } 
        }));
        
        console.log('[API Setup] Azure Data Service configured and ready');
        return true;
    }
    
    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeAzureConnection);
    } else {
        // DOM already loaded
        initializeAzureConnection();
    }
    
    // Export for manual re-initialization if needed
    window.reinitializeAzure = initializeAzureConnection;
    
    // Export config for debugging (remove in production if desired)
    window.AzureConfig = {
        getEndpoint: () => API_CONFIG.apiEndpoint,
        isConfigured: () => typeof AzureDataService !== 'undefined' && AzureDataService.isConfigured()
    };
    
})();
