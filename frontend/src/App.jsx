import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import InputBox from './components/InputBox';
import SettingsModal from './components/SettingsModal';
import ExportModal from './components/ExportModal';
import NotesTasksPanel from './components/NotesTasksPanel';
import AIBuddy from './components/AIBuddy';
import { getGreeting, checkIsFirstVisit } from './utils/greeting';
import {
  fetchSystemStatus,
  fetchModels,
  streamChatMessage,
  fetchConversations,
  fetchConversation,
  createConversation,
  updateConversation,
  deleteConversation,
  clearConversationMessages,
  regenerateResponse,
  uploadDocument,
  fetchDocuments,
  deleteDocument,
  trimConversationMessages
} from './services/api';
import { AlertCircle, X, RefreshCw } from 'lucide-react';

const STORAGE_KEYS = {
  ACTIVE_ID: 'localai_active_id',
  MODEL: 'localai_model',
  VOICE_ENABLED: 'localai_voice_enabled',
  VOICE_RATE: 'localai_voice_rate',
  VOICE_PITCH: 'localai_voice_pitch',
  VOICE_URI: 'localai_voice_uri',
  SIDEBAR_OPEN: 'localai_sidebar_open',
  SPEECH_LANG: 'localai_speech_language',
  BUDDY_VISIBLE: 'localai_buddy_visible',
};

