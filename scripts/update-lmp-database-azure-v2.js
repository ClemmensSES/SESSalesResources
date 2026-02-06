/**
 * LMP Database Azure Updater v2.1.0
 * 
 * Merges newly fetched hourly + monthly LMP data into Azure Blob Storage.
 * ONLY appends new records and updates existing ones - never deletes.
 * 
 * Reads from:
 *   ../temp/fetched-lmp-hourly.json  (hourly data organized by ISO > month)
 *   ../temp/fetched-lmp-data.json    (monthly summaries)
 * 
 * Writes to Azure:
 *   lmp-database.json  (combined: meta + monthly data + hourly data)
 * 
 * Environment Variables:
 *   AZURE_API_ENDPOINT - Azure Function API base URL
 *   AZURE_API_KEY      - API key with write access to lmp-database.json
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const AZURE_API_ENDPOINT = process.env.AZURE_API_ENDPOINT || 'https://ses-data-api-gpaqghfbehhrb6c2.eastus-01.azurewebsites.net/api/data';
const AZURE_API_KEY = process.env.AZURE_API_KEY;
const LMP_FILE = 'lmp-database.json';

const HOURLY_PATH = path.join(__dirname, '..', 'temp', 'fetched-lmp-hourly.json');
const MONTHLY_PATH = path.join(__dirname, '..', 'temp', 'fetched-lmp-data.json');

// ============================================================
// AZURE API
// ============================================================

function apiRequest(method, file, data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(`${AZURE_API_ENDPOINT}/${file}`);

        const options = {
            hostname: url.hostname,
            path: url.pathname,
            method: method,
            headers: {
                'x-api-key': AZURE_API_KEY,
                'Accept': 'application/json'
            }
        };

        if (data) {
            options.headers['Content-Type'] = 'application/json';
        }

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try { resolve(body ? JSON.parse(body) : {}); }
                    catch { resolve(body); }
                } else if (res.statusCode === 404) {
                    resolve(null);
                } else {
                    reject(new Error(`API returned ${res.statusCode}: ${body.substring(0, 300)}`));
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(120000, () => { req.destroy(); reject(new Error('Request timeout (120s)')); });

        if (data) {
            const payload = JSON.stringify(data);
            req.write(payload);
        }
        req.end();
    });
}

// ============================================================
// MERGE LOGIC - APPEND/UPDATE ONLY
// ============================================================

/**
 * Unique key for a monthly record.
 * Uses zone (not zone_id) because that's the consistent field across old and new data.
 */
function monthlyKey(r) {
    return `${r.iso}_${r.zone}_${r.year}_${r.month}`;
}

/**
 * Merge new monthly records into existing database.
 * - New records are ADDED
 * - Existing records are UPDATED only if LMP value changed
 * - Nothing is deleted
 */
function mergeMonthlyData(database, newRecords) {
    let added = 0, updated = 0, unchanged = 0;

    for (const record of newRecords) {
        const iso = record.iso;
        if (!database.data[iso]) {
            database.data[iso] = [];
        }

        const key = monthlyKey(record);
        const idx = database.data[iso].findIndex(r => monthlyKey(r) === key);

        // Normalize to consistent format
        const normalized = {
            iso: record.iso,
            zone: record.zone,
            zone_id: record.zone_id || record.zone,
            year: record.year.toString(),
            month: record.month.toString().padStart(2, '0'),
            avg_da_lmp: parseFloat(record.avg_da_lmp || record.lmp || 0),
            min_price: parseFloat(record.min_price || record.avg_da_lmp || 0),
            max_price: parseFloat(record.max_price || record.avg_da_lmp || 0),
            record_count: record.record_count || 0
        };

        // Skip zero-price records unless there's no existing data
        // (prevents overwriting good data with bad fetches)
        if (normalized.avg_da_lmp === 0 && idx >= 0 && database.data[iso][idx].avg_da_lmp > 0) {
            console.log(`  ⚠️  Skipping zero-price update for ${key} (existing: $${database.data[iso][idx].avg_da_lmp})`);
            unchanged++;
            continue;
        }

        if (idx === -1) {
            database.data[iso].push(normalized);
            added++;
        } else {
            const existing = database.data[iso][idx];
            if (Math.abs((existing.avg_da_lmp || 0) - normalized.avg_da_lmp) > 0.0001) {
                database.data[iso][idx] = normalized;
                updated++;
            } else {
                unchanged++;
            }
        }
    }

    // Sort each ISO's records
    for (const iso of Object.keys(database.data)) {
        database.data[iso].sort((a, b) =>
            (a.zone || '').localeCompare(b.zone || '') ||
            (a.year || '').localeCompare(b.year || '') ||
            (a.month || '').localeCompare(b.month || '')
        );
    }

    return { added, updated, unchanged };
}

