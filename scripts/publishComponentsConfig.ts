// [MH-AI] Publish script for ComponentsConfig
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { ComponentConfig } from '../src/config/componentsConfig';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// [MH-AI] Read Sheet ID from environment (same as frontend)
const SHEETS_ID = process.env.VITE_SHEETS_ID || process.env.SHEETS_ID || '1aSy-ypUF95hLmQkIsKmqnD0RMJ4AQ-rCHdeg7OXSj4k';

// [MH-AI] Simple fetch-based approach (reuses same pattern as frontend)
// For Node.js, you can either:
// 1. Use a service account JSON file (set GOOGLE_APPLICATION_CREDENTIALS env var)
// 2. Use OAuth2 token (set GOOGLE_ACCESS_TOKEN env var)
// 3. Use googleapis package with service account

async function fetchValuesFromSheets(range: string, accessToken?: string): Promise<string[][]> {
  if (!accessToken) {
    throw new Error('Access token required. Set GOOGLE_ACCESS_TOKEN env var or use service account.');
  }
  
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEETS_ID}/values/${encodeURIComponent(range)}?majorDimension=ROWS`;
  const res = await fetch(url, { 
    headers: { 
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    } 
  });
  
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sheets API error ${res.status}: ${err || res.statusText}`);
  }
  
  const json = await res.json();
  const rows: string[][] = json.values || [];
  return rows;
}

async function fetchWithGoogleapis(range: string): Promise<string[][]> {
  try {
    // Dynamic import to avoid requiring it at top level
    const { google } = await import('googleapis');
    
    let auth: any;
    
    // [MH-AI] Try service account first - support both env var path and default location
    let credsPath: string | undefined;
    
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      console.log('[MH-AI] Loading service account from:', credsPath);
    } else if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      // Alternative: JSON content directly in env var
      console.log('[MH-AI] Loading service account from GOOGLE_SERVICE_ACCOUNT_JSON env var');
      const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
      auth = new google.auth.JWT({
        email: serviceAccount.client_email,
        key: serviceAccount.private_key,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
    } else {
      // [MH-AI] Try default location in config folder
      const defaultPath = path.join(__dirname, '..', 'config', 'migrationhub-29ad0a9af681.json');
      if (fs.existsSync(defaultPath)) {
        credsPath = defaultPath;
        console.log('[MH-AI] Loading service account from default location:', credsPath);
      } else {
        throw new Error('No authentication method found. Set GOOGLE_APPLICATION_CREDENTIALS, GOOGLE_SERVICE_ACCOUNT_JSON, or GOOGLE_ACCESS_TOKEN');
      }
    }
    
    if (credsPath) {
      if (!fs.existsSync(credsPath)) {
        throw new Error(`Service account file not found: ${credsPath}`);
      }
      // Use keyFile parameter for JWT auth
      auth = new google.auth.JWT({
        keyFile: credsPath,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
    }
    
    await auth.authorize();
    const sheets = google.sheets({ version: 'v4', auth });
    
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEETS_ID,
      range,
    });
    
    return (res.data.values || []) as string[][];
  } catch (error: any) {
    if (error.code === 'MODULE_NOT_FOUND') {
      console.warn('[MH-AI] googleapis package not found. Install with: npm install --save-dev googleapis');
      console.warn('[MH-AI] Falling back to token-based auth (set GOOGLE_ACCESS_TOKEN env var)');
      throw new Error('googleapis not installed. Install it or use GOOGLE_ACCESS_TOKEN env var.');
    }
    throw error;
  }
}

