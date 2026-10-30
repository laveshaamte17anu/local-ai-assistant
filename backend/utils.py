import re
import os
import logging
from typing import Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("local-ai-assistant")

def clean_thinking_text(text: str) -> str:
    """
    Removes <think>...</think> reasoning blocks from models like Qwen 3
    while preserving genuine response text, lists, and formatting.
    """
    if not text:
        return ""
    
    # 1. Remove closed <think>...</think> blocks
    cleaned = re.sub(r'<think>[\s\S]*?</think>', '', text)
    
    # 2. If an open <think> remains without a closing tag (incomplete generation), remove from <think> onward
    if '<think>' in cleaned:
        cleaned = cleaned.split('<think>')[0]
        
    # 3. If stray closing </think> remains, take content after it
    if '</think>' in cleaned:
        cleaned = cleaned.split('</think>')[-1]
        
    return cleaned.strip()

class StreamThinkFilter:
    """
    Stateful streaming filter that suppresses <think>...</think> tokens in real time.
    Yields only tokens that are outside thinking blocks.
    """
    def __init__(self):
        self.in_think = False
        self.buffer = ""

    def process_token(self, token: str) -> str:
        self.buffer += token
        output = ""

        while self.buffer:
            if not self.in_think:
                if "<think>" in self.buffer:
                    before, _, after = self.buffer.partition("<think>")
                    output += before
                    self.in_think = True
                    self.buffer = after
                else:
                    # Check if buffer ends with a prefix of '<think>'
                    possible_tag = False
                    for i in range(1, len("<think>")):
                        if self.buffer.endswith("<think>"[:i]):
                            possible_tag = True
                            # Output everything before the prefix
                            safe_len = len(self.buffer) - i
                            if safe_len > 0:
                                output += self.buffer[:safe_len]
                                self.buffer = self.buffer[safe_len:]
                            break
                    if not possible_tag:
                        output += self.buffer
                        self.buffer = ""
                    break
            else:
                if "</think>" in self.buffer:
                    _, _, after = self.buffer.partition("</think>")
                    self.in_think = False
                    self.buffer = after
                else:
                    # In think block, drop buffer except possible partial closing tag '</think>'
                    possible_close = False
                    for i in range(1, len("</think>")):
                        if self.buffer.endswith("</think>"[:i]):
                            possible_close = True
                            self.buffer = self.buffer[-(i):]
                            break
                    if not possible_close:
                        self.buffer = ""
                    break

        return output

    def flush(self) -> str:
        """Returns any remaining buffered text if not inside think."""
        if not self.in_think and self.buffer:
            rem = self.buffer
            self.buffer = ""
            return rem
        return ""

def safe_remove_file(file_path: Optional[str]):
    """Safely deletes temporary files without raising exceptions."""
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
            logger.info(f"Temporary file removed: {file_path}")
        except Exception as e:
            logger.warning(f"Could not remove temporary file {file_path}: {e}")
