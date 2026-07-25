/* ==========================================================================
   Spotlight — Pitch demo (Statistics · For You)
   ========================================================================== */

/* Two videos for segment comparison */
const VIDEO_NEW = {
  title: "3 design mistakes",
  full: "Three design mistakes making your posts look outdated",
  meta: "TikTok · Jul 14",
  platform: "TikTok",
  postingTime: "Tue 7:40 PM",
  duration: 24,
  views: "812K",
  viewsRaw: 812400,
  likes: "94.2K",
  comments: "3.1K",
  shares: "18.4K",
  watchTime: "19.8s",
  completion: "74%",
  th1: "#4C1D95",
  th2: "#A78BFA",
};

const VIDEO_PREV = {
  title: "Café menu redesign",
  full: "I redesigned this café menu in 30 minutes",
  meta: "Reels · Jul 9",
  views: "486K",
  th1: "#3D3550",
  th2: "#8A7B9A",
};

const SEGMENTS = [
  { range: "0–2s",  newRet: 94, prevRet: 78, title: "Stronger hook",   detail: "Face + title card in frame 1 — previous opened on a static shot." },
  { range: "2–5s",  newRet: 91, prevRet: 84, title: "Faster setup",    detail: "One-sentence problem. Previous spent this on unused context." },
  { range: "5–10s", newRet: 88, prevRet: 91, title: "Mid-hook dip",    detail: "List item #1 softer than the café reveal. Add a before/after cut." },
  { range: "10–15s",newRet: 82, prevRet: 74, title: "Clearer payoff",  detail: "Mistake #2 transformation drove rewatches — +8 pts vs previous." },
  { range: "15–24s",newRet: 74, prevRet: 68, title: "Stronger CTA",    detail: "Comment prompt held completion higher than the save-prompt ending." },
];

const SERIES = {
  views:      [210, 240, 260, 300, 340, 520, 610, 812].map(v => v * 1000),
  engagement: [4.1, 4.3, 4.6, 4.8, 5.0, 5.9, 6.4, 7.1],
  watchTime:  [13.1, 13.6, 14.0, 14.5, 15.2, 17.0, 18.1, 19.8],
  followers:  [220, 260, 310, 340, 410, 980, 1400, 6120],
};
const SERIES_LABELS = ["May 26","Jun 2","Jun 9","Jun 16","Jun 23","Jun 30","Jul 7","Jul 14"];
const SERIES_NAMES = { views: "Views", engagement: "Engagement", watchTime: "Watch time", followers: "Followers" };

const TRENDS = [
  { name: "Redesign in N minutes", niche: "Transformation", fit: 94, predViews: "520–680K", predEng: "+18%", tip: "Open on the finished redesign, then rewind." },
  { name: "3 mistakes lists",      niche: "Educational",    fit: 91, predViews: "480–720K", predEng: "+22%", tip: "Exactly three items — show each fix on-screen." },
  { name: "Quiet trend explainers", niche: "Typography",    fit: 78, predViews: "280–410K", predEng: "+9%",  tip: "Lead with one visual, not a definition." },
];

