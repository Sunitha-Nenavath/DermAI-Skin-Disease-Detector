"""
backend/routers/reports.py
Clinical decision support reporting router: Server-side PDF generation (ReportLab),
JSON diagnostic report export, and CSV tabular export.
Regulatory Disclaimer: AI-assisted analysis, not a standalone medical diagnosis.
"""

import io
import json
import csv
import base64
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Image as RLImage,
    KeepTogether,
    HRFlowable
)

from backend.database import get_db
from backend.models import Case, Patient, Image, Analysis, User, UserRole
from backend.auth import get_current_user, log_audit_event, get_client_ip
from backend.config import settings

router = APIRouter(prefix="/cases", tags=["Reports & Exports"])

MANDATORY_DISCLAIMER = "AI-assisted analysis, not a standalone medical diagnosis."


def b64_to_rl_image(b64_str: Optional[str], width: float = 140, height: float = 140) -> Optional[RLImage]:
    if not b64_str:
        return None
    try:
        if "," in b64_str:
            b64_str = b64_str.split(",", 1)[1]
        img_bytes = base64.b64decode(b64_str)
        return RLImage(io.BytesIO(img_bytes), width=width, height=height)
    except Exception:
        return None


def add_pdf_decorations(canvas, doc):
    canvas.saveState()
    # Running Header
    canvas.setFont("Helvetica-Bold", 8)
    canvas.setFillColor(colors.HexColor("#0B1F3A"))
    canvas.drawString(36, doc.height + 44, "DermAI Clinical Decision-Support Platform")
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#64748B"))
    canvas.drawRightString(doc.width + 36, doc.height + 44, MANDATORY_DISCLAIMER)
    canvas.setStrokeColor(colors.HexColor("#CBD5E1"))
    canvas.setLineWidth(0.5)
    canvas.line(36, doc.height + 38, doc.width + 36, doc.height + 38)

    # Running Footer
    canvas.setStrokeColor(colors.HexColor("#CBD5E1"))
    canvas.setLineWidth(0.5)
    canvas.line(36, 42, doc.width + 36, 42)
    canvas.setFont("Helvetica-Bold", 8)
    canvas.setFillColor(colors.HexColor("#0B1F3A"))
    canvas.drawString(36, 30, f"MANDATORY CLINICAL NOTICE: {MANDATORY_DISCLAIMER}")
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(colors.HexColor("#64748B"))
    canvas.drawString(
        36, 18,
        "Screening and research decision-support only. Autonomous diagnosis prohibited. Clinical decisions require physician validation."
    )
    canvas.drawRightString(doc.width + 36, 18, f"Page {doc.page}")
    canvas.restoreState()