async function publishComponentsConfig() {
  // [MH-AI] Use existing backend sheet ID source (same as frontend)
  const range = 'ComponentsConfig!A1:Z999';
  console.log(`[MH-AI] Reading from sheet ID: ${SHEETS_ID}`);
  console.log(`[MH-AI] Reading range: ${range}`);
  
  let rows: string[][];
  
  // [MH-AI] Try token-based auth first (simpler), then googleapis
  if (process.env.GOOGLE_ACCESS_TOKEN) {
    console.log('[MH-AI] Using access token authentication');
    rows = await fetchValuesFromSheets(range, process.env.GOOGLE_ACCESS_TOKEN);
  } else {
    try {
      console.log('[MH-AI] Attempting to use googleapis with service account');
      rows = await fetchWithGoogleapis(range);
    } catch (error: any) {
      if (error.code === 'MODULE_NOT_FOUND' || error.message.includes('googleapis not installed') || error.message.includes('Cannot find package')) {
        throw new Error(
          'Authentication required. Options:\n' +
          '1. Install googleapis: npm install --save-dev googleapis\n' +
          '   Then set GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_SERVICE_ACCOUNT_JSON\n' +
          '2. Or set GOOGLE_ACCESS_TOKEN env var with a valid OAuth2 token'
        );
      }
      throw error;
    }
  }

  // [MH-AI] Debug logs to verify header + row count
  console.log('[MH-AI] ComponentsConfig rows:', rows.length);
  if (rows.length > 0) {
    console.log('[MH-AI] ComponentsConfig header:', rows[0]);
  }

  if (rows.length < 2) {
    console.warn('[MH-AI] No ComponentsConfig rows found (need at least header + 1 data row)');
    console.warn('[MH-AI] Check that ComponentsConfig tab exists in the sheet and has data');
    return;
  }

  const [header, ...data] = rows;
  
  // [MH-AI] Guard: verify required header exists
  if (header.indexOf('component_id') === -1) {
    console.error('[MH-AI] ComponentsConfig missing "component_id" header. No configs written.');
    console.error('[MH-AI] Expected headers include: component_id, label, type, sheet_tab, range, primary_key_col, filter_key, depends_on, props, notes');
    console.error('[MH-AI] Found headers:', header);
    return;
  }
  
  const idx = (key: string) => header.indexOf(key);
  console.log('[MH-AI] Header mapping - component_id at index:', idx('component_id'));

  // [MH-AI] Filter only rows with non-empty component_id
  const configs: ComponentConfig[] = data
    .filter((r) => {
      const componentId = (r[idx('component_id')] || '').trim();
      return componentId.length > 0;
    })
    .map((r) => {
      const rawProps = r[idx('props')] || '';
      let parsedProps: Record<string, string> | undefined;

      if (rawProps) {
        try {
          parsedProps = JSON.parse(rawProps);
        } catch {
          // Fall back to key=value;key=value format
          parsedProps = Object.fromEntries(
            rawProps
              .split(';')
              .map((pair: string) => pair.trim())
              .filter(Boolean)
              .map((pair: string) => {
                const [k, v] = pair.split('=');
                return [k.trim(), (v || '').trim()];
              }),
          );
        }
      }

      return {
        component_id: r[idx('component_id')] || '',
        label: r[idx('label')] || '',
        type: (r[idx('type')] || 'table') as ComponentConfig['type'],
        sheet_tab: r[idx('sheet_tab')] || '',
        range: r[idx('range')] || '',
        primary_key_col: r[idx('primary_key_col')] || undefined,
        filter_key: r[idx('filter_key')] || undefined,
        depends_on: r[idx('depends_on')] || undefined,
        props: parsedProps,
        notes: r[idx('notes')] || undefined,
      };
    });

  const outPath = path.join(__dirname, '..', 'src', 'config', 'components.generated.json');
  
  if (configs.length === 0) {
    console.warn('[MH-AI] No valid component configs found after filtering. Check that rows have non-empty component_id values.');
    console.warn('[MH-AI] Sample data row (first non-header row):', data[0] || 'none');
  } else {
    console.log(`[MH-AI] Found ${configs.length} valid component config(s):`);
    configs.forEach((c) => {
      console.log(`[MH-AI]   - ${c.component_id} (${c.type}): ${c.sheet_tab}${c.range ? '!' + c.range : ''}`);
    });
  }
  
  fs.writeFileSync(outPath, JSON.stringify(configs, null, 2) + '\n');
  console.log(`[MH-AI] Wrote ${configs.length} component configs to ${outPath}`);
}

publishComponentsConfig().catch((err) => {
  console.error('[MH-AI] Failed to publish ComponentsConfig', err);
  process.exit(1);
});

