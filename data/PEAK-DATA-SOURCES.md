# Peak Demand Data Management Guide

## Overview

This document provides guidance on managing and updating the `peak-demand.json` database file for the Secure Energy Sales Resources portal.

## Data Sources by ISO

### ISO New England (ISONE)
| Data Type | Source | URL |
|-----------|--------|-----|
| FCM Annual System Peak | ISO-NE Load Reports | https://www.iso-ne.com/isoexpress/web/reports/load-and-demand/-/tree/ann-sys-peak-day-hr-load |
| Net Energy & Peak Load | ISO-NE Operations | https://www.iso-ne.com/isoexpress/web/reports/load-and-demand/-/tree/net-ener-peak-load |
| Key Statistics | ISO-NE Key Stats | https://www.iso-ne.com/about/key-stats/electricity-use |

**Update Frequency:** Annual (with seasonal updates)
**File Format:** CSV/Excel download available
**Notes:** FCM reports use settlement data (excludes losses)

---

### PJM Interconnection
| Data Type | Source | URL |
|-----------|--------|-----|
| Historical Peaks | Load Forecast Report (Appendix F) | https://www.pjm.com/-/media/DotCom/library/reports-notices/load-forecast/2025-load-report.pdf |
| Real-Time Load | Data Viewer | https://dataviewer.pjm.com/dataviewer/pages/public/load.jsf |
| Historical Data | Data Miner 2 | https://dataminer2.pjm.com/ |

**Update Frequency:** Annual Load Forecast Report (January)
**File Format:** PDF report, Excel data available via Data Miner
**Notes:** Historical RTO Summer and Winter Peaks in Appendix F

---

### New York ISO (NYISO)
| Data Type | Source | URL |
|-----------|--------|-----|
| Load Data | NYISO Markets | https://www.nyiso.com/load-data |
| Power Trends Report | Annual Publication | https://www.nyiso.com/power-trends |
| Peak Demand Records | Market Data | https://www.nyiso.com/market-data |

**Update Frequency:** Annual (Power Trends Report)
**Notes:** 1CP program uses July-August non-holiday weekday peaks

---

### ERCOT (Texas)
| Data Type | Source | URL |
|-----------|--------|-----|
| Load Data | Grid Info | https://www.ercot.com/gridinfo/load |
| Historical Load | Load History | https://www.ercot.com/gridinfo/load/load_hist |
| Demand & Energy Reports | Annual Reports | https://www.ercot.com/gridinfo/load |

**Update Frequency:** Monthly/Annual
**Notes:** 4CP program (June-September). Highest 15-min settlement interval per month.

---

### California ISO (CAISO)
| Data Type | Source | URL |
|-----------|--------|-----|
| Today's Outlook | Real-Time Dashboard | http://www.caiso.com/TodaysOutlook/Pages/default.aspx |
| OASIS Data | Open Access System | http://oasis.caiso.com/ |
| Market Reports | Annual Reports | https://www.caiso.com/market/Pages/MarketMonitoring.aspx |

**Update Frequency:** Daily/Annual
**Notes:** 12CP program. Peak hours classification (Super-Peak, Peak, Off-Peak).

---

### MISO
| Data Type | Source | URL |
|-----------|--------|-----|
| Real-Time Display | Market Operations | https://www.misoenergy.org/markets-and-operations/real-time-displays/ |
| Market Reports | Published Reports | https://www.misoenergy.org/markets-and-operations/market-reports/ |
| State of Market | Potomac Economics | Annual Report |

**Update Frequency:** Annual (State of Market Report)
**Notes:** Regional peaks vary significantly across North/Central/South regions

---

## Updating the JSON File

### When to Update
- **Immediately:** After major heat waves or record-breaking events
- **Monthly:** During summer peak season (June-September)
- **Annually:** After each ISO publishes their annual peak reports (typically January-March)

### How to Update

1. **Download latest data** from the ISO source links above

2. **Open** `data/peak-demand.json` in your editor

3. **Update the relevant ISO section:**
```json
{
  "data": {
    "ISONE": {
      "annualPeaks": [
        // ADD new year's data at the BEGINNING of the array
        { "year": 2026, "date": "2026-07-XX", "hour": 17, "loadMW": XXXXX, "tempF": XX, "type": "summer" },
        // ... existing data
      ]
    }
  }
}
```

4. **Update metadata:**
```json
{
  "metadata": {
    "lastUpdated": "2026-XX-XX"  // Update this date
  }
}
```

5. **Commit to GitHub:**
```bash
git add data/peak-demand.json
git commit -m "Update peak demand data - [ISO] [YYYY] annual peak"
git push origin main
```

### Data Validation Checklist
- [ ] Year is correct
- [ ] Date format is `YYYY-MM-DD`
- [ ] Hour is in 24-hour format (0-23)
- [ ] Load is in MW (not GW)
- [ ] Temperature is in Fahrenheit
- [ ] Type is either "summer" or "winter"
- [ ] Notes field used for significant events

---

## JSON Schema

```json
{
  "metadata": {
    "lastUpdated": "YYYY-MM-DD",
    "version": "X.X.X",
    "description": "string",
    "maintainer": "string"
  },
  "dataSources": {
    "[ISO_CODE]": {
      "name": "Full ISO Name",
      "peakReportUrl": "https://...",
      "updateFrequency": "Annual|Monthly|Daily",
      "notes": "Additional context"
    }
  },
  "data": {
    "[ISO_CODE]": {
      "region": "Geographic coverage",
      "allTimePeak": {
        "date": "YYYY-MM-DD",
        "hour": 0-23,
        "loadMW": number,
        "tempF": number,
        "notes": "optional string"
      },
      "allTimeWinterPeak": {
        "date": "YYYY-MM-DD",
        "hour": 0-23,
        "loadMW": number,
        "tempF": number,
        "notes": "optional string"
      },
      "annualPeaks": [
        {
          "year": number,
          "date": "YYYY-MM-DD",
          "hour": 0-23,
          "loadMW": number,
          "tempF": number,
          "type": "summer|winter",
          "notes": "optional string"
        }
      ],
      "customers": number,
      "population": number (optional),
      "forecastPeak2035": number (optional)
    }
  }
}
```

---

## Integration with Portal

The peak demand data integrates with:

1. **Peak Demand Widget** (`widgets/peak-demand-widget.html`)
   - Displays Top 5 peaks by ISO
   - Shows annual trend charts
   - Links to official data sources

2. **LMP Analytics Widget** (planned integration)
   - Overlay peak events on LMP charts
   - Correlate price spikes with demand peaks

3. **Portal Banner** (optional)
   - Compact peak summary next to weather widget
   - Shows current ISO's all-time record

---

## Contact & Support

For questions about data sources or update procedures:
- Review ISO documentation at links above
- Check ISO press releases for record-breaking events
- EIA Monthly Energy Review for cross-ISO comparisons

---

*Last updated: January 28, 2026*
