import io
import re
from datetime import datetime
from typing import Dict, List, Any, Optional

import pdfplumber
import pytesseract
import structlog
from PIL import Image

logger = structlog.get_logger()


class DocumentProcessor:
    """
    Extracts structured data from PDFs and images.
    Improved for better accuracy on invoices.
    """

    def __init__(self):
        self.supported_types = {
            "application/pdf": self._process_pdf,
            "image/png": self._process_image,
            "image/jpeg": self._process_image,
            "image/jpg": self._process_image,
        }

    def _detect_mime_type(self, filename: str) -> str:
        filename = filename.lower()
        if filename.endswith(".pdf"):
            return "application/pdf"
        elif filename.endswith(".png"):
            return "image/png"
        elif filename.endswith((".jpg", ".jpeg")):
            return "image/jpeg"
        return "unknown"

    async def process(self, file_bytes: bytes, filename: str) -> Dict[str, Any]:
        """Main entry point for document processing."""

        mime = self._detect_mime_type(filename)

        logger.info("document_processing_started", filename=filename, mime=mime)

        if mime not in self.supported_types:
            raise ValueError(f"Unsupported file type: {mime}")

        processor = self.supported_types[mime]
        raw_text = await processor(file_bytes)

        extracted = self._extract_fields(raw_text, filename)

        logger.info(
            "extraction_complete",
            filename=filename,
            document_type=extracted["document_type"],
            amounts_found=len(extracted["amounts"]),
            parties_found=len(extracted["parties"])
        )

        return {
            "filename": filename,
            "mime_type": mime,
            "raw_text": raw_text[:12000],
            "extracted_fields": extracted,
            "processed_at": datetime.utcnow().isoformat()
        }

    async def _process_pdf(self, file_bytes: bytes) -> str:
        """Extract text from PDF using pdfplumber."""
        text_parts = []

        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            for i, page in enumerate(pdf.pages):
                # Try both extract_text and extract_text with better settings
                page_text = page.extract_text(x_tolerance=3, y_tolerance=3)
                if page_text:
                    text_parts.append(f"--- Page {i + 1} ---\n{page_text}")

        return "\n\n".join(text_parts)

    async def _process_image(self, file_bytes: bytes) -> str:
        """Extract text from image using OCR."""
        image = Image.open(io.BytesIO(file_bytes)).convert("L")
        text = pytesseract.image_to_string(image, config="--psm 6")
        return text

    def _extract_fields(self, text: str, filename: str) -> Dict[str, Any]:
        """Main extraction method."""
        fields = {
            "document_type": self._detect_document_type(text, filename),
            "amounts": self._extract_amounts(text),
            "dates": self._extract_dates(text),
            "parties": self._extract_parties(text),
            "clauses": self._extract_clauses(text),
            "invoice_number": self._extract_invoice_number(text),
            "po_number": self._extract_po_number(text),
        }
        return fields

    def _detect_document_type(self, text: str, filename: str) -> str:
        text_lower = text.lower()
        filename_lower = filename.lower()

        if "invoice" in text_lower or "inv-" in filename_lower or "invoice" in filename_lower:
            return "invoice"
        elif "contract" in text_lower or "agreement" in text_lower:
            return "contract"
        elif "certificate" in text_lower or "compliance" in text_lower:
            return "compliance_certificate"
        elif "po" in text_lower or "purchase order" in text_lower:
            return "purchase_order"

        return "unknown"

    # ==================== IMPROVED EXTRACTION ====================

    def _extract_amounts(self, text: str) -> List[Dict]:
        """Strongly improved amount extraction."""
        patterns = [
            r'\$\s*([\d,]+\.?\d*)',                    # $42,000
            r'(?:Total Due|Total|Amount|Sum)[\s:]*\$?\s*([\d,]+\.?\d*)',
            r'([\d,]+\.\d{2})',                        # 42500.00
            r'([\d,]+\d)\s*(?:USD|dollars?)',
        ]

        amounts = []
        seen = set()

        for pattern in patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for m in matches:
                if isinstance(m, tuple):
                    m = m[0]
                clean = re.sub(r'[^\d.]', '', str(m))
                if clean and clean not in seen:
                    seen.add(clean)
                    try:
                        value = float(clean)
                        amounts.append({
                            "value": str(value),
                            "currency": "USD",
                            "context": "extracted"
                        })
                    except ValueError:
                        continue

        logger.info("amounts_extracted", count=len(amounts), raw_amounts=[a["value"] for a in amounts])
        return amounts[:8]

    def _extract_dates(self, text: str) -> List[str]:
        patterns = [
            r'\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b',
            r'\b(\d{4}[/-]\d{1,2}[/-]\d{1,2})\b',
            r'\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}\b',
        ]
        dates = []
        for pattern in patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            dates.extend(matches)
        return list(set(dates))[:10]

    def _extract_parties(self, text: str) -> List[str]:
        """Improved party extraction."""
        patterns = [
            r'(?:Bill To|To|Vendor|Supplier|Client)[:\s]+([A-Za-z0-9\s&.,]+?)(?=\n|$)',
            r'([A-Z][A-Za-z0-9\s&.,]+(?:Plc|Inc|LLC|Ltd|Corp|Enterprises))',
        ]
        parties = []
        for pattern in patterns:
            matches = re.findall(pattern, text)
            parties.extend([m.strip() for m in matches if len(m.strip()) > 3])
        return list(set(parties))[:6]

    def _extract_clauses(self, text: str) -> List[Dict]:
        """Only extract if it's likely a contract."""
        clause_keywords = ["warranty", "liability", "indemnification", "termination"]
        clauses = []
        text_lower = text.lower()

        for keyword in clause_keywords:
            if keyword in text_lower:
                clauses.append({"type": keyword, "present": True})

        return clauses

    def _extract_invoice_number(self, text: str) -> Optional[str]:
        match = re.search(r'(?:Invoice\s*(?:No|Number|#)[:\s]*)([A-Z0-9\-]+)', text, re.IGNORECASE)
        return match.group(1) if match else None

    def _extract_po_number(self, text: str) -> Optional[str]:
        match = re.search(r'(?:PO|P\.O\.|Purchase Order)[\s#:]*([A-Z0-9\-]+)', text, re.IGNORECASE)
        return match.group(1) if match else None


# Singleton
document_processor = DocumentProcessor()