/**
 * Merge new hourly data into database.
 * - Replaces entire month's data per ISO (newer fetch wins for that month)
 * - Does NOT touch other months that weren't fetched
 * - Skips months where all prices are zero (bad fetch)
 */
function mergeHourlyData(database, newHourlyData) {
    if (!newHourlyData || !newHourlyData.data) {
        return { addedMonths: 0, updatedMonths: 0, totalRecords: 0, skippedMonths: 0 };
    }

    if (!database.hourly) {
        database.hourly = {};
    }

    let addedMonths = 0, updatedMonths = 0, totalRecords = 0, skippedMonths = 0;

    for (const [iso, monthData] of Object.entries(newHourlyData.data)) {
        if (!database.hourly[iso]) {
            database.hourly[iso] = {};
        }

        for (const [yearMonth, records] of Object.entries(monthData)) {
            if (!records || records.length === 0) continue;

            // Safety check: skip if ALL prices are zero (bad fetch)
            const hasNonZero = records.some(r => r.p !== 0);
            if (!hasNonZero) {
                console.log(`  ⚠️  Skipping ${iso}/${yearMonth}: all ${records.length} records have p=0 (bad fetch)`);
                skippedMonths++;
                continue;
            }

            const isNew = !database.hourly[iso][yearMonth];
            database.hourly[iso][yearMonth] = records;
            totalRecords += records.length;

            if (isNew) addedMonths++;
            else updatedMonths++;
        }
    }

    return { addedMonths, updatedMonths, totalRecords, skippedMonths };
}

// ============================================================
// STORAGE STATS
// ============================================================

function countRecords(database) {
    let monthly = 0, hourly = 0;

    for (const iso of Object.keys(database.data || {})) {
        monthly += (database.data[iso] || []).length;
    }
    for (const iso of Object.keys(database.hourly || {})) {
        for (const ym of Object.keys(database.hourly[iso] || {})) {
            hourly += (database.hourly[iso][ym] || []).length;
        }
    }

    return { monthly, hourly };
}

// ============================================================
// MAIN
// ============================================================

