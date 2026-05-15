import pytest
from app.services.document_processor import DocumentProcessor

@pytest.fixture
def processor():
    return DocumentProcessor()

@pytest.mark.asyncio
async def test_detect_document_type_invoice(processor):
    text = "Invoice #INV-2026-001\nTotal Amount: $5,000.00"
    result = processor._detect_document_type(text, "invoice.pdf")
    assert result == "invoice"

@pytest.mark.asyncio
async def test_detect_document_type_contract(processor):
    text = "This CONTRACT agreement is made between..."
    result = processor._detect_document_type(text, "contract.pdf")
    assert result == "contract"

@pytest.mark.asyncio
async def test_extract_amounts(processor):
    text = "Total: $1,234.56\nSubtotal: $999.99\nTax: $234.57"
    amounts = processor._extract_amounts(text)
    assert len(amounts) >= 2
    assert any(a["value"] == "1234.56" for a in amounts)

@pytest.mark.asyncio
async def test_extract_dates(processor):
    text = "Date: 01/15/2026\nEffective: March 1, 2026"
    dates = processor._extract_dates(text)
    assert len(dates) >= 1

@pytest.mark.asyncio
async def test_extract_invoice_number(processor):
    text = "Invoice No: INV-2026-0042"
    result = processor._extract_invoice_number(text)
    assert result == "INV-2026-0042"

@pytest.mark.asyncio
async def test_extract_po_number(processor):
    text = "PO Number: PO-2026-1234"
    result = processor._extract_po_number(text)
    assert result == "PO-2026-1234"
