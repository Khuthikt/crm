#!/usr/bin/env python3
import sys, json
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_LEFT, TA_CENTER

data   = json.loads(sys.argv[1])
output = sys.argv[2]

inv      = data['invoice']
lines    = data['lines']
settings = data['settings']
banks    = data['banks']

# Colors — use tenant brand colours from settings
_primary = settings.get('primary_colour', '#0A1A3B')
_accent  = settings.get('accent_colour',  '#1DB8A0')
TEAL     = colors.HexColor(_accent)
DARK     = colors.HexColor(_primary)
LIGHT_BG = colors.HexColor('#F8FAFB')
BORDER   = colors.HexColor('#E5E7EB')
TEXT     = colors.HexColor('#111827')
TEXT2    = colors.HexColor('#6B7280')

doc = SimpleDocTemplate(
    output,
    pagesize=A4,
    leftMargin=20*mm, rightMargin=20*mm,
    topMargin=20*mm, bottomMargin=20*mm
)

styles = getSampleStyleSheet()
w = A4[0] - 40*mm  # usable width

story = []

# ── HEADER ───────────────────────────────────────────────────
company_name = settings.get('company_name', 'Property Management')
company_addr = settings.get('address', '')
company_vat  = settings.get('vat_number', '')
company_reg  = settings.get('reg_number', '')
company_ph   = settings.get('phone', '')
company_em   = settings.get('email', '')
logo_url     = settings.get('logo_url', '')

# Try to download logo
logo_img = None
if logo_url:
    try:
        import urllib.request, tempfile, os
        logo_path = tempfile.mktemp(suffix='.png')
        urllib.request.urlretrieve(logo_url, logo_path)
        from reportlab.platypus import Image as RLImage
        from PIL import Image as PILImage
        with PILImage.open(logo_path) as img:
            orig_w, orig_h = img.size
        max_w, max_h = 200, 70
        ratio = min(max_w/orig_w, max_h/orig_h)
        logo_img = RLImage(logo_path, width=orig_w*ratio, height=orig_h*ratio)
    except:
        logo_img = None

if logo_img:
    # Use a nested table to stack logo + name
    from reportlab.platypus import Table as RLTable, TableStyle as RLTableStyle
    header_left = RLTable([
        [logo_img],
        [Paragraph(f'<font size="16" color="{_primary}"><b>{company_name}</b></font>', styles['Normal'])]
    ], colWidths=[w*0.5])
    header_left.setStyle(RLTableStyle([
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
    ]))
else:
    header_left = Paragraph(f'<font size="18" color="' + _primary + '"><b>{company_name}</b></font>', styles['Normal'])

header_data = [[
    header_left,
    Paragraph(f'<font size="22" color="' + _accent + '"><b>INVOICE</b></font><br/>'
              f'<font size="10" color="#6B7280">{inv.get("ref","")}</font>', 
              ParagraphStyle('right', parent=styles['Normal'], alignment=TA_RIGHT))
]]
header_tbl = Table(header_data, colWidths=[w*0.6, w*0.4])
header_tbl.setStyle(TableStyle([
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ('BOTTOMPADDING', (0,0), (-1,-1), 4*mm),
]))
story.append(header_tbl)
story.append(HRFlowable(width=w, thickness=2, color=TEAL, spaceAfter=4*mm))

# Company details + Invoice details
company_text = f'{company_addr}<br/>'
if company_vat: company_text += f'VAT: {company_vat}<br/>'
if company_reg: company_text += f'Reg: {company_reg}<br/>'
if company_ph:  company_text += f'Tel: {company_ph}<br/>'
if company_em:  company_text += f'Email: {company_em}'

inv_date = inv.get('created_at','')[:10] if inv.get('created_at') else ''
inv_due  = inv.get('due_date','')

details_data = [[
    Paragraph(f'<font size="9" color="#6B7280">{company_text}</font>', styles['Normal']),
    Paragraph(
        f'<font size="9" color="#6B7280"><b>Invoice Date:</b> {inv_date}<br/>'
        f'<b>Due Date:</b> {inv_due}<br/>'
        f'<b>Status:</b> {inv.get("status","").upper()}</font>',
        ParagraphStyle('right', parent=styles['Normal'], alignment=TA_RIGHT)
    )
]]
details_tbl = Table(details_data, colWidths=[w*0.5, w*0.5])
details_tbl.setStyle(TableStyle([('VALIGN', (0,0), (-1,-1), 'TOP')]))
story.append(details_tbl)
story.append(Spacer(1, 6*mm))

