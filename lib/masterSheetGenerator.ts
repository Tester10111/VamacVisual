import ExcelJS from 'exceljs';
import { TruckLoad } from './api';

// Import jsbarcode dynamically to handle browser compatibility
let JsBarcode: any = null;

const loadJsBarcode = async () => {
  if (!JsBarcode) {
    try {
      const jsbarcode = await import('jsbarcode');
      JsBarcode = jsbarcode.default;
    } catch (error) {
      console.warn('Failed to load jsbarcode library:', error);
      return null;
    }
  }
  return JsBarcode;
};

// Generate barcode image for a given text
const generateBarcode = async (text: string, width: number = 200, height: number = 60): Promise<string | null> => {
  try {
    const barcodeLib = await loadJsBarcode();
    if (!barcodeLib) return null;

    // Create a canvas element
    const canvas = document.createElement('canvas');

    // Generate barcode on canvas
    barcodeLib(canvas, text, {
      format: "CODE128",
      width: 2,
      height: height,
      displayValue: false,
    });

    // Convert canvas to base64 PNG data
    return canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");
  } catch (error) {
    console.warn('Failed to generate barcode for text:', text, error);
    return null;
  }
};

interface AggregatedBranch {
  branchNumber: number;
  branchName: string;
  pallets: number;
  boxes: number;
  rolls: number;
  fiberglass: number;
  waterHeaters: number;
  waterRights: number;
  boxTub: number;
  copperPipe: number;
  plasticPipe: number;
  galvPipe: number;
  blackPipe: number;
  wood: number;
  galvStrut: number;
  im540Tank: number;
  im1250Tank: number;
  mailBox: number;
  customItems: Record<string, number>;
  transferNumbers: string[];
}

function calculateShipDate(departedDate: Date): Date {
  const ship = new Date(departedDate);
  ship.setDate(ship.getDate() + 2);

  // Check if it's a weekend and adjust
  const dayOfWeek = ship.getDay(); // 0 = Sunday, 6 = Saturday

  if (dayOfWeek === 6) {
    // Saturday -> Monday (add 2 days)
    ship.setDate(ship.getDate() + 2);
  } else if (dayOfWeek === 0) {
    // Sunday -> Tuesday (add 2 days)
    ship.setDate(ship.getDate() + 2);
  }

  return ship;
}

