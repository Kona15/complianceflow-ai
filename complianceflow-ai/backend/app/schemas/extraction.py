from pydantic import BaseModel, Field
from typing import List, Optional

class AmountItem(BaseModel):
    value: str = Field(description="The numeric amount or contract value found in the text (e.g., 48500 or $48,500).")

class DocumentExtractionSchema(BaseModel):
    document_type: str = Field(
        description="Must strictly be classified as either 'invoice', 'contract', or 'unknown'."
    )
    amounts: List[AmountItem] = Field(
        default=[], 
        description="List of all major transactional or contract values found."
    )
    dates: List[str] = Field(
        default=[], 
        description="List of ALL dates found in the document text exactly as written (e.g., ['15 May 2026', 'March 1, 2026'])."
    )
    parties: List[str] = Field(
        default=[], 
        description="Names of the companies, vendors, or individuals involved in the agreement."
    )
    po_number: Optional[str] = Field(
        None, 
        description="The Purchase Order (PO) number reference if clearly mentioned, otherwise leave blank or null."
    )
    clauses: List[str] = Field(
        default=[], 
        description="The raw text sentences or headings of ALL core legal sections, terms, or rules present in the document."
    )
    signatures: str = Field(
        description="The RAW unedited text block of the entire signature/execution section at the end of the document, including spaces and labels like 'Date:' or 'Signature:'."
    )