# ── BILL TO ───────────────────────────────────────────────────
tenant_name  = inv.get('tenant_name') or inv.get('lease_tenant_name') or '—'
tenant_email = inv.get('tenant_email') or ''
tenant_phone = inv.get('tenant_phone') or ''
tenant_addr  = inv.get('tenant_address') or ''
tenant_city  = inv.get('tenant_city') or ''
property_str = inv.get('property','')
unit_str     = inv.get('unit','')
if unit_str: property_str += f' · Unit {unit_str}'

bill_to = [[
    Paragraph('<font size="8" color="' + _accent + '"><b>BILL TO</b></font>', styles['Normal']),
    Paragraph('<font size="8" color="' + _accent + '"><b>PROPERTY</b></font>', styles['Normal']) if property_str else Paragraph('', styles['Normal'])
],[
    Paragraph(
        f'<b>{tenant_name}</b>'
        + (f'<br/><font size="9" color="#6B7280">{tenant_phone}</font>' if tenant_phone else '')
        + (f'<br/><font size="9" color="#6B7280">{tenant_email}</font>' if tenant_email else '')
        + (f'<br/><font size="9" color="#6B7280">{tenant_addr}</font>' if tenant_addr else '')
        + (f'<br/><font size="9" color="#6B7280">{tenant_city}</font>' if tenant_city else ''),
        styles['Normal']
    ),
    Paragraph(f'<font size="9">{property_str}</font>', styles['Normal']) if property_str else Paragraph('', styles['Normal'])
]]
bill_tbl = Table(bill_to, colWidths=[w*0.5, w*0.5])
bill_tbl.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), LIGHT_BG),
    ('TOPPADDING', (0,0), (-1,-1), 3*mm),
    ('BOTTOMPADDING', (0,0), (-1,-1), 3*mm),
    ('LEFTPADDING', (0,0), (-1,-1), 4*mm),
    ('ROUNDEDCORNERS', [3,3,3,3]),
    ('BOX', (0,0), (-1,-1), 0.5, BORDER),
]))
story.append(bill_tbl)
story.append(Spacer(1, 6*mm))

# ── LINE ITEMS ────────────────────────────────────────────────
line_data = [[
    Paragraph('<b>Description</b>', styles['Normal']),
    Paragraph('<b>Qty</b>', ParagraphStyle('c', parent=styles['Normal'], alignment=TA_CENTER)),
    Paragraph('<b>Unit Price</b>', ParagraphStyle('r', parent=styles['Normal'], alignment=TA_RIGHT)),
    Paragraph('<b>Discount</b>', ParagraphStyle('r', parent=styles['Normal'], alignment=TA_RIGHT)),
    Paragraph('<b>Amount</b>', ParagraphStyle('r', parent=styles['Normal'], alignment=TA_RIGHT)),
]]

subtotal = 0
for line in lines:
    qty      = float(line.get('quantity', 1))
    price    = float(line.get('unit_price', 0))
    discount = float(line.get('discount', 0))
    amount   = (qty * price) - discount
    subtotal += amount
    line_data.append([
        Paragraph(line.get('description',''), styles['Normal']),
        Paragraph(str(int(qty)), ParagraphStyle('c', parent=styles['Normal'], alignment=TA_CENTER)),
        Paragraph(f'R {price:,.2f}', ParagraphStyle('r', parent=styles['Normal'], alignment=TA_RIGHT)),
        Paragraph(f'R {discount:,.2f}' if discount else '—', ParagraphStyle('r', parent=styles['Normal'], alignment=TA_RIGHT)),
        Paragraph(f'R {amount:,.2f}', ParagraphStyle('r', parent=styles['Normal'], alignment=TA_RIGHT)),
    ])