async function main() {
    console.log('═'.repeat(60));
    console.log('LMP Database Updater v2.1.0 (Azure)');
    console.log('═'.repeat(60));

    if (!AZURE_API_KEY) {
        console.error('❌ AZURE_API_KEY not set');
        process.exit(1);
    }

    // ── Load temp data ──
    let hourlyData = null;
    let monthlyData = null;

    if (fs.existsSync(HOURLY_PATH)) {
        hourlyData = JSON.parse(fs.readFileSync(HOURLY_PATH, 'utf8'));
        console.log(`📦 Hourly data: ${hourlyData.hourlyRecordCount?.toLocaleString()} records`);
    } else {
        console.log('ℹ️  No hourly data file (optional)');
    }

    if (fs.existsSync(MONTHLY_PATH)) {
        monthlyData = JSON.parse(fs.readFileSync(MONTHLY_PATH, 'utf8'));
        console.log(`📦 Monthly data: ${monthlyData.recordCount?.toLocaleString() || monthlyData.records?.length} records`);
    } else {
        console.error('❌ Monthly data file not found');
        process.exit(1);
    }

    console.log(`\n📅 Fetch range: ${monthlyData.dateRange.start} to ${monthlyData.dateRange.end}`);
    console.log(`🏢 Markets: ${monthlyData.markets.join(', ')}`);

    // ── Quick data quality check ──
    const zeroMonthly = monthlyData.records.filter(r => (r.avg_da_lmp || r.lmp || 0) === 0).length;
    if (zeroMonthly > 0) {
        console.log(`\n⚠️  Warning: ${zeroMonthly}/${monthlyData.records.length} monthly records have zero LMP`);
        console.log(`   These will NOT overwrite existing non-zero values in the database.`);
    }

    // ── Fetch existing database from Azure ──
    console.log('\n── Fetching existing database from Azure ──');
    let database;

    try {
        database = await apiRequest('GET', LMP_FILE);
        if (!database || !database.data) {
            console.log('  No existing database, creating new one');
            database = { meta: {}, data: {}, hourly: {} };
        } else {
            const stats = countRecords(database);
            console.log(`  ✅ Loaded: ${stats.monthly.toLocaleString()} monthly, ${stats.hourly.toLocaleString()} hourly`);
        }
    } catch (err) {
        console.log(`  ⚠️  ${err.message} — creating new database`);
        database = { meta: {}, data: {}, hourly: {} };
    }

    // ── Merge monthly ──
    console.log('\n── Merging monthly data ──');
    const mStats = mergeMonthlyData(database, monthlyData.records);
    console.log(`  Added: ${mStats.added}`);
    console.log(`  Updated: ${mStats.updated}`);
    console.log(`  Unchanged: ${mStats.unchanged}`);

    // ── Merge hourly ──
    let hStats = { addedMonths: 0, updatedMonths: 0, totalRecords: 0, skippedMonths: 0 };
    if (hourlyData) {
        console.log('\n── Merging hourly data ──');
        hStats = mergeHourlyData(database, hourlyData);
        console.log(`  New months: ${hStats.addedMonths}`);
        console.log(`  Updated months: ${hStats.updatedMonths}`);
        console.log(`  Skipped (bad data): ${hStats.skippedMonths}`);
        console.log(`  Total hourly records: ${hStats.totalRecords.toLocaleString()}`);
    }

    // ── Update metadata ──
    const finalStats = countRecords(database);
    database.meta = {
        lastUpdate: new Date().toISOString(),
        lastFetchRange: monthlyData.dateRange,
        storage: 'azure',
        version: '3.1',
        source: 'arcadia-genability',
        hasHourlyData: finalStats.hourly > 0,
        totalMonthlyRecords: finalStats.monthly,
        totalHourlyRecords: finalStats.hourly
    };

    // ── Save to Azure ──
    const hasChanges = mStats.added > 0 || mStats.updated > 0 ||
                       hStats.addedMonths > 0 || hStats.updatedMonths > 0;

    if (hasChanges) {
        console.log('\n── Saving to Azure ──');
        console.log(`  Monthly: ${finalStats.monthly.toLocaleString()} records`);
        console.log(`  Hourly: ${finalStats.hourly.toLocaleString()} records`);

        const payloadSize = JSON.stringify(database).length;
        console.log(`  Payload size: ${(payloadSize / 1024 / 1024).toFixed(2)} MB`);

        try {
            await apiRequest('PUT', LMP_FILE, database);
            console.log('  ✅ Database saved successfully!');
        } catch (err) {
            console.error(`  ❌ Error saving: ${err.message}`);
            process.exit(1);
        }
    } else {
        console.log('\n✔️  No changes to save.');
    }

    // ── Cleanup ──
    try {
        if (fs.existsSync(MONTHLY_PATH)) fs.unlinkSync(MONTHLY_PATH);
        if (fs.existsSync(HOURLY_PATH)) fs.unlinkSync(HOURLY_PATH);
        console.log('🧹 Temp files cleaned up');
    } catch { /* ok */ }

    console.log('\n' + '═'.repeat(60));
    console.log(hasChanges ? '✅ Database updated!' : 'No changes needed.');
}

main().catch(err => {
    console.error('❌ Fatal:', err.message);
    process.exit(1);
});
