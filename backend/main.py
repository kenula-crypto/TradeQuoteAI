import json
import os
import uuid

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

load_dotenv()

app = Flask(__name__)
CORS(app)

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_MODEL = "llama-3.3-70b-versatile"

SYSTEM_PROMPT = """You are an expert estimator for a UK painting and decorating business.
Generate accurate, itemised quotes based on job descriptions and measurements.

You MUST respond with ONLY valid JSON — no markdown, no explanation, no code fences.

Required JSON schema:
{
  "line_items": [
    {
      "type": "material",
      "name": "Dulux Trade Matt 10L x 2",
      "quantity": 2,
      "unit": "tin",
      "unit_cost": 42.00,
      "total_cost": 84.00
    }
  ],
  "ai_notes": "Any assumptions or notes about this quote."
}

Rules:
- type must be exactly "material" or "labour"
- Use realistic UK trade prices (Screwfix / Dulux Trade / Toolstation)
- Use the exact employee names, roles and hourly rates provided
- Labour hours: ~1.5 m2/hr for walls, ~2 m2/hr for ceilings, ~1 m2/hr for woodwork
- Always include a sundries line (masking tape, dust sheets, sugar soap, sandpaper)
- Include primer if job mentions bare plaster, new walls, or heavily stained surfaces
- Do NOT include VAT in line items — calculated separately
- Round all costs to 2 decimal places
"""


def build_prompt(data: dict) -> str:
    measurements = data.get("measurements", [])
    employees = data.get("employees", [])
    total_m2 = sum(m.get("area_m2", 0) for m in measurements)

    meas_lines = "\n".join(
        f"  - {m['label']}: {m['area_m2']} m2 ({m['surface_type']})"
        for m in measurements
    ) or "  - No measurements provided — estimate from job description"

    emp_lines = "\n".join(
        f"  - {e['name']} ({e['role']}): £{e['hourly_rate']}/hr"
        for e in employees
    )

    return f"""Generate an itemised painting and decorating quote.

JOB DESCRIPTION:
{data.get('job_description', 'General painting work')}

MEASUREMENTS (total: {total_m2:.1f} m2):
{meas_lines}

EMPLOYEES & RATES:
{emp_lines}

MATERIAL MARKUP: {data.get('markup_percent', 20)}% (apply to subtotal separately — do NOT add to line items)
LOCATION: UK

Return only the JSON quote."""


def calculate_totals(line_items: list, markup_percent: float, vat_rate: float) -> dict:
    subtotal_materials = round(
        sum(i["total_cost"] for i in line_items if i["type"] == "material"), 2
    )
    subtotal_labour = round(
        sum(i["total_cost"] for i in line_items if i["type"] == "labour"), 2
    )
    markup_amount = round(subtotal_materials * (markup_percent / 100), 2)
    subtotal = round(subtotal_materials + subtotal_labour + markup_amount, 2)
    vat_amount = round(subtotal * (vat_rate / 100), 2)
    total = round(subtotal + vat_amount, 2)

    return {
        "subtotal_materials": subtotal_materials,
        "subtotal_labour": subtotal_labour,
        "markup_amount": markup_amount,
        "subtotal": subtotal,
        "vat_amount": vat_amount,
        "total": total,
    }


@app.route("/")
def health():
    return jsonify({"status": "ok", "service": "TradeQuoteAI API"})


