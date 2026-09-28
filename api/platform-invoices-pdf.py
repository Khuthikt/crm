#!/usr/bin/env python3
import sys, json
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_LEFT, TA_CENTER
from PIL import Image as PILImage
import urllib.request, os, tempfile

data     = json.loads(sys.argv[1])
output   = sys.argv[2]
inv      = data['invoice']
lines    = data['lines']
settings = data['settings']

# Brand colours from Hulisa settings
primary = settings.get('hulisa_primary_colour', '#0A1A3B')
accent  = settings.get('hulisa_accent_colour',  '#1DB8A0')
DARK    = colors.HexColor(primary)
TEAL    = colors.HexColor(accent)
LIGHT   = colors.HexColor('#F8FAFB')
BORDER  = colors.HexColor('#E5E7EB')
TEXT    = colors.HexColor('#111827')
TEXT2   = colors.HexColor('#6B7280')
WHITE   = colors.white

w, h = A4
doc = SimpleDocTemplate(output, pagesize=A4,
    leftMargin=15*mm, rightMargin=15*mm, topMargin=15*mm, bottomMargin=15*mm)

styles = getSampleStyleSheet()
story  = []

company_name = settings.get('hulisa_company_name', 'Hulisa Business Solutions')
company_email = settings.get('hulisa_email', 'info@hulisa.co.za')
company_phone = settings.get('hulisa_phone', '')
company_addr  = settings.get('hulisa_address', '')
company_vat   = settings.get('hulisa_vat_number', '')
company_reg   = settings.get('hulisa_reg_number', '')
logo_url      = settings.get('hulisa_logo_url', '')

# ── Logo & Header ────────────────────────────────────────────
logo_img = None
if logo_url:
    try:
        tmp = tempfile.mktemp(suffix='.png')
        urllib.request.urlretrieve(logo_url, tmp)
        from reportlab.platypus import Image
        pil = PILImage.open(tmp)
        aspect = pil.height / pil.width
        logo_img = Image(tmp, width=40*mm, height=40*mm*aspect)
    except: pass

if logo_img:
    header_left = logo_img
else:
    header_left = Paragraph(f'<font size="18" color="{primary}"><b>{company_name}</b></font>', styles['Normal'])

header_right = Paragraph(
    f'<font size="22" color="{accent}"><b>INVOICE</b></font><br/>'
    f'<font size="10" color="#6B7280">{inv.get("ref","")}</font>',
    ParagraphStyle('r', alignment=TA_RIGHT))

header = Table([[header_left, header_right]], colWidths=[w*0.5-15*mm, w*0.5-15*mm])
header.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'MIDDLE'),('ALIGN',(1,0),(1,0),'RIGHT')]))
story.append(header)
story.append(HRFlowable(width=w-30*mm, thickness=2, color=TEAL, spaceAfter=4*mm, spaceBefore=4*mm))

# ── Company & Bill To ────────────────────────────────────────
company_info = f'<b>{company_name}</b>'
if company_addr:  company_info += f'<br/><font size="9" color="#6B7280">{company_addr}</font>'
if company_phone: company_info += f'<br/><font size="9" color="#6B7280">{company_phone}</font>'
if company_email: company_info += f'<br/><font size="9" color="#6B7280">{company_email}</font>'
if company_vat:   company_info += f'<br/><font size="9" color="#6B7280">VAT: {company_vat}</font>'
if company_reg:   company_info += f'<br/><font size="9" color="#6B7280">Reg: {company_reg}</font>'

tenant_name    = inv.get('tenant_name', '—')
billing_email  = inv.get('billing_email', '')
billing_contact= inv.get('billing_contact', '')

bill_to_info = f'<b>{tenant_name}</b>'
if billing_contact: bill_to_info += f'<br/><font size="9" color="#6B7280">{billing_contact}</font>'
if billing_email:   bill_to_info += f'<br/><font size="9" color="#6B7280">{billing_email}</font>'

