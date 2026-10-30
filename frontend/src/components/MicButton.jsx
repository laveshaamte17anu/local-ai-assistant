import React from 'react';
import { Mic, Square, MicOff } from 'lucide-react';

export default function MicButton({
  isRecording,
  onStart,
  onStop,
  disabled = false,
  isSupported = true,
  title
}) {
  const handleClick = (e) => {
    e.preventDefault();
    if (disabled) return;
    if (isRecording) {
      onStop?.();
    } else {
      onStart?.();
    }
  };

  const getTitle = () => {
    if (title) return title;
    if (!isSupported) return 'Voice input not supported in this browser';
    if (isRecording) return 'Stop recording (or click Finish below)';
    return 'Speak using microphone';
  };

  return (
    <button
      type="button"
      className={`mic-tool-btn ${isRecording ? 'recording' : ''} ${!isSupported ? 'unsupported' : ''}`}
      onClick={handleClick}
      disabled={disabled}
      title={getTitle()}
      aria-label={getTitle()}
      aria-pressed={isRecording}
    >
      {!isSupported ? (
        <MicOff size={14} className="mic-disabled-icon" />
      ) : isRecording ? (
        <Square size={13} className="mic-stop-icon" />
      ) : (
        <Mic size={14} className="mic-active-icon" />
      )}
    </button>
  );
}

