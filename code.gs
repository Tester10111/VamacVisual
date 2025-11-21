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
      case 'getTrucks':
        result = getTrucks();
        break;
      case 'createTruck':
        const truckName = e.parameter.truckName;
        const carrier = e.parameter.carrier || 'STEFI';
        result = createTruck(truckName, carrier);
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
      case 'updateTruckStatus':
        const updateTruckID = parseInt(e.parameter.truckID);
        const status = e.parameter.status;
        result = updateTruckStatus(updateTruckID, status);
        break;
      case 'getDepartedTruckLoadsByDate':
        const departDate = e.parameter.date;
        result = getDepartedTruckLoadsByDate(departDate);
        break;
      case 'getExistingTransferNumber':
        const branchNumber = parseInt(e.parameter.branchNumber);
        const filterDate = e.parameter.date;
        result = getExistingTransferNumber(branchNumber, filterDate);
        break;
      case 'verifyPin':
        const pin = e.parameter.pin;
        result = verifyPin(pin);
        break;
      case 'getVersion':
        result = getVersion();
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

// Verify admin PIN (hard-coded with simple encoding)
function verifyPin(pin) {
  // Hard-coded PIN: 423323
  const validPin = '423323';
  return { success: true, valid: pin === validPin };
}

// Get version from Config sheet
function getVersion() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const configSheet = ss.getSheetByName('Config');
    const data = configSheet.getDataRange().getValues();
    
    // Find the Version key
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === 'Version') {
        return { success: true, version: data[i][1] };
      }
    }
    
    // Default version if not found
    return { success: true, version: 'Unknown' };
  } catch (error) {
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
          status: data[i][4] || 'Active',
          carrier: data[i][5] || 'STEFI'
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
function createTruck(truckName, carrier) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('Trucks');
    
    // Create Trucks sheet if it doesn't exist
    if (!sheet) {
      sheet = ss.insertSheet('Trucks');
      sheet.appendRow(['TruckID', 'TruckName', 'CreateDate', 'CreateTimestamp', 'Status', 'Carrier']);
    }
    
    const timezone = 'America/New_York';
    const now = new Date();
    const dateOnly = Utilities.formatDate(now, timezone, 'yyyy-MM-dd');
    
    // Set default carrier if not provided
    if (!carrier || carrier.trim() === '') {
      carrier = 'STEFI';
    }
    
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
    
    sheet.appendRow([nextID, truckName, dateOnly, now, 'Active', carrier]);
    
    return {
      success: true,
      data: {
        truckID: nextID,
        truckName: truckName,
        createDate: dateOnly,
        createTimestamp: now,
        status: 'Active',
        carrier: carrier
      }
    };
  } catch (error) {
    Logger.log('Error in createTruck: ' + error);
    return { success: false, error: error.toString() };
  }
}

// Load items to truck (Directly add to TruckLoads)
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
        'Custom', 'LoadedTimestamp', 'TransferNumber'
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
        load.pickDate, // This is now the date the item is being loaded/created
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
        now,
        load.transferNumber || ''
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
          loadedTimestamp: data[i][21],
          transferNumber: data[i][22] || ''
        });
      }
    }
    
    return { success: true, data: loads };
  } catch (error) {
    Logger.log('Error in getTruckLoads: ' + error);
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

// Get departed truck loads by date
function getDepartedTruckLoadsByDate(date) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const trucksSheet = ss.getSheetByName('Trucks');
    const loadsSheet = ss.getSheetByName('TruckLoads');
    
    if (!trucksSheet || !loadsSheet) {
      return { success: false, error: 'Required sheets not found' };
    }
    
    // Get all departed trucks for the specified date
    const trucksData = trucksSheet.getDataRange().getValues();
    const departedTruckIDs = [];
    
    for (let i = 1; i < trucksData.length; i++) {
      const truckID = trucksData[i][0];
      const createDate = trucksData[i][2];
      const status = trucksData[i][4];
      
      if (status === 'Departed') {
        let dateStr = '';
        if (createDate && createDate.getTime && !isNaN(createDate.getTime())) {
          dateStr = Utilities.formatDate(createDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        } else if (typeof createDate === 'string') {
          dateStr = createDate.substring(0, 10);
        }
        
        if (dateStr === date) {
          departedTruckIDs.push(truckID);
        }
      }
    }
    
    if (departedTruckIDs.length === 0) {
      return { success: true, data: [] };
    }
    
    // Get all loads for these trucks
    const loadsData = loadsSheet.getDataRange().getValues();
    const loads = [];
    
    for (let i = 1; i < loadsData.length; i++) {
      const truckID = loadsData[i][0];
      
      if (departedTruckIDs.includes(truckID)) {
        loads.push({
          truckID: truckID,
          branchNumber: loadsData[i][1],
          branchName: loadsData[i][2],
          pickDate: loadsData[i][3],
          pallets: loadsData[i][4] || 0,
          boxes: loadsData[i][5] || 0,
          rolls: loadsData[i][6] || 0,
          fiberglass: loadsData[i][7] || 0,
          waterHeaters: loadsData[i][8] || 0,
          waterRights: loadsData[i][9] || 0,
          boxTub: loadsData[i][10] || 0,
          copperPipe: loadsData[i][11] || 0,
          plasticPipe: loadsData[i][12] || 0,
          galvPipe: loadsData[i][13] || 0,
          blackPipe: loadsData[i][14] || 0,
          wood: loadsData[i][15] || 0,
          galvStrut: loadsData[i][16] || 0,
          im540Tank: loadsData[i][17] || 0,
          im1250Tank: loadsData[i][18] || 0,
          mailBox: loadsData[i][19] || 0,
          custom: loadsData[i][20] || '',
          loadedTimestamp: loadsData[i][21],
          transferNumber: loadsData[i][22] || ''
        });
      }
    }
    
    return { success: true, data: loads };
  } catch (error) {
    Logger.log('Error in getDepartedTruckLoadsByDate: ' + error);
    return { success: false, error: error.toString() };
  }
}

// Get existing transfer number for a branch on a specific date (checks TruckLoads)
function getExistingTransferNumber(branchNumber, date) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('TruckLoads');
    
    if (!sheet) {
      return { success: true, data: null };
    }
    
    const data = sheet.getDataRange().getValues();
    const timezone = 'America/New_York';
    
    for (let i = 1; i < data.length; i++) {
      const recordBranchNumber = data[i][1]; // Column B
      let recordDate = '';
      
      // Parse date from column D (PickDate)
      const dateValue = data[i][3];
      if (dateValue) {
        if (dateValue.getTime && !isNaN(dateValue.getTime())) {
          recordDate = Utilities.formatDate(dateValue, timezone, 'yyyy-MM-dd');
        } else if (typeof dateValue === 'string') {
          recordDate = dateValue.substring(0, 10);
        }
      }
      
      if (recordBranchNumber === branchNumber && recordDate === date) {
        const transferNumber = data[i][22] || ''; // Column W (index 22)
        if (transferNumber && transferNumber.trim() !== '') {
          return { success: true, data: transferNumber.trim() };
        }
      }
    }
    
    return { success: true, data: null }; // No existing transfer number
  } catch (error) {
    Logger.log('Error in getExistingTransferNumber: ' + error);
    return { success: false, error: error.toString() };
  }
}
