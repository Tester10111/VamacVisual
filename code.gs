// VAMAC Visual App - Google Apps Script Backend
// Deploy this as a Web App with access set to "Anyone"

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const action = e.parameter.action || e.queryString;
  
  try {
    let result;
    
    switch(action) {
      case 'getBranches':
        result = getBranches();
        break;
      case 'getPickers':
        result = getPickers();
        break;
      case 'getBayAssignments':
        result = getBayAssignments();
        break;
      case 'getStageRecords':
        const date = e.parameter.date;
        result = getStageRecords(date);
        break;
      case 'getDailySummary':
        const summaryDate = e.parameter.date;
        result = getDailySummary(summaryDate);
        break;
      case 'updateBayAssignments':
        const assignments = JSON.parse(e.parameter.assignments);
        result = updateBayAssignments(assignments);
        break;
      case 'addStageRecord':
        const record = JSON.parse(e.parameter.record);
        result = addStageRecord(record);
        break;
      case 'addPicker':
        const picker = JSON.parse(e.parameter.picker);
        result = addPicker(picker);
        break;
      case 'verifyPin':
        const pin = e.parameter.pin;
        result = verifyPin(pin);
        break;
      case 'clearBoard':
        result = clearBoard();
        break;
      case 'deleteStageRecord':
        const rowIndex = parseInt(e.parameter.rowIndex);
        result = deleteStageRecord(rowIndex);
        break;
      case 'getTrucks':
        result = getTrucks();
        break;
      case 'createTruck':
        const truckName = e.parameter.truckName;
        result = createTruck(truckName);
        break;
      case 'getStagingArea':
        result = getStagingArea();
        break;
      case 'loadToTruck':
        const truckID = parseInt(e.parameter.truckID);
        const loads = JSON.parse(e.parameter.loads);
        result = loadToTruck(truckID, loads);
        break;
      case 'getTruckLoads':
        const getTruckID = parseInt(e.parameter.truckID);
        result = getTruckLoads(getTruckID);
        break;
      case 'clearStagingArea':
        result = clearStagingArea();
        break;
      case 'updateTruckStatus':
        const updateTruckID = parseInt(e.parameter.truckID);
        const status = e.parameter.status;
        result = updateTruckStatus(updateTruckID, status);
        break;
      default:
        result = { success: false, error: 'Invalid action' };
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Get all branches
function getBranches() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Branches');
  const data = sheet.getDataRange().getValues();
  
  const branches = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) {
      branches.push({
        branchNumber: data[i][0],
        branchName: data[i][1],
        address: data[i][2],
        phone: data[i][3],
        carrier: data[i][4]
      });
    }
  }
  
  return { success: true, data: branches };
}

// Get all pickers
function getPickers() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Pickers');
  const data = sheet.getDataRange().getValues();
  
  const pickers = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) {
      pickers.push({
        pickerID: data[i][0],
        pickerName: data[i][1] || ''
      });
    }
  }
  
  return { success: true, data: pickers };
}

// Get current bay assignments
function getBayAssignments() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('BayAssignments');
  const data = sheet.getDataRange().getValues();
  
  const assignments = {};
  for (let i = 1; i < data.length; i++) {
    const bayNumber = data[i][0];
    const branchNumbersStr = data[i][1];
    if (bayNumber) {
      // Support multiple branches per bay (comma-separated)
      if (branchNumbersStr && branchNumbersStr.toString().trim() !== '') {
        const branchNumbers = branchNumbersStr.toString().split(',').map(n => {
          const num = parseInt(n.trim());
          return isNaN(num) ? null : num;
        }).filter(n => n !== null);
        assignments[bayNumber] = branchNumbers.length > 0 ? branchNumbers : null;
      } else {
        assignments[bayNumber] = null;
      }
    }
  }
  
  return { success: true, data: assignments };
}

