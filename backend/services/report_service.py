import logging
from io import BytesIO
from datetime import datetime
from sqlalchemy.orm import Session
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas
from backend.models.terraform import TerraformFile, TerraformResource, SecurityFinding, CostFinding, AIInsight
from backend.services.gemini_service import analyze_finding

logger = logging.getLogger("backend.services.report")

class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas to calculate total page count and add headers/footers dynamically.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_elements(num_pages)
            super().showPage()
        super().save()

    def draw_page_elements(self, page_count):
        self.saveState()
        
        # Define palette colors
        primary_color = colors.HexColor("#0f172a")    # Slate 900
        secondary_color = colors.HexColor("#64748b")  # Slate 500
        accent_color = colors.HexColor("#3b82f6")     # Blue 500
        
        # Header (Only on page 2 onwards, or all pages since it's a short report)
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(primary_color)
        self.drawString(54, 750, "INFRASIGHT SECURITY COMPLIANCE REPORT")
        
        self.setStrokeColor(colors.HexColor("#e2e8f0")) # Slate 200
        self.setLineWidth(0.5)
        self.line(54, 742, 558, 742)
        
        # Footer line
        self.line(54, 55, 558, 55)
        
        # Footer text
        self.setFont("Helvetica", 8)
        self.setFillColor(secondary_color)
        self.drawString(54, 42, f"Report Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | Classification: Confidential")
        
        # Page numbers
        page_num_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(558, 42, page_num_str)
        
        self.restoreState()

