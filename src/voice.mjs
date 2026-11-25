const MAX_AUDIO_BYTES = 1024 * 1024;
const ASR_MODEL = '@cf/openai/whisper';
const TTS_MODEL = 'xai/grok-tts';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff'
  }
});

function authorized(request, env) {
  const expected = env.VOICE_DEVICE_TOKEN;
  if (typeof expected !== 'string' || expected.length < 24) return false;
  return request.headers.get('authorization') === `Bearer ${expected}`;
}

function isWav(bytes) {
  return bytes.length >= 44 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 &&
    bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x41 &&
    bytes[10] === 0x56 && bytes[11] === 0x45;
}

function extractText(result) {
  const value = result?.text ?? result?.transcription ?? result?.result?.text;
  return typeof value === 'string' ? value.trim().slice(0, 600) : '';
}

function extractAudioUrl(result) {
  const value = result?.result?.audio ?? result?.audio;
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * One natural turn: WAV upload -> multilingual ASR -> existing 吉小知 chat
 * route -> Chinese TTS. The device receives a short-lived audio URL; provider
 * credentials remain in the Worker.
 */
export async function handleVoiceTurn(request, env, handleChat) {
  if (request.method !== 'POST') {
    return json({ error: 'METHOD_NOT_ALLOWED', message: '仅支持 POST' }, 405);
  }
  if (!authorized(request, env)) {
    return json({ error: 'DEVICE_UNAUTHORIZED', message: '设备未获授权' }, 401);
  }
  if (!env.AI) {
    return json({ error: 'AI_UNAVAILABLE', message: '云端 AI 尚未启用' }, 503);
  }

  const declaredLength = Number(request.headers.get('content-length') || '0');
  if (declaredLength > MAX_AUDIO_BYTES + 8192) {
    return json({ error: 'AUDIO_TOO_LARGE', message: '单轮语音不能超过 1 MiB' }, 413);
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'BAD_MULTIPART', message: '语音数据格式不正确' }, 400);
  }

  const audio = form.get('audio');
  if (!audio || typeof audio.arrayBuffer !== 'function' ||
      audio.size <= 44 || audio.size > MAX_AUDIO_BYTES) {
    return json({ error: 'AUDIO_INVALID', message: '语音文件为空或超出大小限制' }, 400);
  }

  const bytes = new Uint8Array(await audio.arrayBuffer());
  if (!isWav(bytes)) {
    return json({ error: 'AUDIO_FORMAT', message: '当前仅接受 WAV 音频' }, 415);
  }

  const region = typeof form.get('region') === 'string'
    ? String(form.get('region')).slice(0, 24)
    : '长春市';
  let history = [];
  try {
    const raw = form.get('history');
    if (typeof raw === 'string') {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        history = parsed.slice(-4)
          .filter(item => item && ['user', 'assistant'].includes(item.role) &&
            typeof item.content === 'string')
          .map(item => ({ role: item.role, content: item.content.slice(0, 400) }));
      }
    }
  } catch {
    return json({ error: 'HISTORY_INVALID', message: '会话上下文格式不正确' }, 400);
  }

  let transcript;
  try {
    const asr = await env.AI.run(ASR_MODEL, { audio: bytes });
    transcript = extractText(asr);
  } catch (error) {
    console.error('voice ASR failed', error?.name || 'AIError');
    return json({ error: 'ASR_FAILED', message: '暂时无法识别这段语音' }, 502);
  }
  if (!transcript) {
    return json({ error: 'NO_SPEECH', message: '没有识别到清晰语音，请再说一次' }, 422);
  }

  let chatResponse;
  try {
    const chatRequest = new Request(new URL('/api/chat', request.url), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        question: transcript,
        region,
        history,
        mode: 'agent',
        context: { tab: 'home' }
      })
    });
    chatResponse = await handleChat(chatRequest, env);
  } catch (error) {
    console.error('voice chat failed', error?.name || 'ChatError');
    return json({ error: 'CHAT_FAILED', message: '吉小知暂时无法回答，请稍后再试', transcript }, 502);
  }

  if (!chatResponse.ok) {
    const failure = await chatResponse.json().catch(() => ({}));
    return json({
      error: failure.error || 'CHAT_FAILED',
      message: failure.message || '吉小知暂时无法回答',
      transcript
    }, chatResponse.status);
  }

  const chat = await chatResponse.json();
  const reply = typeof chat.text === 'string' ? chat.text.trim().slice(0, 1200) : '';
  if (!reply) return json({ error: 'EMPTY_REPLY', message: '吉小知没有生成有效回答', transcript }, 502);

  let audioUrl;
  try {
    const tts = await env.AI.run(TTS_MODEL, {
      text: reply.slice(0, 900),
      language: 'zh',
      voice_id: 'ara',
      output_format: { codec: 'wav', sample_rate: 16000 }
    });
    audioUrl = extractAudioUrl(tts);
  } catch (error) {
    console.error('voice TTS failed', error?.name || 'AIError');
    return json({
      error: 'TTS_FAILED',
      message: '回答已生成，但语音合成暂时不可用',
      transcript,
      reply
    }, 502);
  }
  if (!audioUrl) {
    return json({
      error: 'TTS_BAD_RESPONSE',
      message: '语音服务没有返回可用音频',
      transcript,
      reply
    }, 502);
  }

  return json({
    transcript,
    reply,
    audioUrl,
    audioFormat: 'wav',
    sampleRate: 16000,
    voice: 'ara',
    region: chat.region || region,
    actions: Array.isArray(chat.actions) ? chat.actions : [],
    sources: Array.isArray(chat.sources) ? chat.sources : []
  });
}