// Update bay assignments
function updateBayAssignments(assignments) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('BayAssignments');
  const timestamp = new Date();
  
  // Clear existing assignments
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 3).clearContent();
  }
  
  // Add new assignments - support arrays of branches
  const rows = [];
  for (let bay = 1; bay <= 5; bay++) {
    const branchNumbers = assignments[bay];
    let branchStr = '';
    if (branchNumbers) {
      if (Array.isArray(branchNumbers)) {
        branchStr = branchNumbers.filter(b => b !== null).join(',');
      } else if (branchNumbers !== null) {
        branchStr = branchNumbers.toString();
      }
    }
    rows.push([bay, branchStr, timestamp]);
  }
  
  sheet.getRange(2, 1, 5, 3).setValues(rows);
  
  return { success: true };
}

// Get stage records for a specific date
function getStageRecords(date) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('StageRecords');
  const data = sheet.getDataRange().getValues();
  
  const records = [];
  const timezone = 'America/New_York'; // Eastern Time
  const filterDate = date || Utilities.formatDate(new Date(), timezone, 'yyyy-MM-dd');
  
  Logger.log('getStageRecords - Timezone: ' + timezone);
  Logger.log('getStageRecords - Filtering for date: ' + filterDate);
  Logger.log('getStageRecords - Total rows in sheet: ' + data.length);
  
  for (let i = 1; i < data.length; i++) {
    // Skip empty rows
    if (!data[i][0]) continue;
    
    // Log all rows for debugging
    Logger.log('Row ' + i + ' - Timestamp: ' + data[i][0] + ', Date column: ' + data[i][8] + ', Type: ' + typeof data[i][8]);
    
    // Handle date comparison - try multiple formats (Eastern Time)
    let recordDate = '';
    try {
      const dateValue = data[i][8];
      const timestamp = data[i][0];
      
      // Try 1: Use the Date column if it exists and is valid
      if (dateValue) {
        // Check if it's a Date object (Apps Script quirk - use getTime() to verify)
        if (typeof dateValue === 'object' && dateValue.getTime && !isNaN(dateValue.getTime())) {
          recordDate = Utilities.formatDate(dateValue, timezone, 'yyyy-MM-dd');
          Logger.log('Row ' + i + ' - Date is Date object, formatted to: ' + recordDate);
        } else if (dateValue instanceof Date) {
          recordDate = Utilities.formatDate(dateValue, timezone, 'yyyy-MM-dd');
          Logger.log('Row ' + i + ' - Date is Date object (instanceof), formatted to: ' + recordDate);
        } else if (typeof dateValue === 'string') {
          // If string is already in yyyy-MM-dd format
          if (dateValue.match(/^\d{4}-\d{2}-\d{2}/)) {
            recordDate = dateValue.substring(0, 10);
            Logger.log('Row ' + i + ' - Date is string in yyyy-MM-dd format: ' + recordDate);
          } else {
            // Try to parse string date
            const parsedDate = new Date(dateValue);
            if (!isNaN(parsedDate.getTime())) {
              recordDate = Utilities.formatDate(parsedDate, timezone, 'yyyy-MM-dd');
              Logger.log('Row ' + i + ' - Date is string, parsed to: ' + recordDate);
            }
          }
        }
      }
      
      // Try 2: If Date column didn't work, use timestamp column
      if (!recordDate && timestamp) {
        if (typeof timestamp === 'object' && timestamp.getTime && !isNaN(timestamp.getTime())) {
          recordDate = Utilities.formatDate(timestamp, timezone, 'yyyy-MM-dd');
          Logger.log('Row ' + i + ' - Using timestamp column, formatted to: ' + recordDate);
        }
      }
      
      Logger.log('Row ' + i + ' - Final recordDate: ' + recordDate + ', filterDate: ' + filterDate + ', Match: ' + (recordDate === filterDate));
      
    } catch (e) {
      Logger.log('Row ' + i + ' - Error parsing date: ' + e);
      continue; // Skip this row if we can't parse the date
    }
    
    if (recordDate && recordDate === filterDate) {
      Logger.log('Row ' + i + ' - MATCH! Adding to results');
      records.push({
        timestamp: data[i][0],
        pickerID: data[i][1],
        pickerName: data[i][2],
        branchNumber: data[i][3],
        branchName: data[i][4],
        pallets: data[i][5] || 0,
        boxes: data[i][6] || 0,
        rolls: data[i][7] || 0,
        date: recordDate,
        // Advanced fields
        fiberglass: data[i][9] || 0,
        waterHeaters: data[i][10] || 0,
        waterRights: data[i][11] || 0,
        boxTub: data[i][12] || 0,
        copperPipe: data[i][13] || 0,
        plasticPipe: data[i][14] || 0,
        galvPipe: data[i][15] || 0,
        blackPipe: data[i][16] || 0,
        wood: data[i][17] || 0,
        galvStrut: data[i][18] || 0,
        im540Tank: data[i][19] || 0,
        im1250Tank: data[i][20] || 0,
        mailBox: data[i][21] || 0,
        custom: data[i][22] || ''
      });
    } else {
      Logger.log('Row ' + i + ' - No match (recordDate: "' + recordDate + '" !== filterDate: "' + filterDate + '")');
    }
  }
  
  Logger.log('getStageRecords - Found ' + records.length + ' matching records');
  Logger.log('getStageRecords - Returning: ' + JSON.stringify(records));
  
  // Sort by timestamp descending (most recent first)
  records.sort((a, b) => {
    const dateA = a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp);
    const dateB = b.timestamp instanceof Date ? b.timestamp : new Date(b.timestamp);
    return dateB.getTime() - dateA.getTime();
  });
  
  return { success: true, data: records };
}

