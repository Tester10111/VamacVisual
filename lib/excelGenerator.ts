import ExcelJS from 'exceljs';

export interface ExcelExportBranch {
  branchNumber: number;
  branchName: string;
  pallets: number;
  boxes: number;
  rolls: number;
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
  custom?: string;
}

export interface ExcelExportData {
  branches: ExcelExportBranch[];
  date: Date;
  shippedBy: string;
  carrier: string;
}

function calculateShipDate(pickDate: Date): Date {
  const ship = new Date(pickDate);
  ship.setDate(ship.getDate() + 2);
  return ship;
}

export async function generateDailySummaryExcel(exportData: ExcelExportData) {
  const { branches, date, shippedBy, carrier } = exportData;
  const shipDate = calculateShipDate(date);
  
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Daily Summary');
  
  // Define all possible items
  const allItems = [
    { field: 'pallets', label: 'Pallets' },
    { field: 'boxes', label: 'Boxes' },
    { field: 'rolls', label: 'Rolls' },
    { field: 'fiberglass', label: 'Fiber-glass' },
    { field: 'waterHeaters', label: 'Water Heaters' },
    { field: 'waterRights', label: 'Water Rights' },
    { field: 'boxTub', label: 'Box Tub' },
    { field: 'copperPipe', label: 'Copper Pipe' },
    { field: 'plasticPipe', label: 'Plastic Pipe' },
    { field: 'galvPipe', label: 'GALV Pipe' },
    { field: 'blackPipe', label: 'Black Pipe' },
    { field: 'wood', label: 'Wood' },
    { field: 'galvStrut', label: 'Galv STRUT' },
    { field: 'im540Tank', label: 'IM-540 TANK' },
    { field: 'im1250Tank', label: 'IM-1250 TANK' },
    { field: 'mailBox', label: 'Mail Box' },
  ];
  
  // Filter active items
  const activeItems = allItems.filter(item => {
    return branches.some(branch => {
      const value = (branch as any)[item.field];
      return value && value > 0;
    });
  });
  
  // Parse custom items
  const customItemSet = new Set<string>();
  const customItemOrder: string[] = [];
  
  const parseCustomItems = (custom?: string) => {
    if (!custom) return {};
    return custom
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
      .reduce<Record<string, number>>((acc, entry) => {
        const [name, qty] = entry.split(':');
        const itemName = name?.trim();
        const itemQty = Number((qty ?? '').trim()) || 0;
        if (itemName) {
          if (!customItemSet.has(itemName)) {
            customItemSet.add(itemName);
            customItemOrder.push(itemName);
          }
          acc[itemName] = itemQty;
        }
        return acc;
      }, {});
  };
  
  const branchCustomMaps = branches.map(branch => parseCustomItems(branch.custom));
  
  // Header section
  let row = 1;
  worksheet.getCell(`A${row}`).value = 'VAMAC CARMEL CHURCH - BR4';
  worksheet.getCell(`A${row}`).font = { bold: true, size: 12 };
  worksheet.getCell(`F${row}`).value = 'BRANCH 4 STEFI TRANSFERS';
  worksheet.getCell(`F${row}`).font = { bold: true, size: 12 };
  row++;
  
  worksheet.getCell(`A${row}`).value = '23323 BUSINESS CTR CT';
  worksheet.getCell(`A${row}`).font = { bold: true, size: 12 };
  worksheet.getCell(`F${row}`).value = `Shipped By: ${shippedBy}`;
  worksheet.getCell(`F${row}`).font = { bold: true, size: 12 };
  row++;
  
  worksheet.getCell(`A${row}`).value = 'RUTHER GLEN, VA 23546';
  worksheet.getCell(`A${row}`).font = { bold: true, size: 12 };
  worksheet.getCell(`F${row}`).value = `Carrier: ${carrier}`;
  worksheet.getCell(`F${row}`).font = { bold: true, size: 12 };
  row++;
  
  worksheet.getCell(`A${row}`).value = '804-321-3955';
  worksheet.getCell(`A${row}`).font = { bold: true, size: 12 };
  worksheet.getCell(`F${row}`).value = `Ship Date: ${shipDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}`;
  worksheet.getCell(`F${row}`).font = { bold: true, size: 12 };
  row++;
  
  row++; // Empty row
  
  // Build headers
  const headers = ['Branch #', 'Branch Name'];
  activeItems.forEach(item => headers.push(item.label));
  customItemOrder.forEach(itemName => headers.push(itemName));
  headers.push('Transfer #', 'Received By', 'Receive Date');
  
  const tableStartRow = row;
  
  // Set column widths
  worksheet.getColumn(1).width = 16;
  worksheet.getColumn(2).width = 22;
  for (let i = 3; i <= headers.length; i++) {
    worksheet.getColumn(i).width = 12;
  }
  
  // Write headers
  const headerRow = worksheet.getRow(row);
  headerRow.values = headers;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    cell.alignment = { horizontal: 'left', vertical: 'middle' };
    cell.border = {
      top: { style: 'medium' },
      left: { style: 'medium' },
      bottom: { style: 'medium' },
      right: { style: 'medium' }
    };
  });
  row++;
  
  // Write data rows
  branches.forEach((branch, branchIndex) => {
    const rowValues: any[] = [branch.branchNumber, branch.branchName];
    
    activeItems.forEach(item => {
      rowValues.push((branch as any)[item.field] || 0);
    });
    
    const customMap = branchCustomMaps[branchIndex];
    customItemOrder.forEach(itemName => {
      rowValues.push(customMap[itemName] || 0);
    });
    
    rowValues.push('', '', ''); // Transfer #, Received By, Receive Date
    
    const dataRow = worksheet.getRow(row);
    dataRow.values = rowValues;
    dataRow.eachCell((cell) => {
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
    
    row++;
  });
  
  row++; // Empty row
  
  // Totals
  const totalPalletSpaces = branches.reduce((sum, b) => sum + (b.pallets || 0), 0);
  const totalsValues = Array(headers.length).fill('');
  totalsValues[1] = 'Total Pallet Spaces';
  const palletIndex = activeItems.findIndex(item => item.field === 'pallets');
  if (palletIndex >= 0) {
    totalsValues[2 + palletIndex] = totalPalletSpaces;
  }
  
  const totalsRow = worksheet.getRow(row);
  totalsRow.values = totalsValues;
  totalsRow.eachCell((cell) => {
    cell.alignment = { horizontal: 'left', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'medium' },
      right: { style: 'thin' }
    };
  });
  
  const tableEndRow = row;
  
  // Apply thick borders to table outline
  for (let r = tableStartRow; r <= tableEndRow; r++) {
    worksheet.getCell(r, 1).border = {
      ...worksheet.getCell(r, 1).border,
      left: { style: 'medium' }
    };
    worksheet.getCell(r, headers.length).border = {
      ...worksheet.getCell(r, headers.length).border,
      right: { style: 'medium' }
    };
  }
  
  row += 2; // Empty rows
  
  // Disclaimer
  worksheet.getCell(`A${row}`).value = 'DISCLAIMER:';
  worksheet.getCell(`A${row}`).font = { bold: true, size: 9 };
  row++;
  worksheet.getCell(`A${row}`).value = 'Inspect Shipment for Shortages/damages before the driver leaves.';
  worksheet.getCell(`A${row}`).font = { size: 8 };
  row++;
  worksheet.getCell(`A${row}`).value = 'Note issues on BOL and contact the shipping branch.';
  worksheet.getCell(`A${row}`).font = { size: 8 };
  row++;
  worksheet.getCell(`A${row}`).value = 'Make sure all Boxes/Pallets are labeled with the ship from branch #, SHIP to branch #, and transfer #';
  worksheet.getCell(`A${row}`).font = { size: 8 };
  
  // Set print settings
  worksheet.pageSetup = {
    orientation: 'landscape',
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: {
      left: 0.7,
      right: 0.7,
      top: 0.75,
      bottom: 0.75,
      header: 0.3,
      footer: 0.3
    }
  };
  
  // Generate and download file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).replace(/\//g, '-');
  a.href = url;
  a.download = `DailySummary_${dateStr}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