export async function generateMasterSheetExcel(loads: TruckLoad[], departedDate: Date, defaultCarrier: string = 'STEFI') {
  // Group loads by pick date
  const loadsByPickDate: Record<string, TruckLoad[]> = {};

  loads.forEach(load => {
    let pickDate = load.pickDate;
    if (typeof pickDate === 'string') {
      pickDate = pickDate.split('T')[0];
    }

    if (!loadsByPickDate[pickDate]) {
      loadsByPickDate[pickDate] = [];
    }
    loadsByPickDate[pickDate].push(load);
  });

  const workbook = new ExcelJS.Workbook();
  const pickDates = Object.keys(loadsByPickDate).sort(); // Sort pick dates chronologically

  // Process each pick date separately
  for (const pickDateStr of pickDates) {
    const pickDateLoads = loadsByPickDate[pickDateStr];

    // Parse pick date and calculate ship date from it
    const [year, month, day] = pickDateStr.split('-').map(Number);
    const pickDate = new Date(year, month - 1, day);
    const shipDate = calculateShipDate(pickDate);

    // Aggregate loads by branch for this pick date
    const branchMap = new Map<number, AggregatedBranch>();

    pickDateLoads.forEach(load => {
      const key = load.branchNumber;

      if (!branchMap.has(key)) {
        branchMap.set(key, {
          branchNumber: load.branchNumber,
          branchName: load.branchName,
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
          customItems: {},
          transferNumbers: []
        });
      }

      const branch = branchMap.get(key)!;

      // Aggregate quantities
      branch.pallets += load.pallets || 0;
      branch.boxes += load.boxes || 0;
      branch.rolls += load.rolls || 0;
      branch.fiberglass += load.fiberglass || 0;
      branch.waterHeaters += load.waterHeaters || 0;
      branch.waterRights += load.waterRights || 0;
      branch.boxTub += load.boxTub || 0;
      branch.copperPipe += load.copperPipe || 0;
      branch.plasticPipe += load.plasticPipe || 0;
      branch.galvPipe += load.galvPipe || 0;
      branch.blackPipe += load.blackPipe || 0;
      branch.wood += load.wood || 0;
      branch.galvStrut += load.galvStrut || 0;
      branch.im540Tank += load.im540Tank || 0;
      branch.im1250Tank += load.im1250Tank || 0;
      branch.mailBox += load.mailBox || 0;

      // Aggregate custom items
      if (load.custom) {
        const customPairs = load.custom.split(',').map(s => s.trim()).filter(Boolean);
        customPairs.forEach(pair => {
          const [name, qty] = pair.split(':');
          const itemName = name?.trim();
          const itemQty = Number((qty ?? '').trim()) || 0;
          if (itemName) {
            branch.customItems[itemName] = (branch.customItems[itemName] || 0) + itemQty;
          }
        });
      }

      // Collect transfer numbers
      if (load.transferNumber && !branch.transferNumbers.includes(load.transferNumber)) {
        branch.transferNumbers.push(load.transferNumber);
      }
    });

    // Convert to array and filter branches with at least one item
    const branches = Array.from(branchMap.values()).filter(branch => {
      return branch.pallets > 0 || branch.boxes > 0 || branch.rolls > 0 ||
        branch.fiberglass > 0 || branch.waterHeaters > 0 || branch.waterRights > 0 ||
        branch.boxTub > 0 || branch.copperPipe > 0 || branch.plasticPipe > 0 ||
        branch.galvPipe > 0 || branch.blackPipe > 0 || branch.wood > 0 ||
        branch.galvStrut > 0 || branch.im540Tank > 0 || branch.im1250Tank > 0 ||
        branch.mailBox > 0 || Object.keys(branch.customItems).length > 0;
    });

    // Sort by branch number
    branches.sort((a, b) => a.branchNumber - b.branchNumber);

    if (branches.length === 0) continue; // Skip if no branches for this pick date

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

    // Collect all unique custom item names
    const customItemSet = new Set<string>();
    branches.forEach(branch => {
      Object.keys(branch.customItems).forEach(itemName => customItemSet.add(itemName));
    });
    const customItemOrder = Array.from(customItemSet);

    // Filter active items
    const activeItems = allItems.filter(item => {
      return branches.some(branch => (branch as any)[item.field] > 0);
    });

    // Create Master Sheet for this pick date
    await createMasterSheet(workbook, branches, activeItems, customItemOrder, pickDate, shipDate, pickDateStr, defaultCarrier);

    // Create individual branch sheets for this pick date
    for (const branch of branches) {
      await createBranchSheet(workbook, branch, activeItems, customItemOrder, pickDate, shipDate, pickDateStr, defaultCarrier);
    }
  }

  // Generate and download file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = departedDate.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }).replace(/\//g, '-');
  a.href = url;
  a.download = `MasterSheet_${dateStr}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

async function createMasterSheet(
  workbook: ExcelJS.Workbook,
  branches: AggregatedBranch[],
  activeItems: any[],
  customItemOrder: string[],
  pickDate: Date,
  shipDate: Date,
  pickDateStr: string,
  carrier: string = 'STEFI'
) {
  const sheetName = `Master - Picked ${pickDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  const worksheet = workbook.addWorksheet(sheetName);

  // Header section
  let row = 1;
  worksheet.getCell(`A${row}`).value = 'VAMAC CARMEL CHURCH - BR4';
  worksheet.getCell(`A${row}`).font = { bold: true, size: 12 };
  // Use merged cells for right side content to prevent overlap
  worksheet.mergeCells(`F${row}:H${row}`);
  worksheet.getCell(`F${row}`).value = 'MR. SHEET';
  worksheet.getCell(`F${row}`).font = { bold: true, size: 12 };
  worksheet.getCell(`F${row}`).alignment = { horizontal: 'left', vertical: 'middle' };
  row++;

  worksheet.getCell(`A${row}`).value = 'RUTHER GLEN, VA 23546';
  worksheet.getCell(`A${row}`).font = { bold: true, size: 12 };
  worksheet.mergeCells(`F${row}:H${row}`);
  worksheet.getCell(`F${row}`).value = `Ship Date: ${shipDate.toLocaleDateString('en-US', { weekday: 'long', month: '2-digit', day: '2-digit', year: '2-digit' })}`;
  worksheet.getCell(`F${row}`).font = { bold: true, size: 12 };
  worksheet.getCell(`F${row}`).alignment = { horizontal: 'left', vertical: 'middle' };
  row++;

  worksheet.getCell(`A${row}`).value = '23323 BUSINESS CTR CT';
  worksheet.getCell(`A${row}`).font = { bold: true, size: 12 };
  worksheet.mergeCells(`F${row}:H${row}`);
  worksheet.getCell(`F${row}`).value = 'Shipped By: Taylor';
  worksheet.getCell(`F${row}`).font = { bold: true, size: 12 };
  worksheet.getCell(`F${row}`).alignment = { horizontal: 'left', vertical: 'middle' };
  row++;

  worksheet.getCell(`A${row}`).value = '804-321-3955';
  worksheet.getCell(`A${row}`).font = { bold: true, size: 12 };
  worksheet.mergeCells(`F${row}:H${row}`);
  worksheet.getCell(`F${row}`).value = `Carrier: ${carrier}`;
  worksheet.getCell(`F${row}`).font = { bold: true, size: 12 };
  worksheet.getCell(`F${row}`).alignment = { horizontal: 'left', vertical: 'middle' };
  row++;

  row++; // Empty row

  // Build headers
  const headers = ['Branch #', 'Branch Name'];
  activeItems.forEach(item => headers.push(item.label));
  customItemOrder.forEach(itemName => headers.push(itemName));
  headers.push('Transfer #', 'Received By', 'Receive Date');

  const tableStartRow = row;

  // Set base column widths
  worksheet.getColumn(1).width = 16;
  worksheet.getColumn(2).width = 22;

  // Set dynamic widths for item columns and custom items
  activeItems.forEach((item, idx) => {
    const colIndex = idx + 3; // +3 because of Branch # and Branch Name
    const minWidth = Math.max(item.label.length + 2, 12);
    worksheet.getColumn(colIndex).width = Math.min(minWidth, 18);
  });

  // Set dynamic widths for custom item columns
  customItemOrder.forEach((itemName, idx) => {
    const colIndex = idx + 3 + activeItems.length;
    const minWidth = Math.max(itemName.length + 2, 12);
    worksheet.getColumn(colIndex).width = Math.min(minWidth, 25);
  });

  // Set widths for Transfer #, Received By, Receive Date
  const transferColIndex = 3 + activeItems.length + customItemOrder.length;
  worksheet.getColumn(transferColIndex).width = 18; // Back to original width
  worksheet.getColumn(transferColIndex + 1).width = 20;
  worksheet.getColumn(transferColIndex + 2).width = 15;

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
  for (const branch of branches) {
    const rowValues: any[] = [branch.branchNumber, branch.branchName];

    activeItems.forEach(item => {
      rowValues.push((branch as any)[item.field] || 0);
    });

    customItemOrder.forEach(itemName => {
      rowValues.push(branch.customItems[itemName] || 0);
    });

    const transferNumbersText = branch.transferNumbers.join('/');
    rowValues.push(transferNumbersText, '', ''); // Just transfer numbers, Received By, Receive Date

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
  };

  row++; // Empty row

  // Totals
  const totalPalletSpaces = branches.reduce((sum, b) => sum + b.pallets, 0);
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
  worksheet.getCell(`A${row}`).value = 'Note issues on BOL and contact the shipping branch. Include pictures and send via solar or email.';
  worksheet.getCell(`A${row}`).font = { size: 8 };
  row++;
  worksheet.getCell(`A${row}`).value = 'Make sure all Boxes/Pallets are labeled with the ship from branch #, SHIP to branch #, and transfer #';
  worksheet.getCell(`A${row}`).font = { size: 8 };
  row++;
  worksheet.getCell(`A${row}`).value = 'You are responsible for what you sign for, failing to note discrepancies will lead to a loss for the receiving branch.';
  worksheet.getCell(`A${row}`).font = { bold: true, size: 8 };

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

async function createBranchSheet(
  workbook: ExcelJS.Workbook,
  branch: AggregatedBranch,
  activeItems: any[],
  customItemOrder: string[],
  pickDate: Date,
  shipDate: Date,
  pickDateStr: string,
  carrier: string = 'STEFI'
) {
  const sheetName = `Br${branch.branchNumber} - Picked ${pickDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  const worksheet = workbook.addWorksheet(sheetName);

  // Header section
  let row = 1;
  worksheet.getCell(`A${row}`).value = `BR4 -> ${branch.branchName}`;
  worksheet.getCell(`A${row}`).font = { bold: true, size: 12 };
  // Ship Date on the same row, right side (merge D-F)
  worksheet.mergeCells(`D${row}:F${row}`);
  worksheet.getCell(`D${row}`).value = `Ship Date: ${shipDate.toLocaleDateString('en-US', { weekday: 'long', month: '2-digit', day: '2-digit', year: '2-digit' })}`;
  worksheet.getCell(`D${row}`).font = { bold: true, size: 12 };
  worksheet.getCell(`D${row}`).alignment = { horizontal: 'left', vertical: 'middle', wrapText: false };
  row++;

  worksheet.getCell(`A${row}`).value = 'VAMAC CARMEL CHURCH';
  worksheet.getCell(`A${row}`).font = { bold: true, size: 12 };
  worksheet.mergeCells(`D${row}:F${row}`);
  worksheet.getCell(`D${row}`).value = 'Shipped By: Taylor';
  worksheet.getCell(`D${row}`).font = { bold: true, size: 12 };
  worksheet.getCell(`D${row}`).alignment = { horizontal: 'left', vertical: 'middle', wrapText: false };
  row++;

  worksheet.getCell(`A${row}`).value = 'RUTHER GLEN, VA 23546';
  worksheet.getCell(`A${row}`).font = { bold: true, size: 12 };
  worksheet.mergeCells(`D${row}:F${row}`);
  worksheet.getCell(`D${row}`).value = `Carrier: ${carrier}`;
  worksheet.getCell(`D${row}`).font = { bold: true, size: 12 };
  worksheet.getCell(`D${row}`).alignment = { horizontal: 'left', vertical: 'middle', wrapText: false };
  row++;

  worksheet.getCell(`A${row}`).value = '23323 BUSINESS CTR CT';
  worksheet.getCell(`A${row}`).font = { bold: true, size: 12 };
  row++;

  worksheet.getCell(`A${row}`).value = '804-321-3955';
  worksheet.getCell(`A${row}`).font = { bold: true, size: 12 };
  row++;

  row++; // Empty row

  // Headers
  const tableStartRow = row;
  const headerRow = worksheet.getRow(row);
  headerRow.values = ['Item', 'Qty Ordered', 'Qty Shipped'];
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

  // Set column widths
  worksheet.getColumn(1).width = 20;
  worksheet.getColumn(2).width = 12;
  worksheet.getColumn(3).width = 12;

  // Data rows - only items with quantities > 0
  activeItems.forEach(item => {
    const qty = (branch as any)[item.field];
    if (qty > 0) {
      const dataRow = worksheet.getRow(row);
      dataRow.values = [item.label, qty, ''];
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
    }
  });

  customItemOrder.forEach(itemName => {
    const qty = branch.customItems[itemName];
    if (qty > 0) {
      const dataRow = worksheet.getRow(row);
      dataRow.values = [itemName, qty, ''];
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
    }
  });

  const tableEndRow = row - 1;

  // Apply thick borders to table outline
  for (let r = tableStartRow; r <= tableEndRow; r++) {
    worksheet.getCell(r, 1).border = {
      ...worksheet.getCell(r, 1).border,
      left: { style: 'medium' }
    };
    worksheet.getCell(r, 3).border = {
      ...worksheet.getCell(r, 3).border,
      right: { style: 'medium' }
    };
  }
  worksheet.getCell(tableEndRow, 1).border = {
    ...worksheet.getCell(tableEndRow, 1).border,
    bottom: { style: 'medium' }
  };
  worksheet.getCell(tableEndRow, 2).border = {
    ...worksheet.getCell(tableEndRow, 2).border,
    bottom: { style: 'medium' }
  };
  worksheet.getCell(tableEndRow, 3).border = {
    ...worksheet.getCell(tableEndRow, 3).border,
    bottom: { style: 'medium' }
  };

  // Transfer numbers with barcode and manual entry backup
  if (branch.transferNumbers.length > 0) {
    const transferNumbersText = branch.transferNumbers.join('/');

    // Add spacing row to prevent overlap with table
    row++;

    // Generate and add barcode for transfer numbers
    try {
      const barcodeBase64 = await generateBarcode(transferNumbersText);
      if (barcodeBase64) {
        // Add barcode image
        const imageId = workbook.addImage({
          base64: `data:image/png;base64,${barcodeBase64}`,
          extension: 'png',
        });

        // Position barcode image
        worksheet.addImage(imageId, {
          tl: { col: 0, row: row - 1 }, // Column A, current row
          ext: { width: 180, height: 50 },
          editAs: 'oneCell'
        });

        // Set row height to accommodate barcode
        worksheet.getRow(row).height = 50;
        row++;

        // Add transfer number text below barcode for manual entry
        worksheet.getCell(`A${row}`).value = `Transfer #: ${transferNumbersText}`;
        worksheet.getCell(`A${row}`).font = { size: 10 };
        row++;
      } else {
        // Fallback to text if barcode generation fails
        worksheet.getCell(`A${row}`).value = `Transfer #: ${transferNumbersText}`;
        worksheet.getCell(`A${row}`).font = { size: 10 };
        row++;
      }
    } catch (error) {
      console.warn('Failed to generate barcode for branch sheet:', transferNumbersText, error);
      // Fallback to text
      worksheet.getCell(`A${row}`).value = `Transfer #: ${transferNumbersText}`;
      worksheet.getCell(`A${row}`).font = { size: 10 };
      row++;
    }
  }

  // Notes section
  row += 2;
  worksheet.getCell(`A${row}`).value = 'Notes/Discrepancies:';
  worksheet.getCell(`A${row}`).font = { bold: true, size: 10 };
  row++;
  worksheet.getCell(`A${row}`).value = '_____________________________________________________________________';
  row++;
  worksheet.getCell(`A${row}`).value = '_____________________________________________________________________';
  row++;
  worksheet.getCell(`A${row}`).value = '_____________________________________________________________________';

  // Received By line
  row += 2;
  worksheet.getCell(`A${row}`).value = 'Received By: _____________________________';
  worksheet.getCell(`A${row}`).font = { size: 10 };

  // Disclaimer at bottom
  row += 3;
  worksheet.getCell(`A${row}`).value = 'DISCLAIMER:';
  worksheet.getCell(`A${row}`).font = { bold: true, size: 9 };
  row++;
  worksheet.getCell(`A${row}`).value = 'Inspect Shipment for Shortages/damages before the driver leaves.';
  worksheet.getCell(`A${row}`).font = { size: 8 };
  row++;
  worksheet.getCell(`A${row}`).value = 'Note issues on BOL and contact the shipping branch. Include pictures and send via solar or email.';
  worksheet.getCell(`A${row}`).font = { size: 8 };
  row++;
  worksheet.getCell(`A${row}`).value = 'Make sure all Boxes/Pallets are labeled with the ship from branch #, SHIP to branch #, and transfer #';
  worksheet.getCell(`A${row}`).font = { size: 8 };
  row++;
  worksheet.getCell(`A${row}`).value = 'You are responsible for what you sign for, failing to note discrepancies will lead to a loss for the receiving branch.';
  worksheet.getCell(`A${row}`).font = { bold: true, size: 8 };

  // Set print settings (portrait for branch sheets)
  worksheet.pageSetup = {
    orientation: 'portrait',
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
