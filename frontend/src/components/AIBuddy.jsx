import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, VolumeX, Square, Minus } from 'lucide-react';
import './AIBuddy.css';

const FRIENDLY_REMARKS = [
  'Hey there! 👋',
  'Ready when you are!',
  'How can I help you today?',
  'Ask me anything!',
  'I am right here!',
];

export default function AIBuddy({
  status = 'ready',
  isRecording = false,
  isStreaming = false,
  speechPlaybackState = 'idle', // 'idle' | 'speaking' | 'paused'
  voiceEnabled = false,
  onToggleVoice,
  onStopSpeaking,
  activeModel = 'local AI',
  isNotesTasksOpen = false,
  greeting = '',
  hasMessages = false,
}) {
  const [isMinimized, setIsMinimized] = useState(() => {
    try {
      return localStorage.getItem('localai_buddy_minimized') === 'true';
    } catch {
      return false;
    }
  });

  const [isHappy, setIsHappy] = useState(false);
  const [isClicked, setIsClicked] = useState(false);
  const [remark, setRemark] = useState('');
  const happyTimerRef = useRef(null);
  const clickTimerRef = useRef(null);
  const prevStreamingRef = useRef(isStreaming);
  const prevSpeechRef = useRef(speechPlaybackState);

  const toggleMinimize = useCallback(() => {
    setIsMinimized((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('localai_buddy_minimized', String(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const showHappy = useCallback((ms = 2200) => {
    if (happyTimerRef.current) clearTimeout(happyTimerRef.current);
    setIsHappy(true);
    happyTimerRef.current = setTimeout(() => {
      setIsHappy(false);
      happyTimerRef.current = null;
    }, ms);
  }, []);

  // When AI finishes responding
  useEffect(() => {
    if (prevStreamingRef.current && !isStreaming && status !== 'error') {
      if (speechPlaybackState !== 'speaking') {
        const timer = setTimeout(() => showHappy(2200), 0);
        return () => clearTimeout(timer);
      }
    }
    prevStreamingRef.current = isStreaming;
  }, [isStreaming, status, speechPlaybackState, showHappy]);

  // When speech finishes playing
  useEffect(() => {
    if (prevSpeechRef.current === 'speaking' && speechPlaybackState === 'idle') {
      const timer = setTimeout(() => showHappy(1800), 0);
      return () => clearTimeout(timer);
    }
    prevSpeechRef.current = speechPlaybackState;
  }, [speechPlaybackState, showHappy]);

  useEffect(() => {
    return () => {
      if (happyTimerRef.current) clearTimeout(happyTimerRef.current);
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    };
  }, []);

  // Determine active state with strict priority
  let charState = 'idle';
  if (isRecording || status === 'listening') {
    charState = 'listening';
  } else if (speechPlaybackState === 'speaking') {
    charState = 'speaking';
  } else if (speechPlaybackState === 'paused') {
    charState = 'paused';
  } else if (status === 'thinking' || isStreaming) {
    charState = 'thinking';
  } else if (isHappy || isClicked) {
    charState = 'happy';
  } else if (status === 'error') {
    charState = 'error';
  }

  // Click interaction on mascot
  const handleMascotClick = () => {
    setIsClicked(true);
    showHappy(2200);

    const pick = FRIENDLY_REMARKS[Math.floor(Math.random() * FRIENDLY_REMARKS.length)];
    setRemark(pick);

    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => {
      setIsClicked(false);
      setRemark('');
      clickTimerRef.current = null;
    }, 2400);
  };

  // Status label
  const getStatusLabel = () => {
    switch (charState) {
      case 'listening':
        return "I'm listening...";
      case 'thinking':
        return 'Thinking...';
      case 'speaking':
        return 'Speaking...';
      case 'paused':
        return 'Speech paused';
      case 'happy':
        return 'Ready to chat';
      case 'error':
        return 'Needs attention';
      default:
        return 'Ready to chat';
    }
  };

  // Greeting speech text
  const getSpeechText = () => {
    if (remark) return remark;
    switch (charState) {
      case 'listening':
        return 'Listening to you...';
      case 'thinking':
        return `Thinking with ${activeModel}...`;
      case 'speaking':
        return 'Reading aloud...';
      case 'paused':
        return 'Speech paused';
      case 'happy':
        return 'Hope that helps!';
      case 'error':
        return 'Oops, something went wrong.';
      default:
        if (!hasMessages && greeting) {
          return greeting;
        }
        return 'Hey! Ready to help.';
    }
  };

  // Mascot SVG drawing
  const renderMascot = () => {
    const eyeColor =
      charState === 'listening'
        ? '#ef4444'
        : charState === 'happy'
        ? '#4ade80'
        : charState === 'paused'
        ? '#eab308'
        : '#38bdf8';

    return (
      <svg
        viewBox="0 0 100 100"
        className="buddy-svg"
        style={{ '--eye-color': eyeColor }}
        aria-hidden="true"
      >
        <g className="buddy-head">
          {/* Antenna */}
          <line
            x1="50"
            y1="24"
            x2="50"
            y2="13"
            stroke="#475569"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="50" cy="11" r="4.5" className="buddy-antenna" />

          {/* Ears */}
          <rect x="15" y="38" width="5" height="16" rx="2.5" fill="#334155" />
          <rect x="80" y="38" width="5" height="16" rx="2.5" fill="#334155" />

          {/* Head Body */}
          <rect
            x="20"
            y="24"
            width="60"
            height="50"
            rx="16"
            fill="#1e293b"
            stroke="#334155"
            strokeWidth="1.5"
          />

          {/* Visor Screen */}
          <rect x="26" y="30" width="48" height="38" rx="10" fill="#0b111e" />

          {/* Soft Blush */}
          <circle cx="33" cy="55" r="3" fill="#f43f5e" className="buddy-blush" />
          <circle cx="67" cy="55" r="3" fill="#f43f5e" className="buddy-blush" />

          {/* Eyes */}
          {charState === 'happy' && !isClicked ? (
            // Smiling crescents (^ ^)
            <g>
              <path
                d="M 33 44 Q 38 36 43 44"
                stroke={eyeColor}
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
              <path
                d="M 57 44 Q 62 36 67 44"
                stroke={eyeColor}
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
            </g>
          ) : isClicked ? (
            // Playful wink (^ -)
            <g>
              <path
                d="M 33 44 Q 38 36 43 44"
                stroke={eyeColor}
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
              <line
                x1="57"
                y1="43"
                x2="67"
                y2="43"
                stroke={eyeColor}
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </g>
          ) : charState === 'listening' ? (
            // Alert open eyes
            <g>
              <rect x="33" y="36" width="10" height="14" rx="5" fill={eyeColor} />
              <rect x="57" y="36" width="10" height="14" rx="5" fill={eyeColor} />
            </g>
          ) : charState === 'thinking' ? (
            // Looking up + thinking dots
            <g>
              <rect x="35" y="34" width="8" height="11" rx="4" fill={eyeColor} />
              <rect x="59" y="34" width="8" height="11" rx="4" fill={eyeColor} />
              <circle cx="43" cy="52" r="2" className="think-dot d1" />
              <circle cx="50" cy="52" r="2" className="think-dot d2" />
              <circle cx="57" cy="52" r="2" className="think-dot d3" />
            </g>
          ) : charState === 'paused' ? (
            // Calm line eyes
            <g>
              <rect x="34" y="42" width="9" height="4" rx="2" fill={eyeColor} />
              <rect x="57" y="42" width="9" height="4" rx="2" fill={eyeColor} />
            </g>
          ) : (
            // Idle natural eyes with blinking
            <g className="buddy-eye">
              <rect x="34" y="37" width="9" height="12" rx="4.5" fill={eyeColor} />
              <circle cx="36.5" cy="40" r="1.5" fill="#ffffff" opacity="0.9" />
              <rect x="57" y="37" width="9" height="12" rx="4.5" fill={eyeColor} />
              <circle cx="59.5" cy="40" r="1.5" fill="#ffffff" opacity="0.9" />
            </g>
          )}

          {/* Mouth */}
          {charState === 'speaking' ? (
            // Mouth moving strictly when speaking
            <ellipse cx="50" cy="55" rx="4.5" ry="3.5" fill={eyeColor} className="mouth-speaking" />
          ) : charState === 'happy' ? (
            // Cheerful smile
            <path
              d="M 45 54 Q 50 59 55 54"
              stroke={eyeColor}
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          ) : charState === 'listening' ? (
            // Curious small open mouth
            <ellipse cx="50" cy="55" rx="2.5" ry="2" fill={eyeColor} />
          ) : charState === 'thinking' ? (
            // Small pondering dot
            <circle cx="50" cy="55" r="1.5" fill={eyeColor} />
          ) : charState === 'paused' ? (
            // Neutral flat line
            <line x1="47" y1="55" x2="53" y2="55" stroke={eyeColor} strokeWidth="1.8" strokeLinecap="round" />
          ) : (
            // Warm gentle curve
            <path
              d="M 45 54 Q 50 57 55 54"
              stroke={eyeColor}
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          )}
        </g>
      </svg>
    );
  };

  return (
    <aside
      className={`buddy-dock ${isNotesTasksOpen ? 'drawer-offset' : ''}`}
      aria-label="AI Buddy companion"
    >
      {isMinimized ? (
        <button
          type="button"
          className="buddy-pill-btn"
          onClick={toggleMinimize}
          title={`AI Buddy: ${getStatusLabel()} (Click to expand)`}
          aria-label={`AI Buddy: ${getStatusLabel()}, click to expand`}
        >
          <div className="buddy-pill-avatar">
            {renderMascot()}
          </div>
          <span className={`buddy-status-dot dot-${charState}`} />
          <span className="buddy-pill-label">{getStatusLabel()}</span>
        </button>
      ) : (
        <div className={`buddy-card state-${charState}`}>
          {/* Header */}
          <div className="buddy-card-header">
            <span className="buddy-card-title">AI Buddy</span>
            <div className="buddy-actions">
              {speechPlaybackState === 'speaking' && onStopSpeaking && (
                <button
                  type="button"
                  className="buddy-icon-btn danger"
                  onClick={onStopSpeaking}
                  title="Stop speech"
                  aria-label="Stop speech"
                >
                  <Square size={12} />
                </button>
              )}
              {onToggleVoice && (
                <button
                  type="button"
                  className={`buddy-icon-btn ${voiceEnabled ? 'active' : ''}`}
                  onClick={onToggleVoice}
                  title={voiceEnabled ? 'Voice output on' : 'Voice output muted'}
                  aria-label="Toggle voice output"
                >
                  {voiceEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
                </button>
              )}
              <button
                type="button"
                className="buddy-icon-btn"
                onClick={toggleMinimize}
                title="Minimize"
                aria-label="Minimize AI Buddy"
              >
                <Minus size={13} />
              </button>
            </div>
          </div>

          {/* Speech bubble */}
          <div className="buddy-speech" role="status">
            {getSpeechText()}
          </div>

          {/* Mascot avatar stage */}
          <div
            className={`buddy-avatar-stage ${isClicked ? 'clicked' : ''}`}
            onClick={handleMascotClick}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleMascotClick();
              }
            }}
            tabIndex={0}
            role="button"
            title="Click to interact"
            aria-label="Click to interact with AI Buddy"
          >
            {renderMascot()}
          </div>

          {/* Small status footer */}
          <div className="buddy-status-label">
            <span className={`buddy-status-dot dot-${charState}`} />
            <span>{getStatusLabel()}</span>
          </div>
        </div>
      )}
    </aside>
  );
}