const IDEAS = [
  {
    id: "idea1",
    title: "The grid rule beginners break",
    hook: "This one rule is why your feed feels inconsistent.",
    format: "Before/after",
    length: "27s",
    predicted: "high",
    claim: "+38% more saves with transformation reveals",
    evidence: {
      stat: "+38% saves",
      sample: "Based on 24 videos",
      scope: "Global Spotlight trend sample · Design & lifestyle",
      source: "Where this statistic comes from",
      detail: "Across 24 recent transformation-style videos analysed on Spotlight, posts that showed the finished result in the first 3 seconds earned 38% more saves than process-first edits in the same niche.",
      method: "Compared average saves per 1K views for reveal-first vs. process-first structures.",
    },
  },
  {
    id: "idea2",
    title: "3 design mistakes, remixed",
    hook: "Your posts may look outdated because of these three.",
    format: "List",
    length: "24s",
    predicted: "high",
    claim: "List formats drive 2.1× completion",
    evidence: {
      stat: "2.1× completion",
      sample: "Based on 24 videos",
      scope: "Global Spotlight trend sample · Educational short-form",
      source: "Where this statistic comes from",
      detail: "In a 24-video educational sample, tight 3-item lists held viewers to the end 2.1× more often than open-ended explainers of similar length.",
      method: "Completion rate averaged across matched list vs. explainer videos posted in the last 30 days.",
    },
  },
  {
    id: "idea3",
    title: "The trend designers are ditching",
    hook: "Looked great in 2024. Now it's working against you.",
    format: "Explainer",
    length: "30s",
    predicted: "medium",
    claim: "+19% shares on trend call-outs",
    evidence: {
      stat: "+19% shares",
      sample: "Based on 24 videos",
      scope: "Global Spotlight trend sample · Typography & lifestyle",
      source: "Where this statistic comes from",
      detail: "Trend call-out videos in the 24-video sample were shared 19% more than evergreen tips, especially when the outdated example appeared before the fix.",
      method: "Share rate per 1K views, filtered to design-niche accounts on TikTok and Reels.",
    },
  },
  {
    id: "idea4",
    title: "Color contrast fix in 20 seconds",
    hook: "If you have to squint, so does your audience.",
    format: "Tutorial",
    length: "20s",
    predicted: "high",
    claim: "+27% watch time on quick fixes",
    evidence: {
      stat: "+27% watch time",
      sample: "Based on 24 videos",
      scope: "Global Spotlight trend sample · Practical tutorials",
      source: "Where this statistic comes from",
      detail: "Short “one fix” tutorials in the 24-video set held +27% average watch time versus multi-tip videos, because viewers got a clear payoff before second 8.",
      method: "Average watch time compared for single-fix vs. multi-tip tutorials under 25 seconds.",
    },
  },
];

const DNA = [
  { k: "Hook", v: "Curiosity question" },
  { k: "Length", v: "20–35s" },
  { k: "Post time", v: "Tue/Thu 7–8 PM" },
  { k: "Colors", v: "Warm contrast" },
];

const State = {
  mode: "performance",
  chartMetric: "views",
  activeSeg: 0,
  activeTrend: 0,
  showVideoAnalysis: false,
};

/* ---------------------------------------------------------------------- */
/* UTIL                                                                    */
/* ---------------------------------------------------------------------- */

function toast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._h);
  toast._h = setTimeout(()=>t.classList.remove("show"), 2200);
}

function icon(name){
  const icons = {
    arrowUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
    arrowDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
  };
  return icons[name] || "";
}

function delta(v){
  const up = v >= 0;
  const label = up ? `up ${Math.abs(v)} percent` : `down ${Math.abs(v)} percent`;
  return `<span class="m-delta ${up?"up":"down"}" aria-label="${label}">${icon(up?"arrowUp":"arrowDown")}<span aria-hidden="true">${Math.abs(v)}%</span></span>`;
}