@router.get("/{id}/report.pdf")
def export_case_pdf(
    id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    case = db.query(Case).filter(Case.id == id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case record not found.")

    if current_user.role == UserRole.PATIENT.value and case.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    patient = case.patient
    latest_img = db.query(Image).filter(Image.case_id == case.id).order_by(desc(Image.id)).first()
    latest_analysis = db.query(Analysis).filter(Analysis.case_id == case.id).order_by(desc(Analysis.id)).first()

    analysis_data = {}
    if latest_analysis and latest_analysis.prediction_json:
        try:
            analysis_data = json.loads(latest_analysis.prediction_json)
        except Exception:
            pass

    # Build PDF buffer
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#0B1F3A"),
    )
    subtitle_style = ParagraphStyle(
        "DocSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=13,
        textColor=colors.HexColor("#0E9F8E"),
    )
    section_h2 = ParagraphStyle(
        "SectionH2",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#0B1F3A"),
        spaceBefore=10,
        spaceAfter=4,
    )
    body_style = ParagraphStyle(
        "BodyTextCustom",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#334155"),
    )
    disclaimer_style = ParagraphStyle(
        "DisclaimerCallout",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#991B1B"),
    )
    disclaimer_body = ParagraphStyle(
        "DisclaimerBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#7F1D1D"),
    )

    elements = []

    # Title Banner Table
    banner_data = [
        [
            Paragraph("<b>DermAI: Clinical Decision Support Report</b>", title_style),
            Paragraph(f"<b>Generated:</b> {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}<br/><b>Case ID:</b> {case.case_code}", body_style)
        ],
        [
            Paragraph("AI-Assisted Skin Lesion Screening & Risk Stratification · HAM10000 Protocol", subtitle_style),
            Paragraph(f"<b>Reviewer:</b> {current_user.full_name} ({current_user.role})", body_style)
        ]
    ]
    t_banner = Table(banner_data, colWidths=[360, 180])
    t_banner.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
    ]))
    elements.append(t_banner)
    elements.append(Spacer(1, 10))

    # Prominent Disclaimer Callout Box (Red/Rose Warning Box)
    disclaimer_table_data = [[
        Paragraph(f"<b>MANDATORY NOTICE: {MANDATORY_DISCLAIMER}</b><br/>"
                  "This report is an AI-assisted screening decision-support aid and is NOT a standalone diagnostic tool. "
                  "Autonomous medical decisions are strictly prohibited. Results must be clinically correlated by a licensed dermatologist or medical provider.",
                  disclaimer_style)
    ]]
    t_disc = Table(disclaimer_table_data, colWidths=[540])
    t_disc.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FEF2F2")),
        ("BOX", (0, 0), (-1, -1), 1.5, colors.HexColor("#F87171")),
        ("PADDING", (0, 0), (-1, -1), 8),
    ]))
    elements.append(t_disc)
    elements.append(Spacer(1, 12))

    # Section 1: De-Identified Subject & Case Profile
    elements.append(Paragraph("1. De-Identified Case Profile & Specimen Metadata", section_h2))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#E2E8F0"), spaceAfter=8))

    pat_code = patient.case_code if patient else "N/A"
    pat_age = f"{patient.age} yrs" if patient and patient.age is not None else "Unknown"
    pat_gender = patient.gender.capitalize() if patient and patient.gender else "Unknown"
    qual_label = latest_img.quality_label if latest_img else "Not Assessed"

    profile_data = [
        ["Case Code:", case.case_code, "Subject Identifier:", pat_code],
        ["Anatomical Region:", case.body_location.title(), "Patient Age / Gender:", f"{pat_age} / {pat_gender}"],
        ["Record Status:", case.status.replace("_", " ").title(), "Image Quality Gate:", qual_label],
        ["Acquisition Date:", case.created_at.strftime("%Y-%m-%d %H:%M"), "Regulatory Class:", "Screening Decision-Support (Non-Diagnostic)"]
    ]
    t_profile = Table(profile_data, colWidths=[110, 160, 120, 150])
    t_profile.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#1E293B")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8FAFC")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#F1F5F9")),
    ]))
    elements.append(t_profile)
    elements.append(Spacer(1, 12))

    # Section 2: AI Screening Results & Risk Stratification
    elements.append(Paragraph("2. Deep Learning Screening Findings & Risk Stratification", section_h2))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#E2E8F0"), spaceAfter=8))

    has_analysis = latest_analysis is not None
    pred_condition = latest_analysis.predicted_condition if has_analysis else "No trained model available"
    model_ver = latest_analysis.model_version if has_analysis else "N/A"
    confidence_val = f"{latest_analysis.confidence * 100:.1f}%" if has_analysis and latest_analysis.confidence else "N/A"
    risk_cat = latest_analysis.risk_category if has_analysis else "Requires Clinical Review"

    # Color code risk tag
    risk_color = colors.HexColor("#0E9F8E")
    if "High" in risk_cat:
        risk_color = colors.HexColor("#DC2626")
    elif "Moderate" in risk_cat:
        risk_color = colors.HexColor("#D97706")
    elif "Clinical Review" in risk_cat:
        risk_color = colors.HexColor("#7C3AED")

    findings_data = [
        [
            Paragraph("<b>Primary AI Finding:</b>", body_style),
            Paragraph(f"<b><font size=11 color='#0B1F3A'>{pred_condition}</font></b>", body_style),
            Paragraph("<b>Model Version:</b>", body_style),
            Paragraph(model_ver, body_style)
        ],
        [
            Paragraph("<b>Model Confidence:</b>", body_style),
            Paragraph(f"<b>{confidence_val}</b>", body_style),
            Paragraph("<b>Risk Stratification:</b>", body_style),
            Paragraph(f"<b><font color='{risk_color.hexval()}'>{risk_cat}</font></b>", body_style)
        ]
    ]
    t_findings = Table(findings_data, colWidths=[120, 150, 110, 160])
    t_findings.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F0FDFA")),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#99F6E4")),
        ("PADDING", (0, 0), (-1, -1), 6),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    elements.append(t_findings)
    elements.append(Spacer(1, 10))

    # Section 3: Top-3 Differential Diagnosis Distribution
    top3_list = analysis_data.get("top3", [])
    if top3_list:
        elements.append(Paragraph("<b>Differential Diagnosis Probabilities (Top-3)</b>", body_style))
        elements.append(Spacer(1, 4))
        diff_data = [["Rank", "Class Code", "Condition Name", "Probability Score"]]
        for i, item in enumerate(top3_list, 1):
            code = item.get("class_code") or item.get("label", "N/A")
            name = item.get("name") or item.get("label_name", "N/A")
            prob = item.get("confidence") or item.get("probability", 0)
            diff_data.append([str(i), code.upper(), name, f"{prob * 100:.2f}%"])

        t_diff = Table(diff_data, colWidths=[40, 80, 260, 160])
        t_diff.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0B1F3A")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("PADDING", (0, 0), (-1, -1), 4),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E2E8F0")),
        ]))
        elements.append(t_diff)
        elements.append(Spacer(1, 12))

    # Section 4: Visual Interpretability & Segmentation Maps
    preproc_b64 = analysis_data.get("preprocessed_image_b64")
    mask_b64 = analysis_data.get("mask_png_b64") or analysis_data.get("mask_png_base64")
    cam_b64 = analysis_data.get("heatmap_png_b64") or analysis_data.get("heatmap_png_base64")

    img_cells = []
    headers = []
    if preproc_b64:
        rl_prep = b64_to_rl_image(preproc_b64, 150, 150)
        if rl_prep:
            img_cells.append(rl_prep)
            headers.append(Paragraph("<b>Standardized Lesion</b>", body_style))
    if mask_b64:
        rl_mask = b64_to_rl_image(mask_b64, 150, 150)
        if rl_mask:
            img_cells.append(rl_mask)
            headers.append(Paragraph("<b>Otsu Lesion Boundary</b>", body_style))
    if cam_b64:
        rl_cam = b64_to_rl_image(cam_b64, 150, 150)
        if rl_cam:
            img_cells.append(rl_cam)
            headers.append(Paragraph("<b>Grad-CAM++ Attention</b>", body_style))

    if img_cells:
        elements.append(Paragraph("3. Lesion Morphology & Interpretability Evidence", section_h2))
        elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#E2E8F0"), spaceAfter=8))
        img_table = Table([headers, img_cells], colWidths=[180] * len(img_cells))
        img_table.setStyle(TableStyle([
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
        ]))
        elements.append(KeepTogether(img_table))
        elements.append(Spacer(1, 12))

    # Section 5: Clinical Notes
    elements.append(Paragraph("4. Clinical Progress Notes & Physician Directives", section_h2))
    elements.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#E2E8F0"), spaceAfter=8))
    notes_text = patient.clinical_notes if patient and patient.clinical_notes else "No clinical notes appended."
    elements.append(Paragraph(notes_text.replace("\n", "<br/>"), body_style))

    # Build PDF
    doc.build(elements, onFirstPage=add_pdf_decorations, onLaterPages=add_pdf_decorations)

    buf.seek(0)
    filename = f"DermAI_Report_{case.case_code}.pdf"

    # Audit log
    ip = get_client_ip(request)
    log_audit_event(
        db=db,
        action="REPORT_PDF_DOWNLOAD",
        entity="case",
        entity_id=case.case_code,
        user_id=current_user.id,
        ip=ip
    )

    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/{id}/report.json")
