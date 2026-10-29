(() => {
  'use strict';

  const STORAGE_KEY = 'daily-standard-v1';
  const TODAY = () => dateKey(new Date());
  const DEFAULT_SETTINGS = Object.freeze({ calories: 3000, calls: 100, afterHoursMinutes: 90, weekendMinutes: 960, workoutsPerWeek: 4 });
  const MORNING = [
    ['tidy', 'Tidy room / make bed'],
    ['shower', 'Shower'],
    ['teethAM', 'Brush teeth · morning'],
    ['firstMeal', 'Eat first meal']
  ];
  const ESSENTIALS = [
    ['vitamins', 'Take planned vitamins / supplements'],
    ['read', 'Read something today'],
    ['emails', 'Work emails up to date'],
    ['teethPM', 'Brush teeth · evening']
  ];
  const SPLITS = [
    'Chest & triceps', 'Back & biceps', 'Legs', 'Shoulders & arms', 'Other session'
  ];
  const CAUSES = ['Ran out of time', 'Forgot', 'Work took priority', 'Illness / recovery', 'No excuse', 'Other'];
  const $ = (q) => document.querySelector(q);

  function dateKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  function parseDate(key) { const [y,m,d] = key.split('-').map(Number); return new Date(y, m - 1, d, 12); }
  function shiftDate(key, amount) { const d = parseDate(key); d.setDate(d.getDate() + amount); return dateKey(d); }
  function weekStart(key) { const d = parseDate(key); const delta = (d.getDay() + 6) % 7; d.setDate(d.getDate() - delta); return dateKey(d); }
  function monthKey(key) { return key.slice(0,7); }
  function moveMonth(key, amount) { const [y,m] = key.split('-').map(Number); return dateKey(new Date(y, m - 1 + amount, 1, 12)).slice(0,7); }
  function monthTitle(key) { return new Intl.DateTimeFormat('en-GB', { month:'long', year:'numeric' }).format(parseDate(key + '-01')); }
  function formatDate(key) { return new Intl.DateTimeFormat('en-GB', { weekday:'long', day:'numeric', month:'long' }).format(parseDate(key)); }
  function isWeekday(key) { const d = parseDate(key).getDay(); return d !== 0 && d !== 6; }
  function isWeekend(key) { return !isWeekday(key); }
  function isSunday(key) { return parseDate(key).getDay() === 0; }
  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])); }
  function validDateKey(key) { return typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key) && dateKey(parseDate(key)) === key; }
  function newId() { return `x${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`; }
  function num(n) { return Number.isFinite(+n) ? +n : 0; }
  function duration(minutes) { const m = Math.round(Math.max(0, num(minutes))); return m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`; }
  function percent(done, total) { return total ? Math.round(done * 100 / total) : 0; }
  function defaultState() { return { version:1, startedOn:TODAY(), settings:{...DEFAULT_SETTINGS}, customHabits:[], days:{} }; }
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== 1 || typeof parsed.days !== 'object' || Array.isArray(parsed.days)) throw Error('Invalid history');
      return {
        version:1,
        startedOn:validDateKey(parsed.startedOn) ? parsed.startedOn : TODAY(),
        settings:{...DEFAULT_SETTINGS, ...(parsed.settings || {})},
        customHabits:Array.isArray(parsed.customHabits) ? parsed.customHabits : [],
        days:parsed.days || {}
      };
    } catch (err) { console.error('Unable to read saved data:', err); return defaultState(); }
  }
  let state = load();
  const ui = { tab:'today', selected:TODAY(), month:monthKey(TODAY()), reviewOpen:false };
  let toastTimeout;
  function toast(message) {
    const node = $('#toast'); if (!node) return;
    node.textContent = message; node.classList.add('show');
    clearTimeout(toastTimeout); toastTimeout = setTimeout(() => node.classList.remove('show'), 3500);
  }
  function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; } catch (e) { toast('Storage full. Export your backup immediately.'); return false; } }
  function getDay(key) { return state.days[key] || {}; }
  function ensureDay(key) {
    if (!state.days[key] || typeof state.days[key] !== 'object') state.days[key] = {};
    const day = state.days[key];
    if (!day.checks || typeof day.checks !== 'object') day.checks = {};
    if (!day.reasons || typeof day.reasons !== 'object') day.reasons = {};
    if (!Array.isArray(day.tasks)) day.tasks = [];
    if (key < state.startedOn) state.startedOn = key;
    return day;
  }
  function modify(fn, changesScore=true) {
    const day = ensureDay(ui.selected);
    fn(day);
    if (changesScore) day.closed = false;
    save(); render();
  }
  function checkValue(day,id) { return !!(day.checks && day.checks[id]); }
  function weeklySummary(key) {
    const monday = weekStart(key);
    let trained = 0, rest = 0, missed = 0;
    const dates = [];
    for (let i=0; i<7; i++) {
      const k = shiftDate(monday,i), status = getDay(k).training || null;
      if (status === 'trained') trained++;
      if (status === 'rest') rest++;
      if (status === 'missed') missed++;
      dates.push({key:k, status});
    }
    return { monday, trained, rest, missed, dates, restBudget:7 - clamp(num(state.settings.workoutsPerWeek),1,7) };
  }
  function restPosition(key) {
    const monday = weekStart(key);
    let count = 0;
    for (let i=0; i<7; i++) {
      const k = shiftDate(monday,i);
      if (k > key) break;
      if (getDay(k).training === 'rest') count++;
    }
    return count;
  }
  function weekendTotal(key) {
    const saturday = shiftDate(weekStart(key),5);
    const sunday = shiftDate(saturday,1);
    return num(getDay(saturday).weekendMinutes) + num(getDay(sunday).weekendMinutes);
  }
  function activeHabits(key) {
    return state.customHabits.filter(h => h && typeof h.label === 'string' && h.starts <= key && (!h.ends || h.ends >= key));
  }
  function goalsFor(key) {
    const day = getDay(key), settings = state.settings;
    const defs = [];
    MORNING.forEach(([id,label]) => defs.push({id, label, ok:checkValue(day,id), group:'Morning'}));
    ESSENTIALS.forEach(([id,label]) => defs.push({id, label, ok:checkValue(day,id), group:'Daily'}));
    activeHabits(key).forEach(h => defs.push({id:h.id, label:h.label, ok:checkValue(day,h.id), group:'Daily'}));
    defs.push({id:'smoke', label:'Smoke-free day', ok:day.smoked === false, group:'Daily'});
    defs.push({id:'calories', label:`Reach ${settings.calories.toLocaleString('en-GB')} calories`, ok:num(day.calories) >= num(settings.calories), group:'Targets'});
    if (isWeekday(key)) {
      defs.push({id:'calls', label:`Reach ${settings.calls} sales calls`, ok:num(day.calls) >= num(settings.calls), group:'Targets'});
      defs.push({id:'afterHoursMinutes', label:`Complete ${duration(settings.afterHoursMinutes)} of AresFit work after 6pm`, ok:num(day.afterHoursMinutes) >= num(settings.afterHoursMinutes), group:'Targets'});
    }
    if (isSunday(key)) {
      defs.push({id:'weekendMinutes', label:`Complete ${duration(settings.weekendMinutes)} of weekend work (Sat + Sun)`, ok:weekendTotal(key) >= num(settings.weekendMinutes), group:'Weekly target'});
    }
    const workoutOk = day.training === 'trained' || (day.training === 'rest' && restPosition(key) <= weeklySummary(key).restBudget);
    defs.push({id:'training', label:'Workout or permitted rest day', ok:workoutOk, group:'Training'});
    return defs;
  }
  function score(key) {
    const goals = goalsFor(key);
    const done = goals.filter(g => g.ok).length;
    return { done, total:goals.length, pct:percent(done,goals.length), perfect:done === goals.length, goals };
  }
  function reasonValid(r) { return !!(r && CAUSES.includes(r.category) && (r.category !== 'Other' || (r.note && r.note.trim()))); }
  function dayCanClose(key) {
    const d = getDay(key);
    if (!d.training || typeof d.smoked !== 'boolean') return false;
    return goalsFor(key).filter(g => !g.ok).every(g => reasonValid(d.reasons?.[g.id]));
  }
  function completionDays(month) {
    const start = month + '-01', end = monthEnd(month);
    const last = end > TODAY() ? TODAY() : end;
    const keys = [];
    for (let key = start < state.startedOn ? state.startedOn : start; key <= last; key = shiftDate(key,1)) {
      if (key === TODAY() && !getDay(key).closed) continue;
      keys.push(key);
    }
    return keys;
  }
  function monthEnd(month) { const [y,m] = month.split('-').map(Number); return dateKey(new Date(y,m,0,12)); }
  function streak() {
    let key = TODAY(), count = 0;
    if (!getDay(key).closed || !score(key).perfect) key = shiftDate(key,-1);
    for (let i=0; i<10000 && key >= state.startedOn; i++, key=shiftDate(key,-1)) {
      if (getDay(key).closed && score(key).perfect) count++; else break;
    }
    return count;
  }
  function progress(value, target) { const status = num(target) <= 0 ? "is-empty" : num(value) >= num(target) ? "is-met" : "is-unmet"; return `<div class="progress ${status}" aria-hidden="true"><div style="width:${clamp(percent(num(value),Math.max(1,num(target))),0,100)}%"></div></div>`; }
  function checkSvg() { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 4 4L19 6"/></svg>`; }
  function navIcon(tab) {
    if (tab === 'today') return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M8 3h8m-11 4h14v14H5zM8 12l3 3 5-5"/></svg>`;
    if (tab === 'history') return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 6h16v15H4zM8 3v6m8-6v6M4 11h16m-12 4h3m3 0h3"/></svg>`;
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9l2.2 2.2m9.8 9.8 2.2 2.2m0-14.2-2.2 2.2M7.1 16.9l-2.2 2.2"/><circle cx="12" cy="12" r="4"/></svg>`;
  }
  function tabButton(tab,label,isMobile=false) { return `<button type="button" data-action="tab" data-value="${tab}" class="${ui.tab === tab ? 'active' : ''}" aria-current="${ui.tab === tab ? 'page' : 'false'}">${isMobile ? navIcon(tab) : ''}${label}</button>`; }
  function renderShell() {
    const content = ui.tab === 'today' ? renderToday() : ui.tab === 'history' ? renderHistory() : renderSettings();
    $('#app').innerHTML = `<main class="shell">
      <header class="topbar"><div class="brand"><div class="brandmark" aria-hidden="true">DS</div><div><div class="brand-title">Daily Standard</div><div class="brand-subtitle">Track what matters</div></div></div>
      <div class="top-right"><span class="today-pill">● LOCAL DATA</span><nav class="nav desktop-nav" aria-label="Main navigation">${tabButton('today','Today')}${tabButton('history','History')}${tabButton('settings','Settings')}</nav></div></header>
      <div class="content">${content}</div><div class="footer">Your standards. Your history. Stored privately on this device.</div>
    </main><nav class="mobile-nav" aria-label="Main navigation">${tabButton('today','Today',true)}${tabButton('history','History',true)}${tabButton('settings','Settings',true)}</nav>`;
  }
  function metricCard({label,field,now,target,unit,steps,full=false,helper=''}) {
    const reached = now >= target;
    const inHours = field === 'weekendMinutes';
    const display = inHours ? (Math.round(now / 6) / 10).toString() : String(Math.round(now));
    const targetLabel = inHours ? `${target / 60} hr goal` : `${Number(target).toLocaleString('en-GB')} ${unit}`;
    return `<article class="metric-card ${full ? 'full' : ''}">
      <div class="metric-head"><span class="metric-label">${esc(label)}</span><span class="${reached?'check-bubble':'wait-bubble'}">${reached ? 'TARGET HIT' : 'IN PROGRESS'}</span></div>
      <div class="metric-number"><input type="number" min="0" max="${inHours?'24':'100000'}" step="${inHours?'0.25':'1'}" inputmode="decimal" aria-label="${esc(label)} logged" data-field="${field}" value="${esc(display)}"><span>${esc(targetLabel)}</span></div>
      ${progress(now,target)}
      <div class="metric-foot"><div class="chip-actions">${steps.map(([txt,increment])=>`<button class="chip" type="button" data-action="increment" data-field="${field}" data-amount="${increment}">${esc(txt)}</button>`).join('')}</div><span class="small">${esc(helper)}</span></div>
    </article>`;
  }
  function renderToday() {
    const key=ui.selected, day=getDay(key), sc=score(key), wd=isWeekday(key);
    const isToday=key===TODAY(), holiday=key>TODAY(), weekly=weeklySummary(key), weekendMins=weekendTotal(key);
    const summaryStatus = day.closed ? 'DAY CLOSED' : isToday ? 'LIVE TODAY' : 'NOT CLOSED';
    const metricItems = [metricCard({label:'Calories consumed',field:'calories',now:num(day.calories),target:num(state.settings.calories),unit:'kcal',steps:[['+250',250],['+500',500]],helper:'Daily intake'})];
    if (wd) {
      metricItems.push(metricCard({label:'Sales calls',field:'calls',now:num(day.calls),target:num(state.settings.calls),unit:'calls',steps:[['+10',10],['+25',25]],helper:'Mon – Fri'}));
      metricItems.push(metricCard({label:'AresFit work after 6pm',field:'afterHoursMinutes',now:num(day.afterHoursMinutes),target:num(state.settings.afterHoursMinutes),unit:'minutes',steps:[['+15m',15],['+30m',30]],full:true,helper:'Outside call hours'}));
    } else {
      metricItems.push(metricCard({label:'Weekend work logged',field:'weekendMinutes',now:num(day.weekendMinutes),target:num(state.settings.weekendMinutes),unit:'hours',steps:[['+1h',60],['+2h',120]],helper:'Your hours today'}));
    }
    const otherNotes = wd ? 'Calls and the 90-minute after-hours block are counted separately.' : `Saturday + Sunday: <strong style="color:var(--ink)">${duration(weekendMins)} / ${duration(state.settings.weekendMinutes)}</strong>. Weekend work is scored once, on Sunday.`;
    return `<div class="pagehead"><div><div class="eyebrow">Daily accountability</div><h1>${isToday?'Today':esc(formatDate(key))}</h1><div class="date-muted">${isToday?esc(formatDate(key)):'View or edit this day'}</div></div><div class="date-actions"><button type="button" class="icon-btn" data-action="day-shift" data-offset="-1" aria-label="Previous day">‹</button><button type="button" class="icon-btn" data-action="day-shift" data-offset="1" aria-label="Next day" ${key>=TODAY()?'disabled':''}>›</button>${isToday?'':`<button type="button" class="text-btn" data-action="jump-today">Today</button>`}</div></div>
      <div class="layout"><div class="stack">
        <section class="panel hero ${day.closed?(sc.perfect?'is-complete':'is-missed'):'is-open'}" aria-label="Daily score"><div class="hero-inner"><div><div class="hero-kicker">${summaryStatus}</div><h2>${day.closed && sc.perfect ? 'Standard met.' : 'Build the day.'}</h2><div class="caption">${day.closed ? 'This day is logged. You can reopen it to correct anything.' : 'Mark everything you actually complete. Close the day to log the final result.'}</div><div class="hero-stats"><span><strong>${sc.done}/${sc.total}</strong> daily standards</span><span><strong>${streak()}</strong> day streak</span></div></div><div class="ring ${sc.perfect?'is-complete':'is-incomplete'}" style="--progress:${sc.pct}%" aria-label="${sc.pct} percent completed"><div class="ring-center"><strong>${sc.pct}%</strong><span>completed</span></div></div></div></section>
        <div><div class="section-row"><h2>Numbers that matter</h2><span>${wd?'Weekday targets':'Weekend targets'}</span></div><div class="metric-grid">${metricItems.join('')}</div><p class="status-note">${otherNotes}</p></div>
        <section class="panel"><div class="panel-title"><div><h2>Daily non-negotiables</h2><p class="caption">The habits that need to happen every day.</p></div><span class="panel-tag">${essentialsDone(day,key)}/${ESSENTIALS.length + 1 + activeHabits(key).length}</span></div>
          <div class="checklist">${ESSENTIALS.map(([id,label])=>renderCheck(id,label,day)).join('')}${activeHabits(key).map(h=>renderCheck(h.id,h.label,day)).join('')}</div>
          <div class="split-line"></div><h3>No smoking</h3><p class="status-note">Confirm this at the end of the day. A slip is recorded honestly, not hidden.</p>
          <div class="choice-row" style="grid-template-columns: 1fr 1fr"><button type="button" class="choice ${day.smoked===false?'selected good':''}" data-action="smoking" data-value="no">Smoke-free ✓</button><button type="button" class="choice ${day.smoked===true?'selected bad':''}" data-action="smoking" data-value="yes">Smoked today</button></div>
          ${day.smoked===true?'<p class="status-note warning">This is recorded as a missed standard. Add the reason during your day review.</p>':''}
        </section>
        <section class="panel" id="review-section"><div class="panel-title"><div><h2>Close out the day</h2><p class="caption">Missed standards require a reason, so you can see patterns.</p></div><span class="panel-tag">${day.closed?'LOGGED':'OPEN'}</span></div>${renderReview(key)}</section>
      </div><aside class="stack">
        <section class="panel"><div class="panel-title"><div><h2>Morning reset</h2><p class="caption">Same basics, every morning.</p></div><span class="panel-tag">${MORNING.filter(([id])=>checkValue(day,id)).length}/${MORNING.length}</span></div><div class="checklist">${MORNING.map(([id,label])=>renderCheck(id,label,day)).join('')}</div></section>
        <section class="panel"><div class="panel-title"><div><h2>Training</h2><p class="caption">Four sessions per week. Three rest days available.</p></div><span class="panel-tag">${weekly.trained}/${state.settings.workoutsPerWeek} SESSIONS</span></div>
          <div class="week-dots" aria-label="Weekly workout status">${weekly.dates.map(d=>`<div class="week-dot ${d.status==='trained'?'good':d.status==='rest'?'rest':d.status==='missed'?'bad':''}" title="${esc(formatDate(d.key))}: ${esc(d.status||'not logged')}"></div>`).join('')}</div>
          <div class="week-copy"><span><strong>${weekly.trained}</strong> workouts</span><span><strong>${weekly.rest}</strong> / ${weekly.restBudget} rest days</span></div>
          <div class="choice-row"><button type="button" class="choice ${day.training==='trained'?'selected good':''}" data-action="training" data-value="trained">Trained</button><button type="button" class="choice ${day.training==='rest'?'selected neutral':''}" data-action="training" data-value="rest">Rest day</button><button type="button" class="choice ${day.training==='missed'?'selected bad':''}" data-action="training" data-value="missed">Missed</button></div>
          ${day.training==='trained'?`<label class="field-caption" for="session-split">Which session?</label><select class="field" id="session-split" data-field="split"><option value="">Choose a session</option>${SPLITS.map(x=>`<option value="${esc(x)}" ${day.split===x?'selected':''}>${esc(x)}</option>`).join('')}</select>`:''}
          ${day.training==='rest'?`<p class="status-note ${restPosition(key)>weekly.restBudget?'warning':'success'}">${restPosition(key)>weekly.restBudget?'Rest-day allowance exceeded. This day does not count as completed.':'Rest day recorded. This counts as completed within the weekly allowance.'}</p>`:''}
          ${day.training==='missed'||(day.training==='rest'&&restPosition(key)>weekly.restBudget)?`<div class="reason-item">${renderReason(key,'training','Why was training missed?')}</div>`:''}
          <p class="status-note">Rest days are counted Monday–Sunday, not necessarily consecutively. A fourth rest day lowers that day's score.</p>
        </section>
        <section class="panel"><div class="panel-title"><div><h2>Today's one-offs</h2><p class="caption">Optional tasks. They never affect your score.</p></div></div><form id="task-form" class="task-form"><input class="field" id="new-task" maxlength="120" autocomplete="off" placeholder="Add a one-off task" aria-label="New one-off task"><button type="submit" class="btn">Add</button></form>
          <div class="task-list">${(day.tasks||[]).map(t=>`<div class="task-row ${t.done?'done':''}"><button type="button" class="task-check" data-action="task-check" data-id="${esc(t.id)}" aria-label="Toggle ${esc(t.text)}">${t.done?'✓':''}</button><span>${esc(t.text)}</span><button type="button" class="task-delete" data-action="task-delete" data-id="${esc(t.id)}" aria-label="Delete ${esc(t.text)}">×</button></div>`).join('')}</div>
          ${!(day.tasks||[]).length?'<p class="status-note">No one-off tasks added.</p>':''}
        </section>
      </aside></div>`;
  }
  function essentialsDone(day,key) { return ESSENTIALS.filter(([id]) => checkValue(day,id)).length + (day.smoked===false ? 1 : 0) + activeHabits(key).filter(h => checkValue(day,h.id)).length; }
  function renderCheck(id,label,day) { const done=checkValue(day,id); return `<button type="button" class="check-item ${done?'done':''}" data-action="check" data-id="${esc(id)}" aria-pressed="${done}"><span class="check-copy"><span class="check-square">${done?checkSvg():''}</span><span class="check-label">${esc(label)}</span></span><span class="check-meta">${done?'DONE':''}</span></button>`; }
  function renderReason(key,id,label) {
    const item=getDay(key).reasons?.[id] || {};
    return `<label for="reason-${esc(id)}">${esc(label)}</label><select class="field" id="reason-${esc(id)}" data-reason="${esc(id)}"><option value="">Select a reason…</option>${CAUSES.map(c=>`<option value="${esc(c)}" ${item.category===c?'selected':''}>${esc(c)}</option>`).join('')}</select>${item.category==='Other'?`<textarea class="field" data-reason-note="${esc(id)}" placeholder="What happened?" rows="2" aria-label="Other reason for ${esc(label)}">${esc(item.note||'')}</textarea>`:''}`;
  }
  function renderReview(key) {
    const d=getDay(key), s=score(key), misses=s.goals.filter(g=>!g.ok);
    if (d.closed) return `<div class="recap"><div class="recap-title">${s.perfect?'100% — all standards met':'Day logged — '+s.pct+'%'}</div><p class="caption">${misses.length ? `${misses.length} missed standard${misses.length===1?'':'s'} and ${misses.length===1?'its':'their'} reason${misses.length===1?'':'s'} are saved.` : 'Every standard was completed.'}</p><button type="button" class="btn secondary block" data-action="reopen">Reopen to edit</button></div>`;
    if (!ui.reviewOpen) return `<button type="button" class="btn block" data-action="review">Review & close day</button><p class="status-note">Current score is provisional until you close this day. You can always correct it later.</p>`;
    let html = `<div class="recap"><div class="recap-title">${s.done} of ${s.total} standards met</div><p class="caption">${misses.length?'Choose a reason for each missed standard, then close the day.':'All standards are met. Close the day to record 100%.'}</p>`;
    if (!d.training) html += `<p class="status-note warning">Select Trained, Rest day or Missed in the Training section first.</p>`;
    if (typeof d.smoked !== 'boolean') html += `<p class="status-note warning">Confirm whether you smoked today above.</p>`;
    for (const g of misses) {
      if ((g.id==='smoke' && typeof d.smoked!=='boolean') || (g.id==='training' && !d.training)) continue;
      html += `<div class="reason-item">${renderReason(key,g.id,g.label)}</div>`;
    }
    html += `<div class="button-row" style="margin-top:15px"><button type="button" class="btn" data-action="close" ${dayCanClose(key)?'':'disabled'}>Close day · ${s.pct}%</button><button type="button" class="btn outline" data-action="review">Cancel</button></div>`;
    if (!dayCanClose(key)) html += '<p class="status-note">The close button unlocks when every missed standard has a reason and smoking/training are classified.</p>';
    return html + '</div>';
  }
  function renderHistory() {
    const month=ui.month, monthDates=completionDays(month), goalRecords=monthDates.map(key=>({ key,...score(key) }));
    const perfect=goalRecords.filter(x=>x.perfect && getDay(x.key).closed).length;
    const average=goalRecords.length? Math.round(goalRecords.reduce((s,x)=>s+x.pct,0)/goalRecords.length):0;
    const logged=goalRecords.filter(x=>getDay(x.key).closed).length;
    const currentMonth=monthKey(TODAY());
    const counts=[
      ['Calories hit', 'calories', monthDates],
      ['Calls ≥ target', 'calls', monthDates.filter(isWeekday)],
      ['Smoke-free', 'smoke', monthDates],
      ['Daily reading', 'read', monthDates],
      ['Morning reset', 'morning-all', monthDates],
      ['Email up to date', 'emails', monthDates]
    ];
    const first=month+'-01', d=parseDate(first), offset=(d.getDay()+6)%7, daysInMonth=parseDate(monthEnd(month)).getDate();
    let cal='<div class="calendar">'+['M','T','W','T','F','S','S'].map(x=>`<div class="cal-weekday">${x}</div>`).join('');
    for(let i=0;i<offset;i++) cal += '<div class="cal-day blank"></div>';
    for(let i=1;i<=daysInMonth;i++) {
      const key=month+'-'+String(i).padStart(2,'0'), isFuture=key>TODAY(), beforeStart=key<state.startedOn, current=key===TODAY(), closed=!!getDay(key).closed;
      const value=score(key).pct;
      const color= isFuture||beforeStart?'future':current&&!closed?'':value===100&&closed?'perfect':value>0?'partial':'empty';
      const summary=(isFuture||beforeStart) ? '—' : current&&!closed ? 'LIVE' : `${value}%${!closed?'*':''}`;
      cal+=`<button type="button" class="cal-day ${color} ${current?'current':''}" data-action="select-day" data-value="${key}" ${isFuture||beforeStart?'disabled':''} aria-label="${esc(formatDate(key))}, ${esc(summary)}"><span class="cal-num">${i}</span><span class="cal-score">${summary}</span></button>`;
    }
    cal+='</div>';
    let weeklyCards='';
    const mondays=new Set();
    for(let key=first;key<=monthEnd(month);key=shiftDate(key,1)) mondays.add(weekStart(key));
    for(const monday of mondays) {
      const sunday=shiftDate(monday,6);
      if (sunday < state.startedOn || monday > TODAY()) continue;
      const s=weeklySummary(monday), completed=sunday<TODAY()||(sunday===TODAY()&&getDay(sunday).closed);
      const total=weekendTotal(monday);
      weeklyCards+=`<div class="week-card"><div class="week-card-top"><span>Week of ${new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short'}).format(parseDate(monday))}</span><span style="color:${s.trained>=state.settings.workoutsPerWeek?'var(--good)':'var(--muted)'}">${s.trained}/${state.settings.workoutsPerWeek} gym</span></div><div class="week-card-info">Rest days ${s.rest}/${s.restBudget} · Weekend work ${duration(total)}/${duration(state.settings.weekendMinutes)} ${completed?(total>=state.settings.weekendMinutes?'✓':'· target missed'):'· in progress'}</div></div>`;
    }
    return `<div class="pagehead"><div><div class="eyebrow">Track the evidence</div><h1>Monthly review</h1><div class="date-muted">Unlogged past days count as incomplete. Today counts after it is closed.</div></div><div class="month-switch"><button type="button" class="icon-btn" data-action="month-shift" data-offset="-1" aria-label="Previous month">‹</button><strong>${esc(monthTitle(month))}</strong><button type="button" class="icon-btn" data-action="month-shift" data-offset="1" ${month>=currentMonth?'disabled':''} aria-label="Next month">›</button></div></div>
      <div class="history-top"><div class="stat"><span class="panel-tag">100% DAYS</span><div class="value">${perfect}<em> / ${monthDates.length}</em></div><p class="caption">Every applicable target met</p></div><div class="stat"><span class="panel-tag">AVG COMPLETION</span><div class="value">${average}%</div><p class="caption">Across tracked days</p></div><div class="stat"><span class="panel-tag">LOGGED DAYS</span><div class="value">${logged}<em> / ${monthDates.length}</em></div><p class="caption">Closed at end of day</p></div><div class="stat"><span class="panel-tag">CURRENT STREAK</span><div class="value">${streak()}</div><p class="caption">Consecutive 100% days</p></div></div>
      <div class="history-grid"><section class="panel"><div class="panel-title"><div><h2>Completion calendar</h2><p class="caption">Tap any recorded day to inspect or edit it.</p></div></div>${cal}<div class="legend"><span><i></i>100%</span><span class="partial"><i></i>Partly done</span><span class="empty"><i></i>0% / unlogged</span></div></section>
      <div class="stack"><section class="panel"><div class="panel-title"><div><h2>Target consistency</h2><p class="caption">How often each standard was met.</p></div></div><div class="compliance">${counts.map(([name,id,days])=>{const hit=days.filter(key=>id==='morning-all'?MORNING.every(([i])=>checkValue(getDay(key),i)):goalsFor(key).find(g=>g.id===id)?.ok).length; return `<div><div class="compliance-top"><span class="compliance-label">${name}</span><strong>${hit}/${days.length}${days.length?' · '+percent(hit,days.length)+'%':''}</strong></div>${progress(hit,days.length)}</div>`;}).join('')}</div></section>
      <section class="panel"><div class="panel-title"><div><h2>Weekly targets</h2><p class="caption">Workout frequency and the 16-hour weekend block.</p></div></div><div class="week-summary">${weeklyCards}</div></section></div></div>`;
  }
  function renderSettings() {
    const target = state.settings, habits=state.customHabits.filter(h=>!h.ends);
    const settingFields=[['calories','Calories per day','kcal',100,10000,50],['calls','Sales calls, weekdays','dials',1,1000,1],['afterHoursMinutes','After-6pm work, weekdays','minutes',1,600,5],['weekendMinutes','Weekend work, both days','minutes (16h = 960)',30,2880,30]];
    return `<div class="pagehead"><div><div class="eyebrow">Your standards</div><h1>Settings & data</h1><div class="date-muted">Adjust targets, manage extra habits and save backups.</div></div></div>
      <div class="settings-grid"><div class="stack"><section class="panel"><div class="panel-title"><div><h2>Daily targets</h2><p class="caption">Changes also recalculate historic scores.</p></div></div>
        ${settingFields.map(([id,label,unit,min,max,step])=>`<div class="setting-row"><label for="setting-${id}">${esc(label)}<small>${esc(unit)}</small></label><input id="setting-${id}" class="field" type="number" data-setting="${id}" min="${min}" max="${max}" step="${step}" value="${esc(target[id])}" inputmode="numeric"></div>`).join('')}
        <p class="settings-help">Your workout goal is fixed at <strong style="color:var(--ink)">4 days/week</strong>, leaving exactly 3 rest days. Workouts are marked once per day.</p></section>
        <section class="panel"><div class="panel-title"><div><h2>Add daily habits</h2><p class="caption">Optional additional standards count from the day they're added.</p></div></div>
          <form id="habit-form" class="task-form"><input class="field" id="habit-name" maxlength="55" autocomplete="off" placeholder="e.g. Drink enough water" aria-label="Habit name"><button class="btn" type="submit">Add</button></form>
          <div style="margin-top:9px">${habits.map(h=>`<div class="custom-row"><span>${esc(h.label)}</span><button type="button" data-action="archive-habit" data-id="${esc(h.id)}">Remove</button></div>`).join('')}</div><p class="settings-help">Removing a habit stops it from applying from today onward. Older records are kept.</p>
        </section></div>
      <div class="stack"><section class="panel"><div class="panel-title"><div><h2>Save your history</h2><p class="caption">This app works offline and stores entries on this device, not in GitHub.</p></div></div><p class="settings-help" style="margin-top:0">Export a backup regularly. Opening the site in a different browser or on another phone does not automatically bring your records across.</p>
        <div class="button-row" style="margin-top:17px"><button class="btn" type="button" data-action="export-json">Download backup</button><button class="btn secondary" type="button" data-action="export-csv">Export CSV</button></div><div class="split-line"></div>
        <label class="field-caption" for="import-input">Restore an exported JSON backup</label><input class="field" id="import-input" type="file" accept=".json,application/json"><p class="status-note warning">Import replaces all currently saved data. Export your existing history first.</p>
      </section><section class="panel"><div class="panel-title"><div><h2>How scoring works</h2></div></div>
        <p class="settings-help" style="margin-top:0">Daily percentage = applicable standards completed ÷ applicable standards. Weekday calls and extra AresFit work do not apply on Saturday/Sunday. The combined weekend work target counts on Sunday only. Training or one of the first three rest days in each Monday–Sunday week counts as completed.</p>
        <p class="settings-help">Misses need a reason before you can close a day. A day left unlogged counts as incomplete in historical statistics. Optional one-off tasks never affect scores.</p>
        <div class="split-line"></div><button class="btn danger" type="button" data-action="reset">Erase all locally saved data</button>
      </section></div></div>`;
  }
  function render() { renderShell(); }

  document.addEventListener('click', e => {
    const b=e.target.closest('[data-action]'); if (!b || b.disabled) return;
    const a=b.dataset.action, id=b.dataset.id;
    if (a==='tab') { ui.tab=b.dataset.value; ui.reviewOpen=false; render(); window.scrollTo(0,0); return; }
    if (a==='day-shift') { ui.selected=shiftDate(ui.selected,num(b.dataset.offset)); ui.reviewOpen=false; render(); return; }
    if (a==='jump-today') { ui.selected=TODAY(); ui.reviewOpen=false; render(); return; }
    if (a==='month-shift') { ui.month=moveMonth(ui.month,num(b.dataset.offset)); render(); return; }
    if (a==='select-day') { ui.selected=b.dataset.value; ui.tab='today'; ui.reviewOpen=false; render(); window.scrollTo(0,0); return; }
    if (a==='check') { modify(d=>{d.checks[id]=!d.checks[id];}); return; }
    if (a==='increment') { const field=b.dataset.field, delta=num(b.dataset.amount); modify(d=>{d[field]=clamp(num(d[field])+delta,0,field==='weekendMinutes'?1440:100000);}); return; }
    if (a==='smoking') { modify(d=>{d.smoked=b.dataset.value==='yes';}); return; }
    if (a==='training') { modify(d=>{d.training=b.dataset.value; if(d.training!=='trained') d.split='';}); return; }
    if (a==='task-check') { modify(d=>{const t=d.tasks.find(x=>x.id===id); if(t) t.done=!t.done;},false); return; }
    if (a==='task-delete') { modify(d=>{d.tasks=d.tasks.filter(x=>x.id!==id);},false); return; }
    if (a==='review') { ui.reviewOpen=!ui.reviewOpen; render(); return; }
    if (a==='reopen') { modify(d=>{d.closed=false;}); ui.reviewOpen=true; render(); return; }
    if (a==='close') {
      if (!dayCanClose(ui.selected)) { ui.reviewOpen=true; render(); toast('Classify training/smoking and explain every missed standard.'); return; }
      modify(d=>{d.closed=true;d.closedAt=new Date().toISOString();},false);
      ui.reviewOpen=false; render(); toast('Day closed and saved.'); return;
    }
    if (a==='archive-habit') {
      if(!confirm('Remove this daily habit going forward? Past results will stay.')) return;
      const habit=state.customHabits.find(x=>x.id===id); if(habit) habit.ends=shiftDate(TODAY(),-1);
      save(); render(); toast('Habit removed from future days.'); return;
    }
    if (a==='export-json') { download(JSON.stringify(state,null,2),'application/json',`daily-standard-backup-${TODAY()}.json`); toast('Backup downloaded.'); return; }
    if (a==='export-csv') { exportCSV(); toast('CSV downloaded.'); return; }
    if (a==='reset') {
      if (!confirm('Permanently erase ALL daily records and settings from this device? Export a backup first.')) return;
      state=defaultState(); save(); ui.selected=TODAY(); ui.month=monthKey(TODAY()); ui.tab='today'; ui.reviewOpen=false; render(); toast('Local history erased.');
    }
  });
  document.addEventListener('change', async e => {
    const el=e.target;
    if (el.matches('[data-field]')) {
      const field=el.dataset.field, raw=Number(el.value);
      if (field==='split') { modify(d=>{d.split=el.value;}); return; }
      if (!Number.isFinite(raw) || raw<0) { toast('Enter a valid non-negative number.'); render(); return; }
      modify(d=>{d[field]=field==='weekendMinutes'?clamp(Math.round(raw*60),0,1440):clamp(Math.round(raw),0,100000);}); return;
    }
    if (el.matches('[data-reason]')) {
      const id=el.dataset.reason;
      modify(d=>{const previous=d.reasons[id]||{};d.reasons[id]={category:el.value,note:previous.note||''};}); return;
    }
    if (el.matches('[data-reason-note]')) {
      const id=el.dataset.reasonNote; modify(d=>{const r=d.reasons[id]||{};r.note=el.value;d.reasons[id]=r;}); return;
    }
    if (el.matches('[data-setting]')) {
      const id=el.dataset.setting, raw=Number(el.value), min=Number(el.min), max=Number(el.max);
      if (!Number.isFinite(raw)||raw<min||raw>max) { toast(`Use a value from ${min} to ${max}.`);render();return; }
      state.settings[id]=Math.round(raw); save();render();toast('Target saved.'); return;
    }
    if (el.id==='import-input' && el.files?.[0]) {
      const file=el.files[0];
      try {
        const incoming=JSON.parse(await file.text());
        if(!incoming || incoming.version!==1 || !validDateKey(incoming.startedOn) || !incoming.days || Array.isArray(incoming.days) || typeof incoming.days!=='object') throw Error('Not a Daily Standard backup.');
        if(!confirm('Replace ALL current data with this backup? This cannot be undone without another backup.')) { render();return; }
        state={version:1,startedOn:incoming.startedOn,settings:{...DEFAULT_SETTINGS,...(incoming.settings||{})},customHabits:Array.isArray(incoming.customHabits)?incoming.customHabits:[],days:incoming.days};
        save();ui.selected=TODAY();ui.month=monthKey(TODAY());ui.tab='today';ui.reviewOpen=false;render();toast('Backup restored.');
      } catch(err) { toast(err.message||'Could not import file.');render(); }
    }
  });
  document.addEventListener('submit', e => {
    if (e.target.id==='task-form') {
      e.preventDefault();const input=e.target.querySelector('input'),value=input.value.trim();if(!value)return;
      modify(d=>{d.tasks.push({id:newId(),text:value.slice(0,120),done:false});},false);return;
    }
    if (e.target.id==='habit-form') {
      e.preventDefault();const input=e.target.querySelector('input'),value=input.value.trim();if(!value)return;
      if (state.customHabits.filter(h=>!h.ends).length>=20) {toast('Maximum 20 extra habits.');return;}
      state.customHabits.push({id:newId(),label:value.slice(0,55),starts:TODAY(),ends:null});save();render();toast('Daily habit added.');
    }
  });
  function download(data,mime,filename) {
    const blob=new Blob([data],{type:mime});const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
  }
  function exportCSV() {
    const cols=['Date','Closed','Score %','Calories','Sales calls','After-hours minutes','Weekend work minutes','Training','Session','Smoked','Read','Vitamins','Emails','Morning steps done','Missed reasons'];
    const rows=[cols];
    for(let key=state.startedOn;key<=TODAY();key=shiftDate(key,1)) {
      const d=getDay(key),s=score(key);
      rows.push([key,d.closed?'Yes':'No',s.pct,num(d.calories),num(d.calls),num(d.afterHoursMinutes),num(d.weekendMinutes),d.training||'',d.split||'',typeof d.smoked==='boolean'?(d.smoked?'Yes':'No'):'',checkValue(d,'read')?'Yes':'No',checkValue(d,'vitamins')?'Yes':'No',checkValue(d,'emails')?'Yes':'No',MORNING.filter(([id])=>checkValue(d,id)).length,s.goals.filter(g=>!g.ok&&d.reasons?.[g.id]?.category).map(g=>`${g.label}: ${d.reasons[g.id].category}${d.reasons[g.id].note?' ('+d.reasons[g.id].note+')':''}`).join('; ')]);
    }
    const csv=rows.map(row=>row.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\r\n');
    download('\ufeff'+csv,'text/csv;charset=utf-8',`daily-standard-history-${TODAY()}.csv`);
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { if (ui.tab==='today' && ui.selected===shiftDate(TODAY(),-1)) ui.selected=TODAY(); render(); }
  });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(err => console.warn('Offline caching unavailable',err)));
  }
  // Small internal test surface, without exposing or syncing user data anywhere.
  window.DailyStandardTest = { score, goalsFor, weeklySummary, weekendTotal, getState:()=>state, today:TODAY, weekStart, shiftDate };
  render();
})();