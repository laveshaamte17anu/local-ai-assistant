from typing import List, Dict, Optional, Any
from backend.database import get_conversation, clear_conversation_messages

class ConversationManager:
    """
    Manages in-memory session conversation history for backwards compatibility
    with existing tests and legacy endpoints.
    """
    def __init__(self, max_turns: int = 15):
        self.max_turns = max_turns
        self.history: List[Dict[str, str]] = []
        self.active_conversation_id: Optional[str] = None

    def set_active_conversation(self, conversation_id: str):
        self.active_conversation_id = conversation_id
        conv = get_conversation(conversation_id)
        if conv and "messages" in conv:
            self.history = [
                {"role": m["role"], "content": m["content"]}
                for m in conv["messages"]
            ]
        else:
            self.history = []

    def add_user_message(self, content: str, conversation_id: Optional[str] = None):
        if conversation_id:
            self.active_conversation_id = conversation_id
        self.history.append({"role": "user", "content": content.strip()})
        self._truncate()

    def add_assistant_message(self, content: str, model: Optional[str] = None, conversation_id: Optional[str] = None):
        if conversation_id:
            self.active_conversation_id = conversation_id
        self.history.append({"role": "assistant", "content": content.strip()})
        self._truncate()

    def get_history(self) -> List[Dict[str, str]]:
        return self.history

    def set_history(self, history: List[Dict[str, str]]):
        self.history = [m for m in history if isinstance(m, dict) and "role" in m and "content" in m]
        self._truncate()

    def clear(self, conversation_id: Optional[str] = None):
        self.history = []
        cid = conversation_id or self.active_conversation_id
        if cid:
            clear_conversation_messages(cid)

    def _truncate(self):
        if len(self.history) > self.max_turns * 2:
            self.history = self.history[-(self.max_turns * 2):]

# Global session instance for backwards compatibility
session_conversation = ConversationManager()
