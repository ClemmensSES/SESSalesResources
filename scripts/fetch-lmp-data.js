/**
 * Arcadia LMP Data Fetcher
 * 
 * This script fetches Day-Ahead LMP data from the Arcadia/Genability Signal API
 * and aggregates hourly data into monthly averages.
 * 
 * Runs server-side via GitHub Actions to avoid CORS issues.
 * 
 * Environment Variables Required:
 *   ARCADIA_APP_ID  - Arcadia API App ID
 *   ARCADIA_APP_KEY - Arcadia API App Key
 *   START_DATE      - Start date (YYYY-MM-DD)
 *   END_DATE        - End date (YYYY-MM-DD)
 *   ISO_MARKETS     - Comma-separated ISOs or 'all'
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ISO Configuration - matches your fetcher tool
const ISO_CONFIG = {
    ISONE: {
        name: 'ISO-NE',
        propertyKey: 'hourlyPricingDayAheadISONE',
        zones: [
            { value: '4000', label: 'ISO NE CA', zoneId: 'ISO NE CA' },
            { value: '4001', label: 'Maine', zoneId: 'ME' },
            { value: '4002', label: 'NH', zoneId: 'NH' },
            { value: '4003', label: 'Vermont', zoneId: 'VT' },
            { value: '4004', label: 'Connecticut', zoneId: 'CT' },
            { value: '4005', label: 'Rhode Island', zoneId: 'RI' },
            { value: '4006', label: 'SEMA', zoneId: 'SEMA' },
            { value: '4007', label: 'WCMA', zoneId: 'WCMA' },
            { value: '4008', label: 'NEMA', zoneId: 'NEMA' }
        ]
    },
    PJM: {
        name: 'PJM',
        propertyKey: 'hourlyPricingDayAheadPJM',
        zones: [
            { value: '51291', label: 'AECO', zoneId: 'AECO' },
            { value: '51292', label: 'BGE', zoneId: 'BGE' },
            { value: '51293', label: 'DPL', zoneId: 'DPL' },
            { value: '51294', label: 'JCPL', zoneId: 'JCPL' },
            { value: '51295', label: 'METED', zoneId: 'METED' },
            { value: '51296', label: 'PECO', zoneId: 'PECO' },
            { value: '51297', label: 'PENELEC', zoneId: 'PENELEC' },
            { value: '51298', label: 'PEPCO', zoneId: 'PEPCO' },
            { value: '51299', label: 'PPL', zoneId: 'PPL' },
            { value: '51300', label: 'PSEG', zoneId: 'PSEG' }
        ]
    },
    ERCOT: {
        name: 'ERCOT',
        propertyKey: 'hourlyPricingDayAheadERCOT',
        zones: [
            { value: 'LZ_AEN', label: 'AEN', zoneId: 'AEN' },
            { value: 'LZ_CPS', label: 'CPS', zoneId: 'CPS' },
            { value: 'LZ_HOUSTON', label: 'Houston', zoneId: 'HOUSTON' },
            { value: 'LZ_LCRA', label: 'LCRA', zoneId: 'LCRA' },
            { value: 'LZ_NORTH', label: 'North', zoneId: 'NORTH' },
            { value: 'LZ_RAYBN', label: 'RAYBN', zoneId: 'RAYBN' },
            { value: 'LZ_SOUTH', label: 'South', zoneId: 'SOUTH' },
            { value: 'LZ_WEST', label: 'West', zoneId: 'WEST' }
        ]
    }
};

// Get credentials from environment
const APP_ID = process.env.ARCADIA_APP_ID;
const APP_KEY = process.env.ARCADIA_APP_KEY;
const START_DATE = process.env.START_DATE;
const END_DATE = process.env.END_DATE;
const ISO_MARKETS = process.env.ISO_MARKETS || 'all';

if (!APP_ID || !APP_KEY) {
    console.error('❌ Missing ARCADIA_APP_ID or ARCADIA_APP_KEY environment variables');
    process.exit(1);
}

if (!START_DATE || !END_DATE) {
    console.error('❌ Missing START_DATE or END_DATE environment variables');
    process.exit(1);
}

const credentials = Buffer.from(`${APP_ID}:${APP_KEY}`).toString('base64');

/**
 * Make HTTPS request to Arcadia API
 */
