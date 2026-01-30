# 📊 LMP Data Automation

Automated monthly LMP (Locational Marginal Pricing) data updates for the Secure Energy Analytics Portal.

## Overview

This automation solves the CORS issue by running the Arcadia API calls **server-side** via GitHub Actions, rather than in the browser. It:

1. **Fetches** hourly Day-Ahead LMP data from the Arcadia/Genability API
2. **Aggregates** hourly data into monthly averages
3. **Updates** the `lmp-database.json` file
4. **Commits** changes back to the repository

## 🚀 Quick Setup

### 1. Add API Credentials as GitHub Secrets

Go to your repository → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these two secrets:

| Secret Name | Description |
|-------------|-------------|
| `ARCADIA_APP_ID` | Your Arcadia/Genability App ID |
| `ARCADIA_APP_KEY` | Your Arcadia/Genability App Key |

Get credentials from: https://dash.genability.com/org

### 2. Add the Files to Your Repository

Copy these files to your repository:

```
your-repo/
├── .github/
│   └── workflows/
│       └── update-lmp-data.yml
├── scripts/
│   ├── package.json
│   ├── fetch-lmp-data.js
│   └── update-lmp-database.js
└── data/
    └── lmp-database.json    (your existing database)
```

### 3. Enable GitHub Actions

1. Go to your repository → **Actions** tab
2. Enable workflows if prompted

## 📅 Automatic Schedule

The workflow runs automatically on the **3rd of every month at 6:00 AM UTC**.

This timing ensures:
- Previous month's data is fully available in the API
- Updates happen early in the business day (EST/PST)

## 🔧 Manual Trigger

You can also run updates manually:

1. Go to **Actions** → **Update LMP Data Monthly**
2. Click **Run workflow**
3. Optionally specify:
   - Custom date range
   - Specific ISO markets (ISONE, PJM, ERCOT)

### Example Manual Runs

**Fetch specific month:**
- Start date: `2025-01-01`
- End date: `2025-01-31`
- Markets: `all`

**Fetch single ISO:**
- Markets: `PJM`

**Backfill multiple ISOs:**
- Markets: `ISONE,ERCOT`

## 📁 File Structure

### `.github/workflows/update-lmp-data.yml`
The GitHub Actions workflow that orchestrates the update process.

### `scripts/fetch-lmp-data.js`
Node.js script that:
- Connects to Arcadia API (no CORS - runs server-side!)
- Fetches hourly LMP data for all configured zones
- Calculates monthly averages
- Saves to temp file for processing

### `scripts/update-lmp-database.js`
Node.js script that:
- Loads existing database
- Merges new records
- Updates changed values
- Maintains data integrity
- Commits changes

## 🗺️ Supported Markets

| ISO | Zones |
|-----|-------|
| **ISO-NE** | ISO NE CA, Maine, NH, Vermont, Connecticut, Rhode Island, SEMA, WCMA, NEMA |
| **PJM** | AECO, BGE, DPL, JCPL, METED, PECO, PENELEC, PEPCO, PPL, PSEG |
| **ERCOT** | AEN, CPS, Houston, LCRA, North, RAYBN, South, West |

## 🔍 Monitoring Updates

### Check Workflow Status
1. Go to **Actions** tab
2. View latest workflow runs
3. Click on a run to see detailed logs

### View Update Summary
Each run creates a summary showing:
- Date range fetched
- Markets processed
- Records added/updated

## 🛠️ Troubleshooting

### API Errors
- Verify credentials in GitHub Secrets
- Check Arcadia account status
- Review workflow logs for specific error messages

### No Data Fetched
- Confirm date range is valid
- Some zones may not have data for all periods
- Check API rate limits

### Database Not Updating
- Ensure workflow has write permissions
- Check if data/lmp-database.json exists
- Review commit logs

## 🔐 Security Notes

- API credentials are stored as encrypted GitHub Secrets
- Credentials are never logged or exposed in workflow output
- Only GitHub Actions bot can commit changes

## 📊 Database Schema

Records in `lmp-database.json`:

```json
{
  "iso": "ISONE",
  "zone": "4001_Maine",
  "zoneId": "ME",
  "year": "2025",
  "month": "1",
  "lmp": 45.23,
  "energy": 0,
  "congestion": 0,
  "loss": 0
}
```

## 🔄 Integration with Portal

The portal automatically loads data from `lmp-database.json`. After each automated update:
1. GitHub Pages rebuilds (if configured)
2. Portal fetches updated JSON on next load
3. Charts and analysis reflect new data

---

## Need Help?

- Check workflow logs in GitHub Actions
- Verify API credentials are current
- Ensure proper file paths in your repository
