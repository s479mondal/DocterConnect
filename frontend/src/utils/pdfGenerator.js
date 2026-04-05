import jsPDF from 'jspdf';
import 'jspdf-autotable';

export const generatePrescriptionPDF = (doctor, patient, prescription) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header - Hospital/Clinic Info
  doc.setFontSize(22);
  doc.setTextColor(99, 102, 241); // Indigo color
  doc.text('DoctorConnect', 20, 30);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text('Advanced Healthcare Solutions', 20, 37);
  doc.text(doctor.hospital?.name || 'City General Hospital', pageWidth - 20, 30, { align: 'right' });
  doc.text(doctor.hospital?.city || 'Mumbai, India', pageWidth - 20, 37, { align: 'right' });

  // Divider line
  doc.setDrawColor(200);
  doc.line(20, 45, pageWidth - 20, 45);

  // Doctor Details
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text(`Dr. ${doctor.firstName} ${doctor.lastName}`, 20, 60);
  doc.setFontSize(10);
  doc.text(doctor.specialization || 'General Practitioner', 20, 67);
  doc.text(`Reg No: ${doctor.registrationNumber}`, 20, 74);

  // Patient Details
  doc.setFontSize(12);
  doc.text('PATIENT DETAILS', 120, 60);
  doc.setFontSize(10);
  doc.text(`Name: ${patient.name}`, 120, 67);
  doc.text(`Date: ${new Date(prescription.issuedAt).toLocaleDateString()}`, 120, 74);

  // Rx Symbol
  doc.setFontSize(30);
  doc.setTextColor(99, 102, 241);
  doc.text('Rx', 20, 100);

  // Diagnosis
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text('DIAGNOSIS:', 20, 115);
  doc.setFontSize(11);
  doc.text(prescription.diagnosis || 'No specific diagnosis mentioned.', 20, 125);

  // Medicines Table
  const tableData = (prescription.medicines || []).map((med, index) => [
    index + 1,
    med.name,
    med.dosage,
    med.duration,
    med.instructions
  ]);

  doc.autoTable({
    startY: 140,
    head: [['#', 'Medicine Name', 'Dosage', 'Duration', 'Instructions']],
    body: tableData,
    headStyles: { fillColor: [99, 102, 241] },
    alternateRowStyles: { fillColor: [245, 247, 255] }
  });

  // Advice
  const finalY = doc.lastAutoTable.finalY || 140;
  doc.setFontSize(12);
  doc.text('ADVICE / INSTRUCTIONS:', 20, finalY + 20);
  doc.setFontSize(11);
  doc.text(prescription.advice || 'Follow-up as needed.', 20, finalY + 30, { maxWidth: pageWidth - 40 });

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(150);
  doc.text('This is a digitally generated prescription.', pageWidth / 2, 280, { align: 'center' });
  doc.text('DoctorConnect Consultation Platform', pageWidth / 2, 285, { align: 'center' });

  // Save the PDF
  doc.save(`Prescription_${patient.name.replace(/\s+/g, '_')}_${new Date().toLocaleDateString()}.pdf`);
};
