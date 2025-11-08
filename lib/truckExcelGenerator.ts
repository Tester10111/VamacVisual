import * as XLSX from 'xlsx';
import { calculateShipDate } from './api';
import { TruckLoad } from './api';

export interface TruckExcelData {
  truckName: string;
  loads: TruckLoad[];
  shippedBy?: string;
  carrier?: string;
}

export function generateTruckExcel(truckData: TruckExcelData) {
  const { truckName, loads, shippedBy = 'Taylor', carrier = 'STEFI' } = truckData;
  
  // Group loads by pick date
  const loadsByDate = loads.reduce((acc, load) => {
    const pickDate = load.pickDate;
    if (!acc[pickDate]) {
      acc[pickDate] = [];
    }
    acc[pickDate].push(load);
    return acc;
  }, {} as Record<string, TruckLoad[]>);
  
  const wb = XLSX.utils.book_new();
  
  // Create a sheet for each pick date
  Object.entries(loadsByDate).forEach(([pickDate, dateLoads]) => {
    const pickDateObj = new Date(pickDate);
    const shipDate = calculateShipDate(pickDateObj);
    
    const ws_data: any[][] = [];
    
    // Company Info
    ws_data.push(['VAMAC CARMEL CHURCH - BR4']);
    ws_data.push(['23323 BUSINESS CTR CT']);
    ws_data.push(['RUTHER GLEN, VA 23546']);
    ws_data.push(['804-321-3955']);
    ws_data.push([]); // Empty row
    
    // Main Title
    ws_data.push(['BRANCH 4 STEFI TRANSFERS']);
    ws_data.push([`Truck: ${truckName}`]);
    ws_data.push([`Shipped By: ${shippedBy}`]);
    ws_data.push([`Carrier: ${carrier}`]);
    ws_data.push([`Pick Date: ${pickDateObj.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })}`]);
    ws_data.push([`Ship Date: ${shipDate.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })}`]);
    ws_data.push([]); // Empty row
    
    // Define all possible items with field names
    const allItems = [
      { field: 'pallets', label: 'Pallets', width: 10 },
      { field: 'boxes', label: 'Boxes', width: 10 },
      { field: 'rolls', label: 'Rolls', width: 10 },
      { field: 'fiberglass', label: 'Fiber-glass', width: 12 },
      { field: 'waterHeaters', label: 'Water Heaters', width: 14 },
      { field: 'waterRights', label: 'Water Rights', width: 14 },
      { field: 'boxTub', label: 'Box Tub', width: 12 },
      { field: 'copperPipe', label: 'Copper Pipe', width: 12 },
      { field: 'plasticPipe', label: 'Plastic Pipe', width: 12 },
      { field: 'galvPipe', label: 'GALV Pipe', width: 12 },
      { field: 'blackPipe', label: 'Black Pipe', width: 12 },
      { field: 'wood', label: 'Wood', width: 10 },
      { field: 'galvStrut', label: 'Galv STRUT', width: 12 },
      { field: 'im540Tank', label: 'IM-540 TANK', width: 14 },
      { field: 'im1250Tank', label: 'IM-1250 TANK', width: 14 },
      { field: 'mailBox', label: 'Mail Box', width: 12 },
    ];
    
    // Check which items have at least one load with quantity > 0
    const activeItems = allItems.filter(item => {
      return dateLoads.some(load => {
        const value = (load as any)[item.field];
        return value && value > 0;
      });
    });
    
    // Check if any load has custom items
    const hasCustomItems = dateLoads.some(load => load.custom && load.custom.trim());
    
    // Build column headers dynamically
    const headers = ['Branch #', 'Branch Name'];
    const colWidths = [{ wch: 10 }, { wch: 20 }];
    
    activeItems.forEach(item => {
      headers.push(item.label);
      colWidths.push({ wch: item.width });
    });
    
    if (hasCustomItems) {
      headers.push('Custom Items');
      colWidths.push({ wch: 30 });
    }
    
    ws_data.push(headers);
    
    // Data rows
    let totalPalletSpaces = 0;
    
    dateLoads.forEach(load => {
      const row: any[] = [load.branchNumber, load.branchName];
      
      activeItems.forEach(item => {
        const value = (load as any)[item.field];
        row.push(value || 0);
      });
      
      if (hasCustomItems) {
        let customItemsText = '';
        if (load.custom && load.custom.trim()) {
          const items = load.custom.split(',').map(item => {
            const parts = item.split(':');
            return `${parts[0]?.trim()}: ${parts[1]?.trim()}`;
          });
          customItemsText = items.join('; ');
        }
        row.push(customItemsText);
      }
      
      ws_data.push(row);
      totalPalletSpaces += load.pallets || 0;
    });
    
    // Add totals
    ws_data.push([]);
    
    const palletColumnIndex = activeItems.findIndex(item => item.field === 'pallets');
    const totalsRow: any[] = ['Total Pallet Spaces:', ''];
    
    if (palletColumnIndex !== -1) {
      for (let i = 0; i < palletColumnIndex; i++) {
        totalsRow.push('');
      }
      totalsRow.push(totalPalletSpaces);
    } else {
      totalsRow.push(totalPalletSpaces);
    }
    
    ws_data.push(totalsRow);
    
    // Add disclaimer
    ws_data.push([]);
    ws_data.push([]);
    ws_data.push(['DISCLAIMER:']);
    ws_data.push(['Inspect Shipment for Shortages/damages before the driver leaves.']);
    ws_data.push(['Note issues on BOL and contact the shipping branch.']);
    ws_data.push(['Make sure all Boxes/Pallets are labeled with the ship from branch #, SHIP to branch #, and transfer #']);
    
    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    ws['!cols'] = colWidths;
    
    // Style headers
    const headerRange = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    const tableHeaderRowIndex = ws_data.findIndex(row => row[0] === 'Branch #');
    
    // Bold company info and main title (first 11 rows)
    for (let R = 0; R <= 11; R++) {
      for (let C = 0; C <= headerRange.e.c; C++) {
        const cell_address = XLSX.utils.encode_cell({ r: R, c: C });
        if (!ws[cell_address]) continue;
        if (!ws[cell_address].s) ws[cell_address].s = {};
        ws[cell_address].s.font = { bold: true };
      }
    }
    
    // Bold table headers
    if (tableHeaderRowIndex !== -1) {
      for (let C = 0; C <= headerRange.e.c; C++) {
        const cell_address = XLSX.utils.encode_cell({ r: tableHeaderRowIndex, c: C });
        if (!ws[cell_address]) continue;
        if (!ws[cell_address].s) ws[cell_address].s = {};
        ws[cell_address].s.font = { bold: true };
        ws[cell_address].s.fill = { fgColor: { rgb: "4472C4" } };
      }
    }
    
    // Create sheet name from pick date
    const sheetName = `Picked ${pickDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });
  
  // Generate filename
  const filename = `Truck_${truckName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
  
  // Write the file
  XLSX.writeFile(wb, filename);
}

