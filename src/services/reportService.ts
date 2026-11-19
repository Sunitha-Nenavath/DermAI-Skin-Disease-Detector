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

async function imageUrlToDataUrl(src: string): Promise<string | null> {
  try {
    if (src.startsWith('data:image/')) return src;
    const res = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export const reportService = {
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
      ['Predicted Condition', pred && !pred.is_demo_mode ? (pred.top3[0]?.label_name || 'N/A') : 'Demo Mode (No Model Connected)'],
      ['Confidence Score', pred && !pred.is_demo_mode ? `${Math.round(pred.confidence * 100)}%` : 'N/A'],
      ['Risk Classification', pred?.risk_tag || 'Requires Clinical Review'],
      ['Model Checkpoint', pred?.model_version || 'Classical Baseline'],
      ['Analysis Timestamp', pred?.timestamp || data.clinicalCase.created_at],
      ['Clinical Decision Disclaimer', 'AI-assisted analysis, not a standalone medical diagnosis.'],
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      rows.map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(',')).join('\n');
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

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text('DermAI: Skin Disease Decision Support Report', 14, 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(45, 212, 191);
    doc.text('AI-Assisted Screening & Clinical Triage · HAM10000 Protocol', 14, 21);

    doc.setTextColor(200, 200, 200);
    doc.setFontSize(8);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 145, 14);
    doc.text(`Case Code: ${data.clinicalCase.case_code}`, 145, 20);

    // Mandatory Disclaimer Box
    doc.setFillColor(240, 253, 250);
    doc.setDrawColor(14, 159, 142);
    doc.roundedRect(14, 34, 182, 12, 2, 2, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(11, 31, 58);
    doc.setFontSize(9);
    doc.text('MANDATORY NOTICE: AI-assisted analysis, not a standalone medical diagnosis.', 18, 41);

    // Section 1: Case Profile
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(11, 31, 58);
    doc.text('1. De-Identified Case Profile & Image Quality', 14, 55);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 58, 196, 58);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);

    doc.text(`Case Identifier: ${data.clinicalCase.case_code}`, 14, 66);
    doc.text(`Anatomical Region: ${data.clinicalCase.body_location}`, 14, 72);
    doc.text(`Subject Age: ${data.clinicalCase.patient?.age || 'N/A'} years`, 14, 78);
    doc.text(`Biological Gender: ${data.clinicalCase.patient?.gender || 'N/A'}`, 14, 84);

    doc.text(`Quality Assessment: ${qual?.quality_label || 'Good'}`, 110, 66);
    doc.text(`Laplacian Sharpness: ${qual?.blur_laplacian || 'N/A'} (min >= 75)`, 110, 72);
    doc.text(`Mean Luminance: ${qual?.mean_brightness || 'N/A'} / 255`, 110, 78);
    doc.text(`Contrast Std: ${qual?.contrast_std || 'N/A'}`, 110, 84);

    // Section 2: Classification
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(11, 31, 58);
    doc.text('2. Screening Result & Risk Triage', 14, 96);
    doc.line(14, 99, 196, 99);

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 103, 182, 34, 2, 2, 'FD');

    const isDemo = !pred || pred.is_demo_mode;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Primary Finding:', 18, 111);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(14, 159, 142);
    doc.text(
      isDemo ? 'DEMO MODE (No Trained Model Connected)' : (pred?.top3[0]?.label_name || 'N/A'),
      18,
      118
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    doc.text(`Model Confidence: ${isDemo ? 'N/A' : `${Math.round(pred!.confidence * 100)}%`}`, 18, 126);
    doc.text(`Risk Classification Tag: ${pred?.risk_tag || 'Requires Clinical Review'}`, 18, 132);

    doc.text(`Model Version: ${pred?.model_version || 'Classical Baseline'}`, 115, 111);
    doc.text(`Latency: ${pred?.latency_ms || 0} ms`, 115, 118);
    doc.text(`Safeguard: ${pred?.requires_clinical_review ? 'Requires Clinical Review' : 'Nominal'}`, 115, 126);

    // Section 3: Top-3
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(11, 31, 58);
    doc.text('3. Top-3 Differential Probability Distribution', 14, 146);
    doc.line(14, 149, 196, 149);

    if (!isDemo && pred?.top3 && pred.top3.length > 0) {
      let yPos = 156;
      pred.top3.forEach((item, idx) => {
        const pct = Math.round(item.probability * 100);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(51, 65, 85);
        doc.text(`${idx + 1}. ${item.label_name} (${item.label.toUpperCase()})`, 18, yPos);
        doc.text(`${pct}%`, 120, yPos);

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
      doc.text('DEMO MODE: No trained ML model connected. Probabilities not synthesized.', 18, 157);
    }

    // Section 4: Visual Evidence (Lesion + Heatmap / Mask)
    let notesStartY = 186;
    const lesionImgData = data.clinicalCase.image_url
      ? await imageUrlToDataUrl(data.clinicalCase.image_url)
      : null;
    const heatmapImgData = pred?.heatmap_png_base64
      ? `data:image/png;base64,${pred.heatmap_png_base64}`
      : data.clinicalCase.segmentation?.overlayDataUrl || null;

    if (lesionImgData || heatmapImgData) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(11, 31, 58);
      doc.text('4. Lesion Acquisition & Interpretability Snapshot', 14, 180);
      doc.line(14, 183, 196, 183);

      try {
        if (lesionImgData) {
          doc.addImage(lesionImgData, 'JPEG', 18, 187, 36, 36);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.text('Acquired Lesion Image', 18, 227);
        }
        if (heatmapImgData) {
          doc.addImage(heatmapImgData, 'PNG', 66, 187, 36, 36);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.text(pred?.heatmap_png_base64 ? 'Grad-CAM Heatmap' : 'Otsu Lesion Boundary', 66, 227);
        }
        notesStartY = 236;
      } catch {
        notesStartY = 188;
      }
    }

    // Clinical Notes
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(11, 31, 58);
    doc.text('5. Clinical Notes & Summary', 14, notesStartY);
    doc.line(14, notesStartY + 3, 196, notesStartY + 3);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    const splitNotes = doc.splitTextToSize(
      data.clinicalCase.clinical_notes || 'No clinician notes appended to this record.',
      180
    );
    doc.text(splitNotes, 14, notesStartY + 9);

    // Footer
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
