import React, { useState, useEffect, useCallback } from 'react';
import { Settings, Cpu, Volume2, ShieldCheck, Trash2, X, RefreshCw, Check, Play } from 'lucide-react';
import { fetchModels } from '../services/api';

export default function SettingsModal({
  isOpen,
  onClose,
  activeModel,
  onSelectModel,
  voiceEnabled,
  onToggleVoice,
  speechLanguage = 'en-IN',
  onSelectSpeechLanguage,
  voiceRate,
  onChangeVoiceRate,
  voicePitch,
  onChangeVoicePitch,
  selectedVoiceURI,
  onChangeVoiceURI,
  onClearAllHistory,
  conversationCount,
}) {

  const [activeTab, setActiveTab] = useState('models'); // models, voice, privacy, data
  const [availableModels, setAvailableModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [systemVoices, setSystemVoices] = useState([]);
  const [testVoiceSpeaking, setTestVoiceSpeaking] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);

  const loadInstalledModels = useCallback(async () => {
    setLoadingModels(true);
    try {
      const data = await fetchModels();
      if (data && data.models && data.models.length > 0) {
        setAvailableModels(data.models);
      } else {
        setAvailableModels([activeModel || 'qwen2.5:1.5b']);
      }
    } catch (e) {
      console.warn('Error fetching models:', e);
      setAvailableModels([activeModel || 'qwen2.5:1.5b']);
    } finally {
      setLoadingModels(false);
    }
  }, [activeModel]);

  const loadSystemVoices = useCallback(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const updateVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        setSystemVoices(voices || []);
      };

      updateVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = updateVoices;
      }
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    if (isOpen) {
      fetchModels()
        .then((data) => {
          if (!ignore && data?.models?.length > 0) {
            setAvailableModels(data.models);
          }
        })
        .catch(() => {});
      loadSystemVoices();
    }
    return () => {
      ignore = true;
    };
  }, [isOpen, loadSystemVoices]);

  const marathiVoices = systemVoices.filter((v) =>
    v.lang && (v.lang.toLowerCase().startsWith('mr') || v.lang.toLowerCase().includes('mr-in'))
  );
  const englishVoices = systemVoices.filter((v) =>
    v.lang && (v.lang.toLowerCase().startsWith('en') || v.lang.toLowerCase().includes('en-in') || v.lang.toLowerCase().includes('en-us'))
  );
  const hasMarathiVoice = marathiVoices.length > 0;

  const handleTestVoice = () => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const isMarathi = speechLanguage === 'mr-IN';
    const testText = isMarathi
      ? 'नमस्कार! लोकल एआय व्हॉइस असिस्टंट तुमच्या संगणकावर उत्तम प्रकारे कार्यरत आहे.'
      : 'Hello! Local AI voice assistant is operating locally and ready to assist you.';

    const utterance = new SpeechSynthesisUtterance(testText);
    utterance.rate = voiceRate || 1.0;
    utterance.pitch = voicePitch || 1.0;

    if (selectedVoiceURI && systemVoices.length > 0) {
      const target = systemVoices.find((v) => v.voiceURI === selectedVoiceURI);
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

    utterance.onstart = () => setTestVoiceSpeaking(true);
    utterance.onend = () => setTestVoiceSpeaking(false);
    utterance.onerror = () => setTestVoiceSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-dialog-title"
    >
      <div className="modal-card settings-modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-title">
            <Settings size={18} className="modal-icon rust" />
            <h3 id="settings-dialog-title">Settings</h3>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close settings"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="settings-tabs">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'models' ? 'active' : ''}`}
            onClick={() => setActiveTab('models')}
          >
            <Cpu size={16} />
            <span>AI Models</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'voice' ? 'active' : ''}`}
            onClick={() => setActiveTab('voice')}
          >
            <Volume2 size={16} />
            <span>Voice & Audio</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'privacy' ? 'active' : ''}`}
            onClick={() => setActiveTab('privacy')}
          >
            <ShieldCheck size={16} />
            <span>Privacy & Storage</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'data' ? 'active' : ''}`}
            onClick={() => setActiveTab('data')}
          >
            <Trash2 size={16} />
            <span>History & Data</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="settings-content">
          {activeTab === 'models' && (
            <div className="settings-section">
              <div className="section-row header-row">
                <div>
                  <h4>Local Model Selection</h4>
                  <p className="setting-desc">
                    Choose which locally installed Ollama model generates responses.
                  </p>
                </div>
                <button
                  type="button"
                  className="refresh-btn"
                  onClick={loadInstalledModels}
                  disabled={loadingModels}
                  title="Refresh installed models"
                >
                  <RefreshCw size={14} className={loadingModels ? 'spin' : ''} />
                  <span>Refresh</span>
                </button>
              </div>

              <div className="models-list">
                {availableModels.map((model) => {
                  const isSelected = activeModel === model;
                  const isFast = model.includes('1.5b') || model.includes('0.5b');
                  return (
                    <div
                      key={model}
                      className={`model-card-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => onSelectModel(model)}
                    >
                      <div className="model-info">
                        <div className="model-name-row">
                          <span className="model-name">{model}</span>
                          {isFast && <span className="speed-tag">⚡ Fast CPU</span>}
                        </div>
                        <span className="model-desc">
                          {model.includes('qwen3')
                            ? 'High reasoning capacity local model'
                            : model.includes('1.5b')
                            ? 'Low-latency CPU optimized model'
                            : 'Local Ollama quantized model'}
                        </span>
                      </div>
                      <div className="model-check-box">
                        {isSelected && <Check size={15} className="rust" />}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="info-box-note">
                💡 <strong>Tip:</strong> Need to add models? Run <code>ollama pull &lt;model-name&gt;</code> in your command prompt, then hit <strong>Refresh</strong>.
              </div>
            </div>
          )}

          {activeTab === 'voice' && (
            <div className="settings-section">
              <h4>Voice Mode & Audio Settings</h4>
              <p className="setting-desc">
                Configure speech-to-text recognition and text-to-speech audio for English and Marathi.
              </p>

              {/* Language Selection Setting */}
              <div className="setting-field-group">
                <label className="field-label">Speech & Voice Language</label>
                <div className="voice-lang-options-grid">
                  <button
                    type="button"
                    className={`voice-lang-option-card ${speechLanguage === 'en-IN' ? 'selected' : ''}`}
                    onClick={() => onSelectSpeechLanguage?.('en-IN')}
                  >
                    <div className="voice-lang-badge">EN</div>
                    <div className="voice-lang-details">
                      <span className="voice-lang-title">English (India / Global)</span>
                      <span className="voice-lang-tag">en-IN • Primary model & speech</span>
                    </div>
                    {speechLanguage === 'en-IN' && <Check size={14} className="rust" />}
                  </button>

                  <button
                    type="button"
                    className={`voice-lang-option-card ${speechLanguage === 'mr-IN' ? 'selected' : ''}`}
                    onClick={() => onSelectSpeechLanguage?.('mr-IN')}
                  >
                    <div className="voice-lang-badge">MR</div>
                    <div className="voice-lang-details">
                      <span className="voice-lang-title">मराठी (Marathi)</span>
                      <span className="voice-lang-tag">mr-IN • मराठी भाषण व संभाषण</span>
                    </div>
                    {speechLanguage === 'mr-IN' && <Check size={14} className="rust" />}
                  </button>
                </div>
              </div>

              {/* Marathi Voice Presence Check Notice */}
              {speechLanguage === 'mr-IN' && (
                <div className={`voice-presence-notice ${hasMarathiVoice ? 'success' : 'warning'}`}>
                  {hasMarathiVoice ? (
                    <>
                      <Check size={14} className="notice-icon text-success" />
                      <span>
                        Native Marathi voice detected: <strong>{marathiVoices[0].name}</strong> ({marathiVoices[0].lang})
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="notice-icon">⚠️</span>
                      <div className="notice-content">
                        <strong>No native Marathi voice detected on this browser/OS.</strong>
                        <p>
                          Text speech will fall back to your default system voice. To enable a native Marathi voice, install the Marathi language speech pack in your Windows or OS settings (Settings &gt; Time &amp; Language &gt; Speech).
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Auto-Speak Responses Toggle */}
              <div className="setting-toggle-row">
                <div className="toggle-label-group">
                  <span className="toggle-title">Auto-Speak Responses</span>
                  <span className="toggle-desc">Automatically read AI responses aloud once generation completes (Off by default)</span>
                </div>
                <button
                  type="button"
                  className={`switch-btn ${voiceEnabled ? 'on' : ''}`}
                  onClick={onToggleVoice}
                  aria-label="Toggle auto speak"
                >
                  <span className="switch-knob"></span>
                </button>
              </div>

              {/* System Voice Selection */}
              {systemVoices.length > 0 && (
                <div className="setting-field-group">
                  <label htmlFor="voice-select" className="field-label">Preferred System Voice</label>
                  <select
                    id="voice-select"
                    className="select-input"
                    value={selectedVoiceURI || ''}
                    onChange={(e) => onChangeVoiceURI(e.target.value)}
                  >
                    <option value="">
                      Auto (Default for {speechLanguage === 'mr-IN' ? 'Marathi' : 'English'})
                    </option>
                    {systemVoices.map((v) => (
                      <option key={v.voiceURI} value={v.voiceURI}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Speech Rate */}
              <div className="setting-field-group">
                <div className="slider-header">
                  <label htmlFor="rate-slider" className="field-label">Speech Rate (Speed)</label>
                  <span className="slider-val">{voiceRate?.toFixed(2) || '1.00'}x</span>
                </div>
                <input
                  id="rate-slider"
                  type="range"
                  min="0.75"
                  max="1.5"
                  step="0.05"
                  value={voiceRate || 1.0}
                  onChange={(e) => onChangeVoiceRate(parseFloat(e.target.value))}
                  className="range-slider"
                />
              </div>

              {/* Speech Pitch */}
              <div className="setting-field-group">
                <div className="slider-header">
                  <label htmlFor="pitch-slider" className="field-label">Speech Pitch</label>
                  <span className="slider-val">{voicePitch?.toFixed(2) || '1.00'}x</span>
                </div>
                <input
                  id="pitch-slider"
                  type="range"
                  min="0.8"
                  max="1.3"
                  step="0.05"
                  value={voicePitch || 1.0}
                  onChange={(e) => onChangeVoicePitch(parseFloat(e.target.value))}
                  className="range-slider"
                />
              </div>

              {/* Test Voice Audio Button */}
              <button
                type="button"
                className="test-voice-btn"
                onClick={handleTestVoice}
                disabled={testVoiceSpeaking}
              >
                <Play size={15} />
                <span>
                  {testVoiceSpeaking
                    ? 'Speaking Audio Sample...'
                    : `Test ${speechLanguage === 'mr-IN' ? 'मराठी' : 'English'} Audio Sample`}
                </span>
              </button>
            </div>
          )}


          {activeTab === 'privacy' && (
            <div className="settings-section">
              <h4>Private, Local Execution</h4>
              <p className="setting-desc">
                Your conversations never leave your device.
              </p>

              <div className="specs-grid">
                <div className="spec-card">
                  <span className="spec-title">Database Storage</span>
                  <span className="spec-val">SQLite (WAL Mode)</span>
                  <span className="spec-sub">Local persistent ACID storage</span>
                </div>
                <div className="spec-card">
                  <span className="spec-title">LLM Execution</span>
                  <span className="spec-val">Ollama Local Service</span>
                  <span className="spec-sub">http://localhost:11434</span>
                </div>
                <div className="spec-card">
                  <span className="spec-title">Speech-to-Text</span>
                  <span className="spec-val">faster-whisper CPU (int8)</span>
                  <span className="spec-sub">Web Speech API + local fallback</span>
                </div>
                <div className="spec-card">
                  <span className="spec-title">Cloud Telemetry</span>
                  <span className="spec-val">None (0.00 kB)</span>
                  <span className="spec-sub">100% private, on-device data</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'data' && (
            <div className="settings-section">
              <h4>Conversation History & Storage</h4>
              <p className="setting-desc">
                Conversations are stored in your local SQLite database for reliable persistence across restarts.
              </p>

              <div className="data-stats-row">
                <span>Stored Conversations:</span>
                <strong>{conversationCount}</strong>
              </div>

              {!clearConfirm ? (
                <button
                  type="button"
                  className="danger-btn"
                  onClick={() => setClearConfirm(true)}
                >
                  <Trash2 size={16} />
                  <span>Delete All Conversation History</span>
                </button>
              ) : (
                <div className="confirm-delete-box">
                  <p>Are you sure you want to permanently delete all {conversationCount} conversations?</p>
                  <div className="confirm-actions">
                    <button
                      type="button"
                      className="confirm-danger-btn"
                      onClick={() => {
                        onClearAllHistory();
                        setClearConfirm(false);
                      }}
                    >
                      Yes, Delete Everything
                    </button>
                    <button
                      type="button"
                      className="cancel-btn"
                      onClick={() => setClearConfirm(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
