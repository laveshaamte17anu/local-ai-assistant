import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.utils import clean_thinking_text
from backend.ollama_client import build_chat_messages

def test_clean_thinking_text():
    raw_response = "<think>Calculating the answer to 2+2...</think>The answer is 4."
    cleaned = clean_thinking_text(raw_response)
    assert cleaned == "The answer is 4."

def test_clean_thinking_text_multiline():
    raw_response = "<think>\nStep 1: Think\nStep 2: Reason\n</think>\nHello there!"
    cleaned = clean_thinking_text(raw_response)
    assert cleaned == "Hello there!"

def test_build_chat_messages():
    history = [
        {"role": "user", "content": "What is Python?"},
        {"role": "assistant", "content": "Python is a programming language."}
    ]
    prompt = "Who created it?"
    messages = build_chat_messages(prompt, history)
    assert messages[0]["role"] == "system"
    assert messages[1]["role"] == "user"
    assert messages[1]["content"] == "What is Python?"
    assert messages[2]["role"] == "assistant"
    assert messages[3]["role"] == "user"
    assert messages[3]["content"] == "Who created it?"