function lineChart(data, labels, opts={}){
  const w = opts.w || 860, h = opts.h || 200, pad = 28;
  const max = Math.max(...data) * 1.15, min = Math.min(...data) * 0.9;
  const stepX = (w - pad*2) / (data.length - 1);
  const y = v => h - pad - ((v - min) / (max - min)) * (h - pad*2);
  const pts = data.map((v,i) => [pad + i*stepX, y(v)]);
  const path = pts.map((p,i) => (i===0?"M":"L")+p[0].toFixed(1)+","+p[1].toFixed(1)).join(" ");
  const area = path + ` L${pts[pts.length-1][0]},${h-pad} L${pts[0][0]},${h-pad} Z`;
  const highlightIdx = opts.highlight || [];
  let dots = "", labelsSvg = "", grid = "";
  for(let i=0;i<4;i++){
    const gy = pad + i*((h-pad*2)/3);
    grid += `<line x1="${pad}" y1="${gy}" x2="${w-pad}" y2="${gy}" stroke="var(--border-soft)" stroke-width="1"/>`;
  }
  pts.forEach((p,i)=>{
    const big = highlightIdx.includes(i);
    dots += `<circle cx="${p[0]}" cy="${p[1]}" r="${big?5.5:3.5}" fill="${big?'var(--mode-tint)':'var(--surface)'}" stroke="var(--mode-tint)" stroke-width="2"/>`;
    labelsSvg += `<text x="${p[0]}" y="${h-6}" font-size="10" fill="var(--ink-faint)" text-anchor="middle" font-family="Plus Jakarta Sans">${labels[i]}</text>`;
  });
  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Performance trend">
    <defs>
      <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--mode-tint)" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="var(--mode-tint)" stop-opacity="0"/>
      </linearGradient>
      <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="2" result="b"/>
        <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    ${grid}
    <path d="${area}" fill="url(#areaFill)"/>
    <path d="${path}" fill="none" stroke="var(--mode-tint)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" filter="url(#lineGlow)"/>
    ${dots}${labelsSvg}
  </svg>`;
}

/* ---------------------------------------------------------------------- */
/* PAGE 1 — Statistics                                                     */
/* ---------------------------------------------------------------------- */

function renderBestVideoCard(){
  const v = VIDEO_NEW;
  return `
  <div class="section" id="bestVideoSection">
    <div class="section-head"><div>
      <h2 class="section-title">Best performing video</h2>
      <div class="section-sub">Your strongest result of the last 30 days</div>
    </div></div>
    <div class="card feature-grid">
      <div class="feature-left">
        <div class="thumb" style="--th1:${v.th1};--th2:${v.th2}">
          <div class="play" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polygon points="6,3 21,12 6,21"/></svg>
          </div>
          <div class="dur">0:${v.duration}</div>
        </div>
        <div class="feature-title">${v.full}</div>
        <div class="feature-date">Posted ${v.postingTime} · ${v.platform}</div>
        <div class="feature-stats">
          <div class="fstat"><div class="v">${v.views}</div><div class="l">Views</div></div>
          <div class="fstat"><div class="v">${v.likes}</div><div class="l">Likes</div></div>
          <div class="fstat"><div class="v">${v.comments}</div><div class="l">Comments</div></div>
          <div class="fstat"><div class="v">${v.shares}</div><div class="l">Shares</div></div>
          <div class="fstat"><div class="v">${v.watchTime}</div><div class="l">Watch time</div></div>
          <div class="fstat"><div class="v">${v.completion}</div><div class="l">Completion</div></div>
        </div>
        <button type="button" class="btn primary" style="align-self:flex-start" onclick="openVideoAnalysis()">Analyse video</button>
      </div>
      <div class="feature-right">
        <h3>Why it performed well</h3>
        <ul class="reason-list">
          <li>Your face appeared within the first second, which keeps viewers past the early drop-off.</li>
          <li>The opening question created curiosity instead of stating the topic outright.</li>
          <li>The video was shorter than your recent average, matching your best completion window.</li>
          <li>Viewers rewatched the transformation between seconds 8 and 12.</li>
          <li>The warm, high-contrast palette matched your strongest-performing videos.</li>
        </ul>
      </div>
    </div>
  </div>`;
}

function renderSegmentCompare(){
  return `
  <div class="section" id="segmentAnalysisSection">
    <div class="section-head">
      <div>
        <h2 class="section-title">Segment analysis</h2>
        <div class="section-sub">Second-by-second retention vs your previous video</div>
      </div>
      <button type="button" class="btn small" onclick="closeVideoAnalysis()">Back to video</button>
    </div>
    <div class="card seg-compare">
      <div class="seg-videos">
        <div class="seg-video-meta">
          <div class="rthumb" style="--th1:${VIDEO_NEW.th1};--th2:${VIDEO_NEW.th2}" aria-hidden="true"></div>
          <div>
            <div class="sv-title">${VIDEO_NEW.title}</div>
            <div class="sv-sub">${VIDEO_NEW.meta} · ${VIDEO_NEW.views}</div>
          </div>
          <span class="sv-badge new">New</span>
        </div>
        <div class="seg-video-meta">
          <div class="rthumb" style="--th1:${VIDEO_PREV.th1};--th2:${VIDEO_PREV.th2}" aria-hidden="true"></div>
          <div>
            <div class="sv-title">${VIDEO_PREV.title}</div>
            <div class="sv-sub">${VIDEO_PREV.meta} · ${VIDEO_PREV.views}</div>
          </div>
          <span class="sv-badge prev">Prev</span>
        </div>
      </div>

      <div class="seg-legend" role="note">
        <span><i class="win" aria-hidden="true"></i> Violet = newer retained more</span>
        <span><i class="lose" aria-hidden="true"></i> Mauve = newer retained less</span>
      </div>

      <div class="seg-cols" aria-hidden="true">
        <span></span><span>New</span><span></span><span>Prev</span>
      </div>

      <div class="timeline" role="tablist" aria-label="Time segments" id="segTimeline">
        ${SEGMENTS.map((s,i)=>{
          const win = s.newRet >= s.prevRet;
          return `<button type="button" role="tab" class="tl-seg ${win?"win":"lose"} ${i===State.activeSeg?"active":""}"
            aria-selected="${i===State.activeSeg}"
            aria-controls="segDetail"
            id="seg-tab-${i}"
            tabindex="${i===State.activeSeg?0:-1}"
            onclick="selectSeg(${i})"
            onkeydown="segKey(event,${i})">${s.range}<span class="sr-only">, ${win?"improved":"dropped"} vs previous</span></button>`;
        }).join("")}
      </div>

      <div class="seg-rows">
        ${SEGMENTS.map((s,i)=>{
          const d = s.newRet - s.prevRet;
          const win = d >= 0;
          return `
          <div class="seg-row">
            <div class="seg-range" id="seg-range-${i}">${s.range}</div>
            <button type="button" class="seg-cell ${win?"win":"lose"} ${i===State.activeSeg?"active":""}"
              aria-label="Newer video ${s.range}: ${s.newRet}% retention, ${win?"better":"worse"} than previous by ${Math.abs(d)} points"
              aria-pressed="${i===State.activeSeg}"
              onclick="selectSeg(${i})">
              <span class="seg-ret">${s.newRet}%</span>
            </button>
            <div class="seg-delta ${win?"up":"down"}" aria-hidden="true">${win?"+":""}${d}</div>
            <button type="button" class="seg-cell ${i===State.activeSeg?"active":""}"
              aria-label="Previous video ${s.range}: ${s.prevRet}% retention"
              aria-pressed="${i===State.activeSeg}"
              onclick="selectSeg(${i})">
              <span class="seg-ret">${s.prevRet}%</span>
            </button>
          </div>`;
        }).join("")}
      </div>

      <div class="tl-detail" id="segDetail" role="tabpanel" aria-live="polite" aria-labelledby="seg-tab-${State.activeSeg}"></div>
    </div>
  </div>`;
}

function renderStatistics(){
  return `
  <div class="page active" id="page-statistics">
    <div class="welcome">
      <h1>Statistics</h1>
      <div class="range">30 days</div>
    </div>

    <div class="metric-grid" role="group" aria-label="Key metrics">
      <div class="card metric-card">
        <div class="m-label">Views</div>
        <div class="m-value">3.02M</div>
        ${delta(38)}
      </div>
      <div class="card metric-card">
        <div class="m-label">Engagement</div>
        <div class="m-value">7.1%</div>
        ${delta(22)}
      </div>
      <div class="card metric-card">
        <div class="m-label">Followers</div>
        <div class="m-value">+19.2K</div>
        ${delta(63)}
      </div>
      <div class="card metric-card">
        <div class="m-label">Retention</div>
        <div class="m-value">68%</div>
        ${delta(11)}
      </div>
    </div>

    ${State.showVideoAnalysis ? renderSegmentCompare() : renderBestVideoCard()}

    <div class="section">
      <div class="card chart-card">
        <div class="section-head">
          <h2 class="section-title">Trend</h2>
          <div class="chart-tabs" id="chartTabs" role="tablist" aria-label="Chart metric">
            ${Object.keys(SERIES).map(m=>`
              <button type="button" role="tab" class="chart-tab ${State.chartMetric===m?"active":""}"
                data-metric="${m}" aria-selected="${State.chartMetric===m}"
                tabindex="${State.chartMetric===m?0:-1}"
                onclick="setChartMetric('${m}')"
                onkeydown="chartKey(event)">${SERIES_NAMES[m]}</button>
            `).join("")}
          </div>
        </div>
        <div class="chart-wrap" id="overviewChart"></div>
      </div>
    </div>
  </div>`;
}

function openVideoAnalysis(){
  State.showVideoAnalysis = true;
  State.activeSeg = 0;
  render();
  document.getElementById("segmentAnalysisSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
  document.getElementById("seg-tab-0")?.focus();
}

function closeVideoAnalysis(){
  State.showVideoAnalysis = false;
  render();
  document.querySelector("#bestVideoSection .btn.primary")?.focus();
}

function selectSeg(i){
  State.activeSeg = i;
  document.querySelectorAll("#segTimeline .tl-seg").forEach((el,idx)=>{
    const on = idx===i;
    el.classList.toggle("active", on);
    el.setAttribute("aria-selected", on ? "true" : "false");
    el.tabIndex = on ? 0 : -1;
  });
  document.querySelectorAll(".seg-row").forEach((row,idx)=>{
    row.querySelectorAll(".seg-cell").forEach(c=>{
      c.classList.toggle("active", idx===i);
      c.setAttribute("aria-pressed", idx===i ? "true" : "false");
    });
  });
  renderSegDetail();
}

function segKey(e, i){
  let next = null;
  if(e.key === "ArrowRight" || e.key === "ArrowDown"){
    e.preventDefault();
    next = Math.min(SEGMENTS.length-1, i+1);
  } else if(e.key === "ArrowLeft" || e.key === "ArrowUp"){
    e.preventDefault();
    next = Math.max(0, i-1);
  } else if(e.key === "Home"){
    e.preventDefault();
    next = 0;
  } else if(e.key === "End"){
    e.preventDefault();
    next = SEGMENTS.length-1;
  }
  if(next !== null){
    selectSeg(next);
    document.getElementById(`seg-tab-${State.activeSeg}`)?.focus();
  }
}

function renderSegDetail(){
  const s = SEGMENTS[State.activeSeg];
  const d = s.newRet - s.prevRet;
  const win = d >= 0;
  const el = document.getElementById("segDetail");
  if(!el) return;
  el.setAttribute("aria-labelledby", `seg-tab-${State.activeSeg}`);
  el.innerHTML = `
    <div class="tt">${s.title} <span class="tm-inline ${win?"win":"lose"}" aria-label="${win?"improved":"dropped"} by ${Math.abs(d)} points">${win?"+":""}${d} pts</span></div>
    <p>${s.detail}</p>
  `;
}

function setChartMetric(m){
  State.chartMetric = m;
  const tabs = document.querySelectorAll("#chartTabs .chart-tab");
  tabs.forEach(b=>{
    const on = b.dataset.metric===m;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
    b.tabIndex = on ? 0 : -1;
  });
  const chart = document.getElementById("overviewChart");
  if(chart) chart.innerHTML = lineChart(SERIES[m], SERIES_LABELS, {highlight:[5,7]});
}

function chartKey(e){
  const keys = Object.keys(SERIES);
  const i = keys.indexOf(State.chartMetric);
  if(e.key === "ArrowRight" || e.key === "ArrowDown"){
    e.preventDefault();
    const next = keys[Math.min(keys.length-1, i+1)];
    setChartMetric(next);
    document.querySelector(`#chartTabs .chart-tab[data-metric="${next}"]`)?.focus();
  } else if(e.key === "ArrowLeft" || e.key === "ArrowUp"){
    e.preventDefault();
    const next = keys[Math.max(0, i-1)];
    setChartMetric(next);
    document.querySelector(`#chartTabs .chart-tab[data-metric="${next}"]`)?.focus();
  }
}