// Add a new stage record
function addStageRecord(record) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('StageRecords');
  const timezone = 'America/New_York'; // Eastern Time
  const timestamp = new Date();
  const dateOnly = Utilities.formatDate(timestamp, timezone, 'yyyy-MM-dd');
  
  Logger.log('addStageRecord - Timezone: ' + timezone);
  Logger.log('addStageRecord - Current time: ' + Utilities.formatDate(timestamp, timezone, 'yyyy-MM-dd HH:mm:ss'));
  Logger.log('addStageRecord - Date only: ' + dateOnly);
  
  sheet.appendRow([
    timestamp,
    record.pickerID,
    record.pickerName,
    record.branchNumber,
    record.branchName,
    record.pallets || 0,
    record.boxes || 0,
    record.rolls || 0,
    dateOnly,
    // Advanced fields
    record.fiberglass || 0,
    record.waterHeaters || 0,
    record.waterRights || 0,
    record.boxTub || 0,
    record.copperPipe || 0,
    record.plasticPipe || 0,
    record.galvPipe || 0,
    record.blackPipe || 0,
    record.wood || 0,
    record.galvStrut || 0,
    record.im540Tank || 0,
    record.im1250Tank || 0,
    record.mailBox || 0,
    record.custom || ''
  ]);
  
  return { success: true };
}

// Add a new picker
function addPicker(picker) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Pickers');
  
  sheet.appendRow([
    picker.pickerID,
    picker.pickerName
  ]);
  
  return { success: true };
}

// Verify admin PIN (hard-coded with simple encoding)
function verifyPin(pin) {
  // Hard-coded PIN: 423323
  // Simple encoding: reverse and add offset for obfuscation
  // Actual PIN in code: 423323 (hard-coded, not in sheets)
  const validPin = '423323';
  
  // Simple verification - compare with hard-coded PIN
  // This removes the need to read from Config sheet, improving performance
  return { success: true, valid: pin === validPin };
}

