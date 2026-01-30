# Bid Management System for Secure Energy Portal

## Overview

The Bid Management System is a comprehensive widget for the Secure Energy Analytics Portal that enables sales representatives to:

1. **Manage Clients** - Create and track clients with unique Client IDs (CID) that work across all portal widgets
2. **Configure Suppliers** - Build supplier profiles with product offerings, pricing formats, and term options
3. **Process Bids** - Create bids, upload supplier pricing from files or enter manually
4. **Generate Bid Sheets** - Create professional Excel bid sheets matching the SES template format

## Features

### Client Management
- Unique Client ID (CID) format: `CID-YYYYMMDD-XXXXX`
- Track client information: company, contact, ISO, locations, usage
- Link clients to LMP analyses and bids
- Export client list to CSV
- Search and filter clients

### Supplier Profiles
- Pre-loaded with common suppliers: Constellation, NRG, Smartest Energy, First Point Power
- Configure products, swing types, term options
- Support multiple commodities (electric, gas)
- Specify which ISOs each supplier serves

### Bid Process Management
- Create bids linked to clients
- Add multiple locations per bid
- Upload pricing from Excel/CSV files
- Manual pricing entry option
- Select which quotes to include in bid sheet

### Bid Sheet Generation
- Generates Excel files matching the SES template format
- Creates aggregated sheet plus individual location sheets
- Includes logo area, customer info, pricing matrix
- Supports multiple suppliers and products per sheet

## File Structure

```
SESSalesResources/
├── scripts/
│   ├── client-store.js      # Client management (NEW)
│   ├── supplier-store.js    # Supplier profiles (NEW)
│   ├── bid-store.js         # Bid processing (NEW)
│   ├── shared-data-store.js # (existing)
│   ├── user-store.js        # (existing)
│   └── main.js              # (update required)
├── widgets/
│   ├── bid-management-widget.html  # Main widget (NEW)
│   └── ... (existing widgets)
└── index.html               # (update required)
```

## Installation

### 1. Add Script Files

Copy to `scripts/` folder:
- `client-store.js`
- `supplier-store.js`
- `bid-store.js`

### 2. Add Widget File

Copy to `widgets/` folder:
- `bid-management-widget.html`

### 3. Update index.html

Add these script tags BEFORE `main.js`:

```html
<script src="scripts/client-store.js"></script>
<script src="scripts/supplier-store.js"></script>
<script src="scripts/bid-store.js"></script>
```

### 4. Update main.js

Add to the WIDGETS array:

```javascript
{
    id: 'bid-management',
    name: 'Bid Management',
    icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    src: 'widgets/bid-management-widget.html',
    fullWidth: true,
    height: 900
}
```

## Usage

### Creating a Client

1. Go to **Clients** tab
2. Click **+ Add Client**
3. Fill in company name and details
4. Client receives unique CID automatically

### Creating a Bid

1. Click **+ New Bid** or go to **Create Bid Sheet** tab
2. Search for existing client or enter new name
3. Add locations for the bid
4. Select ISO and commodity type
5. Click **Create Bid**

### Adding Supplier Pricing

Option A: **Upload File**
1. Select the supplier from dropdown
2. Drag & drop Excel/CSV file with pricing
3. System parses terms and prices automatically

Option B: **Manual Entry**
1. Select supplier and product
2. Enter swing type
3. Fill in prices for each term
4. Click **Add Quote**

### Generating Bid Sheet

1. Select quotes to include (checkbox)
2. Click **Generate Excel Bid Sheet**
3. Downloads formatted Excel file with:
   - Aggregated pricing (all locations)
   - Individual location sheets
   - SES branding and format

## Data Storage

- **localStorage**: Primary storage for immediate access
- **GitHub Sync**: Optional sync to repository for cross-device persistence

### GitHub Sync

If GitHub API token is configured in the portal:
- Clients save to `data/clients.json`
- Suppliers save to `data/suppliers.json`
- Bids save to `data/bids.json`

## API Reference

### SecureEnergyClients

```javascript
// Create client
SecureEnergyClients.createClient({
    name: 'Company Name',
    companyName: 'Company Name',
    iso: 'PJM',
    salesRepId: 'user-123',
    salesRepName: 'John Smith'
});

// Search clients
SecureEnergyClients.searchClients('query');

// Get client
SecureEnergyClients.getClient('CID-20260129-A3B7F');

// Link LMP analysis
SecureEnergyClients.linkLMPAnalysis(clientId, analysisId);
```