/* ---------------------------------------------------------------------- */
/* PAGE 2 — For You                                                        */
/* ---------------------------------------------------------------------- */

function ideaCard(idea){
  const lvl = {high:["High confidence","good"], medium:["Medium confidence","warn"]}[idea.predicted];
  return `
  <article class="card idea-card">
    <div class="idea-top">
      <div class="idea-meta-line">
        <span class="idea-format">${idea.format}</span>
        <span class="idea-sep" aria-hidden="true">·</span>
        <span class="idea-level">${lvl[0]}</span>
      </div>
      <span class="idea-len">${idea.length}</span>
    </div>
    <h4>${idea.title}</h4>
    <div class="idea-hook">"${idea.hook}"</div>
    <p class="idea-claim-text">${idea.claim}</p>
    <div class="idea-foot">
      <button type="button" class="evidence-btn"
        id="evidence-btn-${idea.id}"
        aria-haspopup="dialog"
        aria-controls="evidenceDialog"
        aria-expanded="false"
        onclick="openEvidence('${idea.id}')">
        Evidence
      </button>
      <button type="button" class="btn small primary" onclick="toast('Saved.')">Save</button>
    </div>
  </article>`;
}

function openEvidence(ideaId){
  const idea = IDEAS.find(i => i.id === ideaId);
  if(!idea) return;
  const ev = idea.evidence;
  const dialog = document.getElementById("evidenceDialog");
  const title = document.getElementById("evidenceTitle");
  const body = document.getElementById("evidenceBody");
  if(!dialog || !title || !body) return;

  title.textContent = ev.source;
  body.innerHTML = `
    <div class="ev-claim">“${idea.claim}”</div>
    <div class="ev-stat-row" role="group" aria-label="Evidence summary">
      <div class="ev-pill"><span class="ev-k">Statistic</span><span class="ev-v">${ev.stat}</span></div>
      <div class="ev-pill"><span class="ev-k">Sample</span><span class="ev-v">${ev.sample}</span></div>
    </div>
    <p class="ev-scope">${ev.scope}</p>
    <p class="ev-detail">${ev.detail}</p>
    <p class="ev-method"><span class="ev-k">Method</span> ${ev.method}</p>
    <p class="ev-note">Spotlight analyses global niche trends for every creator — this number is not guessed; it comes from the shared trend sample above.</p>
  `;

  dialog.showModal();
  dialog.dataset.openFor = ideaId;
  document.querySelectorAll(".evidence-btn").forEach(b=>{
    b.setAttribute("aria-expanded", b.id === `evidence-btn-${ideaId}` ? "true" : "false");
  });
  document.getElementById("evidenceClose")?.focus();
}

