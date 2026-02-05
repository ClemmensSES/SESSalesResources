const { BlobServiceClient } = require('@azure/storage-blob');
/**
 * Azure Function: SecureDataAPI
 * 
 * Full CRUD operations for secure data storage in Azure Blob Storage.
 * 
 * Endpoints:
 *   GET    /api/data/{filename}           - Read entire file
 *   POST   /api/data/{filename}           - Create/append record
 *   PUT    /api/data/{filename}           - Full file replacement (no ID) or update specific record (with ID)
 *   DELETE /api/data/{filename}/{id}      - Delete specific record
 * 
 * Deployment:
 *   cd azure-function && npm install
 *   zip -r deploy.zip .
 *   az functionapp deployment source config-zip --name ses-data-api --resource-group ses-portal-resources --src deploy.zip
 * 
 * Last Updated: 2026-02-05
 */
// ============================================================
// PERMISSIONS CONFIGURATION
// ============================================================
const FILE_PERMISSIONS = {
    'admin': {
        read: ['clients.json', 'users.json', 'contracts.json', 'lmp-database.json', 'accounts.json', 'energy-profiles.json', 'activity-log.json', 'usage-profiles.json', 'tickets.json', 'widget-preferences.json'],
        write: ['clients.json', 'users.json', 'contracts.json', 'lmp-database.json', 'accounts.json', 'energy-profiles.json', 'activity-log.json', 'usage-profiles.json', 'tickets.json', 'widget-preferences.json'],
        delete: ['energy-profiles.json', 'tickets.json']
    },
    'ae': {
        read: ['clients.json', 'contracts.json', 'accounts.json', 'energy-profiles.json', 'usage-profiles.json'],
        write: ['energy-profiles.json', 'contracts.json', 'usage-profiles.json'],
        delete: ['energy-profiles.json']
    },
    'widget': {
        read: ['clients.json', 'accounts.json', 'energy-profiles.json', 'usage-profiles.json', 'widget-preferences.json', 'activity-log.json'],
        write: ['energy-profiles.json', 'usage-profiles.json', 'widget-preferences.json', 'activity-log.json'],
        delete: []
    },
    'workflow': {
        read: ['lmp-database.json'],
        write: ['lmp-database.json'],
        delete: []
    },
    'readonly': {
        read: ['lmp-database.json'],
        write: [],
        delete: []
    }
};
// ============================================================
// HELPER FUNCTIONS
// ============================================================
function getRoleFromKey(apiKey) {
    const parts = apiKey.split('-');
    if (parts.length >= 2 && parts[0] === 'ses') {
        return parts[1];
    }
    return null;
}
function hasPermission(apiKey, filename, operation) {
    const role = getRoleFromKey(apiKey);
    if (!role || !FILE_PERMISSIONS[role]) {
        return false;
    }
    const permissions = FILE_PERMISSIONS[role][operation] || [];
    return permissions.includes(filename);
}
async function streamToString(stream) {
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf-8');
}
function generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
// ============================================================
// BLOB OPERATIONS
// ============================================================
async function getBlob(containerClient, filename) {
    const blobClient = containerClient.getBlobClient(filename);
    const exists = await blobClient.exists();
    
    if (!exists) {
        return null;
    }
    
    const downloadResponse = await blobClient.download(0);
    const content = await streamToString(downloadResponse.readableStreamBody);
    return JSON.parse(content);
}
async function saveBlob(containerClient, filename, data) {
    const blobClient = containerClient.getBlockBlobClient(filename);
    const content = JSON.stringify(data, null, 2);
    
    await blobClient.upload(content, Buffer.byteLength(content), {
        overwrite: true,
        blobHTTPHeaders: {
            blobContentType: 'application/json'
        }
    });
    
    return true;
}
async function deleteBlob(containerClient, filename) {
    const blobClient = containerClient.getBlobClient(filename);
    const exists = await blobClient.exists();
    
    if (!exists) {
        return false;
    }
    
    await blobClient.delete();
    return true;
}
// ============================================================
// MAIN FUNCTION
// ============================================================
module.exports = async function (context, req) {
    context.log(`SecureDataAPI: ${req.method} ${req.url}`);
    // Configuration
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    const validKeys = (process.env.VALID_API_KEYS || '').split(',').map(k => k.trim());
    const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim());
    // CORS
    const requestOrigin = req.headers.origin || req.headers.Origin || '';
    const corsOrigin = allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0] || '*';
    
    const corsHeaders = {
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
        'Access-Control-Allow-Credentials': 'true'
    };
    // Preflight
    if (req.method === 'OPTIONS') {
        context.res = { status: 204, headers: corsHeaders };
        return;
    }
    // Authenticate API Key
    const apiKey = req.headers['x-api-key'] || req.headers['X-API-Key'];
    
    if (!apiKey || !validKeys.includes(apiKey)) {
        context.res = {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Unauthorized', message: 'Valid API key required.' })
        };
        return;
    }
    // Parse route
    const filename = req.params.filename;
    const recordId = req.params.id;
    if (!filename) {
        context.res = {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Bad Request', message: 'Filename required.' })
        };
        return;
    }
    // Check permissions
    const isRead = req.method === 'GET';
    const isWrite = ['POST', 'PUT', 'PATCH'].includes(req.method);
    const isDelete = req.method === 'DELETE';
    const operation = isRead ? 'read' : isWrite ? 'write' : 'delete';
    if (!hasPermission(apiKey, filename, operation)) {
        context.res = {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                error: 'Forbidden', 
                message: `Your API key cannot ${operation} ${filename}.` 
            })
        };
        return;
    }
    // Connect to blob storage
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient('secure-data');
    try {
        // ========================================
        // GET - Read operations
        // ========================================
        if (req.method === 'GET') {
            const data = await getBlob(containerClient, filename);
            
            if (data === null) {
                context.res = {
                    status: 404,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'Not Found', message: `${filename} not found.` })
                };
                return;
            }
            // Get specific record by ID
            if (recordId && Array.isArray(data)) {
                const record = data.find(item => 
                    item.id === recordId || 
                    item._id === recordId ||
                    item.profileId === recordId
                );
                
                if (!record) {
                    context.res = {
                        status: 404,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ error: 'Not Found', message: `Record ${recordId} not found.` })
                    };
                    return;
                }
                
                context.res = {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    body: JSON.stringify(record)
                };
                return;
            }
            context.res = {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            };
            return;
        }
        // ========================================
        // POST - Create new record
        // ========================================
        if (req.method === 'POST') {
            const newData = req.body;
            
            if (!newData) {
                context.res = {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'Bad Request', message: 'Request body required.' })
                };
                return;
            }
            // Add to existing array
            if (typeof newData === 'object' && !Array.isArray(newData)) {
                let existingData = await getBlob(containerClient, filename);
                
                if (existingData === null) {
                    existingData = [];
                }
                
                if (Array.isArray(existingData)) {
                    const record = {
                        ...newData,
                        id: newData.id || generateId(),
                        createdAt: new Date().toISOString(),
                        createdBy: getRoleFromKey(apiKey)
                    };
                    
                    existingData.push(record);
                    await saveBlob(containerClient, filename, existingData);
                    
                    context.res = {
                        status: 201,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            success: true, 
                            message: 'Record created.',
                            record: record
                        })
                    };
                    return;
                }
            }
            
            // Replace entire file
            await saveBlob(containerClient, filename, newData);
            
            context.res = {
                status: 201,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ success: true, message: 'File saved.' })
            };
            return;
        }
        // ========================================
        // PUT - Update specific record or full file replacement
        // ========================================
        if (req.method === 'PUT') {
            if (!recordId) {
                // Full file replacement (no record ID)
                const fullData = req.body;
                await saveBlob(containerClient, filename, fullData);
                context.res = {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ success: true, message: 'File replaced', filename: filename })
                };
                return;
            }
            const updateData = req.body;
            let existingData = await getBlob(containerClient, filename);
            
            if (!Array.isArray(existingData)) {
                context.res = {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'Bad Request', message: 'File is not an array.' })
                };
                return;
            }
            const index = existingData.findIndex(item => 
                item.id === recordId || 
                item._id === recordId ||
                item.profileId === recordId
            );
            
            if (index === -1) {
                context.res = {
                    status: 404,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ error: 'Not Found', message: `Record ${recordId} not found.` })
                };
                return;
            }
            existingData[index] = {
                ...existingData[index],
                ...updateData,
                id: existingData[index].id,
                createdAt: existingData[index].createdAt,
                updatedAt: new Date().toISOString(),
                updatedBy: getRoleFromKey(apiKey)
            };
            
            await saveBlob(containerClient, filename, existingData);
            
            context.res = {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    success: true, 
                    message: 'Record updated.',
                    record: existingData[index]
                })
            };
            return;
        }
        // ========================================
        // DELETE - Remove record
        // ========================================
        if (req.method === 'DELETE') {
            if (recordId) {
                // Delete specific record from array
                let existingData = await getBlob(containerClient, filename);
                
                if (!Array.isArray(existingData)) {
                    context.res = {
                        status: 400,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ error: 'Bad Request', message: 'Cannot delete record from non-array.' })
                    };
                    return;
                }
                const initialLength = existingData.length;
                existingData = existingData.filter(item => 
                    item.id !== recordId && 
                    item._id !== recordId &&
                    item.profileId !== recordId
                );
                
                if (existingData.length === initialLength) {
                    context.res = {
                        status: 404,
                        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                        body: JSON.stringify({ error: 'Not Found', message: `Record ${recordId} not found.` })
                    };
                    return;
                }
                
                await saveBlob(containerClient, filename, existingData);
                
                context.res = {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ success: true, message: 'Record deleted.' })
                };
                return;
            }
            
            // Delete entire file
            const deleted = await deleteBlob(containerClient, filename);
            
            context.res = {
                status: deleted ? 200 : 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    success: deleted, 
                    message: deleted ? 'File deleted.' : 'File not found.' 
                })
            };
            return;
        }
    } catch (error) {
        context.log.error('Error:', error.message);
        context.res = {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Server Error', message: error.message })
        };
    }
};