function fetchFromAPI(url) {
    return new Promise((resolve, reject) => {
        const options = {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${credentials}`,
                'Accept': 'application/json'
            }
        };

        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error(`Failed to parse response: ${e.message}`));
                    }
                } else if (res.statusCode === 401) {
                    reject(new Error('Invalid API credentials'));
                } else {
                    reject(new Error(`API returned status ${res.statusCode}`));
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

/**
 * Fetch all data for a specific zone with pagination
 */
async function fetchZoneData(propertyKey, zoneId, startDate, endDate) {
    const baseUrl = 'https://api.genability.com/rest/public/properties';
    const allRecords = [];
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
                const records = data.results
                    .map(item => ({
                        datetime: item.fromDateTime || item.period,
                        price: parseFloat(item.dataValue || item.lmpTotal || 0)
                    }))
                    .filter(r => !isNaN(r.price));

                allRecords.push(...records);
                hasMore = data.count && data.count > pageStart + pageCount;
                pageStart += pageCount;
            } else {
                hasMore = false;
            }
        } catch (error) {
            console.error(`    ⚠️ Error fetching page ${pageStart}: ${error.message}`);
            hasMore = false;
        }
    }

    return allRecords;
}

/**
 * Calculate monthly averages from hourly data
 */
function calculateMonthlyAverages(hourlyData, iso, zone) {
    const monthlyMap = {};

    hourlyData.forEach(record => {
        const date = new Date(record.datetime);
        const year = date.getFullYear().toString();
        const month = (date.getMonth() + 1).toString();
        const key = `${year}_${month}`;

        if (!monthlyMap[key]) {
            monthlyMap[key] = {
                iso: iso,
                zone: `${zone.value}_${zone.label.replace(/\s+/g, '_')}`,
                zoneId: zone.zoneId,
                year: year,
                month: month,
                prices: []
            };
        }
        monthlyMap[key].prices.push(record.price);
    });

    return Object.values(monthlyMap).map(m => ({
        iso: m.iso,
        zone: m.zone,
        zoneId: m.zoneId,
        year: m.year,
        month: m.month,
        lmp: parseFloat((m.prices.reduce((a, b) => a + b, 0) / m.prices.length).toFixed(2)),
        energy: 0,
        congestion: 0,
        loss: 0,
        recordCount: m.prices.length
    }));
}

/**
 * Main execution
 */
async function main() {
    console.log('🔌 Arcadia LMP Data Fetcher');
    console.log('━'.repeat(50));
    console.log(`📅 Date Range: ${START_DATE} to ${END_DATE}`);
    console.log(`🏢 Markets: ${ISO_MARKETS}`);
    console.log('━'.repeat(50));

    // Determine which ISOs to fetch
    const isosToFetch = ISO_MARKETS === 'all' 
        ? Object.keys(ISO_CONFIG) 
        : ISO_MARKETS.split(',').map(s => s.trim().toUpperCase());

    const allMonthlyData = [];

    for (const isoKey of isosToFetch) {
        const config = ISO_CONFIG[isoKey];
        if (!config) {
            console.warn(`⚠️ Unknown ISO: ${isoKey}, skipping...`);
            continue;
        }

        console.log(`\n📊 Fetching ${config.name}...`);

        for (const zone of config.zones) {
            process.stdout.write(`  → ${zone.label}... `);
            
            try {
                const hourlyData = await fetchZoneData(
                    config.propertyKey, 
                    zone.value, 
                    START_DATE, 
                    END_DATE
                );

                if (hourlyData.length > 0) {
                    const monthlyData = calculateMonthlyAverages(hourlyData, isoKey, zone);
                    allMonthlyData.push(...monthlyData);
                    console.log(`✅ ${hourlyData.length} hourly → ${monthlyData.length} monthly records`);
                } else {
                    console.log(`⚠️ No data`);
                }

                // Small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 200));

            } catch (error) {
                console.log(`❌ ${error.message}`);
            }
        }
    }

    // Save fetched data to temp file for the update script
    const outputPath = path.join(__dirname, '..', 'temp', 'fetched-lmp-data.json');
    
    // Ensure temp directory exists
    const tempDir = path.dirname(outputPath);
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify({
        fetchedAt: new Date().toISOString(),
        dateRange: { start: START_DATE, end: END_DATE },
        markets: isosToFetch,
        recordCount: allMonthlyData.length,
        records: allMonthlyData
    }, null, 2));

    console.log('\n' + '━'.repeat(50));
    console.log(`✅ Fetched ${allMonthlyData.length} monthly records`);
    console.log(`💾 Saved to: ${outputPath}`);
}

main().catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
});
