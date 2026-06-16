from fpdf import FPDF
import base64
from datetime import datetime

NAVY   = (15, 23, 42)
ORANGE = (234, 88, 12)
GRAY   = (100, 116, 139)
LIGHT  = (248, 250, 252)
BORDER = (226, 232, 240)
WHITE  = (255, 255, 255)
ROW_H  = 6.5

# Mapping of Unicode characters outside Latin-1 to safe equivalents
_UNICODE_MAP = {
    '–': '-',    # en dash
    '—': '-',    # em dash
    '‘': "'",    # left single quote
    '’': "'",    # right single quote
    '“': '"',    # left double quote
    '”': '"',    # right double quote
    '…': '...',  # ellipsis
    ' ': ' ',    # non-breaking space
    '•': '*',    # bullet
    '·': '*',    # middle dot
    '€': 'EUR',  # euro sign
    '®': '(R)',   # registered trademark
    '™': '(TM)', # trademark
    '©': '(C)',  # copyright
    '×': 'x',    # multiplication sign
    '½': '1/2',  # one half
    '¼': '1/4',  # one quarter
    '¾': '3/4',  # three quarters
    '°': 'deg',  # degree sign
}

def _s(text) -> str:
    """Sanitize text to Latin-1 safe characters for fpdf2 core fonts."""
    if not text:
        return ''
    text = str(text)
    for char, replacement in _UNICODE_MAP.items():
        text = text.replace(char, replacement)
    return text.encode('latin-1', errors='replace').decode('latin-1')


def _date(iso: str) -> str:
    try:
        dt = datetime.fromisoformat(iso.replace('Z', '+00:00'))
        return f"{dt.day} {dt.strftime('%B %Y')}"
    except Exception:
        return iso[:10] if iso else ''


def _gbp(v) -> str:
    try:
        return f"\xa3{float(v):,.2f}"
    except Exception:
        return str(v)


def _trunc(s: str, n: int) -> str:
    return s if len(s) <= n else s[:n - 3] + '...'


class _PDF(FPDF):
    def footer(self):
        self.set_y(-13)
        self.set_font('Helvetica', 'I', 7)
        self.set_text_color(*GRAY)
        self.cell(
            0, 5,
            'This quote is not a legally binding contract. '
            'Prices are valid for the stated period only.',
            align='C',
        )