function closeEvidence(){
  const dialog = document.getElementById("evidenceDialog");
  const openFor = dialog?.dataset.openFor;
  if(dialog?.open) dialog.close();
  document.querySelectorAll(".evidence-btn").forEach(b=> b.setAttribute("aria-expanded", "false"));
  if(openFor) document.getElementById(`evidence-btn-${openFor}`)?.focus();
}

function draftHTML(t){
  return `
    <div class="dp-label">Draft predictor</div>
    <div class="draft-metrics">
      <div class="dm"><div class="v">${t.predViews}</div><div class="l">Views</div></div>
      <div class="dm"><div class="v">${t.predEng}</div><div class="l">Lift</div></div>
      <div class="dm"><div class="v">${t.fit}</div><div class="l">Fit</div></div>
    </div>
    <div class="draft-tip">${t.tip}</div>
  `;
}

function renderForYou(){
  const t = TRENDS[State.activeTrend];
  return `
  <div class="page active" id="page-foryou">
    <div class="welcome">
      <h1>For You</h1>
    </div>

    <section class="section" aria-labelledby="mission-heading">
      <div class="focus-card">
        <div class="eyebrow" id="mission-heading">Today's mission</div>
        <h2>Redesign video today · <span class="mission-lift">+22%</span></h2>
        <div class="focus-actions">
          <button type="button" class="btn primary" onclick="toast('Mission started.')">Start</button>
          <button type="button" class="btn" onclick="toast('Saved.')">Later</button>
        </div>
      </div>
    </section>

    <div class="foryou-grid">
      <section class="section" aria-labelledby="radar-heading">
        <h2 class="section-title" id="radar-heading">Trend radar</h2>
        <div class="card radar-card">
          <div class="trend-list" role="listbox" aria-label="Niche trends" aria-activedescendant="trend-${State.activeTrend}" tabindex="0" onkeydown="trendKey(event)">
            ${TRENDS.map((tr,i)=>`
              <button type="button" role="option" class="trend-item ${i===State.activeTrend?"active":""}"
                id="trend-${i}"
                aria-selected="${i===State.activeTrend}"
                tabindex="-1"
                onclick="selectTrend(${i})">
                <div class="ti-main">
                  <span class="ti-name">${tr.name}</span>
                  <span class="ti-niche">${tr.niche}</span>
                </div>
                <span class="fit-score" aria-label="Fit score ${tr.fit}">${tr.fit}</span>
              </button>
            `).join("")}
          </div>
          <div class="draft-panel" id="draftPanel" aria-live="polite">${draftHTML(t)}</div>
        </div>
      </section>

      <section class="section" aria-labelledby="dna-heading">
        <h2 class="section-title" id="dna-heading">Creator DNA</h2>
        <div class="card dna-card">
          <div class="dna-list">
            ${DNA.map(r=>`<div class="dna-row"><span class="k">${r.k}</span><span class="v">${r.v}</span></div>`).join("")}
          </div>
        </div>
      </section>
    </div>

    <section class="section ideas-section" aria-labelledby="ideas-heading">
      <header class="ideas-intro">
        <p class="ideas-kicker">Ideas</p>
        <h2 class="ideas-title" id="ideas-heading">Your next videos, mapped out</h2>
        <p class="ideas-lead">Every concept here is generated from patterns in your own content, not generic trends.</p>
      </header>
      <h3 class="ideas-list-title">Recommended video ideas</h3>
      <div class="grid-2 ideas-grid">${IDEAS.map(ideaCard).join("")}</div>
    </section>
  </div>`;
}