def export_case_json(
    id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    case = db.query(Case).filter(Case.id == id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case record not found.")

    if current_user.role == UserRole.PATIENT.value and case.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    patient = case.patient
    latest_img = db.query(Image).filter(Image.case_id == case.id).order_by(desc(Image.id)).first()
    latest_analysis = db.query(Analysis).filter(Analysis.case_id == case.id).order_by(desc(Analysis.id)).first()

    analysis_payload = {}
    if latest_analysis and latest_analysis.prediction_json:
        try:
            analysis_payload = json.loads(latest_analysis.prediction_json)
        except Exception:
            pass

    report = {
        "report_title": "DermAI Dermatological Screening Report",
        "case_id": case.id,
        "case_code": case.case_code,
        "anatomical_site": case.body_location,
        "status": case.status,
        "created_at": case.created_at.isoformat(),
        "generated_at": datetime.utcnow().isoformat(),
        "disclaimer": MANDATORY_DISCLAIMER,
        "patient_profile": {
            "case_code": patient.case_code if patient else None,
            "age": patient.age if patient else None,
            "gender": patient.gender if patient else None,
            "medical_history": patient.medical_history if patient else None,
            "allergies": patient.allergies if patient else None,
            "clinical_notes": patient.clinical_notes if patient else None,
        },
        "latest_image": {
            "id": latest_img.id if latest_img else None,
            "quality_label": latest_img.quality_label if latest_img else None,
            "quality_metrics": json.loads(latest_img.quality_metrics_json) if latest_img and latest_img.quality_metrics_json else {},
        } if latest_img else None,
        "ai_prediction": {
            "model_version": latest_analysis.model_version if latest_analysis else None,
            "predicted_condition": latest_analysis.predicted_condition if latest_analysis else "No trained model available",
            "confidence": latest_analysis.confidence if latest_analysis else None,
            "risk_category": latest_analysis.risk_category if latest_analysis else "Requires Clinical Review",
            "top3": analysis_payload.get("top3", []),
            "disclaimer": MANDATORY_DISCLAIMER,
        } if latest_analysis else None,
    }

    # Audit log
    ip = get_client_ip(request)
    log_audit_event(db=db, action="REPORT_JSON_DOWNLOAD", entity="case", entity_id=case.case_code, user_id=current_user.id, ip=ip)

    return report


@router.get("/{id}/report.csv")
def export_case_csv(
    id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    case = db.query(Case).filter(Case.id == id).first()
    if not case:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Case record not found.")

    if current_user.role == UserRole.PATIENT.value and case.owner_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    patient = case.patient
    latest_img = db.query(Image).filter(Image.case_id == case.id).order_by(desc(Image.id)).first()
    latest_analysis = db.query(Analysis).filter(Analysis.case_id == case.id).order_by(desc(Analysis.id)).first()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Parameter", "Value"])
    writer.writerow(["Case Code", case.case_code])
    writer.writerow(["Case Title", case.title])
    writer.writerow(["Anatomical Region", case.body_location])
    writer.writerow(["Workflow Status", case.status])
    writer.writerow(["Created At", case.created_at.isoformat()])
    writer.writerow(["Patient Age", patient.age if patient and patient.age is not None else "N/A"])
    writer.writerow(["Patient Gender", patient.gender if patient else "N/A"])
    writer.writerow(["Image Quality Label", latest_img.quality_label if latest_img else "N/A"])
    writer.writerow(["Predicted Condition", latest_analysis.predicted_condition if latest_analysis else "No trained model available"])
    writer.writerow(["Model Confidence", f"{latest_analysis.confidence * 100:.2f}%" if latest_analysis and latest_analysis.confidence else "N/A"])
    writer.writerow(["Risk Stratification", latest_analysis.risk_category if latest_analysis else "Requires Clinical Review"])
    writer.writerow(["Model Version", latest_analysis.model_version if latest_analysis else "N/A"])
    writer.writerow(["Regulatory Disclaimer", MANDATORY_DISCLAIMER])

    output.seek(0)
    filename = f"DermAI_Report_{case.case_code}.csv"

    # Audit log
    ip = get_client_ip(request)
    log_audit_event(db=db, action="REPORT_CSV_DOWNLOAD", entity="case", entity_id=case.case_code, user_id=current_user.id, ip=ip)

    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8")),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
