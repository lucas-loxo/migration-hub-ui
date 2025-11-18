// Apps Script for New Migration - GitHub Issue + Sheets Write
// Deploy as Web App with "Execute as: Me" and "Who has access: Anyone"

const GITHUB_REPO = 'loxo-ai/migrations'; // Update with your repo
const GITHUB_TOKEN = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
const MASTER_SHEET_ID = PropertiesService.getScriptProperties().getProperty('MASTER_SHEET_ID') || '1aSy-ypUF95hLmQkIsKmqnD0RMJ4AQ-rCHdeg7OXSj4k';

function doGet(e) {
  const action = (e.parameter.action || '').toLowerCase();
  if (action === 'ats_list') return withCors_(getAtsList_());
  if (action === 'ats') return handleGetAts_();
  return withCors_(createJsonResponse({ ok: false, error: 'unknown_action' }));
}

function doOptions(e) {
  return withCors_(ContentService.createTextOutput('').setMimeType(ContentService.MimeType.TEXT));
}

function withCors_(out) {
  return out
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function handleGetAts_() {
  try {
    const cache = CacheService.getScriptCache();
    const cached = cache.get('ats_options_v1');
    if (cached) {
      return createJsonResponse(JSON.parse(cached), { 'X-ATS-Cache': 'HIT' });
    }

    const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
    const tab = findTabInsensitive_(ss, ['Previous ATS List', 'Previous ATS', 'Previous ATSs']);
    if (!tab) throw new Error('Previous ATS tab not found');

    // Use first non-empty column; skip header row if present
    const allValues = tab.getDataRange().getValues();
    const values = [];
    for (let i = 0; i < allValues.length; i++) {
      const val = allValues[i][0];
      if (val && String(val).trim().length > 0) {
        // Skip if it looks like a header (first row and common header words)
        if (i === 0 && /^(Previous ATS|ATS|Name|Value)$/i.test(String(val).trim())) {
          continue;
        }
        values.push(String(val).trim());
      }
    }
    const unique = Array.from(new Set(values));

    const payload = { ok: true, options: unique };
    cache.put('ats_options_v1', JSON.stringify(payload), 21600); // 6 hours
    return createJsonResponse(payload, { 'X-ATS-Cache': 'MISS' });
  } catch (err) {
    return createJsonResponse({ ok: false, error: String(err) });
  }
}

function getAtsList_() {
  try {
    const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
    const tab = findTabInsensitive_(ss, ['previous_ATS_list', 'previous ATS list', 'previous_ats_list']);
    if (!tab) throw new Error('previous_ATS_list tab not found');

    // Read column A, skip header row if present
    const allValues = tab.getDataRange().getValues();
    const values = [];
    for (let i = 0; i < allValues.length; i++) {
      const val = allValues[i][0];
      if (val && String(val).trim().length > 0) {
        // Skip if it looks like a header (first row and common header words)
        if (i === 0 && /^(ATS|Previous ATS|Name|Value)$/i.test(String(val).trim())) {
          continue;
        }
        values.push(String(val).trim());
      }
    }
    const unique = Array.from(new Set(values));
    // Sort case-insensitively
    unique.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

    return createJsonResponse({ ok: true, options: unique });
  } catch (err) {
    return createJsonResponse({ ok: false, error: String(err) });
  }
}

function createJsonResponse(data, headers) {
  // Include cache status in response body if needed
  if (headers && headers['X-ATS-Cache']) {
    data._cache = headers['X-ATS-Cache'];
  }
  
  const output = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  
  return output;
}

function findTabInsensitive_(ss, names) {
  const sheets = ss.getSheets();
  const want = names.map(n => n.toLowerCase());
  for (const sh of sheets) {
    if (want.includes(sh.getName().toLowerCase())) return sh;
  }
  return null;
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    // Validate required fields (stage is not required, defaults to "Waiting on Data Upload")
    if (!data.agencyId || !data.customerName || !data.ownerEmail || !data.previousATS || !data.tier || !data.pod || !data.churn0Link) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: 'Missing required fields' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Default stage if not provided
    const stage = data.stage || 'Waiting on Data Upload';
    
    // Create GitHub issue
    const issueTitle = `[${data.agencyId}] - [${data.agencySlug}] ${data.previousATS} Migration`;
    const issueBody = buildIssueBody(data, stage);
    const labels = buildLabels(stage, data);
    
    const issueResult = createGitHubIssue(issueTitle, issueBody, labels);
    
    if (!issueResult.ok) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: issueResult.error }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    // Write to Sheets (only if GitHub succeeded)
    const customerId = Utilities.getUuid();
    const migrationId = writeToSheets(customerId, data, stage, issueResult.issueNumber, issueResult.issueUrl);
    
    // Log migration creation activity
    if (migrationId && migrationId.trim() !== '') {
      try {
        logMigrationActivity({
          migrationId: migrationId,
          eventType: 'migration_created',
          eventSource: 'ui',
          details: {
            customerName: data.customerName,
            ownerEmail: data.ownerEmail,
            previousATS: data.previousATS
          }
        });
        Logger.log('Successfully logged migration_created activity for MigrationID: ' + migrationId);
      } catch (error) {
        Logger.log('Failed to log migration_created activity: ' + error.toString());
        Logger.log('MigrationID was: ' + migrationId);
        // Don't fail the request if logging fails
      }
    } else {
      Logger.log('Cannot log migration_created: MigrationID is empty or null. customerId: ' + customerId);
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      ok: true,
      issueNumber: issueResult.issueNumber,
      issueUrl: issueResult.issueUrl,
      customerId: customerId
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    Logger.log('doPost error: ' + error.toString());
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function buildIssueBody(data, stage) {
  return `### Customer

- Name: ${data.customerName}
- Agency ID: ${data.agencyId}
- Agency Slug: ${data.agencySlug || 'N/A'}
- Owner (BTC): ${data.ownerEmail}
- Previous ATS: ${data.previousATS}
- Customer Segment: ${data.customerSegment || 'N/A'}
- ChurnZero: ${data.churn0Link || 'N/A'}

### Contacts

- Primary Contact: ${data.primaryContactName || 'N/A'} (${data.primaryContactEmail || 'N/A'})
- Secondary Contact: ${data.secondaryContactName || 'N/A'} (${data.secondaryContactEmail || 'N/A'})

### Data Delivery

- Method: ${data.dataMethod}
- Access Instructions:

${data.accessInstructions || "N/A"}

### Additional Details

${data.additionalDetails || "N/A"}

### Paying Users

${data.payingUsers || "N/A"}

### Intake Notes

${data.intakeNotes || "N/A"}

### Migration Details

- Initial Stage: ${stage}
- Tier: ${data.tier || 'N/A'}
- Pod: ${data.pod || 'N/A'}`;
}

function buildLabels(stage, data) {
  const labels = ['product:migrations'];
  
  // Status label
  const statusLabel = toStatusLabel(stage);
  if (statusLabel) labels.push(`status:${statusLabel}`);
  
  // Tier label
  const tierLabel = toTierLabel(data.tier);
  if (tierLabel) labels.push(`tier:${tierLabel}`);
  
  // Pod label
  if (data.pod && data.pod !== '--PLEASE SELECT--') {
    labels.push(`pod:${data.pod}`);
  }
  
  // Source label
  const sourceLabel = slugify(data.previousATS);
  if (sourceLabel) labels.push(`source:${sourceLabel}`);
  
  return labels;
}

function toStatusLabel(stage) {
  const map = {
    'Waiting on Data Upload': 'waiting-data',
    'Waiting on Eng Import Map': 'waiting-eng-map',
    'Waiting on Customer Import Map': 'waiting-cust-map',
    'Waiting on Data Import': 'waiting-import',
    'Waiting on Validation Requests': 'waiting-validation',
    'Waiting on Eng Validation': 'waiting-eng-val',
    'Waiting on Final Confirmation': 'waiting-final',
    'Waiting on Duplicate Merge': 'waiting-dup-merge',
  };
  return map[stage] || null;
}

function toTierLabel(t) {
  const map = {
    'Free (1)': 'free',
    'Standard (2)': 'standard',
    'High Touch (3)': 'high-touch',
    'N/A': 'na'
  };
  return map[t] || 'na';
}

function slugify(s) {
  if (!s) return '';
  return s.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function createGitHubIssue(title, body, labels) {
  try {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/issues`;
    const payload = {
      title: title,
      body: body,
      labels: labels
    };
    
    const options = {
      method: 'POST',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(payload)
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    
    if (response.getResponseCode() === 201) {
      return {
        ok: true,
        issueNumber: result.number,
        issueUrl: result.html_url
      };
    } else {
      return {
        ok: false,
        error: result.message || 'Failed to create GitHub issue'
      };
    }
  } catch (error) {
    Logger.log('GitHub issue error: ' + error.toString());
    return {
      ok: false,
      error: error.toString()
    };
  }
}

function writeToSheets(customerId, data, stage, issueNumber, issueUrl) {
  try {
    const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
    const now = new Date().toISOString();
    
    // Write to Customers sheet
    const customersSheet = ss.getSheetByName('Customers') || ss.insertSheet('Customers');
    ensureCustomersHeaders(customersSheet);
    
    // Get headers for Customers sheet
    const customersHeaders = customersSheet.getRange(1, 1, 1, customersSheet.getLastColumn()).getValues()[0];
    const customersRow = new Array(customersHeaders.length).fill('');
    
    // Map headers to values
    const customersHeaderMap = {
      'CustomerID': customerId,
      'CustomerName': data.customerName,
      'OwnerEmail': data.ownerEmail,
      'AgencyID': data.agencyId,
      'AgencySlug': data.agencySlug || '',
      'PreviousATS': data.previousATS,
      'PrimaryContactName': data.primaryContactName || '',
      'PrimaryContactEmail': data.primaryContactEmail || '',
      'PrimaryContactPhone': '',
      'ChurnZeroLink': data.churn0Link || '',
      'CustomerSegment': data.customerSegment || '',
      'SecondaryContactName': data.secondaryContactName || '',
      'SecondaryContactEmail': data.secondaryContactEmail || '',
      'CreatedAt': now
    };
    
    for (let i = 0; i < customersHeaders.length; i++) {
      const header = String(customersHeaders[i] || '').trim();
      if (customersHeaderMap.hasOwnProperty(header)) {
        customersRow[i] = customersHeaderMap[header];
      }
    }
    
    customersSheet.appendRow(customersRow);
    
    // Write to MH_View_Migrations sheet
    const migrationsSheet = ss.getSheetByName('MH_View_Migrations');
    if (!migrationsSheet) {
      Logger.log('MH_View_Migrations sheet not found');
      return null;
    }
    
    const headers = migrationsSheet.getRange(1, 1, 1, migrationsSheet.getLastColumn()).getValues()[0];
    const row = new Array(headers.length).fill('');
    
    // Find MigrationID column index
    const migrationIdIdx = headers.findIndex(function(h) {
      return String(h || '').trim().toLowerCase() === 'migrationid';
    });
    
    // Map headers to values
    const headerMap = {
      'CustomerID': customerId,
      'CustomerName': data.customerName,
      'Stage': stage,
      'DaysInStage': 0,
      'OwnerEmail': data.ownerEmail,
      'PreviousATS': data.previousATS,
      'GH_IssueNumber': issueNumber,
      'GH_IssueURL': issueUrl,
      'GH_Status': 'Active',
      'CreatedAt': now,
      'UpdatedAt': now,
      'DataMethod': data.dataMethod || '',
      'Tier': data.tier || '',
      'Pod': data.pod || '',
      'ChurnZeroLink': data.churn0Link || ''
    };
    
    for (let i = 0; i < headers.length; i++) {
      const header = String(headers[i] || '').trim();
      if (headerMap.hasOwnProperty(header)) {
        row[i] = headerMap[header];
      }
    }
    
    migrationsSheet.appendRow(row);
    
    // Flush to ensure ARRAYFORMULA calculations complete
    SpreadsheetApp.flush();
    
    // Read back the MigrationID from the appended row
    // MigrationID is typically auto-generated (ARRAYFORMULA), so we need to read it back
    const lastRow = migrationsSheet.getLastRow();
    
    // Wait a bit for ARRAYFORMULA to calculate (flush already called, but add small delay)
    Utilities.sleep(100);
    
    if (migrationIdIdx >= 0 && lastRow > 1) {
      const migrationId = migrationsSheet.getRange(lastRow, migrationIdIdx + 1).getValue();
      const migrationIdStr = String(migrationId || '').trim();
      if (migrationIdStr) {
        Logger.log('Found MigrationID from appended row: ' + migrationIdStr);
        return migrationIdStr;
      } else {
        Logger.log('MigrationID column found but value is empty, trying fallback');
      }
    }
    
    // Fallback: try to find by CustomerID + CreatedAt if MigrationID column not found or empty
    if (lastRow > 1) {
      const customerIdIdx = headers.findIndex(function(h) {
        return String(h || '').trim().toLowerCase() === 'customerid';
      });
      const createdAtIdx = headers.findIndex(function(h) {
        return String(h || '').trim().toLowerCase() === 'createdat';
      });
      
      if (customerIdIdx >= 0 && createdAtIdx >= 0) {
        const rowCustomerId = migrationsSheet.getRange(lastRow, customerIdIdx + 1).getValue();
        const rowCreatedAt = migrationsSheet.getRange(lastRow, createdAtIdx + 1).getValue();
        
        if (String(rowCustomerId) === customerId && String(rowCreatedAt) === now) {
          // Found the row, try to get MigrationID again
          if (migrationIdIdx >= 0) {
            Utilities.sleep(100); // Small delay for formula calculation
            const migrationId = migrationsSheet.getRange(lastRow, migrationIdIdx + 1).getValue();
            const migrationIdStr = String(migrationId || '').trim();
            if (migrationIdStr) {
              Logger.log('Found MigrationID via fallback: ' + migrationIdStr);
              return migrationIdStr;
            }
          }
        }
      }
    }
    
    Logger.log('Warning: Could not retrieve MigrationID after appending row. customerId: ' + customerId);
    return null;
    
  } catch (error) {
    Logger.log('Sheets write error: ' + error.toString());
    throw error;
  }
}

function ensureCustomersHeaders(sheet) {
  if (sheet.getLastRow() === 0) {
    const headers = [
      'CustomerID',
      'CustomerName',
      'OwnerEmail',
      'AgencyID',
      'AgencySlug',
      'PreviousATS',
      'PrimaryContactName',
      'PrimaryContactEmail',
      'PrimaryContactPhone',
      'ChurnZeroLink',
      'CustomerSegment',
      'SecondaryContactName',
      'SecondaryContactEmail',
      'CreatedAt'
    ];
    sheet.appendRow(headers);
  } else {
    // Ensure ChurnZeroLink header exists (add if missing)
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const hasChurnZeroLink = headers.some(function(h) {
      return String(h || '').trim() === 'ChurnZeroLink';
    });
    if (!hasChurnZeroLink) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue('ChurnZeroLink');
    }
  }
}

function logMigrationActivity(params) {
  try {
    const ss = SpreadsheetApp.openById(MASTER_SHEET_ID);
    const activitiesSheet = ss.getSheetByName('MH_Activities');
    if (!activitiesSheet) {
      Logger.log('MH_Activities sheet not found');
      return;
    }
    
    const timestamp = new Date().toISOString();
    const detailsJson = JSON.stringify(params.details || {});
    
    // Ensure headers exist
    if (activitiesSheet.getLastRow() === 0) {
      activitiesSheet.appendRow(['Timestamp', 'MigrationID', 'EventType', 'EventSource', 'Details']);
    }
    
    // Append activity row: Timestamp, MigrationID, EventType, EventSource, Details
    activitiesSheet.appendRow([
      timestamp,
      params.migrationId || '',
      params.eventType || '',
      params.eventSource || '',
      detailsJson
    ]);
    
  } catch (error) {
    Logger.log('logMigrationActivity error: ' + error.toString());
    throw error;
  }
}

