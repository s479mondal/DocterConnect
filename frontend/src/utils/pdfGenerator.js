import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const generatePrescriptionPDF = (doctor = {}, patient = {}, prescription = {}) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Safety fallbacks for nested objects
  const doctorInfo = {
    firstName: doctor.firstName || 'Medical',
    lastName: doctor.lastName || 'Professional',
    specialization: doctor.specialization || 'General Practitioner',
    registrationNumber: doctor.registrationNumber || 'Pending',
    hospital: doctor.hospital || { name: 'DoctorConnect Network', city: 'Healthcare Platform' }
  };

  const patientInfo = {
    name: patient.name || 'Valued Patient'
  };

  const rxDetails = {
    diagnosis: prescription.diagnosis || 'General Consultation',
    advice: prescription.advice || 'Follow-up as needed.',
    issuedAt: prescription.issuedAt ? new Date(prescription.issuedAt) : new Date(),
    medicines: prescription.medicines || []
  };

  // Header - Hospital/Clinic Info
  doc.setFontSize(22);
  doc.setTextColor(99, 102, 241); // Indigo color
  doc.text('DoctorConnect', 20, 30);
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text('Advanced Healthcare Solutions', 20, 37);
  doc.text(doctorInfo.hospital.name, pageWidth - 20, 30, { align: 'right' });
  doc.text(doctorInfo.hospital.city, pageWidth - 20, 37, { align: 'right' });

  // Divider line
  doc.setDrawColor(200);
  doc.line(20, 45, pageWidth - 20, 45);

  // Doctor Details
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text(`Dr. ${doctorInfo.firstName} ${doctorInfo.lastName}`, 20, 60);
  doc.setFontSize(10);
  doc.text(doctorInfo.specialization, 20, 67);
  doc.text(`Reg No: ${doctorInfo.registrationNumber}`, 20, 74);

  // Patient Details
  doc.setFontSize(12);
  doc.text('PATIENT DETAILS', 120, 60);
  doc.setFontSize(10);
  doc.text(`Name: ${patientInfo.name}`, 120, 67);
  doc.text(`Date: ${rxDetails.issuedAt.toLocaleDateString()}`, 120, 74);

  // Rx Symbol
  doc.setFontSize(30);
  doc.setTextColor(99, 102, 241);
  doc.text('Rx', 20, 100);

  // Diagnosis
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text('DIAGNOSIS:', 20, 115);
  doc.setFontSize(11);
  doc.text(rxDetails.diagnosis, 20, 125);

  // Medicines Table
  const tableData = rxDetails.medicines.map((med, index) => [
    index + 1,
    med.name || 'N/A',
    med.dosage || 'As directed',
    med.duration || 'N/A',
    med.instructions || '-'
  ]);

  autoTable(doc, {
    startY: 140,
    head: [['#', 'Medicine Name', 'Dosage', 'Duration', 'Instructions']],
    body: tableData.length > 0 ? tableData : [['-', 'No medicines prescribed', '-', '-', '-']],
    headStyles: { fillColor: [99, 102, 241] },
    alternateRowStyles: { fillColor: [245, 247, 255] }
  });

  // Advice
  const finalY = doc.lastAutoTable?.finalY || 140;
  doc.setFontSize(12);
  doc.text('ADVICE / INSTRUCTIONS:', 20, finalY + 20);
  doc.setFontSize(11);
  doc.text(rxDetails.advice, 20, finalY + 30, { maxWidth: pageWidth - 40 });

  // Footer
  doc.setFontSize(9);
  doc.setTextColor(150);
  doc.text('This is a digitally generated prescription.', pageWidth / 2, 280, { align: 'center' });
  doc.text('DoctorConnect Consultation Platform', pageWidth / 2, 285, { align: 'center' });

  // Save the PDF
  const filename = `Prescription_${patientInfo.name.replace(/\s+/g, '_')}_${new Date().getTime()}.pdf`;
  doc.save(filename);
};
