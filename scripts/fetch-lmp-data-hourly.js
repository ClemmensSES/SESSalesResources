/**
 * Arcadia/Genability LMP Hourly Data Fetcher
 * Version: 2.1.0 - CORRECTED
 * 
 * Fetches Day-Ahead LMP hourly data from the Genability API.
 * Zone IDs and field names verified against the Arcadia LMP Fetcher V2
 * and the Arcadia_ISO-zone_mapping.txt API discovery output.
 * 
 * Outputs BOTH:
 *   temp/fetched-lmp-hourly.json  - hourly records by ISO > month > [{dt,p,z}]
 *   temp/fetched-lmp-data.json    - monthly summaries for backward compat
 * 
 * Environment Variables:
 *   ARCADIA_APP_ID  - Genability API App ID
 *   ARCADIA_APP_KEY - Genability API App Key
 *   START_DATE      - YYYY-MM-DD
 *   END_DATE        - YYYY-MM-DD
 *   ISO_MARKETS     - comma-separated ISOs or 'all' (default: all)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ============================================================
// ISO CONFIGURATION
// Zone IDs match arcadia-lmp-fetcher-COMPLETE_V2.html exactly
// propertyKeys match Arcadia_ISO-zone_mapping.txt
// ============================================================
const ISO_CONFIG = {
    ERCOT: {
        name: 'ERCOT',
        propertyKey: 'hourlyPricingDayAheadERCOT',
        zones: [
            // API subKeyName values - NO "LZ_" prefix
            { value: 'AEN',     label: 'AEN',      dbName: 'AEN' },
            { value: 'CPS',     label: 'CPS Energy',dbName: 'CPS' },
            { value: 'HOUSTON', label: 'Houston',   dbName: 'HOUSTON' },
            { value: 'LCRA',    label: 'LCRA',      dbName: 'LCRA' },
            { value: 'NORTH',   label: 'North',     dbName: 'NORTH' },
            { value: 'RAYBN',   label: 'Rayburn',   dbName: 'RAYBN' },
            { value: 'SOUTH',   label: 'South',     dbName: 'SOUTH' },
            { value: 'WEST',    label: 'West',      dbName: 'WEST' }
        ]
    },
    ISONE: {
        name: 'ISO-NE',
        propertyKey: 'hourlyPricingDayAheadISONE',
        zones: [
            // 4001-4008 only. Zone 4000 does NOT exist in the API.
            { value: '4001', label: 'Maine',        dbName: '4001_Maine' },
            { value: '4002', label: 'NH',           dbName: '4002_NH' },
            { value: '4003', label: 'Vermont',      dbName: '4003_Vermont' },
            { value: '4004', label: 'Connecticut',  dbName: '4004_Connecticut' },
            { value: '4005', label: 'Rhode Island', dbName: '4005_Rhode_Island' },
            { value: '4006', label: 'SEMA',         dbName: '4006_SEMA' },
            { value: '4007', label: 'WCMA',         dbName: '4007_WCMA' },
            { value: '4008', label: 'NEMA',         dbName: '4008_NEMA' }
        ]
    },
    MISO: {
        name: 'MISO',
        propertyKey: 'hourlyPricingDayAheadMISO',
        zones: [
            { value: 'ARKANSAS',  label: 'Arkansas',   dbName: 'ARKANSAS' },
            { value: 'ILLINOIS',  label: 'Illinois',   dbName: 'ILLINOIS' },
            { value: 'INDIANA',   label: 'Indiana',    dbName: 'INDIANA' },
            { value: 'LOUISIANA', label: 'Louisiana',  dbName: 'LOUISIANA' },
            { value: 'MICHIGAN',  label: 'Michigan',   dbName: 'MICHIGAN' },
            { value: 'MINN',      label: 'Minnesota',  dbName: 'MINN' },
            { value: 'MS',        label: 'Mississippi', dbName: 'MS' },
            { value: 'TEXAS',     label: 'Texas',      dbName: 'TEXAS' }
        ]
    },
    NYISO: {
        name: 'NYISO',
        propertyKey: 'hourlyPricingDayAheadNYISO',
        zones: [
            // All 15 zones from API discovery (11 main + 4 hubs)
            { value: '61752', label: 'West (A)',         dbName: '61752' },
            { value: '61753', label: 'Genesee (B)',      dbName: '61753' },
            { value: '61754', label: 'Central (C)',      dbName: '61754' },
            { value: '61755', label: 'North (D)',        dbName: '61755' },
            { value: '61756', label: 'Mohawk Valley (E)',dbName: '61756' },
            { value: '61757', label: 'Capital (F)',      dbName: '61757' },
            { value: '61758', label: 'Hudson Valley (G)',dbName: '61758' },
            { value: '61759', label: 'Millwood (H)',     dbName: '61759' },
            { value: '61760', label: 'Dunwoodie (I)',    dbName: '61760' },
            { value: '61761', label: 'NYC (J)',          dbName: '61761' },
            { value: '61762', label: 'Long Island (K)',  dbName: '61762' },
            { value: '61844', label: 'Zone J Hub',       dbName: '61844' },
            { value: '61845', label: 'Zone K Hub',       dbName: '61845' },
            { value: '61846', label: 'Zone A Hub',       dbName: '61846' },
            { value: '61847', label: 'Zone F Hub',       dbName: '61847' }
        ]
    },
    PJM: {
        name: 'PJM',
        propertyKey: 'hourlyPricingDayAheadPJM',
        zones: [
            // ACTUAL Genability API zone IDs - NOT sequential
            { value: '51291',     label: 'AECO',              dbName: 'AECO' },
            { value: '51292',     label: 'BGE',               dbName: 'BGE' },
            { value: '51293',     label: 'DPL',               dbName: 'DPL' },
            { value: '51295',     label: 'JCPL',              dbName: 'JCPL' },
            { value: '51296',     label: 'Met-Ed',            dbName: 'METED' },
            { value: '51297',     label: 'PECO',              dbName: 'PECO' },
            { value: '51298',     label: 'Penelec',           dbName: 'PENELEC' },
            { value: '51299',     label: 'Pepco',             dbName: 'PEPCO' },
            { value: '51300',     label: 'PPL',               dbName: 'PPL' },
            { value: '51301',     label: 'Duquesne',          dbName: 'DUQ' },
            { value: '7633629',   label: 'EKPC',              dbName: 'EKPC' },
            { value: '8394954',   label: 'APS',               dbName: 'APS' },
            { value: '8445784',   label: 'AEP',               dbName: 'AEP' },
            { value: '33092371',  label: 'ComEd',             dbName: 'COMED' },
            { value: '34508503',  label: 'Dayton',            dbName: 'DAY' },
            { value: '34964545',  label: 'Dominion',          dbName: 'DOM' },
            { value: '37737283',  label: 'RECO',              dbName: 'RECO' },
            { value: '116013753', label: 'ATSI',              dbName: 'ATSI' },
            { value: '124076095', label: 'Duke Energy OH/KY', dbName: 'DEOK' }
        ]
    }
};

// ============================================================
// ENVIRONMENT
// ============================================================
const APP_ID = process.env.ARCADIA_APP_ID;
const APP_KEY = process.env.ARCADIA_APP_KEY;
const START_DATE = process.env.START_DATE;
const END_DATE = process.env.END_DATE;
const ISO_MARKETS = process.env.ISO_MARKETS || 'all';

if (!APP_ID || !APP_KEY) {
    console.error('❌ Missing ARCADIA_APP_ID or ARCADIA_APP_KEY');
    process.exit(1);
}
if (!START_DATE || !END_DATE) {
    console.error('❌ Missing START_DATE or END_DATE');
    process.exit(1);
}

const credentials = Buffer.from(`${APP_ID}:${APP_KEY}`).toString('base64');

// ============================================================
// GENABILITY API
// ============================================================

function fetchFromAPI(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Accept': 'application/json'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try { resolve(JSON.parse(data)); }
                    catch (e) { reject(new Error(`JSON parse error: ${e.message}`)); }
                } else if (res.statusCode === 401) {
                    reject(new Error('Invalid API credentials (401)'));
                } else {
                    reject(new Error(`API returned ${res.statusCode}: ${data.substring(0, 200)}`));
                }
            });
        });
        req.on('error', reject);
        req.setTimeout(30000, () => { req.destroy(); reject(new Error('Request timeout')); });
    });
}

/**
 * Fetch all hourly records for one zone, with pagination.
 * 
 * CRITICAL FIX: Uses actualValue / bestValue (the real Genability field names)
 * NOT dataValue / lmpTotal which don't exist and caused all p:0 records.
 */
