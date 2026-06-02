import json
import os
import uuid

from groq import Groq
from dotenv import load_dotenv

from models import (
    EmployeeInput,
    GenerateQuoteRequest,
    GenerateQuoteResponse,
    LineItemResponse,
    MeasurementInput,
)

load_dotenv()
client = Groq(api_key=os.environ["GROQ_API_KEY"])
MODEL = "llama-3.3-70b-versatile"

SYSTEM_PROMPT = """You are an expert estimator for a UK painting and decorating business.
Your job is to generate accurate, itemised quotes based on job descriptions and measurements.

You MUST respond with ONLY valid JSON — no markdown, no explanation, no code fences.
The JSON must match this exact schema:

{
  "line_items": [
    {
      "type": "material",
      "name": "Dulux Trade Matt 10L × 2",
      "quantity": 2,
      "unit": "tin",
      "unit_cost": 42.00,
      "total_cost": 84.00
    }
  ],
  "ai_notes": "Brief note about the quote or any assumptions made."
}

Rules:
- type must be "material" or "labour"
- For materials: use realistic UK trade prices (Screwfix / Dulux Trade / Toolstation pricing)
- For labour: use the exact employee names, roles and hourly rates provided
- Calculate labour hours based on surface area (approx 1.5 m² per hour for walls, 2 m² per hour for ceilings, 1 m² per hour for woodwork)
- Always include sundries (masking tape, dust sheets, sugar soap, sandpaper) as a material line item
- Round all costs to 2 decimal places
- Include primer coat if job description mentions bare plaster, new walls, or stained surfaces
- Do not include VAT in line items — it is calculated separately
"""

def build_prompt(req: GenerateQuoteRequest) -> str:
    total_m2 = sum(m.area_m2 for m in req.measurements)
    measurements_text = "\n".join(
        f"  - {m.label}: {m.area_m2} m² ({m.surface_type})"
        for m in req.measurements
    ) or "  - No specific measurements provided (use job description to estimate)"

    employees_text = "\n".join(
        f"  - {e.name} ({e.role}): £{e.hourly_rate}/hr"
        for e in req.employees
    )

    return f"""Generate an itemised painting quote for the following job.

JOB DESCRIPTION:
{req.job_description}

MEASUREMENTS (total: {total_m2:.1f} m²):
{measurements_text}

EMPLOYEES & RATES:
{employees_text}

MARKUP ON MATERIALS: {req.markup_percent}% (do NOT add this to line items — it is applied separately)
LOCATION: UK

Generate realistic material quantities and labour hours, then return the JSON quote."""


def calculate_totals(
    line_items: list[LineItemResponse],
    markup_percent: float,
    vat_rate: float,
) -> dict:
    subtotal_materials = round(
        sum(i.total_cost for i in line_items if i.type == "material"), 2
    )
    subtotal_labour = round(
        sum(i.total_cost for i in line_items if i.type == "labour"), 2
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


async def generate_quote(req: GenerateQuoteRequest) -> GenerateQuoteResponse:
    prompt = build_prompt(req)

    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
    )

    raw = response.choices[0].message.content.strip()

    # Strip markdown code fences if model returns them despite instructions
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    data = json.loads(raw)

    line_items = [
        LineItemResponse(
            id=str(uuid.uuid4()),
            type=item["type"],
            name=item["name"],
            quantity=float(item["quantity"]),
            unit=item["unit"],
            unit_cost=float(item["unit_cost"]),
            total_cost=float(item["total_cost"]),
        )
        for item in data["line_items"]
    ]

    totals = calculate_totals(line_items, req.markup_percent, req.vat_rate)

    return GenerateQuoteResponse(
        line_items=line_items,
        ai_notes=data.get("ai_notes"),
        **totals,
    )