export default function App() {
  // --- Persistent & System State ---
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_ID) || null;
  });

  const [activeModel, setActiveModel] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.MODEL) || 'qwen2.5:1.5b';
  });
  const [availableModels, setAvailableModels] = useState(['qwen2.5:1.5b', 'qwen3:4b']);

  // Auto Speak is OFF by default as per requirement 5
  const [voiceEnabled, setVoiceEnabled] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.VOICE_ENABLED);
    return saved !== null ? saved === 'true' : false;
  });

  // Speech language (English en-IN / Marathi mr-IN)
  const [speechLanguage, setSpeechLanguage] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.SPEECH_LANG) || 'en-IN';
  });

  const [voiceRate, setVoiceRate] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.VOICE_RATE);
    return saved ? parseFloat(saved) : 1.0;
  });

  const [voicePitch, setVoicePitch] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.VOICE_PITCH);
    return saved ? parseFloat(saved) : 1.0;
  });

  const [selectedVoiceURI, setSelectedVoiceURI] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.VOICE_URI) || '';
  });

  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) return false;
    const saved = localStorage.getItem(STORAGE_KEYS.SIDEBAR_OPEN);
    return saved !== null ? saved === 'true' : true;
  });

  const [isBuddyVisible, setIsBuddyVisible] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.BUDDY_VISIBLE);
    return saved !== null ? saved === 'true' : true;
  });

  // --- Runtime UI State ---
  const [activeMessages, setActiveMessages] = useState([]);
  const [activeMode, setActiveMode] = useState('chat'); // 'chat' | 'coding' | 'document' | 'study' | 'writing'
  const [attachedDocs, setAttachedDocs] = useState([]);
  const [inputText, setInputText] = useState('');
  const [status, setStatus] = useState('ready'); // ready, listening, transcribing, thinking, speaking, error
  const [statusMessage, setStatusMessage] = useState('● Local Ready');
  const [isRecording, setIsRecording] = useState(false);
  const [interimSpeech, setInterimSpeech] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [ollamaRunning, setOllamaRunning] = useState(true);

  // TTS Playback State
  const [speakingContent, setSpeakingContent] = useState(null);
  const [speakingMessageId, setSpeakingMessageId] = useState(null);
  const [speechPlaybackState, setSpeechPlaybackState] = useState('idle'); // 'idle' | 'speaking' | 'paused'

  // Streaming State
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState(null);
  const abortControllerRef = useRef(null);

  // Modals & Drawers
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isNotesTasksOpen, setIsNotesTasksOpen] = useState(false);

  // Audio & Speech Recognition Refs
  const recognitionRef = useRef(null);
  const baseTextBeforeRecordRef = useRef('');
  const isStartingRecordRef = useRef(false);

  // Check browser speech recognition support
  const isSpeechRecognitionSupported = typeof window !== 'undefined' &&
    !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  // First visit check
  const [isFirstVisit] = useState(() => checkIsFirstVisit());

  // Dynamic stable greeting per conversation / new chat session
  const currentGreeting = useMemo(() => {
    return getGreeting({
      seed: activeConversationId || 'default',
      isFirstVisit,
      hasHistory: conversations.length > 0,
    });
  }, [activeConversationId, isFirstVisit, conversations.length]);

  // Active Conversation Helper
  const activeConversation = conversations.find((c) => c.id === activeConversationId) || null;

  // --- Sync Preferences to LocalStorage ---
  useEffect(() => {
    if (activeConversationId) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_ID, activeConversationId);
    }
  }, [activeConversationId]);

  useEffect(() => {
    if (activeModel) {
      localStorage.setItem(STORAGE_KEYS.MODEL, activeModel);
    }
  }, [activeModel]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.VOICE_ENABLED, String(voiceEnabled));
  }, [voiceEnabled]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SPEECH_LANG, speechLanguage);
  }, [speechLanguage]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.VOICE_RATE, String(voiceRate));
  }, [voiceRate]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.VOICE_PITCH, String(voicePitch));
  }, [voicePitch]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.VOICE_URI, selectedVoiceURI);
  }, [selectedVoiceURI]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SIDEBAR_OPEN, String(isSidebarOpen));
  }, [isSidebarOpen]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.BUDDY_VISIBLE, String(isBuddyVisible));
  }, [isBuddyVisible]);


  // --- Load System & Ollama Status ---
  const verifySystemStatus = useCallback(async () => {
    setStatus('checking');
    setStatusMessage('Checking Ollama...');
    try {
      const statusData = await fetchSystemStatus();
      const ollamaData = statusData.ollama || {};
      const isConnected = !!ollamaData.connected;
      setOllamaRunning(isConnected);

      if (!isConnected) {
        setStatus('disconnected');
        setStatusMessage(ollamaData.status === 'timeout' ? 'Connection Timeout' : 'Ollama Offline');
        setErrorMessage(
          ollamaData.error || 'Ollama is not running. Please ensure Ollama is started at http://localhost:11434.'
        );
        return;
      }

      // Check installed models
      const modelsData = await fetchModels().catch(() => ({ models: [] }));
      const installedModels = modelsData?.models || [];
      if (installedModels.length > 0) {
        setAvailableModels(installedModels);
        // If current active model is missing, switch to first installed
        let currentModel = activeModel;
        if (!installedModels.includes(activeModel)) {
          currentModel = installedModels[0];
          setActiveModel(currentModel);
        }
        setStatus('connected');
        setStatusMessage(`Connected (${currentModel})`);
        setErrorMessage('');
      } else {
        setStatus('model_unavailable');
        setStatusMessage('Model Unavailable');
        setErrorMessage(
          'Ollama is connected, but no models are installed. Please run "ollama pull qwen2.5:1.5b" or "ollama pull qwen3:4b".'
        );
      }
    } catch (err) {
      console.warn('Backend reachability notice:', err);
      setOllamaRunning(false);
      setStatus('disconnected');
      setStatusMessage('Backend Offline');
      setErrorMessage('FastAPI backend (port 8002) is unreachable. Please verify server is running.');
    }
  }, [activeModel]);

  // --- Load Conversations from SQLite Database ---
  const loadConversationsFromDB = useCallback(async () => {
    try {
      const data = await fetchConversations();
      const list = data.conversations || [];
      setConversations(list);

      if (list.length > 0) {
        const targetId = activeConversationId && list.some((c) => c.id === activeConversationId)
          ? activeConversationId
          : list[0].id;
        setActiveConversationId(targetId);
      } else {
        // Create initial conversation
        const fresh = await createConversation({
          title: 'New Conversation',
          model: activeModel,
          mode: 'chat',
        });
        setConversations([fresh]);
        setActiveConversationId(fresh.id);
      }
    } catch (err) {
      console.warn('Could not fetch conversations from SQLite, creating fallback:', err);
    }
  }, [activeConversationId, activeModel]);

  useEffect(() => {
    verifySystemStatus();
    loadConversationsFromDB();
  }, [verifySystemStatus, loadConversationsFromDB]);

  // --- Load Messages & Documents for Active Conversation ---
  useEffect(() => {
    if (!activeConversationId) return;

    let ignore = false;
    const fetchActiveDetails = async () => {
      try {
        const conv = await fetchConversation(activeConversationId);
        if (!ignore && conv) {
          setActiveMessages(conv.messages || []);
          setActiveMode(conv.mode || 'chat');
          if (conv.model && availableModels.includes(conv.model)) {
            setActiveModel(conv.model);
          }
        }
        const docsRes = await fetchDocuments(activeConversationId);
        if (!ignore) {
          setAttachedDocs(docsRes.documents || []);
        }
      } catch (err) {
        console.warn('Failed to load active conversation messages:', err);
      }
    };

    fetchActiveDetails();
    return () => {
      ignore = true;
    };
  }, [activeConversationId, availableModels]);

  // Clean markdown tokens for natural speech reading
  const cleanTextForSpeech = useCallback((raw) => {
    if (!raw) return '';
    return raw
      .replace(/```[\s\S]*?```/g, 'Code block omitted.')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/^#+\s+/gm, '')
      .replace(/[*_~>]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .trim();
  }, []);

  // --- Comprehensive Speech Synthesis (TTS) Suite ---
  const stopSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (err) {
        console.warn('Speech synthesis cancel error:', err);
      }
    }
    setSpeechPlaybackState('idle');
    setSpeakingContent(null);
    setSpeakingMessageId(null);
    setStatus('ready');
    setStatusMessage('● Local Ready');
  }, []);

  const pauseSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.pause();
        setSpeechPlaybackState('paused');
        setStatusMessage('⏸ Speech paused');
      } catch (err) {
        console.warn('Speech pause error:', err);
      }
    }
  }, []);

  const resumeSpeaking = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.resume();
        setSpeechPlaybackState('speaking');
        setStatusMessage(speechLanguage === 'mr-IN' ? '🔊 उत्तर वाचत आहे...' : '🔊 Reading response aloud...');
      } catch (err) {
        console.warn('Speech resume error:', err);
      }
    }
  }, [speechLanguage]);

  const speakMessage = useCallback(
    (text, messageId = null) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        setErrorMessage('Speech synthesis is not supported in this browser.');
        return;
      }

      try {
        // Prevent multiple responses from speaking simultaneously
        window.speechSynthesis.cancel();

        const speechScript = cleanTextForSpeech(text) || text;
        const utterance = new SpeechSynthesisUtterance(speechScript);
        utterance.rate = voiceRate;
        utterance.pitch = voicePitch;

        const isMarathi = speechLanguage === 'mr-IN';
        const voices = window.speechSynthesis.getVoices() || [];
        const marathiVoices = voices.filter((v) =>
          v.lang && (v.lang.toLowerCase().startsWith('mr') || v.lang.toLowerCase().includes('mr-in'))
        );
        const englishVoices = voices.filter((v) =>
          v.lang && (v.lang.toLowerCase().startsWith('en') || v.lang.toLowerCase().includes('en-in') || v.lang.toLowerCase().includes('en-us'))
        );

        if (selectedVoiceURI) {
          const target = voices.find((v) => v.voiceURI === selectedVoiceURI);
          if (target) utterance.voice = target;
        } else if (isMarathi && marathiVoices.length > 0) {
          utterance.voice = marathiVoices[0];
          utterance.lang = 'mr-IN';
        } else if (!isMarathi && englishVoices.length > 0) {
          utterance.voice = englishVoices[0];
          utterance.lang = 'en-IN';
        } else {
          utterance.lang = isMarathi ? 'mr-IN' : 'en-IN';
        }

        utterance.onstart = () => {
          setSpeechPlaybackState('speaking');
          setSpeakingContent(text);
          setSpeakingMessageId(messageId);
          setStatus('speaking');
          setStatusMessage(isMarathi ? '🔊 उत्तर वाचत आहे...' : '🔊 Reading response aloud...');
        };

        utterance.onpause = () => {
          setSpeechPlaybackState('paused');
          setStatusMessage('⏸ Speech paused');
        };

        utterance.onresume = () => {
          setSpeechPlaybackState('speaking');
          setStatusMessage(isMarathi ? '🔊 उत्तर वाचत आहे...' : '🔊 Reading response aloud...');
        };

        utterance.onend = () => {
          setSpeechPlaybackState('idle');
          setSpeakingContent(null);
          setSpeakingMessageId(null);
          setStatus('ready');
          setStatusMessage('● Local Ready');
        };

        utterance.onerror = (e) => {
          // If error was triggered by user cancellation, don't show error banner
          if (e.error !== 'canceled' && e.error !== 'interrupted') {
            console.warn('Speech synthesis playback error:', e);
          }
          setSpeechPlaybackState('idle');
          setSpeakingContent(null);
          setSpeakingMessageId(null);
          setStatus('ready');
          setStatusMessage('● Local Ready');
        };

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.warn('Speech synthesis error:', err);
        stopSpeaking();
      }
    },
    [voiceRate, voicePitch, selectedVoiceURI, speechLanguage, cleanTextForSpeech, stopSpeaking]
  );

  // Automatically cancel speech on component unmount or page exit
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);


  // --- Multi-Chat Handlers ---
  const handleNewChat = useCallback(async () => {
    window.speechSynthesis?.cancel();
    setSpeakingContent(null);
    try {
      const fresh = await createConversation({
        title: 'New Conversation',
        model: activeModel,
        mode: activeMode,
      });
      setConversations((prev) => [fresh, ...prev]);
      setActiveConversationId(fresh.id);
      setActiveMessages([]);
      setAttachedDocs([]);
      setInputText('');
      setErrorMessage('');
      setStatus('ready');
      setStatusMessage('● Local Ready');
    } catch (err) {
      console.error('Failed to create new conversation in DB:', err);
    }
  }, [activeModel, activeMode]);

  const handleSelectConversation = (id) => {
    window.speechSynthesis?.cancel();
    setSpeakingContent(null);
    setActiveConversationId(id);
    setErrorMessage('');
    setStatus('ready');
    setStatusMessage('● Local Ready');
  };

  const handleDeleteConversation = async (id) => {
    window.speechSynthesis?.cancel();
    setSpeakingContent(null);
    try {
      await deleteConversation(id);
      const remaining = conversations.filter((c) => c.id !== id);
      setConversations(remaining);
      if (id === activeConversationId) {
        if (remaining.length > 0) {
          setActiveConversationId(remaining[0].id);
        } else {
          handleNewChat();
        }
      }
    } catch (err) {
      console.error('Failed to delete conversation from DB:', err);
    }
  };

  const handleRenameConversation = async (id, newTitle) => {
    try {
      await updateConversation(id, { title: newTitle });
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c))
      );
    } catch (err) {
      console.error('Failed to rename conversation in DB:', err);
    }
  };

  const handleSelectMode = async (newMode) => {
    setActiveMode(newMode);
    if (activeConversationId) {
      try {
        await updateConversation(activeConversationId, { mode: newMode });
        setConversations((prev) =>
          prev.map((c) => (c.id === activeConversationId ? { ...c, mode: newMode } : c))
        );
      } catch (err) {
        console.warn('Failed to update conversation mode:', err);
      }
    }
  };

  const handleSelectModel = async (newModel) => {
    setActiveModel(newModel);
    if (activeConversationId) {
      try {
        await updateConversation(activeConversationId, { model: newModel });
        setConversations((prev) =>
          prev.map((c) => (c.id === activeConversationId ? { ...c, model: newModel } : c))
        );
      } catch (err) {
        console.warn('Failed to update conversation model:', err);
      }
    }
  };

  const handleClearCurrentChat = async () => {
    window.speechSynthesis?.cancel();
    setSpeakingContent(null);
    if (!activeConversationId) return;

    try {
      await clearConversationMessages(activeConversationId);
      setActiveMessages([]);
      setStatus('ready');
      setStatusMessage('● Local Ready');
      setErrorMessage('');
    } catch (err) {
      console.error('Failed to clear conversation in DB:', err);
    }
  };

  const handleClearAllHistory = async () => {
    window.speechSynthesis?.cancel();
    setSpeakingContent(null);
    for (const c of conversations) {
      try {
        await deleteConversation(c.id);
      } catch {
        // continue
      }
    }
    handleNewChat();
    setIsSettingsOpen(false);
  };

  // --- Document Upload & Management ---
  const handleUploadDocument = async (file) => {
    if (!file || !activeConversationId) return;
    setStatus('transcribing');
    setStatusMessage(`📄 Processing ${file.name}...`);
    try {
      const res = await uploadDocument(activeConversationId, file);
      if (res.document) {
        setAttachedDocs((prev) => [res.document, ...prev]);
      }
      setStatus('ready');
      setStatusMessage('● Document attached');
    } catch (err) {
      setStatus('error');
      setStatusMessage('● Upload Error');
      setErrorMessage(err.message || 'Failed to extract text from uploaded document.');
    }
  };

  const handleDeleteAttachedDoc = async (docId) => {
    try {
      await deleteDocument(docId);
      setAttachedDocs((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      console.error('Failed to delete document:', err);
    }
  };


  // --- Send Message & Real Token Streaming ---
  const handleSendMessage = async (textToSend) => {
    const prompt = (textToSend || inputText || '').trim();
    if (!prompt || isStreaming) return;

    window.speechSynthesis?.cancel();
    setSpeakingContent(null);

    const userMessageId = `msg_${Date.now()}_u`;
    const now = new Date().toISOString();
    const userMsg = {
      id: userMessageId,
      role: 'user',
      content: prompt,
      created_at: now,
    };

    // Auto-title conversation on first message
    let currentTitle = activeConversation?.title || 'New Conversation';
    if (currentTitle === 'New Conversation' && activeMessages.length === 0) {
      const autoTitle = prompt.length > 36 ? `${prompt.slice(0, 36).trim()}...` : prompt;
      currentTitle = autoTitle;
      handleRenameConversation(activeConversationId, autoTitle);
    }

    // Add user message to UI immediately
    const updatedMessages = [...activeMessages, userMsg];
    setActiveMessages(updatedMessages);
    setInputText('');

    // Setup streaming assistant message placeholder
    const assistantMessageId = `msg_${Date.now()}_a`;
    const placeholderAssistantMsg = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      model: activeModel,
      created_at: new Date().toISOString(),
    };
    setActiveMessages([...updatedMessages, placeholderAssistantMsg]);

    setStatus('thinking');
    setStatusMessage(`🤔 Querying ${activeModel}...`);
    setErrorMessage('');
    setIsStreaming(true);
    setStreamingMessageId(assistantMessageId);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      await streamChatMessage({
        message: prompt,
        conversationId: activeConversationId,
        history: activeMessages.map((m) => ({ role: m.role, content: m.content })),
        model: activeModel,
        mode: activeMode,
        signal: abortController.signal,
        onToken: (_tok, accumulatedText, usedModel) => {
          setStatus('speaking');
          setStatusMessage(`⚡ Streaming from ${usedModel || activeModel}...`);
          setActiveMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId
                ? { ...m, content: accumulatedText, model: usedModel || activeModel }
                : m
            )
          );
        },
        onDone: (finalText, usedModel) => {
          setIsStreaming(false);
          setStatus('ready');
          setStatusMessage('● Local Ready');
          setActiveMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId
                ? { ...m, content: finalText, model: usedModel || activeModel }
                : m
            )
          );
          if (voiceEnabled && finalText) {
            speakMessage(finalText, assistantMessageId);
          }
        },
        onError: (err) => {
          setIsStreaming(false);
          setStatus('error');
          setStatusMessage('● Generation Error');
          const errText = err.message || 'Generation failed.';
          setErrorMessage(errText);
          setActiveMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId
                ? {
                    ...m,
                    content: `⚠️ Error: ${errText}\n\nPlease check Ollama status at http://localhost:11434 with model \`${activeModel}\`.`,
                  }
                : m
            )
          );
        },
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        setStatus('error');
        setStatusMessage('● Request Error');
        setErrorMessage(err.message || 'Error occurred communicating with local AI.');
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsStreaming(false);
      setStatus('ready');
      setStatusMessage('● Local Ready (Stopped)');
    }
  }, []);

  // --- Regenerate Assistant Response ---
  const handleRegenerate = async (_targetAssistantMsg) => {
    if (!activeConversationId || isStreaming) return;
    setStatus('thinking');
    setStatusMessage(`🤔 Regenerating response with ${activeModel}...`);

    try {
      const res = await regenerateResponse(activeConversationId, activeModel);
      if (res.conversation?.messages) {
        setActiveMessages(res.conversation.messages);
      }
      setStatus('ready');
      setStatusMessage('● Local Ready');
      if (voiceEnabled && res.response) {
        speakMessage(res.response);
      }
    } catch (err) {
      setStatus('error');
      setStatusMessage('● Regenerate Error');
      setErrorMessage(err.message || 'Failed to regenerate response.');
    }
  };

  // --- Edit User Message & Resend ---
  const handleEditMessage = async (messageId, newContent) => {
    if (!activeConversationId || isStreaming) return;
    try {
      // Trim subsequent messages from backend database
      await trimConversationMessages(activeConversationId, messageId);
      // Trim local state so conversation history accurately reflects the branch point
      const msgIndex = activeMessages.findIndex((m) => m.id === messageId);
      if (msgIndex !== -1) {
        setActiveMessages(activeMessages.slice(0, msgIndex));
      }
      // Send the edited content
      await handleSendMessage(newContent);
    } catch (err) {
      console.error('Failed to edit and resend message:', err);
      setErrorMessage(err.message || 'Failed to edit message.');
    }
  };

  // --- Microphone & STT Handling (Web Speech API) ---
  const handleStartRecord = useCallback(() => {
    // Stop any active TTS audio
    stopSpeaking();
    setErrorMessage('');

    // Verify browser support gracefully
    const SpeechRecognition =
      typeof window !== 'undefined'
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;

    if (!SpeechRecognition) {
      setStatus('ready');
      setStatusMessage('● Voice input unavailable in this browser');
      setErrorMessage(
        'Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge for microphone voice input.'
      );
      return;
    }

    // Prevent duplicate microphone sessions or double clicks
    if (isRecording || isStartingRecordRef.current) {
      return;
    }

    isStartingRecordRef.current = true;
    baseTextBeforeRecordRef.current = inputText;
    setInterimSpeech('');

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = speechLanguage; // 'en-IN' or 'mr-IN'
      recognition.maxAlternatives = 1;

      recognitionRef.current = recognition;

      recognition.onstart = () => {
        isStartingRecordRef.current = false;
        setIsRecording(true);
        setStatus('listening');
        setStatusMessage(
          speechLanguage === 'mr-IN'
            ? '🔴 ऐकत आहे (मराठी mr-IN)... बोला'
            : '🔴 Listening (English en-IN)... Speak now'
        );
      };

      recognition.onresult = (event) => {
        let finalTranscript = '';
        let currentInterim = '';

        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            currentInterim += result[0].transcript;
          }
        }

        setInterimSpeech(currentInterim);

        const base = baseTextBeforeRecordRef.current ? baseTextBeforeRecordRef.current.trim() : '';
        const speechPart = (finalTranscript + (currentInterim ? ' ' + currentInterim : '')).trim();
        const combined = base ? `${base} ${speechPart}` : speechPart;

        setInputText(combined);

        const previewSnippet = (speechPart || currentInterim).trim();
        if (previewSnippet) {
          setStatusMessage(
            speechLanguage === 'mr-IN'
              ? `🔴 थेट भाषण: "${previewSnippet.slice(-28)}"`
              : `🔴 Live Speech: "${previewSnippet.slice(-28)}"`
          );
        }
      };

      recognition.onerror = (event) => {
        isStartingRecordRef.current = false;
        console.warn('Speech recognition notice:', event.error);

        if (event.error === 'no-speech') {
          setStatusMessage(
            speechLanguage === 'mr-IN'
              ? '● आवाज आला नाही. कृपया पुन्हा बोला किंवा Done दाबा.'
              : '● No speech detected. Speak or tap Done.'
          );
          return;
        }

        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setIsRecording(false);
          setStatus('error');
          setStatusMessage('● Mic Access Denied');
          setErrorMessage(
            'Microphone permission was denied. Please allow microphone access in your browser site permissions.'
          );
          return;
        }

        if (event.error === 'network') {
          setIsRecording(false);
          setStatus('error');
          setStatusMessage('● Network Speech Error');
          setErrorMessage(
            'Speech recognition network error. Please check your internet connectivity.'
          );
          return;
        }

        if (event.error !== 'aborted') {
          setErrorMessage(`Speech recognition notice: ${event.error}`);
        }
      };

      recognition.onend = () => {
        isStartingRecordRef.current = false;
        setIsRecording(false);
        setInterimSpeech('');
        recognitionRef.current = null;
        setStatus('ready');
        setStatusMessage('● Local Ready (Review your transcript)');
        // NOTE: We intentionally preserve the recognized text in the input box so
        // the user can review and edit before clicking Send.
      };

      recognition.start();
    } catch (err) {
      isStartingRecordRef.current = false;
      setIsRecording(false);
      console.warn('Web Speech API initialization error:', err);
      setStatus('error');
      setStatusMessage('● Speech Init Error');
      setErrorMessage('Failed to start speech recognition. Please try clicking the microphone again.');
    }
  }, [inputText, isRecording, speechLanguage, stopSpeaking]);

  const handleStopRecord = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn(e);
      }
    }
    isStartingRecordRef.current = false;
    setIsRecording(false);
    setInterimSpeech('');
    setStatus('ready');
    setStatusMessage('● Local Ready (Review & send)');
  }, []);

  const handleCancelRecord = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    }
    isStartingRecordRef.current = false;
    setIsRecording(false);
    setInterimSpeech('');
    // Discard speech and restore prior text
    setInputText(baseTextBeforeRecordRef.current || '');
    setStatus('ready');
    setStatusMessage('● Local Ready (Recording discarded)');
  }, []);


  // --- Keyboard Shortcuts (Ctrl+N, Ctrl+,, Esc) ---
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleNewChat();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        setIsSettingsOpen(true);
      }
      if (e.key === 'Escape') {
        if (isStreaming) handleStopStreaming();
        if (isSettingsOpen) setIsSettingsOpen(false);
        if (isExportOpen) setIsExportOpen(false);
        if (isNotesTasksOpen) setIsNotesTasksOpen(false);
        if (isRecording) handleStopRecord();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isSettingsOpen, isExportOpen, isNotesTasksOpen, isRecording, isStreaming, handleNewChat, handleStopRecord, handleStopStreaming]);

  return (
    <div className="app-shell">
      {/* Collapsible Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        onRenameConversation={handleRenameConversation}
        activeModel={activeModel}
        onOpenSettings={() => setIsSettingsOpen(true)}
        voiceEnabled={voiceEnabled}
        onToggleVoice={() => setVoiceEnabled(!voiceEnabled)}
        ollamaRunning={ollamaRunning}
      />

      {/* Main Conversation Canvas */}
      <div className="app-main-canvas">
        <Header
          status={status}
          statusMessage={statusMessage}
          activeModel={activeModel}
          onSelectModel={handleSelectModel}
          availableModels={availableModels}
          conversationTitle={activeConversation?.title}
          mode={activeMode}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          voiceEnabled={voiceEnabled}
          onToggleVoice={() => setVoiceEnabled(!voiceEnabled)}
          onClearChat={handleClearCurrentChat}
          onOpenExport={() => setIsExportOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onToggleNotesTasks={() => setIsNotesTasksOpen(!isNotesTasksOpen)}
          isNotesTasksOpen={isNotesTasksOpen}
          hasMessages={activeMessages.length > 0}
          isBuddyVisible={isBuddyVisible}
          onToggleBuddy={() => setIsBuddyVisible(!isBuddyVisible)}
        />

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="error-banner-bar" role="alert">
            <div className="error-banner-content">
              <AlertCircle size={16} className="error-banner-icon" />
              <span className="error-banner-text">{errorMessage}</span>
            </div>
            <div className="error-banner-actions">
              <button
                type="button"
                className="error-retry-btn"
                onClick={verifySystemStatus}
                title="Retry connecting to local services"
              >
                <RefreshCw size={13} />
                <span>Retry</span>
              </button>
              <button
                type="button"
                className="error-dismiss-btn"
                onClick={() => setErrorMessage('')}
                aria-label="Dismiss error notice"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        )}

        {/* Conversation Area with Animated AI Buddy Companion */}
        <div className="chat-content-viewport">
          <ChatWindow
            messages={activeMessages}
            status={status}
            activeModel={activeModel}
            greeting={currentGreeting}
            onSelectPrompt={(prompt) => {
              setInputText(prompt);
              handleSendMessage(prompt);
            }}
            onSpeakMessage={speakMessage}
            onPauseSpeakMessage={pauseSpeaking}
            onResumeSpeakMessage={resumeSpeaking}
            onStopSpeakMessage={stopSpeaking}
            speechPlaybackState={speechPlaybackState}
            speakingMessageId={speakingMessageId}
            speakingContent={speakingContent}
            onRegenerate={handleRegenerate}
            onEditMessage={handleEditMessage}
            isStreaming={isStreaming}
            streamingMessageId={streamingMessageId}
            mode={activeMode}
            onSelectMode={handleSelectMode}
            attachedDocuments={attachedDocs}
            onUploadClick={() => document.querySelector('input[type="file"]')?.click()}
          />

          {isBuddyVisible && (
            <AIBuddy
              status={status}
              statusMessage={statusMessage}
              isRecording={isRecording}
              isStreaming={isStreaming}
              speechPlaybackState={speechPlaybackState}
              voiceEnabled={voiceEnabled}
              onToggleVoice={() => setVoiceEnabled(!voiceEnabled)}
              onStopSpeaking={stopSpeaking}
              activeModel={activeModel}
              activeMode={activeMode}
              isNotesTasksOpen={isNotesTasksOpen}
              greeting={currentGreeting}
              hasMessages={activeMessages.length > 0}
            />
          )}
        </div>

        {/* Bottom Input Composer with Stop Generation */}
        <InputBox
          text={inputText}
          onTextChange={setInputText}
          onSendMessage={handleSendMessage}
          isRecording={isRecording}
          onStartRecord={handleStartRecord}
          onStopRecord={handleStopRecord}
          onCancelRecord={handleCancelRecord}
          interimSpeech={interimSpeech}
          speechLanguage={speechLanguage}
          onSelectSpeechLanguage={setSpeechLanguage}
          isSpeechRecognitionSupported={isSpeechRecognitionSupported}
          disabled={status === 'thinking' || status === 'transcribing'}
          isStreaming={isStreaming}
          onStopStreaming={handleStopStreaming}
          activeModel={activeModel}
          onUploadDocument={handleUploadDocument}
          attachedDocuments={attachedDocs}
          onDeleteDocument={handleDeleteAttachedDoc}
          mode={activeMode}
        />
      </div>

      {/* Notes & Tasks Slide-over Panel */}
      <NotesTasksPanel
        isOpen={isNotesTasksOpen}
        onClose={() => setIsNotesTasksOpen(false)}
        onInsertToPrompt={(snippet) => setInputText((prev) => (prev ? `${prev}\n\n${snippet}` : snippet))}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        activeModel={activeModel}
        onSelectModel={handleSelectModel}
        voiceEnabled={voiceEnabled}
        onToggleVoice={() => setVoiceEnabled(!voiceEnabled)}
        speechLanguage={speechLanguage}
        onSelectSpeechLanguage={setSpeechLanguage}
        voiceRate={voiceRate}
        onChangeVoiceRate={setVoiceRate}
        voicePitch={voicePitch}
        onChangeVoicePitch={setVoicePitch}
        selectedVoiceURI={selectedVoiceURI}
        onChangeVoiceURI={setSelectedVoiceURI}
        onClearAllHistory={handleClearAllHistory}
        conversationCount={conversations.length}
      />

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        conversation={activeConversation}
        activeModel={activeModel}
      />
    </div>
  );
}