due_date    = inv.get('due_date', '') or '—'
inv_date    = (inv.get('created_at','') or '')[:10] or '—'
status      = inv.get('status','unpaid').upper()
status_color = '#16A34A' if status == 'PAID' else '#DC2626'

info_data = [
    [Paragraph(f'<font size="8" color="{accent}"><b>FROM</b></font>', styles['Normal']),
     Paragraph(f'<font size="8" color="{accent}"><b>BILL TO</b></font>', styles['Normal']),
     Paragraph(f'<font size="8" color="{accent}"><b>INVOICE DATE</b></font>', styles['Normal']),
     Paragraph(f'<font size="8" color="{accent}"><b>DUE DATE</b></font>', styles['Normal']),
     Paragraph(f'<font size="8" color="{accent}"><b>STATUS</b></font>', styles['Normal'])],
    [Paragraph(company_info, styles['Normal']),
     Paragraph(bill_to_info, styles['Normal']),
     Paragraph(f'<font size="9">{inv_date}</font>', styles['Normal']),
     Paragraph(f'<font size="9">{due_date}</font>', styles['Normal']),
     Paragraph(f'<font size="9" color="{status_color}"><b>{status}</b></font>', styles['Normal'])],
]
col_w = (w - 30*mm) / 5
info_tbl = Table(info_data, colWidths=[col_w]*5)
info_tbl.setStyle(TableStyle([
    ('BACKGROUND',(0,0),(-1,0), colors.HexColor('#F8FAFB')),
    ('TOPPADDING',(0,0),(-1,-1), 3*mm),
    ('BOTTOMPADDING',(0,0),(-1,-1), 3*mm),
    ('LEFTPADDING',(0,0),(-1,-1), 3*mm),
    ('BOX',(0,0),(-1,-1),0.5,BORDER),
    ('INNERGRID',(0,0),(-1,-1),0.5,BORDER),
    ('VALIGN',(0,0),(-1,-1),'TOP'),
]))
story.append(info_tbl)
story.append(Spacer(1, 5*mm))

# ── Line items ───────────────────────────────────────────────
col_widths = [(w-30*mm)*0.7, (w-30*mm)*0.3]
rows = [[
    Paragraph('<font size="9" color="#fff"><b>DESCRIPTION</b></font>', styles['Normal']),
    Paragraph('<font size="9" color="#fff"><b>AMOUNT</b></font>', ParagraphStyle('r', alignment=TA_RIGHT)),
]]
for line in lines:
    amt = float(line.get('amount', 0))
    rows.append([
        Paragraph(f'<font size="9">{line.get("description","")}</font>', styles['Normal']),
        Paragraph(f'<font size="9">R {amt:,.2f}</font>', ParagraphStyle('r', alignment=TA_RIGHT)),
    ])

subtotal = float(inv.get('subtotal', 0))
vat_amt  = float(inv.get('vat_amount', 0))
total    = float(inv.get('total', 0))

rows.append(['', ''])
rows.append([
    Paragraph('<font size="9" color="#6B7280">Subtotal</font>', ParagraphStyle('r', alignment=TA_RIGHT)),
    Paragraph(f'<font size="9">R {subtotal:,.2f}</font>', ParagraphStyle('r', alignment=TA_RIGHT)),
])
if vat_amt > 0:
    rows.append([
        Paragraph('<font size="9" color="#6B7280">VAT (15%)</font>', ParagraphStyle('r', alignment=TA_RIGHT)),
        Paragraph(f'<font size="9">R {vat_amt:,.2f}</font>', ParagraphStyle('r', alignment=TA_RIGHT)),
    ])
rows.append([
    Paragraph(f'<font size="11" color="{primary}"><b>TOTAL DUE</b></font>', ParagraphStyle('r', alignment=TA_RIGHT)),
    Paragraph(f'<font size="11" color="{accent}"><b>R {total:,.2f}</b></font>', ParagraphStyle('r', alignment=TA_RIGHT)),
])

