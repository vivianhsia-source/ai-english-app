import { useState } from "react";

const STORAGE_KEY = "ai_english_db";
const API_KEY_STORAGE = "anthropic_api_key";

function loadDB() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { items: [], corrections: [], absorptions: [] };
}

function saveDB(db) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); } catch {}
}

function nextDue(confidence) {
  const intervals = [1, 3, 7, 14, 30];
  const idx = Math.min(Math.max(confidence, 0), intervals.length - 1);
  const d = new Date();
  d.setDate(d.getDate() + intervals[idx]);
  return d.toISOString();
}

function uid() { return "item_" + Math.random().toString(36).slice(2, 10); }

function upsertItem(db, payload) {
  const key = `${payload.type}:${payload.front.toLowerCase()}`;
  if (db.items.find(i => i.key === key)) return db;
  const item = {
    id: uid(), key, type: payload.type, front: payload.front,
    back: payload.back, example: payload.example, tags: payload.tags || [],
    confidence: 0, reviewCount: 0, dueAt: nextDue(0),
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  return { ...db, items: [...db.items, item] };
}

async function callClaude(apiKey, systemPrompt, userContent) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "API 錯誤");
  const text = data.content?.map(b => b.text || "").join("") || "";
  const clean = text.replace(/```json|```/g, "").trim();
  try { return JSON.parse(clean); } catch { return null; }
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700;900&family=Space+Mono:wght@700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --ink: #0d1117; --paper: #f7f8fa; --card: #ffffff; --border: #e4e7ec;
    --muted: #6b7280; --accent: #2f6de0; --accent-lt: #dbeafe;
    --green: #16a34a; --orange: #ea580c; --red: #dc2626;
    --shadow: 0 2px 12px rgba(0,0,0,.07);
    font-family: 'DM Sans', sans-serif; font-size: 15px; color: var(--ink); background: var(--paper);
  }
  button, input, select, textarea { font: inherit; color: inherit; }
  .shell { display: flex; flex-direction: column; min-height: 100vh; }
  .topbar { position: sticky; top: 0; z-index: 40; display: flex; align-items: center; gap: 10px; padding: 0 24px; height: 56px; background: var(--ink); color: white; }
  .topbar .logo { font-family: 'Space Mono', monospace; font-size: 15px; background: var(--accent); padding: 4px 8px; border-radius: 6px; }
  .topbar .title { font-weight: 700; font-size: 15px; }
  .topbar .badge { padding: 4px 10px; border-radius: 99px; background: rgba(255,255,255,.1); font-size: 12px; font-weight: 700; }
  .topbar .key-btn { margin-left: auto; padding: 4px 12px; border-radius: 99px; background: rgba(255,255,255,.15); border: none; color: white; font-size: 12px; font-weight: 700; cursor: pointer; }
  .topbar .key-btn:hover { background: rgba(255,255,255,.25); }
  .nav { display: flex; gap: 4px; padding: 12px 20px; background: var(--card); border-bottom: 1px solid var(--border); overflow-x: auto; }
  .nav-btn { padding: 8px 18px; border: none; border-radius: 99px; background: transparent; cursor: pointer; font-weight: 700; color: var(--muted); white-space: nowrap; transition: background .15s, color .15s; }
  .nav-btn:hover { background: var(--paper); color: var(--ink); }
  .nav-btn.active { background: var(--accent); color: white; }
  .main { flex: 1; padding: 28px 20px; max-width: 820px; margin: 0 auto; width: 100%; }
  .section-head { margin-bottom: 24px; }
  .section-head h2 { font-size: 24px; font-weight: 900; margin-bottom: 4px; }
  .section-head p { color: var(--muted); line-height: 1.7; }
  .form-row { display: grid; gap: 14px; margin-bottom: 14px; }
  .form-row.cols-3 { grid-template-columns: repeat(3, 1fr); }
  .form-row.cols-2 { grid-template-columns: repeat(2, 1fr); }
  label { display: flex; flex-direction: column; gap: 6px; font-weight: 700; font-size: 13px; }
  input, select, textarea { border: 1.5px solid var(--border); border-radius: 10px; background: var(--card); outline: none; transition: border-color .15s, box-shadow .15s; }
  input, select { height: 42px; padding: 0 12px; }
  textarea { padding: 12px; line-height: 1.7; resize: vertical; min-height: 160px; }
  input:focus, select:focus, textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(47,109,224,.12); }
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 44px; padding: 0 20px; border: none; border-radius: 10px; font-weight: 900; cursor: pointer; transition: opacity .15s, transform .1s; }
  .btn:hover { opacity: .88; }
  .btn:active { transform: scale(.98); }
  .btn-primary { background: var(--accent); color: white; }
  .btn-ghost { background: var(--paper); color: var(--ink); border: 1.5px solid var(--border); }
  .btn-sm { height: 34px; padding: 0 12px; font-size: 13px; border-radius: 8px; }
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 20px; box-shadow: var(--shadow); }
  .card + .card { margin-top: 14px; }
  .card-label { font-size: 11px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); margin-bottom: 10px; }
  .mini-card { background: var(--paper); border: 1px solid var(--border); border-radius: 12px; padding: 14px; }
  .mini-card + .mini-card { margin-top: 10px; }
  .mini-card strong { display: block; margin-bottom: 6px; font-size: 15px; }
  .mini-card p { color: var(--muted); font-size: 14px; line-height: 1.6; margin-top: 4px; }
  .tag-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .tag { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 99px; background: var(--paper); border: 1px solid var(--border); font-size: 12px; font-weight: 700; color: var(--muted); }
  .tag.blue { background: var(--accent-lt); color: var(--accent); border-color: var(--accent-lt); }
  .tag.green { background: #dcfce7; color: var(--green); border-color: #bbf7d0; }
  .tag.orange { background: #ffedd5; color: var(--orange); border-color: #fed7aa; }
  .corrected-box { background: var(--accent-lt); border-radius: 12px; padding: 16px; font-size: 16px; line-height: 1.8; color: #1e3a8a; white-space: pre-wrap; }
  .review-card { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 24px; }
  .review-front { font-size: 22px; font-weight: 900; margin-bottom: 10px; }
  .review-back { color: var(--muted); font-size: 15px; line-height: 1.7; }
  .review-example { margin-top: 10px; font-size: 14px; color: #374151; font-style: italic; }
  .review-actions { display: flex; gap: 10px; margin-top: 18px; }
  .toolbar { display: flex; gap: 10px; margin-bottom: 16px; }
  .toolbar input { flex: 1; }
  .toolbar select { width: 140px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 12px 14px; text-align: left; border-bottom: 1px solid var(--border); font-size: 14px; }
  th { font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
  tr:last-child td { border-bottom: none; }
  .stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 28px; }
  .stat-card { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 18px; }
  .stat-card strong { display: block; font-size: 30px; font-weight: 900; }
  .stat-card span { font-size: 13px; color: var(--muted); }
  .dots span { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: var(--accent); animation: pulse 1.2s infinite; margin-right: 4px; }
  .dots span:nth-child(2) { animation-delay: .2s; }
  .dots span:nth-child(3) { animation-delay: .4s; }
  @keyframes pulse { 0%,80%,100% { opacity:.3; transform: scale(.8); } 40% { opacity:1; transform: scale(1); } }
  .empty { text-align: center; padding: 40px; color: var(--muted); border: 1.5px dashed var(--border); border-radius: 16px; }
  .empty strong { display: block; font-size: 18px; margin-bottom: 8px; color: var(--ink); }
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
  .modal { background: var(--card); border-radius: 20px; padding: 32px; max-width: 480px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,.3); }
  .modal h3 { font-size: 20px; font-weight: 900; margin-bottom: 8px; }
  .modal p { color: var(--muted); font-size: 14px; line-height: 1.7; margin-bottom: 20px; }
  .modal input { width: 100%; margin-bottom: 16px; font-family: monospace; font-size: 13px; }
  .modal-actions { display: flex; gap: 10px; justify-content: flex-end; }
  @media (max-width: 640px) {
    .form-row.cols-3, .form-row.cols-2 { grid-template-columns: 1fr; }
    .stats-row { grid-template-columns: 1fr 1fr; }
    .toolbar { flex-direction: column; }
    .toolbar select { width: 100%; }
  }
`;

const TYPE_LABELS = { vocab: "單字", phrase: "片語", pattern: "句型", sentence: "好句", error: "常犯錯誤" };
function Dots() { return <span className="dots"><span/><span/><span/></span>; }

function ApiKeyModal({ onSave, canClose, onClose }) {
  const [key, setKey] = useState("");
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>設定 Claude API Key</h3>
        <p>
          請輸入你的 Anthropic API Key。Key 只儲存在你的瀏覽器，不會上傳到任何伺服器。<br/><br/>
          沒有 API Key？到 <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" style={{color:"var(--accent)"}}>console.anthropic.com</a> 申請。
        </p>
        <input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder="sk-ant-..." onKeyDown={e => e.key === "Enter" && key.startsWith("sk-") && onSave(key)} />
        <div className="modal-actions">
          {canClose && <button className="btn btn-ghost" onClick={onClose}>取消</button>}
          <button className="btn btn-primary" disabled={!key.startsWith("sk-")} onClick={() => onSave(key)}>儲存並開始使用</button>
        </div>
      </div>
    </div>
  );
}

function CorrectMode({ db, setDb, apiKey }) {
  const [purpose, setPurpose] = useState("business email");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("natural and clear");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function run() {
    if (!text.trim()) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const system = `你是一位英文寫作教練。請以 JSON 格式回傳（不要加 markdown 代碼塊），結構如下：
{"corrected_text":"修正後的英文","chinese_summary":"整體修正說明","correction_items":[{"original":"原文片段","corrected":"修正後","reason":"繁體中文說明","error_type":"文法/用字/語氣/結構/清楚度"}],"reusable_patterns":[{"pattern":"句型","zh_usage":"用法說明","example_1":"例句1","example_2":"例句2"}],"vocabulary":[{"word":"單字","meaning_zh":"中文意思","example":"例句"}],"common_error_tags":["標籤"],"next_practice":"下一步練習建議"}`;
      const userMsg = `使用情境: ${purpose}\n對象: ${audience || "不指定"}\n語氣: ${tone}\n\n原文:\n${text}`;
      const r = await callClaude(apiKey, system, userMsg);
      if (!r) throw new Error("AI 回傳格式異常，請再試一次。");
      setResult(r);
      let updated = db;
      (r.vocabulary || []).forEach(v => { updated = upsertItem(updated, { type: "vocab", front: v.word, back: v.meaning_zh, example: v.example, tags: ["修正模式"] }); });
      (r.reusable_patterns || []).forEach(p => { updated = upsertItem(updated, { type: "pattern", front: p.pattern, back: p.zh_usage, example: p.example_1, tags: ["修正模式"] }); });
      (r.correction_items || []).forEach(c => { updated = upsertItem(updated, { type: "error", front: c.original, back: c.corrected + "\n" + c.reason, example: c.corrected, tags: ["常犯錯誤", c.error_type] }); });
      updated = { ...updated, corrections: [...(updated.corrections || []), { id: uid(), input: { text, purpose, audience, tone }, result: r, createdAt: new Date().toISOString() }] };
      setDb(updated); saveDB(updated);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  return (
    <div>
      <div className="section-head"><h2>修正模式</h2><p>貼上你的英文，AI 會修正文法、語氣、用字，並整理可複習的單字與句型。</p></div>
      <div className="form-row cols-3">
        <label>使用情境<select value={purpose} onChange={e => setPurpose(e.target.value)}><option value="business email">商務 Email</option><option value="social post">社群貼文</option><option value="chat message">聊天訊息</option><option value="interview answer">面試回答</option><option value="speaking practice">口說練習</option></select></label>
        <label>對象<input value={audience} onChange={e => setAudience(e.target.value)} placeholder="主管、客戶、朋友…" /></label>
        <label>語氣<select value={tone} onChange={e => setTone(e.target.value)}><option value="natural and clear">自然清楚</option><option value="professional">專業</option><option value="polite">禮貌</option><option value="casual">口語</option><option value="confident">有自信</option></select></label>
      </div>
      <label style={{ marginBottom: 14 }}>貼上你的英文<textarea value={text} onChange={e => setText(e.target.value)} placeholder="I want to explain why I feel stressful recently…" /></label>
      <button className="btn btn-primary" onClick={run} disabled={loading || !text.trim()}>{loading ? <><Dots /> 分析中…</> : "開始修正 →"}</button>
      {error && <div style={{ marginTop: 16, color: "var(--red)", fontSize: 14 }}>⚠️ {error}</div>}
      {result && (
        <div style={{ marginTop: 24 }}>
          <div className="card"><div className="card-label">修正後英文</div><div className="corrected-box">{result.corrected_text}</div><p style={{ marginTop: 12, color: "var(--muted)", fontSize: 14, lineHeight: 1.7 }}>{result.chinese_summary}</p>{result.common_error_tags?.length > 0 && <div className="tag-row">{result.common_error_tags.map(t => <span key={t} className="tag orange">{t}</span>)}</div>}</div>
          {result.correction_items?.length > 0 && <div className="card"><div className="card-label">逐項修正說明</div>{result.correction_items.map((c, i) => <div className="mini-card" key={i}><strong>{c.original} → {c.corrected}</strong><p>{c.reason}</p><div className="tag-row"><span className="tag blue">{c.error_type}</span></div></div>)}</div>}
          {result.reusable_patterns?.length > 0 && <div className="card"><div className="card-label">可重複使用句型</div>{result.reusable_patterns.map((p, i) => <div className="mini-card" key={i}><strong>{p.pattern}</strong><p>{p.zh_usage}</p><p>{p.example_1}</p><p>{p.example_2}</p></div>)}</div>}
          {result.vocabulary?.length > 0 && <div className="card"><div className="card-label">值得複習的單字</div>{result.vocabulary.map((v, i) => <div className="mini-card" key={i}><strong>{v.word}</strong><p>{v.meaning_zh}</p><p style={{ fontStyle: "italic" }}>{v.example}</p></div>)}</div>}
          {result.next_practice && <div className="card"><div className="card-label">下一步練習</div><p style={{ lineHeight: 1.7 }}>{result.next_practice}</p></div>}
        </div>
      )}
    </div>
  );
}

function AbsorbMode({ db, setDb, apiKey }) {
  const [title, setTitle] = useState("");
  const [srcType, setSrcType] = useState("article");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function run() {
    if (!content.trim()) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const system = `你是英文學習輔助 AI。請以 JSON 格式回傳（不要加 markdown 代碼塊）：{"source_title":"素材標題","summary_zh":"繁體中文摘要","vocabulary":[{"word":"單字","meaning_zh":"中文","level":"B1/B2","example":"例句"}],"phrases":[{"phrase":"片語","meaning_zh":"中文","example":"例句"}],"sentence_patterns":[{"pattern":"句型","usage_zh":"中文說明","example":"例句"}],"good_sentences":[{"sentence":"好句","why_good_zh":"為何值得學"}]}`;
      const userMsg = `素材標題: ${title || "未命名"}\n素材類型: ${srcType}\n\n內容:\n${content}`;
      const r = await callClaude(apiKey, system, userMsg);
      if (!r) throw new Error("AI 回傳格式異常，請再試一次。");
      setResult(r);
      let updated = db;
      (r.vocabulary || []).forEach(v => { updated = upsertItem(updated, { type: "vocab", front: v.word, back: v.meaning_zh, example: v.example, tags: ["吸收模式", v.level || ""] }); });
      (r.phrases || []).forEach(p => { updated = upsertItem(updated, { type: "phrase", front: p.phrase, back: p.meaning_zh, example: p.example, tags: ["吸收模式"] }); });
      (r.sentence_patterns || []).forEach(p => { updated = upsertItem(updated, { type: "pattern", front: p.pattern, back: p.usage_zh, example: p.example, tags: ["吸收模式"] }); });
      (r.good_sentences || []).forEach(s => { updated = upsertItem(updated, { type: "sentence", front: s.sentence, back: s.why_good_zh, example: s.sentence, tags: ["吸收模式"] }); });
      updated = { ...updated, absorptions: [...(updated.absorptions || []), { id: uid(), input: { title, srcType }, result: r, createdAt: new Date().toISOString() }] };
      setDb(updated); saveDB(updated);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  return (
    <div>
      <div className="section-head"><h2>吸收模式</h2><p>貼上文章、字幕、聊天訊息或好句。AI 會抽出最值得學的單字、片語、句型與好句。</p></div>
      <div className="form-row cols-2">
        <label>素材標題<input value={title} onChange={e => setTitle(e.target.value)} placeholder="例：TED Talk – How great leaders inspire action" /></label>
        <label>素材類型<select value={srcType} onChange={e => setSrcType(e.target.value)}><option value="article">文章</option><option value="video transcript">影片字幕</option><option value="chat">聊天內容</option><option value="good sentences">好句</option><option value="meeting notes">會議逐字稿</option></select></label>
      </div>
      <label style={{ marginBottom: 14 }}>貼上英文素材<textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Paste article, transcript, or useful sentences here…" style={{ minHeight: 200 }} /></label>
      <button className="btn btn-primary" onClick={run} disabled={loading || !content.trim()}>{loading ? <><Dots /> 吸收中…</> : "開始吸收 →"}</button>
      {error && <div style={{ marginTop: 16, color: "var(--red)", fontSize: 14 }}>⚠️ {error}</div>}
      {result && (
        <div style={{ marginTop: 24 }}>
          <div className="card"><div className="card-label">{result.source_title || title || "素材摘要"}</div><p style={{ lineHeight: 1.7 }}>{result.summary_zh}</p><div className="tag-row"><span className="tag green">已存入資料庫</span></div></div>
          {[
            { label: "單字", items: result.vocabulary, render: v => <><strong>{v.word} <span className="tag blue">{v.level}</span></strong><p>{v.meaning_zh}</p><p style={{ fontStyle: "italic" }}>{v.example}</p></> },
            { label: "片語", items: result.phrases, render: v => <><strong>{v.phrase}</strong><p>{v.meaning_zh}</p><p style={{ fontStyle: "italic" }}>{v.example}</p></> },
            { label: "句型", items: result.sentence_patterns, render: v => <><strong>{v.pattern}</strong><p>{v.usage_zh}</p><p style={{ fontStyle: "italic" }}>{v.example}</p></> },
            { label: "好句", items: result.good_sentences, render: v => <><strong style={{ fontStyle: "italic" }}>{v.sentence}</strong><p>{v.why_good_zh}</p></> },
          ].map(({ label, items, render }) => items?.length > 0 && <div className="card" key={label}><div className="card-label">{label}</div>{items.map((item, i) => <div className="mini-card" key={i}>{render(item)}</div>)}</div>)}
        </div>
      )}
    </div>
  );
}

function ReviewMode({ db, setDb }) {
  const [queue, setQueue] = useState([]);
  const [idx, setIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);

  function load() {
    const now = new Date();
    setQueue(db.items.filter(item => new Date(item.dueAt) <= now));
    setIdx(0); setLoaded(true);
  }

  function grade(g) {
    const item = queue[idx];
    const conf = g === "easy" ? Math.min(item.confidence + 2, 4) : g === "good" ? Math.min(item.confidence + 1, 4) : Math.max(item.confidence - 1, 0);
    const newDb = { ...db, items: db.items.map(i => i.id === item.id ? { ...i, confidence: conf, reviewCount: i.reviewCount + 1, dueAt: nextDue(conf), updatedAt: new Date().toISOString() } : i) };
    setDb(newDb); saveDB(newDb); setIdx(i => i + 1);
  }

  const item = queue[idx];
  const done = loaded && idx >= queue.length;

  return (
    <div>
      <div className="section-head"><h2>複習清單</h2><p>根據熟悉度與到期時間，系統自動排出今日複習清單。</p></div>
      {!loaded && <button className="btn btn-primary" onClick={load}>載入今日複習</button>}
      {loaded && done && <div className="empty">{queue.length === 0 ? <><strong>今天沒有待複習項目</strong>先用修正模式或吸收模式建立內容吧！</> : <><strong>🎉 今日複習完成！</strong>共複習了 {queue.length} 個項目</>}</div>}
      {loaded && !done && item && (
        <div style={{ maxWidth: 560 }}>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>{idx + 1} / {queue.length}</div>
          <div className="review-card">
            <div className="tag-row" style={{ marginBottom: 14 }}><span className="tag blue">{TYPE_LABELS[item.type] || item.type}</span>{(item.tags || []).map(t => <span key={t} className="tag">{t}</span>)}</div>
            <div className="review-front">{item.front}</div>
            <div className="review-back">{item.back}</div>
            {item.example && <div className="review-example">"{item.example}"</div>}
            <div style={{ marginTop: 8, fontSize: 13, color: "var(--muted)" }}>熟悉度：{item.confidence} / 4</div>
            <div className="review-actions">
              <button className="btn btn-sm" style={{ background: "#fee2e2", color: "var(--red)", border: "none" }} onClick={() => grade("hard")}>不熟</button>
              <button className="btn btn-sm" style={{ background: "#fef9c3", color: "#854d0e", border: "none" }} onClick={() => grade("good")}>普通</button>
              <button className="btn btn-sm" style={{ background: "#dcfce7", color: "var(--green)", border: "none" }} onClick={() => grade("easy")}>熟了</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LibraryMode({ db, setDb }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");

  function clearAll() {
    if (!confirm("確定要清除所有學習資料嗎？此操作無法復原。")) return;
    const empty = { items: [], corrections: [], absorptions: [] };
    setDb(empty); saveDB(empty);
  }

  let items = db.items || [];
  if (type !== "all") items = items.filter(i => i.type === type);
  if (query.trim()) { const q = query.toLowerCase(); items = items.filter(i => [i.front, i.back, i.example, ...(i.tags || [])].join(" ").toLowerCase().includes(q)); }
  const dueCount = db.items.filter(i => new Date(i.dueAt) <= new Date()).length;

  return (
    <div>
      <div className="section-head"><h2>學習資料庫</h2><p>所有修正與吸收的結果會自動存進這裡，支援搜尋與類型篩選。</p></div>
      <div className="stats-row">
        <div className="stat-card"><strong>{db.items.length}</strong><span>學習項目</span></div>
        <div className="stat-card"><strong>{dueCount}</strong><span>待複習</span></div>
        <div className="stat-card"><strong>{(db.corrections || []).length + (db.absorptions || []).length}</strong><span>分析紀錄</span></div>
      </div>
      <div className="toolbar">
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="搜尋單字、句型、標籤…" />
        <select value={type} onChange={e => setType(e.target.value)}><option value="all">全部類型</option><option value="vocab">單字</option><option value="phrase">片語</option><option value="pattern">句型</option><option value="sentence">好句</option><option value="error">常犯錯誤</option></select>
        <button className="btn btn-ghost btn-sm" onClick={clearAll} style={{ color: "var(--red)", borderColor: "var(--red)", whiteSpace: "nowrap" }}>清除資料</button>
      </div>
      {items.length === 0
        ? <div className="empty"><strong>目前沒有符合條件的項目</strong>試著使用修正模式或吸收模式新增內容吧！</div>
        : <div className="card" style={{ padding: 0, overflow: "hidden" }}><table><thead><tr><th>類型</th><th>項目</th><th>意思</th><th>例句</th><th>下次複習</th></tr></thead><tbody>{items.map(item => (<tr key={item.id}><td><span className="tag blue">{TYPE_LABELS[item.type] || item.type}</span></td><td><strong style={{ fontSize: 14 }}>{item.front}</strong><div className="tag-row">{(item.tags || []).filter(Boolean).map(t => <span key={t} className="tag" style={{ fontSize: 11 }}>{t}</span>)}</div></td><td style={{ maxWidth: 200, fontSize: 13, color: "var(--muted)" }}>{item.back?.slice(0, 80)}{item.back?.length > 80 ? "…" : ""}</td><td style={{ maxWidth: 200, fontSize: 13, fontStyle: "italic" }}>{item.example?.slice(0, 80)}{item.example?.length > 80 ? "…" : ""}</td><td style={{ fontSize: 13, color: "var(--muted)", whiteSpace: "nowrap" }}>{new Date(item.dueAt).toLocaleDateString("zh-TW")}</td></tr>))}</tbody></table></div>
      }
    </div>
  );
}

const TABS = [
  { id: "correct", label: "修正模式" },
  { id: "absorb", label: "吸收模式" },
  { id: "review", label: "複習清單" },
  { id: "library", label: "學習資料庫" },
];

export default function App() {
  const [tab, setTab] = useState("correct");
  const [db, setDb] = useState(() => loadDB());
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(API_KEY_STORAGE) || "");
  const [showKeyModal, setShowKeyModal] = useState(false);
  const dueCount = db.items.filter(i => new Date(i.dueAt) <= new Date()).length;

  function saveKey(key) {
    localStorage.setItem(API_KEY_STORAGE, key);
    setApiKey(key); setShowKeyModal(false);
  }

  return (
    <>
      <style>{css}</style>
      {(!apiKey || showKeyModal) && <ApiKeyModal onSave={saveKey} canClose={!!apiKey && showKeyModal} onClose={() => setShowKeyModal(false)} />}
      <div className="shell">
        <header className="topbar">
          <div className="logo">AI</div>
          <span className="title">英文學習系統</span>
          {dueCount > 0 && <span className="badge">📚 {dueCount} 待複習</span>}
          <button className="key-btn" onClick={() => setShowKeyModal(true)}>🔑 API Key</button>
        </header>
        <nav className="nav">{TABS.map(t => <button key={t.id} className={`nav-btn${tab === t.id ? " active" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>)}</nav>
        <main className="main">
          {tab === "correct" && <CorrectMode db={db} setDb={setDb} apiKey={apiKey} />}
          {tab === "absorb" && <AbsorbMode db={db} setDb={setDb} apiKey={apiKey} />}
          {tab === "review" && <ReviewMode db={db} setDb={setDb} />}
          {tab === "library" && <LibraryMode db={db} setDb={setDb} />}
        </main>
      </div>
    </>
  );
}