function selectTrend(i){
  State.activeTrend = i;
  document.querySelectorAll(".trend-item").forEach((el,idx)=>{
    el.classList.toggle("active", idx===i);
    el.setAttribute("aria-selected", idx===i ? "true" : "false");
  });
  const list = document.querySelector(".trend-list");
  if(list) list.setAttribute("aria-activedescendant", `trend-${i}`);
  const panel = document.getElementById("draftPanel");
  if(panel) panel.innerHTML = draftHTML(TRENDS[i]);
}

function trendKey(e){
  let next = null;
  if(e.key === "ArrowDown" || e.key === "ArrowRight"){
    e.preventDefault();
    next = Math.min(TRENDS.length-1, State.activeTrend+1);
  } else if(e.key === "ArrowUp" || e.key === "ArrowLeft"){
    e.preventDefault();
    next = Math.max(0, State.activeTrend-1);
  } else if(e.key === "Home"){
    e.preventDefault();
    next = 0;
  } else if(e.key === "End"){
    e.preventDefault();
    next = TRENDS.length-1;
  } else if(e.key === "Enter" || e.key === " "){
    e.preventDefault();
    document.getElementById(`trend-${State.activeTrend}`)?.click();
    return;
  }
  if(next !== null) selectTrend(next);
}

/* ---------------------------------------------------------------------- */
/* ROUTING                                                                 */
/* ---------------------------------------------------------------------- */