def generate_pdf_report(db: Session, tf_file: TerraformFile) -> BytesIO:
    """
    Generates a beautifully formatted PDF report containing findings from security analysis.
    """
    buffer = BytesIO()
    
    # Page dimensions details:
    # Letter size: 612 x 792 pt
    # Left/Right margins: 54 pt (0.75 in) -> Printable width = 504 pt
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=70,
        bottomMargin=70
    )
    
    styles = getSampleStyleSheet()
    
    # Custom stylesheet elements
    normal_style = ParagraphStyle(
        'ReportNormal',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#334155")
    )
    
    title_style = ParagraphStyle(
        'ReportTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=5
    )
    
    subtitle_style = ParagraphStyle(
        'ReportSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#4b5563"),
        spaceAfter=15
    )
    
    section_heading = ParagraphStyle(
        'ReportSectionHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=14,
        leading=18,
        textColor=colors.HexColor("#1e293b"),
        spaceBefore=15,
        spaceAfter=10,
        keepWithNext=True
    )
    
    meta_label = ParagraphStyle(
        'MetaLabel',
        parent=normal_style,
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#475569")
    )
    
    meta_val = ParagraphStyle(
        'MetaValue',
        parent=normal_style,
        fontName='Helvetica-Oblique',
        fontSize=9,
        leading=13,
        textColor=colors.HexColor("#1e293b")
    )

    code_style = ParagraphStyle(
        'CodeBlock',
        parent=normal_style,
        fontName='Courier',
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#0f172a"),
        backColor=colors.HexColor("#f1f5f9"),
        borderColor=colors.HexColor("#cbd5e1"),
        borderWidth=0.5,
        borderPadding=6,
        spaceBefore=5,
        spaceAfter=5
    )
    
    story = []
    
    # Title & Header Block
    story.append(Spacer(1, 10))
    story.append(Paragraph("InfraSight Compliance & Security Report", title_style))
    story.append(Paragraph(f"Terraform Security Scan Analysis for <b>{tf_file.file_name}</b>", subtitle_style))
    
    # Gather counts
    resources = db.query(TerraformResource).filter(TerraformResource.file_id == tf_file.id).all()
    findings = db.query(SecurityFinding).filter(SecurityFinding.file_id == tf_file.id).all()
    cost_findings = db.query(CostFinding).filter(CostFinding.file_id == tf_file.id).all()
    
    potential_savings = sum(f.estimated_monthly_cost for f in cost_findings)
    
    crit_count = sum(1 for f in findings if f.severity == "Critical")
    high_count = sum(1 for f in findings if f.severity == "High")
    med_count = sum(1 for f in findings if f.severity == "Medium")
    low_count = sum(1 for f in findings if f.severity == "Low")
    
    # Metadata Overview Table
    meta_summary_data = [
        [Paragraph("<b>File Name:</b>", meta_label), Paragraph(tf_file.file_name, normal_style),
         Paragraph("<b>Date Scanned:</b>", meta_label), Paragraph(tf_file.upload_time.strftime('%Y-%m-%d %H:%M'), normal_style)],
        [Paragraph("<b>Total Resources:</b>", meta_label), Paragraph(str(len(resources)), normal_style),
         Paragraph("<b>Security Findings:</b>", meta_label), Paragraph(str(len(findings)), normal_style)],
        [Paragraph("<b>Cost Findings:</b>", meta_label), Paragraph(str(len(cost_findings)), normal_style),
         Paragraph("<b>Potential Savings:</b>", meta_label), Paragraph(f"<b>${potential_savings:.2f}/mo</b>", normal_style)]
     ]
    
    meta_summary_table = Table(meta_summary_data, colWidths=[110, 142, 110, 142])
    meta_summary_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 6),
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
        ('LINEBELOW', (0,0), (-1,-2), 0.5, colors.HexColor('#e2e8f0')),
    ]))
    story.append(meta_summary_table)
    story.append(Spacer(1, 15))
    
    # Severity Count Table
    story.append(Paragraph("Security Assessment Summary", section_heading))
    
    severity_summary_data = [
        [
            Paragraph("<b>CRITICAL</b>", ParagraphStyle('CR', parent=normal_style, fontName='Helvetica-Bold', textColor=colors.HexColor("#b91c1c"), alignment=1)),
            Paragraph("<b>HIGH</b>", ParagraphStyle('HI', parent=normal_style, fontName='Helvetica-Bold', textColor=colors.HexColor("#c2410c"), alignment=1)),
            Paragraph("<b>MEDIUM</b>", ParagraphStyle('MD', parent=normal_style, fontName='Helvetica-Bold', textColor=colors.HexColor("#a16207"), alignment=1)),
            Paragraph("<b>LOW</b>", ParagraphStyle('LO', parent=normal_style, fontName='Helvetica-Bold', textColor=colors.HexColor("#1d4ed8"), alignment=1)),
        ],
        [
            Paragraph(f"<b>{crit_count}</b>", ParagraphStyle('CR_val', parent=normal_style, fontName='Helvetica-Bold', fontSize=14, alignment=1)),
            Paragraph(f"<b>{high_count}</b>", ParagraphStyle('HI_val', parent=normal_style, fontName='Helvetica-Bold', fontSize=14, alignment=1)),
            Paragraph(f"<b>{med_count}</b>", ParagraphStyle('MD_val', parent=normal_style, fontName='Helvetica-Bold', fontSize=14, alignment=1)),
            Paragraph(f"<b>{low_count}</b>", ParagraphStyle('LO_val', parent=normal_style, fontName='Helvetica-Bold', fontSize=14, alignment=1)),
        ]
    ]
    
    severity_summary_table = Table(severity_summary_data, colWidths=[126, 126, 126, 126])
    severity_summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (0,-1), colors.HexColor("#fee2e2")), # Critical light red
        ('BACKGROUND', (1,0), (1,-1), colors.HexColor("#ffedd5")), # High light orange
        ('BACKGROUND', (2,0), (2,-1), colors.HexColor("#fef9c3")), # Medium light yellow
        ('BACKGROUND', (3,0), (3,-1), colors.HexColor("#dbeafe")), # Low light blue
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('PADDING', (0,0), (-1,-1), 8),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
    ]))
    story.append(severity_summary_table)
    story.append(Spacer(1, 20))
    
    # Findings Details
    story.append(Paragraph("Vulnerabilities & Findings Details", section_heading))
    
    if not findings:
        no_findings_style = ParagraphStyle(
            'NoFindings',
            parent=normal_style,
            fontName='Helvetica-Bold',
            fontSize=10,
            textColor=colors.HexColor("#15803d") # Green
        )
        no_findings_table = Table([[Paragraph("✔ No security issues or violations were detected in this configuration.", no_findings_style)]], colWidths=[504])
        no_findings_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f0fdf4")),
            ('PADDING', (0,0), (-1,-1), 10),
            ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#bbf7d0")),
        ]))
        story.append(no_findings_table)
    else:
        severity_colors = {
            "Critical": (colors.HexColor("#fee2e2"), colors.HexColor("#991b1b")),
            "High": (colors.HexColor("#ffedd5"), colors.HexColor("#9a3412")),
            "Medium": (colors.HexColor("#fef9c3"), colors.HexColor("#854d0e")),
            "Low": (colors.HexColor("#dbeafe"), colors.HexColor("#1e40af")),
        }
        
        for idx, finding in enumerate(findings):
            bg_color, text_color = severity_colors.get(finding.severity, (colors.HexColor("#f1f5f9"), colors.HexColor("#334155")))
            
            badge_style = ParagraphStyle(
                f'Badge_{finding.id}',
                parent=normal_style,
                fontName='Helvetica-Bold',
                fontSize=8,
                leading=11,
                textColor=text_color,
                alignment=1
            )
            
            finding_title_style = ParagraphStyle(
                f'Title_{finding.id}',
                parent=normal_style,
                fontName='Helvetica-Bold',
                fontSize=10,
                leading=14,
                textColor=colors.HexColor("#0f172a")
            )
            
            # Header table
            header_table = Table([
                [Paragraph(finding.title, finding_title_style), Paragraph(finding.severity.upper(), badge_style)]
            ], colWidths=[404, 100])
            
            header_table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,-1), bg_color),
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('PADDING', (0,0), (-1,-1), 6),
                ('BOTTOMPADDING', (0,0), (-1,-1), 8),
                ('TOPPADDING', (0,0), (-1,-1), 8),
                ('LEFTPADDING', (0,0), (0,0), 10),
                ('RIGHTPADDING', (-1,-1), (-1,-1), 10),
                ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
            ]))
            
            # Details block
            details_data = [
                [Paragraph("<b>Resource Name:</b>", meta_label), Paragraph(finding.resource_name, meta_val)],
                [Paragraph("<b>Resource Type:</b>", meta_label), Paragraph(finding.resource_type, meta_val)],
                [Paragraph("<b>Description:</b>", meta_label), Paragraph(finding.description, normal_style)],
                [Paragraph("<b>Recommendation:</b>", meta_label), Paragraph(finding.recommendation, normal_style)],
            ]
            
            details_table = Table(details_data, colWidths=[110, 394])
            details_table.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('TOPPADDING', (0,0), (-1,-1), 5),
                ('BOTTOMPADDING', (0,0), (-1,-1), 5),
                ('LEFTPADDING', (0,0), (-1,-1), 10),
                ('RIGHTPADDING', (0,0), (-1,-1), 10),
                ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
                ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
                ('LINEBELOW', (0,0), (-1,-2), 0.5, colors.HexColor('#f1f5f9')),
            ]))
            
            # Keep header and details tables together to prevent breaking across pages
            story.append(KeepTogether([
                header_table,
                details_table,
                Spacer(1, 15)
            ]))
            
    # Cost Findings Details
    story.append(Paragraph("Cost Optimization Findings", section_heading))
    
    if not cost_findings:
        no_cost_findings_style = ParagraphStyle(
            'NoCostFindings',
            parent=normal_style,
            fontName='Helvetica-Bold',
            fontSize=10,
            textColor=colors.HexColor("#15803d") # Green
        )
        no_cost_table = Table([[Paragraph("✔ No cost optimization opportunities detected.", no_cost_findings_style)]], colWidths=[504])
        no_cost_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f0fdf4")),
            ('PADDING', (0,0), (-1,-1), 10),
            ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor("#bbf7d0")),
        ]))
        story.append(no_cost_table)
    else:
        for idx, finding in enumerate(cost_findings):
            badge_style = ParagraphStyle(
                f'CostBadge_{finding.id}',
                parent=normal_style,
                fontName='Helvetica-Bold',
                fontSize=8,
                leading=11,
                textColor=colors.HexColor("#16a34a"), # Green 600
                alignment=1
            )
            
            finding_title_style = ParagraphStyle(
                f'CostTitle_{finding.id}',
                parent=normal_style,
                fontName='Helvetica-Bold',
                fontSize=10,
                leading=14,
                textColor=colors.HexColor("#0f172a")
            )
            
            # Header table
            badge_text = f"SAVINGS: ${finding.estimated_monthly_cost:.2f}/MO"
            header_table = Table([
                [Paragraph(finding.title, finding_title_style), Paragraph(badge_text, badge_style)]
            ], colWidths=[354, 150])
            
            header_table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f0fdf4")), # Light green
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('PADDING', (0,0), (-1,-1), 6),
                ('BOTTOMPADDING', (0,0), (-1,-1), 8),
                ('TOPPADDING', (0,0), (-1,-1), 8),
                ('LEFTPADDING', (0,0), (0,0), 10),
                ('RIGHTPADDING', (-1,-1), (-1,-1), 10),
                ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#bbf7d0')),
            ]))
            
            # Details block
            details_data = [
                [Paragraph("<b>Resource Name:</b>", meta_label), Paragraph(finding.resource_name, meta_val)],
                [Paragraph("<b>Resource Type:</b>", meta_label), Paragraph(finding.resource_type, meta_val)],
                [Paragraph("<b>Description:</b>", meta_label), Paragraph(finding.description, normal_style)],
                [Paragraph("<b>Recommendation:</b>", meta_label), Paragraph(finding.recommendation, normal_style)],
            ]
            
            details_table = Table(details_data, colWidths=[110, 394])
            details_table.setStyle(TableStyle([
                ('VALIGN', (0,0), (-1,-1), 'TOP'),
                ('TOPPADDING', (0,0), (-1,-1), 5),
                ('BOTTOMPADDING', (0,0), (-1,-1), 5),
                ('LEFTPADDING', (0,0), (-1,-1), 10),
                ('RIGHTPADDING', (0,0), (-1,-1), 10),
                ('BACKGROUND', (0,0), (-1,-1), colors.HexColor("#f8fafc")),
                ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
                ('LINEBELOW', (0,0), (-1,-2), 0.5, colors.HexColor('#f1f5f9')),
            ]))
            
            story.append(KeepTogether([
                header_table,
                details_table,
                Spacer(1, 15)
            ]))

    # --- AI INSIGHTS ENHANCEMENTS ---
    ai_insights = {}
    for f in findings:
        insight = db.query(AIInsight).filter(
            AIInsight.finding_id == f.id,
            AIInsight.finding_type == "security"
        ).first()
        if not insight:
            try:
                res = analyze_finding(f, "security")
                insight = AIInsight(
                    finding_id=f.id,
                    finding_type="security",
                    prompt=f"PDF generation analyze security: {f.title}",
                    response=res
                )
                db.add(insight)
                db.commit()
                db.refresh(insight)
            except Exception as exc:
                logger.error(f"Error generating insight for security finding {f.id}: {exc}")
                insight = None
        if insight:
            ai_insights[(f.id, "security")] = insight.response

    for f in cost_findings:
        insight = db.query(AIInsight).filter(
            AIInsight.finding_id == f.id,
            AIInsight.finding_type == "cost"
        ).first()
        if not insight:
            try:
                res = analyze_finding(f, "cost")
                insight = AIInsight(
                    finding_id=f.id,
                    finding_type="cost",
                    prompt=f"PDF generation analyze cost: {f.title}",
                    response=res
                )
                db.add(insight)
                db.commit()
                db.refresh(insight)
            except Exception as exc:
                logger.error(f"Error generating insight for cost finding {f.id}: {exc}")
                insight = None
        if insight:
            ai_insights[(f.id, "cost")] = insight.response

    def format_code_snippet(code: str) -> str:
        if not code:
            return ""
        escaped = code.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        formatted = escaped.replace("\n", "<br/>").replace(" ", "&nbsp;")
        return formatted

    # 1. AI Security Recommendations
    sec_insights = [ai_insights[(f.id, "security")] for f in findings if (f.id, "security") in ai_insights]
    if sec_insights:
        story.append(KeepTogether([
            Paragraph("AI Security Recommendations", section_heading),
            Spacer(1, 5)
        ]))
        for f in findings:
            resp = ai_insights.get((f.id, "security"))
            if not resp:
                continue
            why_matters = resp.get("why_this_matters") or resp.get("attack_surface_explanation") or ""
            bus_impact = resp.get("business_impact") or ""
            rec_fix = resp.get("recommended_fix") or ""
            
            finding_text = f"<b>Finding:</b> {f.title} ({f.resource_name})"
            details_content = [
                Paragraph(finding_text, normal_style),
                Paragraph(f"<b>Why This Matters:</b> {why_matters}", normal_style),
                Paragraph(f"<b>Business Impact:</b> {bus_impact}", normal_style),
                Paragraph(f"<b>Recommended Action:</b> {rec_fix}", normal_style),
                Spacer(1, 10)
            ]
            story.append(KeepTogether(details_content))

    # 2. AI Cost Optimization Recommendations
    c_insights = [ai_insights[(f.id, "cost")] for f in cost_findings if (f.id, "cost") in ai_insights]
    if c_insights:
        story.append(KeepTogether([
            Paragraph("AI Cost Optimization Recommendations", section_heading),
            Spacer(1, 5)
        ]))
        for f in cost_findings:
            resp = ai_insights.get((f.id, "cost"))
            if not resp:
                continue
            concern = resp.get("cost_concern") or resp.get("cost_waste_explanation") or ""
            impact = resp.get("estimated_impact") or resp.get("estimated_monthly_savings") or f"Potential savings: ${f.estimated_monthly_cost:.2f}/mo"
            suggestion = resp.get("optimization_suggestion") or resp.get("cleanup_recommendation") or ""
            
            finding_text = f"<b>Resource:</b> {f.resource_name} (-${f.estimated_monthly_cost:.2f}/mo)"
            details_content = [
                Paragraph(finding_text, normal_style),
                Paragraph(f"<b>Cost Concern:</b> {concern}", normal_style),
                Paragraph(f"<b>Financial Impact:</b> {impact}", normal_style),
                Paragraph(f"<b>Optimization Suggestion:</b> {suggestion}", normal_style),
                Spacer(1, 10)
            ]
            story.append(KeepTogether(details_content))

    # 3. Terraform Remediation Suggestions
    remediation_blocks = []
    for f in findings:
        resp = ai_insights.get((f.id, "security"))
        if not resp:
            continue
        code = resp.get("terraform_example") or resp.get("terraform_fix") or ""
        if code:
            remediation_blocks.append((f.title, f.resource_name, code))
            
    for f in cost_findings:
        resp = ai_insights.get((f.id, "cost"))
        if not resp:
            continue
        code = resp.get("alternative_resource_recommendation") or ""
        if code:
            remediation_blocks.append((f.title, f.resource_name, code))
            
    if remediation_blocks:
        story.append(KeepTogether([
            Paragraph("Terraform Remediation Suggestions", section_heading),
            Spacer(1, 5)
        ]))
        for title, resource, code in remediation_blocks:
            code_fmt = format_code_snippet(code)
            block_content = [
                Paragraph(f"<b>Remediation for:</b> {title} ({resource})", normal_style),
                Paragraph(code_fmt, code_style),
                Spacer(1, 10)
            ]
            story.append(KeepTogether(block_content))

    # 4. Best Practices Summary
    best_practices = []
    for f in findings:
        resp = ai_insights.get((f.id, "security"))
        if resp and resp.get("best_practice"):
            best_practices.append(f"<b>Security ({f.resource_type}):</b> {resp['best_practice']}")
            
    for f in cost_findings:
        resp = ai_insights.get((f.id, "cost"))
        if resp and resp.get("best_practice"):
            best_practices.append(f"<b>Cost ({f.resource_type}):</b> {resp['best_practice']}")
            
    if best_practices:
        story.append(KeepTogether([
            Paragraph("Best Practices Summary", section_heading),
            Spacer(1, 5)
        ]))
        bp_list = []
        for bp in best_practices:
            bp_list.append([Paragraph(f"• {bp}", normal_style)])
            
        bp_table = Table(bp_list, colWidths=[504])
        bp_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('PADDING', (0,0), (-1,-1), 4),
            ('LEFTPADDING', (0,0), (-1,-1), 10),
        ]))
        story.append(KeepTogether([bp_table, Spacer(1, 15)]))

    # Build the document
    doc.build(story, canvasmaker=NumberedCanvas)
    buffer.seek(0)
    return buffer
