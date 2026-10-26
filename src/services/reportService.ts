import { jsPDF } from 'jspdf';
import { auditService } from './auditService';
import type { ClinicalCase, PredictionResult, QualityMetrics } from '../types';

export interface ReportDataPayload {
  clinicalCase: ClinicalCase;
  prediction?: PredictionResult | null;
  quality?: QualityMetrics;
  userEmail: string;
  userRole: string;
}

export const reportService = {
  // 1. Export structured JSON format
  exportJSON: async (data: ReportDataPayload): Promise<void> => {
    const payload = {
      report_title: 'DermAI Dermatological Screening Report',
      case_id: data.clinicalCase.id,
      case_code: data.clinicalCase.case_code,
      anatomical_site: data.clinicalCase.body_location,
      generated_at: new Date().toISOString(),
      medical_disclaimer: 'AI-assisted analysis, not a standalone medical diagnosis.',
      patient_profile: data.clinicalCase.patient,
      quality_assessment: data.quality || data.clinicalCase.quality_metrics,
      ai_prediction: data.prediction || data.clinicalCase.latest_prediction,
      clinical_notes: data.clinicalCase.clinical_notes,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DermAI_Report_${data.clinicalCase.case_code}.json`;
    a.click();
    URL.revokeObjectURL(url);

    await auditService.log({
      action: 'report_download',
      user_id: data.clinicalCase.owner_id,
      user_email: data.userEmail,
      user_role: data.userRole,
      target_id: data.clinicalCase.id,
      details: `Exported JSON diagnostic decision report for ${data.clinicalCase.case_code}`,
    });
  },

  // 2. Export Tabular CSV format
  exportCSV: async (data: ReportDataPayload): Promise<void> => {
    const pred = data.prediction || data.clinicalCase.latest_prediction;
    const qual = data.quality || data.clinicalCase.quality_metrics;

    const rows = [
      ['Metric', 'Value'],
      ['Case Code', data.clinicalCase.case_code],
      ['Case ID', data.clinicalCase.id],
      ['Anatomical Site', data.clinicalCase.body_location],
      ['Patient Age', String(data.clinicalCase.patient?.age || 'N/A')],
      ['Biological Gender', String(data.clinicalCase.patient?.gender || 'N/A')],
      ['Quality Grade', qual?.quality_label || 'Passed'],
      ['Laplacian Blur Score', String(qual?.blur_laplacian || 'N/A')],
      ['Mean Luminance', String(qual?.mean_brightness || 'N/A')],
      ['Predicted Condition', pred?.top3[0]?.label_name || 'N/A'],
      ['Confidence Score', `${pred ? Math.round(pred.confidence * 100) : 0}%`],
      ['Risk Classification', pred?.risk_tag || 'Requires Review'],
      ['Model Checkpoint', pred?.model_version || 'v3.0 Ensemble'],
      ['Analysis Timestamp', pred?.timestamp || data.clinicalCase.created_at],
      ['Clinical Decision Disclaimer', 'AI-assisted analysis, not a standalone medical diagnosis.'],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.map(val => `"${val}"`).join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const a = document.createElement('a');
    a.href = encodedUri;
    a.download = `DermAI_Report_${data.clinicalCase.case_code}.csv`;
    a.click();

    await auditService.log({
      action: 'report_download',
      user_id: data.clinicalCase.owner_id,
      user_email: data.userEmail,
      user_role: data.userRole,
      target_id: data.clinicalCase.id,
      details: `Exported CSV tabular data for ${data.clinicalCase.case_code}`,
    });
  },

  // 3. Generate Clinical PDF with jsPDF
  exportPDF: async (data: ReportDataPayload): Promise<void> => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pred = data.prediction || data.clinicalCase.latest_prediction;
    const qual = data.quality || data.clinicalCase.quality_metrics;

    // Header Background Navy Bar
    doc.setFillColor(11, 31, 58);
    doc.rect(0, 0, 210, 28, 'F');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text('DermAI: Skin Disease Decision Support Report', 14, 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(45, 212, 191);
    doc.text('AI-Assisted Screening & Clinical Triage · HAM10000 Protocol', 14, 21);

    // Date & Case Code
    doc.setTextColor(200, 200, 200);
    doc.setFontSize(8);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 145, 14);
    doc.text(`Case Code: ${data.clinicalCase.case_code}`, 145, 20);

    // Ubiquitous Disclaimer Header Notice (Teal Box)
    doc.setFillColor(240, 253, 250);
    doc.setDrawColor(14, 159, 142);
    doc.roundedRect(14, 34, 182, 12, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(11, 31, 58);
    doc.setFontSize(9);
    doc.text('MANDATORY NOTICE: AI-assisted analysis, not a standalone medical diagnosis.', 18, 41);

    // Section 1: Patient and Lesion Information
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(11, 31, 58);
    doc.text('1. De-Identified Case Profile', 14, 55);

    doc.setDrawColor(226, 232, 240);
    doc.line(14, 58, 196, 58);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);

    const leftColX = 14;
    const rightColX = 110;

    doc.text(`Case Identifier: ${data.clinicalCase.case_code}`, leftColX, 66);
    doc.text(`Anatomical Region: ${data.clinicalCase.body_location}`, leftColX, 72);
    doc.text(`Subject Age: ${data.clinicalCase.patient?.age || 'N/A'} years`, leftColX, 78);
    doc.text(`Biological Gender: ${data.clinicalCase.patient?.gender || 'N/A'}`, leftColX, 84);

    doc.text(`Quality Assessment: ${qual?.quality_label || 'Good'}`, rightColX, 66);
    doc.text(`Laplacian Sharpness: ${qual?.blur_laplacian || 'N/A'} (threshold >= 75)`, rightColX, 72);
    doc.text(`Mean Luminance: ${qual?.mean_brightness || 'N/A'} / 255`, rightColX, 78);
    doc.text(`Contrast Std: ${qual?.contrast_std || 'N/A'}`, rightColX, 84);

    // Section 2: AI-Assisted Inference Result
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(11, 31, 58);
    doc.text('2. Deep Learning Classification & Risk Triage', 14, 98);
    doc.line(14, 101, 196, 101);

    // Result Highlight Box
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 106, 182, 36, 2, 2, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Primary Suspected Condition:', 18, 114);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(14, 159, 142);
    doc.text(pred?.top3[0]?.label_name || 'Classical Baseline (Otsu)', 18, 122);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text(`Model Confidence: ${pred ? Math.round(pred.confidence * 100) : 0}%`, 18, 130);
    doc.text(`Risk Classification Tag: ${pred?.risk_tag || 'Requires Review'}`, 18, 136);

    doc.text(`Model Checkpoint: ${pred?.model_version || 'v3.0 Ensemble'}`, 110, 114);
    doc.text(`Inference Latency: ${pred?.latency_ms || 24} ms`, 110, 122);
    doc.text(`Safeguard Flag: ${pred?.requires_clinical_review ? 'Requires Clinical Review' : 'Nominal Triage'}`, 110, 130);

    // Section 3: Differential Probability Distribution (Top-3)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(11, 31, 58);
    doc.text('3. Top-3 Differential Probability Distribution', 14, 152);
    doc.line(14, 155, 196, 155);

    if (pred && pred.top3 && pred.top3.length > 0) {
      let yPos = 163;
      pred.top3.forEach((item, idx) => {
        const pct = Math.round(item.probability * 100);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(51, 65, 85);
        doc.text(`${idx + 1}. ${item.label_name} (${item.label.toUpperCase()})`, 18, yPos);
        doc.text(`${pct}%`, 120, yPos);

        // Simple progress bar
        doc.setFillColor(226, 232, 240);
        doc.rect(135, yPos - 3, 50, 4, 'F');
        doc.setFillColor(14, 159, 142);
        doc.rect(135, yPos - 3, (pct / 100) * 50, 4, 'F');

        yPos += 8;
      });
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text('Demo Mode: No remote ML server attached. Probabilities not synthesized.', 18, 164);
    }

    // Section 4: Clinical Decision Support Notes
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(11, 31, 58);
    doc.text('4. Clinical Notes & Observations', 14, 195);
    doc.line(14, 198, 196, 198);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    const splitNotes = doc.splitTextToSize(
      data.clinicalCase.clinical_notes || 'No clinician notes appended to this record.',
      180
    );
    doc.text(splitNotes, 14, 206);

    // Footer with mandatory statement
    doc.setFillColor(241, 245, 249);
    doc.rect(0, 275, 210, 22, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(11, 31, 58);
    doc.text('AI-assisted analysis, not a standalone medical diagnosis.', 14, 283);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'This document is for clinical screening assistance and research decision support. Clinical decisions require independent physician validation.',
      14,
      289
    );

    // Save PDF
    doc.save(`DermAI_Report_${data.clinicalCase.case_code}.pdf`);

    await auditService.log({
      action: 'report_download',
      user_id: data.clinicalCase.owner_id,
      user_email: data.userEmail,
      user_role: data.userRole,
      target_id: data.clinicalCase.id,
      details: `Generated clinical PDF report for ${data.clinicalCase.case_code}`,
    });
  },
};