line_tbl = Table(line_data, colWidths=[w*0.45, w*0.1, w*0.15, w*0.15, w*0.15])
line_tbl.setStyle(TableStyle([
    ('BACKGROUND', (0,0), (-1,0), TEAL),
    ('TEXTCOLOR', (0,0), (-1,0), colors.white),
    ('FONTSIZE', (0,0), (-1,-1), 9),
    ('TOPPADDING', (0,0), (-1,-1), 3*mm),
    ('BOTTOMPADDING', (0,0), (-1,-1), 3*mm),
    ('LEFTPADDING', (0,0), (-1,-1), 3*mm),
    ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, LIGHT_BG]),
    ('LINEBELOW', (0,0), (-1,-1), 0.5, BORDER),
    ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
]))
story.append(line_tbl)
story.append(Spacer(1, 4*mm))

# ── TOTALS ────────────────────────────────────────────────────
vat_applied = inv.get('vat_applied', 0)
vat_amt     = subtotal * 0.15 if vat_applied else 0
total       = subtotal + vat_amt

totals_data = []
totals_data.append(['', 'Subtotal:', f'R {subtotal:,.2f}'])
totals_data.append(['', 'VAT (15%):', f'R {vat_amt:,.2f}'])
totals_data.append(['', Paragraph('<b>TOTAL DUE:</b>', styles['Normal']), Paragraph(f'<b>R {total:,.2f}</b>', ParagraphStyle('r', parent=styles['Normal'], alignment=TA_RIGHT))])

totals_tbl = Table(totals_data, colWidths=[w*0.55, w*0.25, w*0.2])
totals_tbl.setStyle(TableStyle([
    ('FONTSIZE', (0,0), (-1,-1), 9),
    ('ALIGN', (2,0), (2,-1), 'RIGHT'),
    ('ALIGN', (1,0), (1,-1), 'RIGHT'),
    ('TOPPADDING', (0,0), (-1,-1), 2*mm),
    ('BOTTOMPADDING', (0,0), (-1,-1), 2*mm),
    ('BACKGROUND', (1,-1), (2,-1), TEAL),
    ('TEXTCOLOR', (1,-1), (2,-1), colors.white),
    ('FONTSIZE', (1,-1), (2,-1), 11),
    ('TOPPADDING', (1,-1), (2,-1), 3*mm),
    ('BOTTOMPADDING', (1,-1), (2,-1), 3*mm),
    ('LEFTPADDING', (1,-1), (2,-1), 4*mm),
    ('RIGHTPADDING', (1,-1), (2,-1), 4*mm),
]))
story.append(totals_tbl)
story.append(Spacer(1, 8*mm))

# ── BANK DETAILS ─────────────────────────────────────────────
if banks:
    story.append(Paragraph('<font size="9" color="' + _accent + '"><b>PAYMENT DETAILS</b></font>', styles['Normal']))
    story.append(Spacer(1, 2*mm))
    bank_data = [['Company', 'Bank', 'Account No', 'Account Type', 'Branch Code']]
    for b in banks:
        bank_data.append([
            b.get('bank_company',''), b.get('bank_name',''),
            b.get('bank_account',''), b.get('bank_type',''),
            b.get('bank_branch','')
        ])
    bank_tbl = Table(bank_data, colWidths=[w*0.25, w*0.15, w*0.2, w*0.2, w*0.2])
    bank_tbl.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), LIGHT_BG),
        ('FONTSIZE', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 2*mm),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2*mm),
        ('LEFTPADDING', (0,0), (-1,-1), 2*mm),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER),
        ('INNERGRID', (0,0), (-1,-1), 0.25, BORDER),
    ]))
    story.append(bank_tbl)
    story.append(Spacer(1, 4*mm))

# ── NOTES ────────────────────────────────────────────────────
notes = inv.get('notes','')
if notes:
    story.append(Paragraph('<font size="9" color="#6B7280"><b>Notes:</b></font>', styles['Normal']))
    story.append(Paragraph(f'<font size="9" color="#6B7280">{notes}</font>', styles['Normal']))
    story.append(Spacer(1, 4*mm))

# ── FOOTER ───────────────────────────────────────────────────
story.append(HRFlowable(width=w, thickness=1, color=BORDER, spaceBefore=4*mm))
story.append(Paragraph(
    f'<font size="8" color="#6B7280">Thank you for your business. Please use the invoice reference <b>{inv.get("ref","")}</b> as your payment reference.</font>',
    ParagraphStyle('center', parent=styles['Normal'], alignment=TA_CENTER)
))

doc.build(story)
print("OK")