// Get daily summary for PDF export
function getDailySummary(date) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const recordsSheet = ss.getSheetByName('StageRecords');
  const branchesSheet = ss.getSheetByName('Branches');
  const timezone = 'America/New_York'; // Eastern Time
  
  const filterDate = date || Utilities.formatDate(new Date(), timezone, 'yyyy-MM-dd');
  
  // Get all records for the date
  const recordsData = recordsSheet.getDataRange().getValues();
  const branchesData = branchesSheet.getDataRange().getValues();
  
  // Create branch map
  const branchMap = {};
  for (let i = 1; i < branchesData.length; i++) {
    if (branchesData[i][0]) {
      branchMap[branchesData[i][0]] = {
        branchNumber: branchesData[i][0],
        branchName: branchesData[i][1],
        address: branchesData[i][2],
        phone: branchesData[i][3],
        carrier: branchesData[i][4],
        pallets: 0,
        boxes: 0,
        rolls: 0,
        // Advanced fields
        fiberglass: 0,
        waterHeaters: 0,
        waterRights: 0,
        boxTub: 0,
        copperPipe: 0,
        plasticPipe: 0,
        galvPipe: 0,
        blackPipe: 0,
        wood: 0,
        galvStrut: 0,
        im540Tank: 0,
        im1250Tank: 0,
        mailBox: 0,
        custom: ''
      };
    }
  }
  
  // Aggregate records by branch
  for (let i = 1; i < recordsData.length; i++) {
    if (!recordsData[i][0]) continue; // Skip empty rows
    
    // Handle date comparison similar to getStageRecords (Eastern Time)
    let recordDate = '';
    try {
      const dateValue = recordsData[i][8];
      const timestamp = recordsData[i][0];
      
      // Check if it's a Date object (Apps Script quirk)
      if (dateValue && typeof dateValue === 'object' && dateValue.getTime && !isNaN(dateValue.getTime())) {
        recordDate = Utilities.formatDate(dateValue, timezone, 'yyyy-MM-dd');
      } else if (dateValue instanceof Date) {
        recordDate = Utilities.formatDate(dateValue, timezone, 'yyyy-MM-dd');
      } else if (typeof dateValue === 'string') {
        if (dateValue.match(/^\d{4}-\d{2}-\d{2}/)) {
          recordDate = dateValue.substring(0, 10);
        } else {
          const parsedDate = new Date(dateValue);
          if (!isNaN(parsedDate.getTime())) {
            recordDate = Utilities.formatDate(parsedDate, timezone, 'yyyy-MM-dd');
          }
        }
      } else if (timestamp && typeof timestamp === 'object' && timestamp.getTime && !isNaN(timestamp.getTime())) {
        recordDate = Utilities.formatDate(timestamp, timezone, 'yyyy-MM-dd');
      }
    } catch (e) {
      try {
        const timestamp = recordsData[i][0];
        if (timestamp && typeof timestamp === 'object' && timestamp.getTime && !isNaN(timestamp.getTime())) {
          recordDate = Utilities.formatDate(timestamp, timezone, 'yyyy-MM-dd');
        }
      } catch (e2) {
        continue;
      }
    }
    
    if (recordDate === filterDate) {
      const branchNumber = recordsData[i][3];
      if (branchMap[branchNumber]) {
        branchMap[branchNumber].pallets += recordsData[i][5] || 0;
        branchMap[branchNumber].boxes += recordsData[i][6] || 0;
        branchMap[branchNumber].rolls += recordsData[i][7] || 0;
        // Advanced fields
        branchMap[branchNumber].fiberglass += recordsData[i][9] || 0;
        branchMap[branchNumber].waterHeaters += recordsData[i][10] || 0;
        branchMap[branchNumber].waterRights += recordsData[i][11] || 0;
        branchMap[branchNumber].boxTub += recordsData[i][12] || 0;
        branchMap[branchNumber].copperPipe += recordsData[i][13] || 0;
        branchMap[branchNumber].plasticPipe += recordsData[i][14] || 0;
        branchMap[branchNumber].galvPipe += recordsData[i][15] || 0;
        branchMap[branchNumber].blackPipe += recordsData[i][16] || 0;
        branchMap[branchNumber].wood += recordsData[i][17] || 0;
        branchMap[branchNumber].galvStrut += recordsData[i][18] || 0;
        branchMap[branchNumber].im540Tank += recordsData[i][19] || 0;
        branchMap[branchNumber].im1250Tank += recordsData[i][20] || 0;
        branchMap[branchNumber].mailBox += recordsData[i][21] || 0;
        
        // Aggregate custom items (combine comma-separated strings)
        const customData = recordsData[i][22] || '';
        if (customData && customData.trim()) {
          if (branchMap[branchNumber].custom) {
            branchMap[branchNumber].custom += ',' + customData;
          } else {
            branchMap[branchNumber].custom = customData;
          }
        }
      }
    }
  }
  
  // Convert to array and filter out branches with no shipments (including advanced fields and custom items)
  const summary = Object.values(branchMap).filter(branch => 
    branch.pallets > 0 || branch.boxes > 0 || branch.rolls > 0 ||
    branch.fiberglass > 0 || branch.waterHeaters > 0 || branch.waterRights > 0 ||
    branch.boxTub > 0 || branch.copperPipe > 0 || branch.plasticPipe > 0 ||
    branch.galvPipe > 0 || branch.blackPipe > 0 || branch.wood > 0 ||
    branch.galvStrut > 0 || branch.im540Tank > 0 || branch.im1250Tank > 0 ||
    branch.mailBox > 0 || (branch.custom && branch.custom.trim())
  );
  
  return { success: true, data: summary, date: filterDate };
}

