import os
import re
import math
from typing import List, Dict, Any, Tuple
from pathlib import Path
from backend.utils import logger, safe_remove_file

try:
    import pypdf
except ImportError:
    pypdf = None

try:
    import docx
except ImportError:
    docx = None

MAX_FILE_SIZE = 15 * 1024 * 1024  # 15 MB
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".md", ".json", ".csv"}

def extract_text_from_file(file_path: str, original_filename: str) -> Tuple[str, List[Dict[str, Any]]]:
    """
    Extracts text from PDF, DOCX, TXT, MD, JSON, CSV files.
    Returns (full_text, metadata_list) where metadata_list contains section/page info.
    """
    ext = os.path.splitext(original_filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(f"Unsupported file type '{ext}'. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}")

    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    file_size = os.path.getsize(file_path)
    if file_size > MAX_FILE_SIZE:
        raise ValueError(f"File size ({file_size / (1024*1024):.1f} MB) exceeds maximum allowed limit of 15 MB.")

    full_text = ""
    pages_meta = []

    if ext == ".pdf":
        if pypdf is None:
            raise RuntimeError("pypdf is not installed. PDF extraction unavailable.")
        reader = pypdf.PdfReader(file_path)
        for page_num, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            if text.strip():
                full_text += f"\n[Page {page_num}]\n" + text.strip() + "\n"
                pages_meta.append({"page": page_num, "text": text.strip()})
        if not full_text.strip():
            raise ValueError("The PDF document does not contain any extractable text (it may be scanned images).")

    elif ext == ".docx":
        if docx is None:
            raise RuntimeError("python-docx is not installed. DOCX extraction unavailable.")
        doc = docx.Document(file_path)
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        # Also check tables
        for table in doc.tables:
            for row in table.rows:
                row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text.strip())
                if row_text:
                    paragraphs.append(row_text)
        full_text = "\n\n".join(paragraphs)
        if not full_text.strip():
            raise ValueError("The DOCX document does not contain any readable text.")

    elif ext in {".txt", ".md", ".json", ".csv"}:
        encodings = ["utf-8", "utf-8-sig", "latin-1", "cp1252"]
        content = None
        for enc in encodings:
            try:
                with open(file_path, "r", encoding=enc) as f:
                    content = f.read()
                break
            except UnicodeDecodeError:
                continue
        if content is None:
            raise ValueError("Could not decode file with standard text encodings.")
        full_text = content.strip()
        if not full_text:
            raise ValueError("The uploaded text document is empty.")

    return full_text.strip(), pages_meta

def chunk_text(text: str, chunk_size: int = 700, chunk_overlap: int = 100) -> List[str]:
    """
    Chunks text into smaller semantic blocks with overlap.
    Prefers splitting on paragraph boundaries and sentence endings.
    """
    if not text:
        return []

    # First split by double newlines (paragraphs)
    raw_paras = [p.strip() for p in re.split(r'\n{2,}', text) if p.strip()]
    chunks = []
    current_chunk = ""

    for para in raw_paras:
        if len(current_chunk) + len(para) + 2 <= chunk_size:
            current_chunk = f"{current_chunk}\n\n{para}".strip() if current_chunk else para
        else:
            if current_chunk:
                chunks.append(current_chunk)
            # If a single paragraph is longer than chunk_size, split by sentences
            if len(para) > chunk_size:
                sentences = re.split(r'(?<=[.!?])\s+', para)
                sub_chunk = ""
                for sent in sentences:
                    if len(sub_chunk) + len(sent) + 1 <= chunk_size:
                        sub_chunk = f"{sub_chunk} {sent}".strip() if sub_chunk else sent
                    else:
                        if sub_chunk:
                            chunks.append(sub_chunk)
                        sub_chunk = sent
                if sub_chunk:
                    current_chunk = sub_chunk
                else:
                    current_chunk = ""
            else:
                current_chunk = para

    if current_chunk:
        chunks.append(current_chunk)

    # Filter out empty or trivially small chunks
    valid_chunks = [c.strip() for c in chunks if len(c.strip()) > 20]
    return valid_chunks if valid_chunks else [text[:chunk_size]]

def tokenize(text: str) -> List[str]:
    """Lowercase word tokenizer removing punctuation."""
    return [w.lower() for w in re.findall(r'\b[a-zA-Z0-9_]{2,}\b', text)]

def retrieve_relevant_chunks(
    query: str,
    chunks_with_meta: List[Dict[str, Any]],
    top_k: int = 4
) -> List[Dict[str, Any]]:
    """
    Retrieves the top_k most relevant chunks using BM25-style term frequency / inverse document frequency scoring.
    chunks_with_meta items must have 'content' and 'filename'.
    """
    if not chunks_with_meta or not query.strip():
        return []

    query_tokens = tokenize(query)
    if not query_tokens:
        return chunks_with_meta[:top_k]

    doc_count = len(chunks_with_meta)
    
    # Calculate Document Frequency (DF) for each query term
    df: Dict[str, int] = {}
    chunk_tokens_list: List[List[str]] = []
    
    for item in chunks_with_meta:
        tokens = tokenize(item.get("content", ""))
        chunk_tokens_list.append(tokens)
        unique_tokens = set(tokens)
        for qt in query_tokens:
            if qt in unique_tokens:
                df[qt] = df.get(qt, 0) + 1

    # Average chunk length
    total_len = sum(len(t) for t in chunk_tokens_list)
    avg_len = total_len / max(1, doc_count)

    scored_chunks: List[Tuple[float, Dict[str, Any]]] = []
    k1 = 1.2
    b = 0.75

    for idx, item in enumerate(chunks_with_meta):
        tokens = chunk_tokens_list[idx]
        chunk_len = len(tokens)
        score = 0.0

        for qt in query_tokens:
            if qt not in df or df[qt] == 0:
                continue
            # Term Frequency in current chunk
            tf = tokens.count(qt)
            if tf == 0:
                continue
            # IDF calculation
            idf = math.log((doc_count - df[qt] + 0.5) / (df[qt] + 0.5) + 1.0)
            # BM25 TF component
            tf_comp = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (chunk_len / max(1.0, avg_len))))
            score += idf * tf_comp

        if score > 0:
            scored_chunks.append((score, item))

    # Sort descending by score
    scored_chunks.sort(key=lambda x: x[0], reverse=True)
    results = [item for _, item in scored_chunks[:top_k]]
    
    # If no chunk had matching query words, return the first 2 chunks as fallback context
    if not results and chunks_with_meta:
        results = chunks_with_meta[:min(2, len(chunks_with_meta))]

    return results

def format_document_context(chunks: List[Dict[str, Any]]) -> str:
    """Formats retrieved chunks into a prompt-friendly context block."""
    if not chunks:
        return ""

    context_parts = ["=== RELEVANT DOCUMENT EXCERPTS ==="]
    for idx, c in enumerate(chunks, 1):
        filename = c.get("filename", "Document")
        page_str = f" (Chunk {c.get('chunk_index', idx)})"
        content = c.get("content", "").strip()
        context_parts.append(f"[{idx}] Source: {filename}{page_str}\n{content}")

    context_parts.append("=== END EXCERPTS ===\nInstructions: Base your response directly on the above excerpts whenever relevant. If an excerpt answers the question, cite the source name.")
    return "\n\n".join(context_parts)