function render(){
  const root = document.getElementById("viewRoot");
  if(State.mode === "performance"){
    root.innerHTML = renderStatistics();
    root.setAttribute("aria-labelledby", "tab-statistics");
    if(State.showVideoAnalysis) renderSegDetail();
    const chart = document.getElementById("overviewChart");
    if(chart) chart.innerHTML = lineChart(SERIES[State.chartMetric], SERIES_LABELS, {highlight:[5,7]});
  } else {
    root.innerHTML = renderForYou();
    root.setAttribute("aria-labelledby", "tab-foryou");
  }
  root.scrollTop = 0;
}

function setMode(mode){
  if(State.mode === mode) return;
  State.mode = mode;
  document.documentElement.setAttribute("data-mode", mode);
  document.querySelectorAll(".mode-toggle button").forEach(b=>{
    const on = b.dataset.mode === mode;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
  });
  render();
}

function initHeroCarousel(){
  const items = [...document.querySelectorAll(".orbit-item")];
  if(!items.length) return;
  let i = 0;

  const paint = ()=>{
    items.forEach((el, idx)=> el.classList.toggle("is-hot", idx === i));
  };
  paint();

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(reduced){
    items.forEach(el=> el.classList.add("is-hot"));
    return;
  }
  setInterval(()=>{
    i = (i + 1) % items.length;
    paint();
  }, 1600);
}