### SecureEnergySuppliers

```javascript
// Get all active suppliers
SecureEnergySuppliers.getActiveSuppliers();

// Get suppliers by ISO
SecureEnergySuppliers.getSuppliersByISO('PJM');

// Create supplier
SecureEnergySuppliers.createSupplier({
    name: 'Supplier Name',
    products: [{ name: 'Fixed', code: 'FIXED', swingType: 'Unlimited' }],
    termOptions: [12, 24, 36, 48],
    isos: ['PJM', 'ISONE']
});
```

### SecureEnergyBids

```javascript
// Create bid
SecureEnergyBids.createBid({
    clientId: 'CID-...',
    clientName: 'Company',
    commodityType: 'electric',
    iso: 'PJM'
});

// Add quote
SecureEnergyBids.addSupplierQuote(bidId, {
    supplierName: 'Constellation',
    productName: 'Fixed',
    terms: [{ term: 12, price: 0.08765 }, { term: 24, price: 0.08234 }]
});

// Generate bid sheet data
SecureEnergyBids.prepareBidSheetData(bidId);
```

## Integration with LMP Widget

To link LMP analyses to clients:

```javascript
// In lmp-comparison-portal.html, after running analysis:
if (window.SecureEnergyClients && clientId) {
    SecureEnergyClients.linkLMPAnalysis(clientId, analysisId);
}
```

## Version History

- **v1.0.0** - Initial release with client, supplier, and bid management

## Excel Bid Sheet Format Details

The generated bid sheet matches the company template with:

### Layout Structure
| Row | Content |
|-----|---------|
| 1-11 | Empty (logo area) |
| 12 | Phone: 1-800-655-9818 (column N) |
| 13 | Website: www.sesenergy.org (column N) |
| 14 | "QUOTE FORM" title (merged A:N) |
| 15 | Empty |
| 16 | Customer Name (merged A:N) |
| 17 | Date Prepared (merged A:N) |
| 18 | Empty |
| 19-20 | Disclaimer text (merged A:N) |
| 21-22 | Empty |
| 23+ | Supplier quotes (3 rows per supplier + blank) |

### Supplier Quote Block (repeats for each supplier)
```
Row N:   Supplier/Product: [merged A:G]  |  [Supplier Name] (col I)  |  [Swing Type] (col M)
Row N+1: Term: (months) [merged A:G]     |  12    18    24    30    36    48  (cols I-N)
Row N+2: Price: | x | Elec.($/kWh) |     |  0.11813  0.12329  ...  (cols I-N)
Row N+3: [empty row]
```

### Column Widths
| Column | Width (chars) | Purpose |
|--------|--------------|---------|
| A | 8 | Labels |
| B | 1.4 | Spacer |
| C | 4.4 | "x" marker |
| D | 13.3 | Electric unit label |
| E | 1.4 | Spacer |
| F | 4.7 | Spacer |
| G | 13.7 | Gas unit label |
| H | 1 | Spacer |
| I-N | 13.9 | Term/Price columns |
| O-P | 8.4 | Buffer |

## Adding Logo to Generated Files

The browser-based generator cannot embed images due to JavaScript limitations. To add the Secure Energy logo:

### Option 1: Manual (Quick)
1. Generate the bid sheet from the widget
2. Open the downloaded Excel file
3. Go to Insert > Pictures > This Device
4. Select the logo file (logo-20th.jpg)
5. Position and resize to fit rows 1-11, columns A-H

### Option 2: Python Enhancement Script (Automated)
Use the included `enhance-bid-sheet.py` script for full formatting:

```bash
# Install requirement
pip install openpyxl

# Enhance a generated bid sheet (overwrites original)
python scripts/enhance-bid-sheet.py BidSheet_ClientName_2026-01-30.xlsx

# Or specify a different output file
python scripts/enhance-bid-sheet.py input.xlsx output_enhanced.xlsx
```

The enhancement script will:
- Download and insert the Secure Energy logo
- Apply Secure Energy brand colors (PANTONE 3308 C, 7465 C)
- Add proper fonts (bold titles, styled headers)
- Format pricing cells with number format (0.00000)
- Add light green background to price cells
- Style phone number and website

### Logo URL
`https://www.sesenergy.org/assets/images/logo-20th.jpg`
