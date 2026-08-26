#!/usr/bin/env python3
import sys, json
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_CENTER

data      = json.loads(sys.argv[1])
output    = sys.argv[2]
stmt_type = data.get('type', 'landlord')
lease     = data.get('lease', {})
invoices  = data.get('invoices', [])
settings  = data.get('settings', {})
tenant_c  = data.get('tenant_contact', {})
landlord  = data.get('landlord', {})

_primary = settings.get('primary_colour', '#0A1A3B')
_accent  = settings.get('accent_colour',  '#1DB8A0')
TEAL  = colors.HexColor(_accent)
DARK  = colors.HexColor(_primary)
LIGHT = colors.HexColor('#F8FAFB')
BORDER= colors.HexColor('#E5E7EB')

doc    = SimpleDocTemplate(output, pagesize=A4, leftMargin=20*mm, rightMargin=20*mm, topMargin=20*mm, bottomMargin=20*mm)
styles = getSampleStyleSheet()
w      = A4[0] - 40*mm
story  = []

company_name = settings.get('company_name', 'Property Management')
company_addr = settings.get('address', '')
company_ph   = settings.get('phone', '')
company_em   = settings.get('email', '')
logo_url     = settings.get('logo_url', '')
title = 'LANDLORD STATEMENT' if stmt_type == 'landlord' else 'DEBTOR STATEMENT'

# Try to download logo
logo_img = None
if logo_url:
    try:
        import urllib.request, tempfile
        from reportlab.platypus import Image as RLImage
        from PIL import Image as PILImage
        logo_path = tempfile.mktemp(suffix='.png')
        urllib.request.urlretrieve(logo_url, logo_path)
        with PILImage.open(logo_path) as img:
            orig_w, orig_h = img.size
        max_w, max_h = 180, 65
        ratio = min(max_w/orig_w, max_h/orig_h)
        logo_img = RLImage(logo_path, width=orig_w*ratio, height=orig_h*ratio)
    except:
        logo_img = None

from datetime import date
period = date.today().strftime('%B %Y')

# Header
if logo_img:
    from reportlab.platypus import Table as RLT, TableStyle as RLTS
    left_cell = RLT([[logo_img],[Paragraph(f'<font size="11" color="{_primary}"><b>{company_name}</b></font>', styles['Normal'])]], colWidths=[w*0.5])
    left_cell.setStyle(RLTS([('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),0),('TOPPADDING',(0,0),(-1,-1),2),('BOTTOMPADDING',(0,0),(-1,-1),2)]))
else:
    left_cell = Paragraph(f'<font size="16" color="{_primary}"><b>{company_name}</b></font><br/><font size="9" color="#6B7280">{company_addr}</font>', styles['Normal'])

hdr = Table([[
    left_cell,
    Paragraph(f'<font size="16" color="{_accent}"><b>{title}</b></font>', ParagraphStyle('r', parent=styles['Normal'], alignment=TA_RIGHT))
]], colWidths=[w*0.6, w*0.4])
hdr.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'MIDDLE')]))
story.append(hdr)
story.append(HRFlowable(width=w, thickness=2, color=TEAL, spaceAfter=4*mm))

# Info
person = landlord if stmt_type == 'landlord' else tenant_c
info = Table([[
    Paragraph(f'<font size="9" color="#6B7280"><b>PROPERTY</b><br/>{lease.get("property","—")} {("Unit "+lease.get("unit","")) if lease.get("unit") else ""}<br/><b>REF:</b> {lease.get("ref","—")}<br/><b>PERIOD:</b> {period}</font>', styles['Normal']),
    Paragraph(f'<font size="9" color="#6B7280"><b>{"LANDLORD" if stmt_type=="landlord" else "TENANT"}</b><br/>{person.get("name","—")}<br/>{person.get("phone","")}<br/>{person.get("email","")}</font>', ParagraphStyle('r', parent=styles['Normal'], alignment=TA_RIGHT))
]], colWidths=[w*0.5, w*0.5])
story.append(info)
story.append(Spacer(1, 6*mm))