n = len(lines)
tbl = Table(rows, colWidths=col_widths)
tbl.setStyle(TableStyle([
    ('BACKGROUND',(0,0),(-1,0), colors.HexColor(primary)),
    ('TOPPADDING',(0,0),(-1,-1), 3*mm),
    ('BOTTOMPADDING',(0,0),(-1,-1), 3*mm),
    ('LEFTPADDING',(0,0),(-1,-1), 4*mm),
    ('BACKGROUND',(0,1),(-1,n), WHITE),
    ('ROWBACKGROUNDS',(0,1),(-1,n),[WHITE, colors.HexColor('#F8FAFB')]),
    ('LINEBELOW',(0,1),(-1,n),0.3,BORDER),
    ('BACKGROUND',(0,n+2),(-1,-1), colors.HexColor('#F8FAFB')),
    ('LINEABOVE',(0,-1),(-1,-1),1,colors.HexColor(accent)),
]))
story.append(tbl)
story.append(Spacer(1, 5*mm))

# ── Banking details ──────────────────────────────────────────
bank_name    = settings.get('hulisa_bank_name', '')
bank_account = settings.get('hulisa_bank_account', '')
bank_branch  = settings.get('hulisa_bank_branch', '')
bank_type    = settings.get('hulisa_bank_type', '')

if bank_name or bank_account:
    story.append(Paragraph(f'<font size="9" color="{accent}"><b>PAYMENT DETAILS</b></font>', styles['Normal']))
    story.append(Spacer(1, 2*mm))
    bank_rows = []
    if bank_name:    bank_rows.append([Paragraph('<font size="9" color="#6B7280">Bank</font>', styles['Normal']), Paragraph(f'<font size="9">{bank_name}</font>', styles['Normal'])])
    if bank_account: bank_rows.append([Paragraph('<font size="9" color="#6B7280">Account No</font>', styles['Normal']), Paragraph(f'<font size="9">{bank_account}</font>', styles['Normal'])])
    if bank_branch:  bank_rows.append([Paragraph('<font size="9" color="#6B7280">Branch Code</font>', styles['Normal']), Paragraph(f'<font size="9">{bank_branch}</font>', styles['Normal'])])
    if bank_type:    bank_rows.append([Paragraph('<font size="9" color="#6B7280">Account Type</font>', styles['Normal']), Paragraph(f'<font size="9">{bank_type}</font>', styles['Normal'])])
    bank_rows.append([Paragraph('<font size="9" color="#6B7280">Reference</font>', styles['Normal']), Paragraph(f'<font size="9"><b>{inv.get("ref","")}</b></font>', styles['Normal'])])

    bank_tbl = Table(bank_rows, colWidths=[(w-30*mm)*0.3, (w-30*mm)*0.7])
    bank_tbl.setStyle(TableStyle([
        ('TOPPADDING',(0,0),(-1,-1), 2*mm),
        ('BOTTOMPADDING',(0,0),(-1,-1), 2*mm),
        ('LEFTPADDING',(0,0),(-1,-1), 3*mm),
        ('BOX',(0,0),(-1,-1),0.5,BORDER),
        ('ROWBACKGROUNDS',(0,0),(-1,-1),[WHITE, colors.HexColor('#F8FAFB')]),
    ]))
    story.append(bank_tbl)

# ── Notes ────────────────────────────────────────────────────
if inv.get('notes'):
    story.append(Spacer(1, 4*mm))
    story.append(Paragraph(f'<font size="9" color="#6B7280"><i>Notes: {inv["notes"]}</i></font>', styles['Normal']))

# ── Footer ───────────────────────────────────────────────────
story.append(Spacer(1, 8*mm))
story.append(HRFlowable(width=w-30*mm, thickness=0.5, color=BORDER))
story.append(Spacer(1, 2*mm))
story.append(Paragraph(
    f'<font size="8" color="#6B7280">{company_name} · {company_email}'
    + (f' · VAT {company_vat}' if company_vat else '') + '</font>',
    ParagraphStyle('c', alignment=TA_CENTER)))

doc.build(story)
print("OK")
