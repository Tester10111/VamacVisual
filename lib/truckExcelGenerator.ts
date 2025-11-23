import ExcelJS from 'exceljs';
import { TruckLoad } from './api';

function calculateShipDate(pickDate: Date): Date {
  const ship = new Date(pickDate);
  ship.setDate(ship.getDate() + 2);
  return ship;
}

export async function generateTruckExcel(
  truckName: string,
  loads: TruckLoad[],
  shippedBy: string = 'Taylor',
  carrier: string = 'STEFI'
) {
  // Group loads by pick date
  const loadsByDate: Record<string, TruckLoad[]> = {};
  
  loads.forEach(load => {
    let pickDate = load.pickDate;
    if (typeof pickDate === 'string') {
      pickDate = pickDate.split('T')[0];
    }
    
    if (!loadsByDate[pickDate]) {
      loadsByDate[pickDate] = [];
    }
    loadsByDate[pickDate].push(load);
  });
  
  const workbook = new ExcelJS.Workbook();
  const dateKeys = Object.keys(loadsByDate);
  
  for (const pickDate of dateKeys) {
    const dateLoads = loadsByDate[pickDate];
    const pickDateObj = new Date(pickDate + 'T12:00:00');
    const shipDate = calculateShipDate(pickDateObj);
    
    const sheetName = `Picked ${pickDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    const worksheet = workbook.addWorksheet(sheetName);
    
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
      return dateLoads.some(load => (load as any)[item.field] > 0);
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
    
    const loadCustomMaps = dateLoads.map(load => parseCustomItems(load.custom));
    
    // Header section
    let row = 1;
    worksheet.getCell(`A${row}`).value = 'VAMAC CARMEL CHURCH - BR4';
    worksheet.getCell(`A${row}`).font = { bold: true, size: 12 };
    row++;
    
    worksheet.getCell(`A${row}`).value = '23323 BUSINESS CTR CT';
    worksheet.getCell(`A${row}`).font = { bold: true, size: 12 };
    worksheet.getCell(`F${row}`).value = `Truck: ${truckName}`;
    worksheet.getCell(`F${row}`).font = { bold: true, size: 12 };
    row++;
    
    worksheet.getCell(`A${row}`).value = 'RUTHER GLEN, VA 23546';
    worksheet.getCell(`A${row}`).font = { bold: true, size: 12 };
    worksheet.getCell(`F${row}`).value = `Shipped By: ${shippedBy}`;
    worksheet.getCell(`F${row}`).font = { bold: true, size: 12 };
    row++;
    
    worksheet.getCell(`A${row}`).value = '804-321-3955';
    worksheet.getCell(`A${row}`).font = { bold: true, size: 12 };
    worksheet.getCell(`F${row}`).value = `Carrier: ${carrier}`;
    worksheet.getCell(`F${row}`).font = { bold: true, size: 12 };
    row++;
    
    worksheet.getCell(`F${row}`).value = `Pick Date: ${pickDateObj.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}`;
    worksheet.getCell(`F${row}`).font = { bold: true, size: 12 };
    row++;
    
    worksheet.getCell(`F${row}`).value = `Ship Date: ${shipDate.toLocaleDateString('en-US', { weekday: 'short', year: '2-digit', month: '2-digit', day: '2-digit' })}`;
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
    let totalPalletSpaces = 0;
    
    dateLoads.forEach((load, loadIndex) => {
      const rowValues: any[] = [load.branchNumber, load.branchName];
      
      activeItems.forEach(item => {
        rowValues.push((load as any)[item.field] || 0);
      });
      
      const customMap = loadCustomMaps[loadIndex];
      customItemOrder.forEach(itemName => {
        rowValues.push(customMap[itemName] || 0);
      });
      
      rowValues.push((load as any).transferNumber || '', '', ''); // Transfer #, Received By, Receive Date
      
      const dataRow = worksheet.getRow(row);
      dataRow.values = rowValues;

      // Apply alternating row shading
      const isEvenRow = (row - tableStartRow) % 2 === 1;
      const rowColor = isEvenRow ? 'FFF2F2F2' : 'FFFFFFFF'; // Light gray for even rows, white for odd

      dataRow.eachCell((cell) => {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowColor } };
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };
      });
      
      totalPalletSpaces += load.pallets || 0;
      row++;
    });
    
    row++; // Empty row
    
    // Totals
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
    row++;
    worksheet.getCell(`A${row}`).value = '**you are responsible for what you sign for, failing to note discrepancies will lead to a loss for the receiving branch.**';
    worksheet.getCell(`A${row}`).font = { bold: true, size: 8 };

    // Add Logo
    // Place at the bottom right, aligned with the last few columns and same row as disclaimer
    const logoCol = Math.max(0, headers.length - 2);
    await addLogoToSheet(workbook, worksheet, row, logoCol);
    
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
  }
  
  // Generate and download file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const filename = `Truck_${truckName.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`;
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Helper to convert WebP to PNG (Excel doesn't support WebP)
const convertWebPToPng = async (url: string): Promise<ArrayBuffer | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            blob.arrayBuffer().then(resolve);
          } else {
            resolve(null);
          }
        }, 'image/png');
      } else {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
};

// Helper to add logo to sheet
const addLogoToSheet = async (workbook: ExcelJS.Workbook, worksheet: ExcelJS.Worksheet, row: number, col: number) => {
  try {
    const pngBuffer = await convertWebPToPng('/logo.webp');

    if (pngBuffer) {
      const imageId = workbook.addImage({
        buffer: pngBuffer,
        extension: 'png',
      });

      worksheet.addImage(imageId, {
        tl: { col: col, row: row },
        ext: { width: 200, height: 200 },
        editAs: 'oneCell'
      });
    }
  } catch (error) {
    console.warn('Failed to add logo to sheet:', error);
  }
};