async function fetchZoneHourly(propertyKey, zoneId, startDate, endDate) {
    const baseUrl = 'https://api.genability.com/rest/public/properties';
    const records = [];
    let pageStart = 0;
    const pageCount = 1000;
    let hasMore = true;

    while (hasMore) {
        const params = new URLSearchParams({
            subKeyName: zoneId,
            fromDateTime: `${startDate}T00:00:00`,
            toDateTime: `${endDate}T23:59:59`,
            pageStart: pageStart.toString(),
            pageCount: pageCount.toString()
        });

        const url = `${baseUrl}/${propertyKey}/lookups?${params}`;

        try {
            const data = await fetchFromAPI(url);

            if (data.results && data.results.length > 0) {
                for (const item of data.results) {
                    // ── THE FIX: correct Genability field names ──
                    const price = parseFloat(item.actualValue || item.bestValue || 0);
                    if (!isNaN(price) && item.fromDateTime) {
                        records.push({
                            datetime: item.fromDateTime,
                            price: price
                        });
                    }
                }
                hasMore = data.count > pageStart + pageCount;
                pageStart += pageCount;
            } else {
                hasMore = false;
            }
        } catch (error) {
            console.error(`    ⚠️  Page ${pageStart} error: ${error.message}`);
            hasMore = false;
        }
    }

    return records;
}