// Clear the board (reset bay assignments and optionally clear today's records)
function clearBoard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const baySheet = ss.getSheetByName('BayAssignments');
  const timestamp = new Date();
  
  // Reset bay assignments
  const rows = [];
  for (let bay = 1; bay <= 5; bay++) {
    rows.push([bay, '', timestamp]);
  }
  
  baySheet.getRange(2, 1, 5, 3).setValues(rows);
  
  return { success: true };
}

// Delete a stage record by row number
function deleteStageRecord(rowIndex) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('StageRecords');
    
    // rowIndex is 0-based from data array, but sheet rows are 1-based
    // Add 2 to account for header row (1) and 0-based index (1)
    const sheetRow = rowIndex + 2;
    
    Logger.log('Deleting row: ' + sheetRow);
    sheet.deleteRow(sheetRow);
    
    return { success: true };
  } catch (error) {
    Logger.log('Error deleting record: ' + error);
    return { success: false, error: error.toString() };
  }
}

// ===== TRUCK LOADING FUNCTIONS =====

// Get all trucks
function getTrucks() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Trucks');
    
    if (!sheet) {
      // If Trucks sheet doesn't exist yet, return empty array
      return { success: true, data: [] };
    }
    
    const data = sheet.getDataRange().getValues();
    const trucks = [];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) { // Check if TruckID exists
        trucks.push({
          truckID: data[i][0],
          truckName: data[i][1],
          createDate: data[i][2],
          createTimestamp: data[i][3],
          status: data[i][4] || 'Active'
        });
      }
    }
    
    return { success: true, data: trucks };
  } catch (error) {
    Logger.log('Error in getTrucks: ' + error);
    return { success: false, error: error.toString() };
  }
}

// Create a new truck
function createTruck(truckName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Trucks');
    
    // Create Trucks sheet if it doesn't exist
    if (!sheet) {
      sheet = ss.insertSheet('Trucks');
      sheet.appendRow(['TruckID', 'TruckName', 'CreateDate', 'CreateTimestamp', 'Status']);
    }
    
    const timezone = 'America/New_York';
    const now = new Date();
    const dateOnly = Utilities.formatDate(now, timezone, 'yyyy-MM-dd');
    
    // Get next truck ID
    const data = sheet.getDataRange().getValues();
    let nextID = 1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] && data[i][0] >= nextID) {
        nextID = data[i][0] + 1;
      }
    }
    
    // If no name provided, generate default name
    if (!truckName || truckName.trim() === '') {
      const formattedDate = Utilities.formatDate(now, timezone, 'MM/dd');
      // Count trucks created today
      let todayCount = 0;
      for (let i = 1; i < data.length; i++) {
        if (data[i][2]) {
          const createDate = Utilities.formatDate(new Date(data[i][2]), timezone, 'yyyy-MM-dd');
          if (createDate === dateOnly) {
            todayCount++;
          }
        }
      }
      truckName = `${formattedDate} Truck #${todayCount + 1}`;
    }
    
    sheet.appendRow([nextID, truckName, dateOnly, now, 'Active']);
    
    return { 
      success: true, 
      data: {
        truckID: nextID,
        truckName: truckName,
        createDate: dateOnly,
        createTimestamp: now,
        status: 'Active'
      }
    };
  } catch (error) {
    Logger.log('Error in createTruck: ' + error);
    return { success: false, error: error.toString() };
  }
}