function enterApp(){
  const landing = document.getElementById("landing");
  const app = document.getElementById("app");
  if(!landing || !app || !app.hidden) return;

  landing.classList.add("is-leaving");
  const finish = ()=>{
    landing.hidden = true;
    landing.setAttribute("aria-hidden", "true");
    app.hidden = false;
    app.classList.add("is-entering");
    document.querySelector(".skip-link")?.setAttribute("href", "#viewRoot");
    render();
    document.getElementById("tab-statistics")?.focus();
  };

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if(reduced){ finish(); return; }
  setTimeout(finish, 420);
}

function goHome(){
  const landing = document.getElementById("landing");
  const app = document.getElementById("app");
  if(!landing || !app || app.hidden) return;

  closeEvidence();
  State.showVideoAnalysis = false;
  app.hidden = true;
  app.classList.remove("is-entering");
  landing.hidden = false;
  landing.classList.remove("is-leaving");
  landing.removeAttribute("aria-hidden");
  document.querySelector(".skip-link")?.setAttribute("href", "#landingCta");
  window.scrollTo(0, 0);
  document.getElementById("landingCta")?.focus();
}

function init(){
  initHeroCarousel();
  document.getElementById("landingCta")?.addEventListener("click", enterApp);
  document.getElementById("brandHome")?.addEventListener("click", e=>{
    e.preventDefault();
    goHome();
  });

  const evidenceDialog = document.getElementById("evidenceDialog");
  evidenceDialog?.addEventListener("click", e=>{
    if(e.target === evidenceDialog) closeEvidence();
  });
  evidenceDialog?.addEventListener("cancel", e=>{
    e.preventDefault();
    closeEvidence();
  });

  document.querySelectorAll(".mode-toggle button").forEach(b=>{
    b.addEventListener("click", ()=> setMode(b.dataset.mode));
    b.addEventListener("keydown", e=>{
      if(e.key === "ArrowRight" || e.key === "ArrowLeft"){
        e.preventDefault();
        const next = State.mode === "performance" ? "coach" : "performance";
        setMode(next);
        document.querySelector(`.mode-toggle button[data-mode="${next}"]`)?.focus();
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", init);

window.enterApp = enterApp;
window.goHome = goHome;
window.selectSeg = selectSeg;
window.segKey = segKey;
window.setChartMetric = setChartMetric;
window.chartKey = chartKey;
window.selectTrend = selectTrend;
window.trendKey = trendKey;
window.openEvidence = openEvidence;
window.closeEvidence = closeEvidence;
window.openVideoAnalysis = openVideoAnalysis;
window.closeVideoAnalysis = closeVideoAnalysis;
window.toast = toast;