if stmt_type == 'debtor':
    rows = [['Ref', 'Type', 'Due Date', 'Paid Date', 'Amount', 'Status']]
    total_owed = total_paid = 0
    for inv in invoices:
        amt = float(inv.get('total', 0))
        status = inv.get('status', 'unpaid')
        if status == 'paid': total_paid += amt
        else: total_owed += amt
        rows.append([inv.get('ref',''), inv.get('invoice_type','Monthly Rental'), inv.get('due_date',''), inv.get('paid_date','—') or '—', f'R {amt:,.2f}', status.upper()])
    rows.append(['','','','Total Paid:', f'R {total_paid:,.2f}',''])
    rows.append(['','','','Outstanding:', f'R {total_owed:,.2f}',''])
    tbl = Table(rows, colWidths=[w*0.12, w*0.2, w*0.13, w*0.13, w*0.15, w*0.12])
    tbl.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0),DARK),('TEXTCOLOR',(0,0),(-1,0),colors.white),
        ('FONTSIZE',(0,0),(-1,-1),9),('TOPPADDING',(0,0),(-1,-1),3*mm),('BOTTOMPADDING',(0,0),(-1,-1),3*mm),('LEFTPADDING',(0,0),(-1,-1),3*mm),
        ('ROWBACKGROUNDS',(0,1),(-1,-3),[colors.white,LIGHT]),('LINEBELOW',(0,0),(-1,-1),0.5,BORDER),
        ('FONTNAME',(0,-2),(-1,-1),'Helvetica-Bold'),
        ('BACKGROUND',(0,-1),(-1,-1),TEAL),('TEXTCOLOR',(0,-1),(-1,-1),colors.white),
    ]))
else:
    monthly = float(lease.get('monthly_rent', 0))
    mgmt_pct = float(lease.get('management_pct') or 7)
    mgmt_amt = monthly * mgmt_pct / 100
    net = monthly - mgmt_amt
    rows = [
        ['Description', 'Amount'],
        ['Monthly Rental Received', f'R {monthly:,.2f}'],
        [f'Less: Management Fee ({mgmt_pct:.0f}%)', f'- R {mgmt_amt:,.2f}'],
        ['', ''],
        ['NET DUE TO LANDLORD', f'R {net:,.2f}'],
    ]
    # Add invoice summary if available
    if invoices:
        paid_invoices = [i for i in invoices if i.get('status') == 'paid']
        if paid_invoices:
            rows.insert(-2, ['Invoices Collected This Period', str(len(paid_invoices)) + ' invoice(s)'])
    tbl = Table(rows, colWidths=[w*0.7, w*0.3])
    tbl.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0),DARK),('TEXTCOLOR',(0,0),(-1,0),colors.white),
        ('FONTSIZE',(0,0),(-1,-1),10),('TOPPADDING',(0,0),(-1,-1),4*mm),('BOTTOMPADDING',(0,0),(-1,-1),4*mm),('LEFTPADDING',(0,0),(-1,-1),4*mm),
        ('ALIGN',(1,0),(1,-1),'RIGHT'),('LINEBELOW',(0,0),(-1,-1),0.5,BORDER),
        ('BACKGROUND',(0,-1),(-1,-1),TEAL),('TEXTCOLOR',(0,-1),(-1,-1),colors.white),
        ('FONTNAME',(0,-1),(-1,-1),'Helvetica-Bold'),('FONTSIZE',(0,-1),(-1,-1),12),
    ]))

story.append(tbl)
story.append(Spacer(1,8*mm))
story.append(HRFlowable(width=w, thickness=1, color=BORDER))
story.append(Paragraph(f'<font size="8" color="#6B7280">Generated by {company_name} · {period} · {company_ph} · {company_em}</font>', ParagraphStyle('c', parent=styles['Normal'], alignment=TA_CENTER)))
doc.build(story)
print("OK")