// ============================================================
// MONTHLY AVERAGE COMPUTATION
// ============================================================

function calculateMonthlyFromHourly(hourlyRecords, iso, dbName) {
    const byMonth = {};

    for (const rec of hourlyRecords) {
        const d = new Date(rec.datetime);
        const year = d.getFullYear().toString();
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const key = `${year}_${month}`;

        if (!byMonth[key]) {
            byMonth[key] = { year, month, prices: [] };
        }
        byMonth[key].prices.push(rec.price);
    }

    return Object.values(byMonth).map(m => ({
        iso: iso,
        zone: dbName,
        zone_id: dbName,
        year: m.year,
        month: m.month,
        avg_da_lmp: parseFloat((m.prices.reduce((a, b) => a + b, 0) / m.prices.length).toFixed(4)),
        min_price: parseFloat(Math.min(...m.prices).toFixed(4)),
        max_price: parseFloat(Math.max(...m.prices).toFixed(4)),
        record_count: m.prices.length
    }));
}

// ============================================================
// MAIN
// ============================================================

async function main() {
    console.log('⚡ Arcadia LMP Hourly Fetcher v2.1.0');
    console.log('─'.repeat(60));
    console.log(`📅 Date Range: ${START_DATE} to ${END_DATE}`);
    console.log(`🏢 Markets: ${ISO_MARKETS}`);

    // Determine ISOs
    const isoList = ISO_MARKETS === 'all'
        ? Object.keys(ISO_CONFIG)
        : ISO_MARKETS.split(',').map(s => s.trim().toUpperCase()).filter(s => ISO_CONFIG[s]);

    const totalZones = isoList.reduce((sum, iso) => sum + ISO_CONFIG[iso].zones.length, 0);
    console.log(`📡 ISOs: ${isoList.join(', ')} (${totalZones} total zones)`);
    console.log('─'.repeat(60));

    // ── Fetch hourly data ──
    const hourlyByISO = {};     // { ISONE: { "2026-01": [{dt,p,z},...] } }
    const monthlyByISO = {};    // { ISONE: [{iso,zone,...}] }
    let totalHourly = 0;
    let totalMonthly = 0;
    let totalErrors = 0;

    for (const isoKey of isoList) {
        const config = ISO_CONFIG[isoKey];
        hourlyByISO[isoKey] = {};
        monthlyByISO[isoKey] = [];

        console.log(`\n📊 ${config.name} (${config.zones.length} zones)...`);

        for (const zone of config.zones) {
            process.stdout.write(`  → ${zone.dbName}... `);

            try {
                const records = await fetchZoneHourly(
                    config.propertyKey,
                    zone.value,
                    START_DATE,
                    END_DATE
                );

                if (records.length > 0) {
                    // Organize hourly by year-month
                    for (const rec of records) {
                        const d = new Date(rec.datetime);
                        const ym = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;

                        if (!hourlyByISO[isoKey][ym]) {
                            hourlyByISO[isoKey][ym] = [];
                        }
                        hourlyByISO[isoKey][ym].push({
                            dt: rec.datetime,
                            p: parseFloat(rec.price.toFixed(4)),
                            z: zone.dbName
                        });
                    }

                    // Calculate monthly averages
                    const monthly = calculateMonthlyFromHourly(records, isoKey, zone.dbName);
                    monthlyByISO[isoKey].push(...monthly);

                    totalHourly += records.length;
                    totalMonthly += monthly.length;

                    // Quick sanity check: show first non-zero price
                    const firstPrice = records.find(r => r.price !== 0);
                    const priceNote = firstPrice ? `$${firstPrice.price.toFixed(2)}/MWh` : '⚠️ all zeros';
                    console.log(`✅ ${records.length} hourly → ${monthly.length} monthly (${priceNote})`);
                } else {
                    console.log('⚠️  No data');
                }

                // Rate limiting
                await new Promise(r => setTimeout(r, 250));

            } catch (err) {
                totalErrors++;
                console.log(`❌ ${err.message}`);
            }
        }

        // Sort monthly
        monthlyByISO[isoKey].sort((a, b) =>
            a.zone.localeCompare(b.zone) ||
            a.year.localeCompare(b.year) ||
            a.month.localeCompare(b.month)
        );
    }

    // ── Summary ──
    console.log('\n' + '─'.repeat(60));
    console.log(`✅ Total hourly records: ${totalHourly.toLocaleString()}`);
    console.log(`✅ Total monthly records: ${totalMonthly.toLocaleString()}`);
    if (totalErrors > 0) console.log(`⚠️  Errors: ${totalErrors}`);

    if (totalHourly === 0) {
        console.error('\n❌ No data fetched. Check API credentials and date range.');
        process.exit(1);
    }

    // ── Save temp files ──
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    // Hourly output
    const hourlyOutput = {
        fetchedAt: new Date().toISOString(),
        dateRange: { start: START_DATE, end: END_DATE },
        markets: isoList,
        hourlyRecordCount: totalHourly,
        data: hourlyByISO
    };
    const hourlyPath = path.join(tempDir, 'fetched-lmp-hourly.json');
    fs.writeFileSync(hourlyPath, JSON.stringify(hourlyOutput));
    console.log(`\n💾 Hourly: ${hourlyPath} (${(JSON.stringify(hourlyOutput).length / 1024 / 1024).toFixed(2)} MB)`);

    // Monthly output (backward compat for update-lmp-database-azure-v2.js)
    const allMonthly = [];
    for (const [iso, records] of Object.entries(monthlyByISO)) {
        allMonthly.push(...records);
    }
    const monthlyOutput = {
        fetchedAt: new Date().toISOString(),
        dateRange: { start: START_DATE, end: END_DATE },
        markets: isoList,
        recordCount: totalMonthly,
        records: allMonthly
    };
    const monthlyPath = path.join(tempDir, 'fetched-lmp-data.json');
    fs.writeFileSync(monthlyPath, JSON.stringify(monthlyOutput));
    console.log(`💾 Monthly: ${monthlyPath} (${(JSON.stringify(monthlyOutput).length / 1024).toFixed(1)} KB)`);
}

main().catch(err => {
    console.error('❌ Fatal:', err.message);
    process.exit(1);
});
