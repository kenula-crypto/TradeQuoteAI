from pydantic import BaseModel
from typing import Optional

class MeasurementInput(BaseModel):
    label: str
    surface_type: str  # walls | ceiling | woodwork | exterior
    area_m2: float

class EmployeeInput(BaseModel):
    name: str
    role: str
    hourly_rate: float

class GenerateQuoteRequest(BaseModel):
    job_description: str
    measurements: list[MeasurementInput]
    employees: list[EmployeeInput]
    markup_percent: float = 20.0
    vat_rate: float = 20.0

class LineItemResponse(BaseModel):
    id: str
    type: str           # material | labour
    name: str
    quantity: float
    unit: str
    unit_cost: float
    total_cost: float

class GenerateQuoteResponse(BaseModel):
    line_items: list[LineItemResponse]
    subtotal_materials: float
    subtotal_labour: float
    markup_amount: float
    subtotal: float
    vat_amount: float
    total: float
    ai_notes: Optional[str] = None