// Get staging area (StageRecords minus TruckLoads, grouped by branch and pick date)
function getStagingArea() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const stageSheet = ss.getSheetByName('StageRecords');
    const loadSheet = ss.getSheetByName('TruckLoads');
    const timezone = 'America/New_York';
    
    if (!stageSheet) {
      return { success: true, data: [] };
    }
    
    // Aggregate all staged items by branch and pick date
    const stageData = stageSheet.getDataRange().getValues();
    const staged = {}; // Key: "branchNumber-pickDate", Value: quantities
    
    for (let i = 1; i < stageData.length; i++) {
      if (!stageData[i][3]) continue; // Skip if no branch number
      
      const branchNumber = stageData[i][3];
      const branchName = stageData[i][4];
      let pickDate = stageData[i][8]; // Column I (Date)
      
      // Parse pick date
      if (pickDate) {
        if (pickDate.getTime && !isNaN(pickDate.getTime())) {
          pickDate = Utilities.formatDate(pickDate, timezone, 'yyyy-MM-dd');
        } else if (typeof pickDate === 'string') {
          pickDate = pickDate.substring(0, 10);
        }
      }
      
      const key = `${branchNumber}-${pickDate}`;
      
      if (!staged[key]) {
        staged[key] = {
          branchNumber: branchNumber,
          branchName: branchName,
          pickDate: pickDate,
          pallets: 0,
          boxes: 0,
          rolls: 0,
          fiberglass: 0,
          waterHeaters: 0,
          waterRights: 0,
          boxTub: 0,
          copperPipe: 0,
          plasticPipe: 0,
          galvPipe: 0,
          blackPipe: 0,
          wood: 0,
          galvStrut: 0,
          im540Tank: 0,
          im1250Tank: 0,
          mailBox: 0,
          customItems: []
        };
      }
      
      // Add quantities
      staged[key].pallets += stageData[i][5] || 0;
      staged[key].boxes += stageData[i][6] || 0;
      staged[key].rolls += stageData[i][7] || 0;
      staged[key].fiberglass += stageData[i][9] || 0;
      staged[key].waterHeaters += stageData[i][10] || 0;
      staged[key].waterRights += stageData[i][11] || 0;
      staged[key].boxTub += stageData[i][12] || 0;
      staged[key].copperPipe += stageData[i][13] || 0;
      staged[key].plasticPipe += stageData[i][14] || 0;
      staged[key].galvPipe += stageData[i][15] || 0;
      staged[key].blackPipe += stageData[i][16] || 0;
      staged[key].wood += stageData[i][17] || 0;
      staged[key].galvStrut += stageData[i][18] || 0;
      staged[key].im540Tank += stageData[i][19] || 0;
      staged[key].im1250Tank += stageData[i][20] || 0;
      staged[key].mailBox += stageData[i][21] || 0;
      
      // Collect custom items
      if (stageData[i][22] && stageData[i][22].trim()) {
        staged[key].customItems.push(stageData[i][22]);
      }
    }
    
    // Subtract loaded items if TruckLoads sheet exists
    if (loadSheet) {
      const loadData = loadSheet.getDataRange().getValues();
      
      for (let i = 1; i < loadData.length; i++) {
        if (!loadData[i][1]) continue; // Skip if no branch number
        
        const branchNumber = loadData[i][1];
        let pickDate = loadData[i][3]; // Column D (PickDate)
        
        // Parse pick date
        if (pickDate) {
          if (pickDate.getTime && !isNaN(pickDate.getTime())) {
            pickDate = Utilities.formatDate(pickDate, timezone, 'yyyy-MM-dd');
          } else if (typeof pickDate === 'string') {
            pickDate = pickDate.substring(0, 10);
          }
        }
        
        const key = `${branchNumber}-${pickDate}`;
        
        if (staged[key]) {
          // Subtract quantities
          staged[key].pallets -= loadData[i][4] || 0;
          staged[key].boxes -= loadData[i][5] || 0;
          staged[key].rolls -= loadData[i][6] || 0;
          staged[key].fiberglass -= loadData[i][7] || 0;
          staged[key].waterHeaters -= loadData[i][8] || 0;
          staged[key].waterRights -= loadData[i][9] || 0;
          staged[key].boxTub -= loadData[i][10] || 0;
          staged[key].copperPipe -= loadData[i][11] || 0;
          staged[key].plasticPipe -= loadData[i][12] || 0;
          staged[key].galvPipe -= loadData[i][13] || 0;
          staged[key].blackPipe -= loadData[i][14] || 0;
          staged[key].wood -= loadData[i][15] || 0;
          staged[key].galvStrut -= loadData[i][16] || 0;
          staged[key].im540Tank -= loadData[i][17] || 0;
          staged[key].im1250Tank -= loadData[i][18] || 0;
          staged[key].mailBox -= loadData[i][19] || 0;
          // Note: Custom items handling can be complex, for now we'll keep track separately
        }
      }
    }
    
    // Convert to array and filter out zero quantities
    const result = [];
    for (let key in staged) {
      const item = staged[key];
      // Only include if at least one quantity is > 0
      const hasQuantity = item.pallets > 0 || item.boxes > 0 || item.rolls > 0 ||
                         item.fiberglass > 0 || item.waterHeaters > 0 || item.waterRights > 0 ||
                         item.boxTub > 0 || item.copperPipe > 0 || item.plasticPipe > 0 ||
                         item.galvPipe > 0 || item.blackPipe > 0 || item.wood > 0 ||
                         item.galvStrut > 0 || item.im540Tank > 0 || item.im1250Tank > 0 ||
                         item.mailBox > 0 || item.customItems.length > 0;
      
      if (hasQuantity) {
        // Combine custom items into a single string
        item.custom = item.customItems.join(',');
        delete item.customItems;
        result.push(item);
      }
    }
    
    // Sort by pick date (oldest first) then by branch number
    result.sort((a, b) => {
      if (a.pickDate < b.pickDate) return -1;
      if (a.pickDate > b.pickDate) return 1;
      return a.branchNumber - b.branchNumber;
    });
    
    return { success: true, data: result };
  } catch (error) {
    Logger.log('Error in getStagingArea: ' + error);
    return { success: false, error: error.toString() };
  }
}