@app.route("/quotes/generate", methods=["POST"])
def generate_quote():
    if not GROQ_API_KEY:
        return jsonify({"error": "GROQ_API_KEY not set in .env"}), 500

    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    prompt = build_prompt(data)

    groq_payload = {
        "model": GROQ_MODEL,
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {GROQ_API_KEY}",
    }

    try:
        resp = requests.post(GROQ_URL, json=groq_payload, headers=headers, timeout=30)
        print(f"[Groq] Status: {resp.status_code}")
        print(f"[Groq] Response: {resp.text[:500]}")
        resp.raise_for_status()
    except requests.RequestException as e:
        print(f"[Groq] Error: {str(e)}")
        return jsonify({"error": f"Groq API request failed: {str(e)}"}), 502

    try:
        groq_data = resp.json()
        raw_text = groq_data["choices"][0]["message"]["content"].strip()

        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]
        raw_text = raw_text.strip()

        ai_result = json.loads(raw_text)
    except (KeyError, IndexError, json.JSONDecodeError) as e:
        return jsonify({"error": f"Failed to parse Groq response: {str(e)}"}), 500

    line_items = [
        {
            "id": str(uuid.uuid4()),
            "type": item["type"],
            "name": item["name"],
            "quantity": float(item["quantity"]),
            "unit": item["unit"],
            "unit_cost": float(item["unit_cost"]),
            "total_cost": float(item["total_cost"]),
        }
        for item in ai_result.get("line_items", [])
    ]

    totals = calculate_totals(
        line_items,
        float(data.get("markup_percent", 20)),
        float(data.get("vat_rate", 20)),
    )

    return jsonify({
        "line_items": line_items,
        "ai_notes": ai_result.get("ai_notes"),
        **totals,
    })


@app.route("/quotes/draft-email", methods=["POST"])
def draft_email():
    import traceback
    from datetime import datetime

    def fmt_date(iso):
        if not iso or not isinstance(iso, str):
            return ""
        try:
            dt = datetime.fromisoformat(iso.replace('Z', '+00:00'))
            return f"{dt.day} {dt.strftime('%B %Y')}"
        except Exception:
            return iso[:10]

    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Request body required"}), 400

        quote    = data.get("quote") or {}
        settings = data.get("settings") or {}

        customer_name  = quote.get("customerName") or "there"
        customer_first = customer_name.split()[0]
        valid_until    = fmt_date(quote.get("validUntil"))
        total          = float(quote.get("total") or 0)

        prompt = f"""Draft a short, professional and friendly email from a UK painting and decorating business to a customer. The email accompanies a quote for work.

Business name: {settings.get("businessName") or "Our business"}
Owner name: {settings.get("ownerName") or ""}
Quote reference: {quote.get("quoteNumber") or ""}
Customer first name: {customer_first}
Job description: {quote.get("jobDescription") or ""}
Quote total (inc. VAT): £{total:,.2f}
Quote valid until: {valid_until}

Write an email that:
- Greets the customer by first name
- Thanks them for their enquiry
- Mentions the attached quote PDF and the reference number
- Briefly summarises the job in one sentence
- States the total and the date the quote expires
- Invites them to reply with any questions
- Signs off warmly from the owner

Keep it concise — 4 to 6 short paragraphs. Do not use bullet points.

Return ONLY valid JSON with no markdown: {{"subject": "...", "body": "..."}}"""

        payload = {
            "model": GROQ_MODEL,
            "messages": [
                {"role": "system", "content": "You are a professional business email writer. Always respond with valid JSON only."},
                {"role": "user", "content": prompt},
            ],
            "temperature": 0.4,
            "response_format": {"type": "json_object"},
        }
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {GROQ_API_KEY}",
        }

        resp = requests.post(GROQ_URL, json=payload, headers=headers, timeout=20)
        resp.raise_for_status()
        content = resp.json()["choices"][0]["message"]["content"].strip()
        email_data = json.loads(content)

        return jsonify({
            "subject": email_data.get("subject") or f"Your quote from {settings.get('businessName') or ''}",
            "body":    email_data.get("body") or "",
        })

    except Exception as e:
        print(f"[EmailDraft] Error: {traceback.format_exc()}")
        return jsonify({"error": str(e)}), 500


@app.route("/quotes/pdf", methods=["POST"])
def generate_pdf():
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body required"}), 400

    quote    = data.get("quote", {})
    settings = data.get("settings", {})

    try:
        from pdf_generator import generate_quote_pdf
        pdf_b64 = generate_quote_pdf(quote, settings)
    except Exception as e:
        print(f"[PDF] Error: {e}")
        return jsonify({"error": f"PDF generation failed: {str(e)}"}), 500

    filename = f"{quote.get('quoteNumber', 'quote')}.pdf"
    return jsonify({"pdf_base64": pdf_b64, "filename": filename})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=True)
