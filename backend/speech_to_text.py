import os
import logging
import httpx

# Pre-emptive SSL verification workaround for huggingface_hub on Windows environments
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
try:
    import huggingface_hub.utils._http
    huggingface_hub.utils._http.get_session = lambda: httpx.Client(verify=False)
except Exception:
    pass

from faster_whisper import WhisperModel
from backend.config import WHISPER_MODEL_SIZE, WHISPER_DEVICE, WHISPER_COMPUTE_TYPE
from backend.utils import safe_remove_file

logger = logging.getLogger(__name__)

_whisper_model = None

def get_whisper_model():
    """
    Lazy-loads and caches faster-whisper model instance on CPU int8.
    """
    global _whisper_model
    if _whisper_model is None:
        logger.info(f"Initializing faster-whisper model '{WHISPER_MODEL_SIZE}' on {WHISPER_DEVICE} ({WHISPER_COMPUTE_TYPE})...")
        try:
            _whisper_model = WhisperModel(
                WHISPER_MODEL_SIZE,
                device=WHISPER_DEVICE,
                compute_type=WHISPER_COMPUTE_TYPE,
                cpu_threads=4
            )
            logger.info("Whisper model loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize WhisperModel '{WHISPER_MODEL_SIZE}': {e}")
            logger.info("Attempting fallback to 'tiny' Whisper model...")
            _whisper_model = WhisperModel("tiny", device=WHISPER_DEVICE, compute_type=WHISPER_COMPUTE_TYPE)
    return _whisper_model

def transcribe_audio_file(file_path: str) -> str:
    """
    Transcribes audio file to text using local faster-whisper model with auto language detection.
    Cleans up temp file automatically when finished.
    """
    try:
        model = get_whisper_model()
        # Auto-detect language (allows Marathi, Hindi, English, etc.)
        segments, info = model.transcribe(file_path, beam_size=1)
        text_segments = [segment.text.strip() for segment in segments if segment.text]
        transcription = " ".join(text_segments).strip()
        logger.info(f"Transcription result ({info.language}, prob={info.language_probability:.2f}): '{transcription}'")
        return transcription
    except Exception as e:
        logger.error(f"Transcription error on file {file_path}: {e}")
        raise RuntimeError(f"Speech recognition error: {str(e)}")
    finally:
        safe_remove_file(file_path)