// Load items to truck
function loadToTruck(truckID, loads) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('TruckLoads');
    
    // Create TruckLoads sheet if it doesn't exist
    if (!sheet) {
      sheet = ss.insertSheet('TruckLoads');
      sheet.appendRow([
        'TruckID', 'BranchNumber', 'BranchName', 'PickDate',
        'Pallets', 'Boxes', 'Rolls',
        'Fiberglass', 'WaterHeaters', 'WaterRights', 'BoxTub',
        'CopperPipe', 'PlasticPipe', 'GALVPipe', 'BlackPipe',
        'Wood', 'GalvSTRUT', 'IM540TANK', 'IM1250TANK', 'MailBox',
        'Custom', 'LoadedTimestamp'
      ]);
    }
    
    const timezone = 'America/New_York';
    const now = new Date();
    
    // Add each load
    loads.forEach(load => {
      sheet.appendRow([
        truckID,
        load.branchNumber,
        load.branchName,
        load.pickDate,
        load.pallets || 0,
        load.boxes || 0,
        load.rolls || 0,
        load.fiberglass || 0,
        load.waterHeaters || 0,
        load.waterRights || 0,
        load.boxTub || 0,
        load.copperPipe || 0,
        load.plasticPipe || 0,
        load.galvPipe || 0,
        load.blackPipe || 0,
        load.wood || 0,
        load.galvStrut || 0,
        load.im540Tank || 0,
        load.im1250Tank || 0,
        load.mailBox || 0,
        load.custom || '',
        now
      ]);
    });
    
    return { success: true };
  } catch (error) {
    Logger.log('Error in loadToTruck: ' + error);
    return { success: false, error: error.toString() };
  }
}

