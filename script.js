// Beginner-friendly Azure Speech to Text demo.
// The Azure Speech SDK is loaded in index.html from the Microsoft Cognitive Services Speech SDK CDN.

const speechKeyInput = document.getElementById('speechKey');
const regionOrEndpointInput = document.getElementById('regionOrEndpoint');
const languageSelect = document.getElementById('languageSelect');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const clearBtn = document.getElementById('clearBtn');
const copyBtn = document.getElementById('copyBtn');
const outputText = document.getElementById('outputText');
const settingsForm = document.getElementById('settingsForm');
const statusBadge = document.getElementById('statusBadge');
const messageBox = document.getElementById('messageBox');
const wordCount = document.getElementById('wordCount');
const charCount = document.getElementById('charCount');

let recognizer = null;
let isRecognizing = false;
let finalTranscript = '';

function setStatus(status, message) {
  const normalizedStatus = status.toLowerCase();
  statusBadge.textContent = status;
  statusBadge.className = `status-pill ${normalizedStatus}`;
  messageBox.textContent = message;
}

function setRecordingState(active) {
  isRecognizing = active;
  startBtn.disabled = active;
  stopBtn.disabled = !active;
}

function updateCounts() {
  const text = outputText.value.trim();
  const words = text ? text.split(/\s+/).length : 0;
  wordCount.textContent = `Words: ${words}`;
  charCount.textContent = `Characters: ${outputText.value.length}`;
}

function showFriendlyError(message) {
  setStatus('Error', message);
  window.alert(message);
}

function buildSpeechConfig(key, regionOrEndpoint, language) {
  const SpeechSDK = window.SpeechSDK;
  const looksLikeEndpoint = /^https?:\/\//i.test(regionOrEndpoint);
  let speechConfig;

  if (looksLikeEndpoint) {
    speechConfig = SpeechSDK.SpeechConfig.fromEndpoint(new URL(regionOrEndpoint), key);
  } else {
    speechConfig = SpeechSDK.SpeechConfig.fromSubscription(key, regionOrEndpoint);
  }

  speechConfig.speechRecognitionLanguage = language;
  return speechConfig;
}

function validateSettings() {
  const key = speechKeyInput.value.trim();
  const regionOrEndpoint = regionOrEndpointInput.value.trim();

  if (!window.SpeechSDK) {
    showFriendlyError('The Azure Speech SDK is not loaded. Check your internet connection and refresh the page.');
    return null;
  }

  if (!key) {
    showFriendlyError('Please enter your Azure Speech Service key before starting.');
    speechKeyInput.focus();
    return null;
  }

  if (!regionOrEndpoint) {
    showFriendlyError('Please enter your Azure Speech region or endpoint before starting.');
    regionOrEndpointInput.focus();
    return null;
  }

  return {
    key,
    regionOrEndpoint,
    language: languageSelect.value,
  };
}

async function ensureMicrophonePermission() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch (error) {
    showFriendlyError('Microphone permission was denied or no microphone was found. Please allow microphone access and try again.');
    return false;
  }
}

async function startRecognition() {
  const settings = validateSettings();
  if (!settings || isRecognizing) {
    return;
  }

  const hasMicrophonePermission = await ensureMicrophonePermission();
  if (!hasMicrophonePermission) {
    return;
  }

  try {
    const speechConfig = buildSpeechConfig(settings.key, settings.regionOrEndpoint, settings.language);
    const audioConfig = window.SpeechSDK.AudioConfig.fromDefaultMicrophoneInput();

    recognizer = new window.SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

    recognizer.recognizing = (sender, event) => {
      if (event.result.text) {
        outputText.value = `${finalTranscript}${event.result.text}`;
        updateCounts();
        setStatus('Listening', 'Listening... live speech is being converted to text.');
      }
    };

    recognizer.recognized = (sender, event) => {
      const ResultReason = window.SpeechSDK.ResultReason;

      if (event.result.reason === ResultReason.RecognizedSpeech && event.result.text) {
        finalTranscript += `${event.result.text}\n`;
        outputText.value = finalTranscript;
        updateCounts();
      } else if (event.result.reason === ResultReason.NoMatch) {
        setStatus('Processing', 'Speech was detected, but Azure could not recognize clear text. Try speaking closer to the microphone.');
      }
    };

    recognizer.canceled = (sender, event) => {
      const errorMessage = event.errorDetails
        ? `Speech recognition failed: ${event.errorDetails}`
        : 'Speech recognition was canceled. Please check your Azure key, region/endpoint, and network connection.';

      stopRecognition(false);
      showFriendlyError(errorMessage);
    };

    recognizer.sessionStopped = () => {
      if (isRecognizing) {
        stopRecognition(false);
      }
    };

    setStatus('Processing', 'Connecting to Azure AI Speech Service...');

    recognizer.startContinuousRecognitionAsync(
      () => {
        setRecordingState(true);
        setStatus('Listening', 'Listening... speak into your microphone.');
      },
      (error) => {
        setRecordingState(false);
        showFriendlyError(`Unable to start recognition. ${error}`);
      },
    );
  } catch (error) {
    setRecordingState(false);
    showFriendlyError(`Could not initialize Azure Speech recognition. ${error.message}`);
  }
}

function stopRecognition(showCompletedMessage = true) {
  if (!recognizer) {
    setRecordingState(false);
    return;
  }

  setStatus('Processing', 'Stopping speech recognition...');

  recognizer.stopContinuousRecognitionAsync(
    () => {
      recognizer.close();
      recognizer = null;
      setRecordingState(false);

      if (showCompletedMessage) {
        setStatus('Completed', 'Recognition stopped. Your transcription is ready.');
      }
    },
    (error) => {
      recognizer.close();
      recognizer = null;
      setRecordingState(false);
      showFriendlyError(`Could not stop recognition cleanly. ${error}`);
    },
  );
}

function clearText() {
  finalTranscript = '';
  outputText.value = '';
  updateCounts();
  setStatus('Waiting', 'Transcription cleared. Start recording when you are ready.');
}

async function copyText() {
  if (!outputText.value.trim()) {
    showFriendlyError('There is no transcription text to copy yet.');
    return;
  }

  try {
    await navigator.clipboard.writeText(outputText.value);
    setStatus('Completed', 'Transcription copied to clipboard.');
  } catch (error) {
    outputText.select();
    document.execCommand('copy');
    setStatus('Completed', 'Transcription copied using the browser fallback.');
  }
}

settingsForm.addEventListener('submit', (event) => event.preventDefault());
startBtn.addEventListener('click', startRecognition);
stopBtn.addEventListener('click', () => stopRecognition(true));
clearBtn.addEventListener('click', clearText);
copyBtn.addEventListener('click', copyText);

updateCounts();
setRecordingState(false);
setStatus('Waiting', 'Waiting for your Azure settings and microphone input.');
