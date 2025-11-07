import * as XLSX from 'xlsx';
import { calculateShipDate } from './api';

export interface ExcelExportBranch {
  branchNumber: number;
  branchName: string;
  pallets: number;
  boxes: number;
  rolls: number;
  // Advanced fields
  fiberglass?: number;
  waterHeaters?: number;
  waterRights?: number;
  boxTub?: number;
  copperPipe?: number;
  plasticPipe?: number;
  galvPipe?: number;
  blackPipe?: number;
  wood?: number;
  galvStrut?: number;
  im540Tank?: number;
  im1250Tank?: number;
  mailBox?: number;
  // Custom items as string
  custom?: string;
}

export interface ExcelExportData {
  branches: ExcelExportBranch[];
  date: Date;
  shippedBy: string;
  carrier: string;
}

export function generateDailySummaryExcel(exportData: ExcelExportData) {
  const { branches, date, shippedBy, carrier } = exportData;
  const shipDate = calculateShipDate(date);
  
  // Create a new workbook
  const wb = XLSX.utils.book_new();
  
  // Prepare data for the sheet
  const data: any[][] = [];
  
  // Header section
  data.push(['VAMAC CARMEL CHURCH - BR4']);
  data.push(['23323 BUSINESS CTR CT']);
  data.push(['RUTHER GLEN, VA 23546']);
  data.push(['804-321-3955']);
  data.push([]); // Empty row
  data.push(['BRANCH 4 STEFI TRANSFERS']);
  data.push([`Shipped By: ${shippedBy}`]);
  data.push([`Carrier: ${carrier}`]);
  data.push([`Ship Date: ${shipDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`]);
  data.push([]); // Empty row
  
  // Define all possible items with their field names and display names
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
  
  // Check which items have at least one branch with quantity > 0
  const activeItems = allItems.filter(item => {
    return branches.some(branch => {
      const value = (branch as any)[item.field];
      return value && value > 0;
    });
  });
  
  // Check if any branch has custom items
  const hasCustomItems = branches.some(branch => branch.custom && branch.custom.trim());
  
  // Build column headers dynamically
  const headers = ['Branch #', 'Branch Name'];
  const colWidths = [{ wch: 10 }, { wch: 20 }]; // Branch # and Branch Name widths
  
  activeItems.forEach(item => {
    headers.push(item.label);
    colWidths.push({ wch: item.width });
  });
  
  if (hasCustomItems) {
    headers.push('Custom Items');
    colWidths.push({ wch: 30 });
  }
  
  data.push(headers);
  
  // Branch data rows
  branches.forEach(branch => {
    const row: any[] = [branch.branchNumber, branch.branchName];
    
    // Add values for active items only
    activeItems.forEach(item => {
      const value = (branch as any)[item.field];
      row.push(value || 0);
    });
    
    // Add custom items if any branch has them
    if (hasCustomItems) {
      let customItemsText = '';
      if (branch.custom && branch.custom.trim()) {
        const items = branch.custom.split(',').map(item => {
          const parts = item.split(':');
          return `${parts[0]?.trim()}: ${parts[1]?.trim()}`;
        });
        customItemsText = items.join('; ');
      }
      row.push(customItemsText);
    }
    
    data.push(row);
  });
  
  // Add empty row before totals
  data.push([]);
  
  // Calculate total pallet spaces
  const totalPalletSpaces = branches.reduce((sum, b) => sum + (b.pallets || 0), 0);
  
  // Find the column index for Pallets in the active items
  const palletColumnIndex = activeItems.findIndex(item => item.field === 'pallets');
  
  // Create totals row
  const totalsRow: any[] = ['Total Pallet Spaces:', ''];
  
  // If pallets column exists, put the total in that column
  if (palletColumnIndex !== -1) {
    // Fill empty cells up to the pallets column
    for (let i = 0; i < palletColumnIndex; i++) {
      totalsRow.push('');
    }
    totalsRow.push(totalPalletSpaces);
  } else {
    // If no pallets column, just put it in the third column
    totalsRow.push(totalPalletSpaces);
  }
  
  data.push(totalsRow);
  
  // Add empty rows before disclaimer
  data.push([]);
  data.push([]);
  
  // Disclaimer
  data.push(['DISCLAIMER:']);
  data.push(['Inspect Shipment for Shortages/damages before the driver leaves.']);
  data.push(['Note issues on BOL and contact the shipping branch.']);
  data.push(['Make sure all Boxes/Pallets are labeled with the ship from branch #, SHIP to branch #, and transfer #']);
  
  // Create worksheet from data
  const ws = XLSX.utils.aoa_to_sheet(data);
  
  // Set column widths
  ws['!cols'] = colWidths;
  
  // Style header rows (rows 1-9) - bold
  const headerRange = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let R = 0; R <= 9; R++) {
    for (let C = 0; C <= headerRange.e.c; C++) {
      const cell_address = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[cell_address]) continue;
      if (!ws[cell_address].s) ws[cell_address].s = {};
      ws[cell_address].s.font = { bold: true };
    }
  }
  
  // Style column headers (row 10) - bold with background
  const headerRowIndex = 10;
  for (let C = 0; C <= headerRange.e.c; C++) {
    const cell_address = XLSX.utils.encode_cell({ r: headerRowIndex, c: C });
    if (!ws[cell_address]) continue;
    if (!ws[cell_address].s) ws[cell_address].s = {};
    ws[cell_address].s.font = { bold: true };
    ws[cell_address].s.fill = { fgColor: { rgb: "4472C4" } };
  }
  
  // Add the worksheet to the workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Daily Summary');
  
  // Generate filename
  const filename = `VAMAC_Daily_Summary_${date.toISOString().split('T')[0]}.xlsx`;
  
  // Write the file
  XLSX.writeFile(wb, filename);
}

