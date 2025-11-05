import jsPDF from 'jspdf';
import { calculateShipDate } from './api';

export interface SummaryBranch {
  branchNumber: number;
  branchName: string;
  address: string;
  phone: string;
  carrier: string;
  pallets: number;
  boxes: number;
  rolls: number;
  transferNumber?: string;
  notes?: string;
  receivedBy?: string;
  dateReceived?: string;
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
}

export interface PDFExportData {
  branches: SummaryBranch[];
  date: Date;
  shippedBy: string;
  carrier: string;
}

export function generateDailySummaryPDF(exportData: PDFExportData) {
  const { branches, date, shippedBy, carrier } = exportData;
  const doc = new jsPDF();
  const shipDate = calculateShipDate(date);
  
  // Left side - Company Info
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('VAMAC CARMEL CHURCH - BR4', 15, 15);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('23323 BUSINESS CTR CT', 15, 19);
  doc.text('RUTHER GLEN, VA 23546', 15, 23);
  doc.text('804-321-3955', 15, 27);
  
  // Center - Main Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('BRANCH 4 STEFI TRANSFERS', 105, 15, { align: 'center' });
  
  // Shipped By
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Shipped By: ${shippedBy}`, 105, 22, { align: 'center' });
  
  // Carrier
  doc.text(`Carrier: ${carrier}`, 105, 28, { align: 'center' });
  
  // Ship Date
  doc.setFontSize(10);
  doc.text(`Ship Date: ${shipDate.toLocaleDateString('en-US', { 
    weekday: 'short', 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  })}`, 105, 34, { align: 'center' });
  
  doc.line(10, 38, 200, 38);
  
  let yPosition = 45;
  let totalPalletSpaces = 0;
  
  // For each branch with shipments
  branches.forEach((branch, index) => {
    // Check if we need a new page
    if (yPosition > 250) {
      doc.addPage();
      yPosition = 20;
    }
    
    if (index > 0) {
      yPosition += 5;
      doc.line(15, yPosition, 195, yPosition);
      yPosition += 8;
    }
    
    // Branch header
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(`Branch ${branch.branchNumber} - ${branch.branchName}`, 15, yPosition);
    yPosition += 7;
    
    // Shipment details
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    
    if (branch.pallets > 0) {
      doc.text(`Pallets: ${branch.pallets}`, 20, yPosition);
      totalPalletSpaces += branch.pallets;
      yPosition += 5;
    }
    if (branch.boxes > 0) {
      doc.text(`Boxes: ${branch.boxes}`, 20, yPosition);
      yPosition += 5;
    }
    if (branch.rolls > 0) {
      doc.text(`Rolls: ${branch.rolls}`, 20, yPosition);
      yPosition += 5;
    }
    
    // Advanced fields
    if (branch.fiberglass && branch.fiberglass > 0) {
      doc.text(`Fiber-glass: ${branch.fiberglass}`, 20, yPosition);
      yPosition += 5;
    }
    if (branch.waterHeaters && branch.waterHeaters > 0) {
      doc.text(`Water Heaters: ${branch.waterHeaters}`, 20, yPosition);
      yPosition += 5;
    }
    if (branch.waterRights && branch.waterRights > 0) {
      doc.text(`Water Rights: ${branch.waterRights}`, 20, yPosition);
      yPosition += 5;
    }
    if (branch.boxTub && branch.boxTub > 0) {
      doc.text(`Box Tub: ${branch.boxTub}`, 20, yPosition);
      yPosition += 5;
    }
    if (branch.copperPipe && branch.copperPipe > 0) {
      doc.text(`Copper Pipe: ${branch.copperPipe}`, 20, yPosition);
      yPosition += 5;
    }
    if (branch.plasticPipe && branch.plasticPipe > 0) {
      doc.text(`Plastic Pipe: ${branch.plasticPipe}`, 20, yPosition);
      yPosition += 5;
    }
    if (branch.galvPipe && branch.galvPipe > 0) {
      doc.text(`GALV Pipe: ${branch.galvPipe}`, 20, yPosition);
      yPosition += 5;
    }
    if (branch.blackPipe && branch.blackPipe > 0) {
      doc.text(`Black Pipe: ${branch.blackPipe}`, 20, yPosition);
      yPosition += 5;
    }
    if (branch.wood && branch.wood > 0) {
      doc.text(`Wood: ${branch.wood}`, 20, yPosition);
      yPosition += 5;
    }
    if (branch.galvStrut && branch.galvStrut > 0) {
      doc.text(`Galv STRUT: ${branch.galvStrut}`, 20, yPosition);
      yPosition += 5;
    }
    if (branch.im540Tank && branch.im540Tank > 0) {
      doc.text(`IM-540 TANK: ${branch.im540Tank}`, 20, yPosition);
      yPosition += 5;
    }
    if (branch.im1250Tank && branch.im1250Tank > 0) {
      doc.text(`IM-1250 TANK: ${branch.im1250Tank}`, 20, yPosition);
      yPosition += 5;
    }
    if (branch.mailBox && branch.mailBox > 0) {
      doc.text(`Mail Box: ${branch.mailBox}`, 20, yPosition);
      yPosition += 5;
    }
    
    yPosition += 2;
    
    // Transfer Number / Notes
    if (branch.transferNumber || branch.notes) {
      doc.setFont('helvetica', 'italic');
      const noteText = branch.transferNumber 
        ? `Transfer #: ${branch.transferNumber}${branch.notes ? ' - ' + branch.notes : ''}`
        : `Notes: ${branch.notes}`;
      const splitNotes = doc.splitTextToSize(noteText, 170);
      doc.text(splitNotes, 20, yPosition);
      yPosition += splitNotes.length * 5;
    }
    
    yPosition += 3;
    
    // Signature fields (blank lines for manual completion)
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    
    // Received By
    doc.text('Received By:', 20, yPosition);
    doc.line(45, yPosition, 95, yPosition);
    
    // Date Received
    doc.text('Date:', 105, yPosition);
    doc.line(118, yPosition, 155, yPosition);
    
    yPosition += 8;
  });
  
  // Total Pallet Spaces at bottom
  if (yPosition > 260) {
    doc.addPage();
    yPosition = 20;
  }
  
  yPosition = Math.max(yPosition + 5, 260);
  doc.line(10, yPosition, 200, yPosition);
  yPosition += 7;
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Pallet Spaces: ${totalPalletSpaces}`, 105, yPosition, { align: 'center' });
  yPosition += 10;
  
  // Disclaimer at the bottom
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  const disclaimer = 'Inspect Shipment for Shortages/damages before the driver leaves. Note issues on BOL and contact the shipping branch. Make sure all Boxes/Pallets are labeled with the ship from branch #, SHIP to branch #, and transfer #.';
  const splitDisclaimer = doc.splitTextToSize(disclaimer, 180);
  doc.text(splitDisclaimer, 105, yPosition, { align: 'center' });
  
  // Save the PDF
  const fileName = `VAMAC_Transfer_${date.toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
}