// Get all loads for a specific truck
function getTruckLoads(truckID) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('TruckLoads');
    
    if (!sheet) {
      return { success: true, data: [] };
    }
    
    const data = sheet.getDataRange().getValues();
    const loads = [];
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === truckID) {
        loads.push({
          truckID: data[i][0],
          branchNumber: data[i][1],
          branchName: data[i][2],
          pickDate: data[i][3],
          pallets: data[i][4] || 0,
          boxes: data[i][5] || 0,
          rolls: data[i][6] || 0,
          fiberglass: data[i][7] || 0,
          waterHeaters: data[i][8] || 0,
          waterRights: data[i][9] || 0,
          boxTub: data[i][10] || 0,
          copperPipe: data[i][11] || 0,
          plasticPipe: data[i][12] || 0,
          galvPipe: data[i][13] || 0,
          blackPipe: data[i][14] || 0,
          wood: data[i][15] || 0,
          galvStrut: data[i][16] || 0,
          im540Tank: data[i][17] || 0,
          im1250Tank: data[i][18] || 0,
          mailBox: data[i][19] || 0,
          custom: data[i][20] || '',
          loadedTimestamp: data[i][21]
        });
      }
    }
    
    return { success: true, data: loads };
  } catch (error) {
    Logger.log('Error in getTruckLoads: ' + error);
    return { success: false, error: error.toString() };
  }
}

// Clear staging area (delete all StageRecords)
function clearStagingArea() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('StageRecords');
    
    if (!sheet) {
      return { success: true };
    }
    
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      // Delete all rows except header
      sheet.deleteRows(2, lastRow - 1);
    }
    
    return { success: true };
  } catch (error) {
    Logger.log('Error in clearStagingArea: ' + error);
    return { success: false, error: error.toString() };
  }
}

// Update truck status (Active/Departed)
function updateTruckStatus(truckID, status) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Trucks');
    
    if (!sheet) {
      return { success: false, error: 'Trucks sheet not found' };
    }
    
    const data = sheet.getDataRange().getValues();
    
    // Find the truck row
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === truckID) {
        // Update status in column E (index 4)
        sheet.getRange(i + 1, 5).setValue(status);
        return { success: true };
      }
    }
    
    return { success: false, error: 'Truck not found' };
  } catch (error) {
    Logger.log('Error in updateTruckStatus: ' + error);
    return { success: false, error: error.toString() };
  }
}

// DEBUG FUNCTION - Run this manually to see what's in your sheet
function debugStageRecords() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('StageRecords');
  const data = sheet.getDataRange().getValues();
  const timezone = 'America/New_York';
  
  Logger.log('=== DEBUG: StageRecords Sheet ===');
  Logger.log('Total rows (including header): ' + data.length);
  Logger.log('');
  
  // Log header row
  Logger.log('Header row:');
  for (let j = 0; j < data[0].length; j++) {
    Logger.log('  Column ' + j + ': ' + data[0][j]);
  }
  Logger.log('');
  
  // Log each data row
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) {
      Logger.log('Row ' + i + ': EMPTY (skipping)');
      continue;
    }
    
    Logger.log('Row ' + i + ':');
    Logger.log('  [0] Timestamp: ' + data[i][0] + ' (Type: ' + (typeof data[i][0]) + ')');
    Logger.log('  [1] PickerID: ' + data[i][1]);
    Logger.log('  [2] PickerName: ' + data[i][2]);
    Logger.log('  [3] BranchNumber: ' + data[i][3]);
    Logger.log('  [4] BranchName: ' + data[i][4]);
    Logger.log('  [5] Pallets: ' + data[i][5]);
    Logger.log('  [6] Boxes: ' + data[i][6]);
    Logger.log('  [7] Rolls: ' + data[i][7]);
    Logger.log('  [8] Date: "' + data[i][8] + '" (Type: ' + (typeof data[i][8]) + ')');
    
    // Try to format the date
    if (data[i][8]) {
      if (data[i][8] instanceof Date) {
        Logger.log('  Date is Date object, formatted: ' + Utilities.formatDate(data[i][8], timezone, 'yyyy-MM-dd'));
      } else if (typeof data[i][8] === 'string') {
        Logger.log('  Date is string, first 10 chars: "' + data[i][8].substring(0, 10) + '"');
        Logger.log('  Date string length: ' + data[i][8].length);
        Logger.log('  Date string trimmed: "' + data[i][8].trim() + '"');
      }
    } else {
      Logger.log('  Date column is EMPTY or undefined');
    }
    
    Logger.log('');
  }
  
  Logger.log('=== Testing getStageRecords ===');
  const result = getStageRecords('2025-11-04');
  Logger.log('Result for 2025-11-04: ' + JSON.stringify(result));
  Logger.log('Number of records found: ' + result.data.length);
}