def generate_quote_pdf(quote: dict, settings: dict) -> str:
    pdf = _PDF()
    pdf.add_page()
    pdf.set_margins(18, 18, 18)
    pdf.set_auto_page_break(auto=True, margin=22)
    W = pdf.w - 36  # ~174mm usable width

    # ── HEADER ─────────────────────────────────────────────────────
    pdf.set_xy(18, 18)
    pdf.set_font('Helvetica', 'B', 19)
    pdf.set_text_color(*NAVY)
    pdf.cell(W * 0.58, 9, _s(_trunc(settings.get('businessName', 'My Business'), 35)), ln=0)

    pdf.set_font('Helvetica', 'B', 24)
    pdf.set_text_color(*ORANGE)
    pdf.cell(W * 0.42, 9, 'QUOTE', align='R', ln=1)

    pdf.set_font('Helvetica', '', 8.5)
    pdf.set_text_color(*GRAY)
    pdf.set_x(18)
    contact = '  |  '.join(
        p for p in [
            settings.get('ownerName', ''),
            settings.get('phone', ''),
            settings.get('email', ''),
        ] if p
    )
    pdf.cell(W * 0.58, 5, _s(contact), ln=0)
    pdf.set_font('Helvetica', 'B', 8.5)
    pdf.cell(W * 0.42, 5, _s(f"Ref: {quote.get('quoteNumber', '')}"), align='R', ln=1)

    pdf.set_font('Helvetica', '', 8.5)
    pdf.set_x(18)
    pdf.cell(W * 0.58, 5, '', ln=0)
    issued = _date(quote.get('createdAt', ''))
    valid  = _date(quote.get('validUntil', ''))
    pdf.cell(W * 0.42, 5, _s(f"Issued: {issued}   Valid until: {valid}"), align='R', ln=1)

    pdf.ln(4)

    # Orange rule
    pdf.set_draw_color(*ORANGE)
    pdf.set_line_width(0.7)
    pdf.line(18, pdf.get_y(), 18 + W, pdf.get_y())
    pdf.ln(6)

    # ── CUSTOMER ────────────────────────────────────────────────────
    pdf.set_font('Helvetica', 'B', 7.5)
    pdf.set_text_color(*ORANGE)
    pdf.cell(W, 5, 'PREPARED FOR', ln=1)

    pdf.set_font('Helvetica', 'B', 11)
    pdf.set_text_color(*NAVY)
    pdf.cell(W, 6, _s(quote.get('customerName', '')), ln=1)

    pdf.set_font('Helvetica', '', 9)
    pdf.set_text_color(*GRAY)
    for key in ('customerAddress', 'customerPhone', 'customerEmail'):
        val = quote.get(key, '')
        if val:
            pdf.cell(W, 4.5, _s(val), ln=1)

    pdf.ln(5)

    # ── JOB DESCRIPTION ─────────────────────────────────────────────
    desc = (quote.get('jobDescription') or '').strip()
    if desc:
        pdf.set_font('Helvetica', 'B', 7.5)
        pdf.set_text_color(*ORANGE)
        pdf.cell(W, 5, 'JOB DESCRIPTION', ln=1)
        pdf.set_font('Helvetica', '', 9)
        pdf.set_text_color(*NAVY)
        pdf.multi_cell(W, 5, _s(desc))
        pdf.ln(3)

    # Thin rule
    pdf.set_draw_color(*BORDER)
    pdf.set_line_width(0.3)
    pdf.line(18, pdf.get_y(), 18 + W, pdf.get_y())
    pdf.ln(5)

    # ── LINE ITEMS ──────────────────────────────────────────────────
    # Desc 50% | Qty 10% | Unit 9% | Unit Cost 14% | Total 17%
    CW = [W * 0.50, W * 0.10, W * 0.09, W * 0.14, W * 0.17]

    def section_header(label: str):
        pdf.set_font('Helvetica', 'B', 7.5)
        pdf.set_text_color(*ORANGE)
        pdf.cell(W, 5.5, label, ln=1)

    def table_header():
        headers = ['DESCRIPTION', 'QTY',  'UNIT', 'UNIT COST', 'TOTAL']
        aligns  = ['L',           'R',    'C',    'R',         'R']
        pdf.set_fill_color(*NAVY)
        pdf.set_text_color(*WHITE)
        pdf.set_font('Helvetica', 'B', 7.5)
        for w, lbl, align in zip(CW, headers, aligns):
            txt = f'  {lbl}' if align == 'L' else lbl
            pdf.cell(w, ROW_H, txt, fill=True, align=align, ln=0)
        pdf.ln()

    def item_row(item: dict, shade: bool):
        pdf.set_fill_color(*(LIGHT if shade else WHITE))
        pdf.set_text_color(*NAVY)
        pdf.set_font('Helvetica', '', 8.5)
        vals   = [
            _s(f"  {_trunc(item.get('name', ''), 42)}"),
            _s(str(item.get('quantity', ''))),
            _s(item.get('unit', '')),
            _gbp(item.get('unitCost', 0)),
            _gbp(item.get('totalCost', 0)),
        ]
        aligns = ['L', 'R', 'C', 'R', 'R']
        for w, val, align in zip(CW, vals, aligns):
            pdf.cell(w, ROW_H, val, fill=True, align=align, ln=0)
        pdf.ln()

    line_items = quote.get('lineItems', [])
    materials  = [i for i in line_items if i.get('type') == 'material']
    labour     = [i for i in line_items if i.get('type') == 'labour']

    for label, items in [('MATERIALS', materials), ('LABOUR', labour)]:
        if not items:
            continue
        section_header(label)
        table_header()
        for idx, item in enumerate(items):
            item_row(item, idx % 2 == 0)
        pdf.ln(4)

    # ── TOTALS ──────────────────────────────────────────────────────
    pdf.set_draw_color(*BORDER)
    pdf.set_line_width(0.3)
    pdf.line(18, pdf.get_y(), 18 + W, pdf.get_y())
    pdf.ln(5)

    TW = W * 0.55
    TX = 18 + W - TW
    LW = TW * 0.60
    VW = TW * 0.40

    def total_row(label: str, value: str, bold: bool = False, highlight: bool = False):
        pdf.set_x(TX)
        if highlight:
            pdf.set_fill_color(*NAVY)
            pdf.set_text_color(*WHITE)
            pdf.set_font('Helvetica', 'B', 10)
            pdf.cell(LW, 8.5, _s(f'  {label}'), fill=True, align='L', ln=0)
            pdf.set_text_color(*ORANGE)
            pdf.cell(VW, 8.5, _s(value), fill=True, align='R', ln=1)
        else:
            pdf.set_text_color(*NAVY)
            pdf.set_font('Helvetica', 'B' if bold else '', 9)
            pdf.cell(LW, 6, _s(f'  {label}'), align='L', ln=0)
            pdf.cell(VW, 6, _s(value), align='R', ln=1)

    total_row('Materials subtotal', _gbp(quote.get('subtotalMaterials', 0)))
    markup_amt = float(quote.get('markupAmount') or 0)
    if markup_amt:
        total_row(f"Markup ({quote.get('markupPercent', 0)}%)", _gbp(markup_amt))
    total_row('Labour subtotal', _gbp(quote.get('subtotalLabour', 0)))

    pdf.set_x(TX)
    pdf.set_draw_color(*BORDER)
    pdf.line(TX, pdf.get_y(), TX + TW, pdf.get_y())
    pdf.ln(2)

    total_row('Subtotal', _gbp(quote.get('subtotal', 0)), bold=True)
    total_row(f"VAT ({quote.get('vatRate', 20)}%)", _gbp(quote.get('vatAmount', 0)))
    pdf.ln(2)
    total_row('TOTAL  (inc. VAT)', _gbp(quote.get('total', 0)), highlight=True)

    # ── AI NOTES ────────────────────────────────────────────────────
    ai_notes = (quote.get('aiNotes') or quote.get('ai_notes') or '').strip()
    if ai_notes:
        pdf.ln(6)
        pdf.set_font('Helvetica', 'I', 8)
        pdf.set_text_color(*GRAY)
        pdf.multi_cell(W, 5, _s(f'Note: {ai_notes}'))

    # ── PAYMENT TERMS ───────────────────────────────────────────────
    terms = (settings.get('paymentTerms') or '').strip()
    if terms:
        pdf.ln(6)
        pdf.set_draw_color(*BORDER)
        pdf.set_line_width(0.3)
        pdf.line(18, pdf.get_y(), 18 + W, pdf.get_y())
        pdf.ln(5)
        pdf.set_font('Helvetica', 'B', 7.5)
        pdf.set_text_color(*ORANGE)
        pdf.cell(W, 5, 'PAYMENT TERMS', ln=1)
        pdf.set_font('Helvetica', '', 8.5)
        pdf.set_text_color(*GRAY)
        pdf.multi_cell(W, 5, _s(terms))

    return base64.b64encode(pdf.output()).decode('utf-8')
