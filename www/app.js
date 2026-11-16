// Robot 2027 - App V1 (On-Device llama.cpp) + V2 Backend Bridge
const BACKEND_URL = 'https://khotrithucso.io.vn/robot2027/api_chat.php';

let isModelReady = false;
let isGenerating = false;

const statusEl = document.getElementById('modelStatus');
const metricEl = document.getElementById('speedMetric');
const faceStage = document.getElementById('faceStage');
const stateLabel = document.getElementById('stateLabel');
const chatArea = document.getElementById('chatArea');
const modeSelect = document.getElementById('modeSelect');
const mockFactRow = document.getElementById('mockFactRow');

modeSelect.addEventListener('change', () => {
  mockFactRow.style.display = modeSelect.value === 'V1_MOCK_FACT' ? 'flex' : 'none';
});

function setFaceState(state) {
  faceStage.className = 'face-stage ' + state;
  stateLabel.textContent = 'STATE: ' + state.toUpperCase();
}

function addBubble(text, isUser = false, meta = '') {
  const div = document.createElement('div');
  div.className = 'bubble ' + (isUser ? 'user' : 'bot');
  div.innerHTML = text + (meta ? `<div class="meta">${meta}</div>` : '');
  chatArea.appendChild(div);
  chatArea.scrollTop = chatArea.scrollHeight;
}

function getNativeLLM() {
  return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalLLM;
}

async function initModel() {
  const LocalLLM = getNativeLLM();
  if (!LocalLLM) {
    statusEl.className = 'pill err';
    statusEl.textContent = '⚠️ Chạy trên Web (Chưa có Native C++)';
    addBubble('Lưu ý: Bạn đang mở bằng trình duyệt thường. Hãy cài file APK lên điện thoại Android để chạy lõi C++ llama.cpp!', false);
    return;
  }

  try {
    statusEl.className = 'pill busy';
    statusEl.textContent = '⏳ Đang giải nén & nạp Model vào RAM...';
    const t0 = performance.now();

    const res = await LocalLLM.loadModel({
      assetPath: 'models/brain_local.gguf',
      nCtx: 512,
      nThreads: 4
    });

    const elapsed = Math.round(performance.now() - t0);
    isModelReady = true;
    statusEl.className = 'pill ready';
    statusEl.textContent = '✅ Model Sẵn Sàng';
    metricEl.textContent = `Nạp: ${elapsed} ms`;
    addBubble(`My brain is awake! Loaded in ${elapsed} ms. Talk to me in English!`, false, res.modelPath || '');
  } catch (err) {
    statusEl.className = 'pill err';
    statusEl.textContent = '❌ Lỗi nạp Model';
    addBubble('Lỗi khởi tạo model: ' + (err.message || JSON.stringify(err)), false);
  }
}

async function speakEnglish(text) {
  setFaceState('speaking');
  try {
    const TTS = window.Capacitor?.Plugins?.TextToSpeech;
    if (TTS) {
      await TTS.speak({
        text: text,
        lang: 'en-US',
        rate: 0.95,
        pitch: 1.15,
        volume: 1.0
      });
    } else if ('speechSynthesis' in window) {
      await new Promise((resolve) => {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'en-US';
        u.rate = 0.95;
        u.pitch = 1.15;
        u.onend = resolve;
        u.onerror = resolve;
        window.speechSynthesis.speak(u);
      });
    }
  } catch (e) {
    console.warn('TTS error:', e);
  } finally {
    setFaceState('idle');
  }
}

async function fetchBackendGuidance(userText, persona) {
  const res = await fetch(BACKEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bot_id: 'BOT_VN_001',
      member_name: 'Bi',
      member_age: 6,
      persona: persona,
      tier: 'FREE',
      text: userText
    })
  });
  const data = await res.json();
  const top = data.candidates && data.candidates[0];
  if (!top) return { guidance: '', strict: false };
  const combined = `${top.fact} ${top.follow_up || ''}`.trim();
  return {
    guidance: combined,
    strict: !!data.strict
  };
}

function quickAsk(text) {
  document.getElementById('textInput').value = text;
  sendChat();
}

async function sendChat() {
  if (isGenerating) return;
  const inputEl = document.getElementById('textInput');
  const userText = inputEl.value.trim();
  if (!userText) return;

  inputEl.value = '';
  addBubble(userText, true);

  const LocalLLM = getNativeLLM();
  if (!LocalLLM || !isModelReady) {
    addBubble('Model C++ chưa sẵn sàng trên thiết bị này.', false);
    return;
  }

  isGenerating = true;
  setFaceState('thinking');

  const persona = document.getElementById('personaSelect').value;
  const mode = modeSelect.value;

  let backendFact = '';
  let isStrict = false;
  let sourceTag = 'V1 Local';

  try {
    if (mode === 'V1_MOCK_FACT') {
      backendFact = document.getElementById('mockFactInput').value.trim();
      sourceTag = 'V1 Mock Fact';
    } else if (mode === 'V2_BACKEND') {
      const apiRes = await fetchBackendGuidance(userText, persona);
      backendFact = apiRes.guidance;
      isStrict = apiRes.strict;
      sourceTag = 'V2 Backend + Local';
    }

    if (isStrict && backendFact) {
      addBubble(backendFact, false, 'STRICT MODE (0 ms LLM)');
      await speakEnglish(backendFact);
      isGenerating = false;
      return;
    }

    const systemPrompt = backendFact
      ? `You are a cheerful English robot (${persona}) talking to a 6-year-old kid named Bi. Rewrite ONLY this guidance into 1 or 2 short, lively sentences: "${backendFact}". Do NOT add new facts.`
      : `You are a cheerful English robot (${persona}) talking to a 6-year-old kid named Bi. Reply in 1 or 2 very short, simple, encouraging English sentences.`;

    const chatML = `<|im_start|>system\n${systemPrompt}<|im_end|>\n<|im_start|>user\n${userText}<|im_end|>\n<|im_start|>assistant\n`;

    const t0 = performance.now();
    const genRes = await LocalLLM.generate({
      prompt: chatML,
      maxTokens: 60
    });
    const inferMs = Math.round(performance.now() - t0);

    let reply = (genRes.text || '').replace(/<\|im_end\|>/g, '').trim();
    if (!reply) reply = 'Beep boop! Can you say that again, Bi?';

    metricEl.textContent = `⚡ ${inferMs} ms`;
    addBubble(reply, false, `${sourceTag} • ${inferMs} ms`);
    await speakEnglish(reply);

  } catch (err) {
    addBubble('Lỗi xử lý: ' + (err.message || JSON.stringify(err)), false);
    setFaceState('idle');
  } finally {
    isGenerating = false;
  }
}

let recognition = null;
function toggleMic() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) {
    alert('Thiết bị chưa hỗ trợ Web Speech Recognition, bạn hãy nhập chữ vào ô chat để test nhé!');
    return;
  }
  const micBtn = document.getElementById('micBtn');
  if (recognition) {
    recognition.stop();
    recognition = null;
    micBtn.classList.remove('active');
    setFaceState('idle');
    return;
  }

  recognition = new SpeechRec();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  micBtn.classList.add('active');
  setFaceState('listening');

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    document.getElementById('textInput').value = transcript;
    sendChat();
  };

  recognition.onerror = () => {
    micBtn.classList.remove('active');
    setFaceState('idle');
    recognition = null;
  };

  recognition.onend = () => {
    micBtn.classList.remove('active');
    recognition = null;
  };

  recognition.start();
}

window.addEventListener('DOMContentLoaded', initModel);
