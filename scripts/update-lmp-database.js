/**
 * LMP Database Updater
 * 
 * Merges newly fetched LMP data into the existing database.
 * - Adds new records
 * - Updates existing records if values differ
 * - Preserves historical data
 * - Maintains consistent record format
 */

const fs = require('fs');
const path = require('path');

// Paths
const FETCHED_DATA_PATH = path.join(__dirname, '..', 'temp', 'fetched-lmp-data.json');
const DATABASE_PATH = path.join(__dirname, '..', 'data', 'lmp-database.json');

/**
 * Create a unique key for a record
 */
function getRecordKey(record) {
    return `${record.iso}_${record.zone}_${record.year}_${record.month}`;
}

/**
 * Normalize zone format to match existing database
 */
function normalizeRecord(record) {
    // Ensure consistent format matching existing database structure
    return {
        iso: record.iso,
        zone: record.zone,
        zoneId: record.zoneId,
        year: String(record.year),
        month: String(record.month),
        lmp: parseFloat(record.lmp.toFixed(2)),
        energy: record.energy || 0,
        congestion: record.congestion || 0,
        loss: record.loss || 0
    };
}

/**
 * Main update process
 */
function main() {
    console.log('📊 LMP Database Updater');
    console.log('━'.repeat(50));

    // Load fetched data
    if (!fs.existsSync(FETCHED_DATA_PATH)) {
        console.error('❌ No fetched data found at:', FETCHED_DATA_PATH);
        process.exit(1);
    }

    const fetchedData = JSON.parse(fs.readFileSync(FETCHED_DATA_PATH, 'utf8'));
    console.log(`📥 Loaded ${fetchedData.recordCount} new records`);
    console.log(`   Date range: ${fetchedData.dateRange.start} to ${fetchedData.dateRange.end}`);

    // Load existing database
    let database;
    if (fs.existsSync(DATABASE_PATH)) {
        database = JSON.parse(fs.readFileSync(DATABASE_PATH, 'utf8'));
        console.log(`📂 Existing database: ${database.records.length} records`);
    } else {
        console.log('📂 No existing database, creating new one');
        database = {
            version: '1.0.0',
            lastUpdated: null,
            meta: {
                source: 'arcadia-api',
                loadedAt: null,
                recordCount: 0
            },
            records: []
        };
    }

    // Create lookup map for existing records
    const existingMap = new Map();
    database.records.forEach(record => {
        existingMap.set(getRecordKey(record), record);
    });

    // Process new records
    let added = 0;
    let updated = 0;
    let unchanged = 0;

    fetchedData.records.forEach(newRecord => {
        const normalized = normalizeRecord(newRecord);
        const key = getRecordKey(normalized);
        const existing = existingMap.get(key);

        if (!existing) {
            // New record - add it
            existingMap.set(key, normalized);
            added++;
        } else if (Math.abs(existing.lmp - normalized.lmp) > 0.01) {
            // Existing record with different value - update it
            existingMap.set(key, normalized);
            updated++;
        } else {
            unchanged++;
        }
    });

    // Convert map back to array and sort
    const updatedRecords = Array.from(existingMap.values());
    
    // Sort by ISO, zone, year, month
    updatedRecords.sort((a, b) => {
        if (a.iso !== b.iso) return a.iso.localeCompare(b.iso);
        if (a.zone !== b.zone) return a.zone.localeCompare(b.zone);
        if (a.year !== b.year) return a.year.localeCompare(b.year);
        return a.month.localeCompare(b.month);
    });

    // Update database
    database.records = updatedRecords;
    database.lastUpdated = new Date().toISOString();
    database.meta = {
        source: 'arcadia-api',
        loadedAt: new Date().toISOString(),
        recordCount: updatedRecords.length,
        lastFetchRange: fetchedData.dateRange
    };

    // Ensure data directory exists
    const dataDir = path.dirname(DATABASE_PATH);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    // Save updated database
    fs.writeFileSync(DATABASE_PATH, JSON.stringify(database, null, 2));

    // Summary
    console.log('\n' + '━'.repeat(50));
    console.log('📊 Update Summary:');
    console.log(`   ➕ Added: ${added} new records`);
    console.log(`   🔄 Updated: ${updated} existing records`);
    console.log(`   ⏸️  Unchanged: ${unchanged} records`);
    console.log(`   📁 Total: ${updatedRecords.length} records`);
    console.log(`\n💾 Database saved to: ${DATABASE_PATH}`);

    // Clean up temp file
    try {
        fs.unlinkSync(FETCHED_DATA_PATH);
        console.log('🧹 Cleaned up temp files');
    } catch (e) {
        // Ignore cleanup errors
    }
}

main();
