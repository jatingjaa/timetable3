/* สมุดติดตามการเรียน — ตรรกะของแอป
   ถ้าใส่ลิงก์เว็บแอปของ Apps Script ข้อมูลจะอ่าน/เขียนที่ Google ชีต
   ถ้าไม่ใส่ ข้อมูลจะเก็บไว้ในเบราว์เซอร์เครื่องนี้ */
 
const DEFAULT_API_URL = 'https://script.google.com/macros/s/AKfycbzB7MjF5rBHzmcC0IK-DLPZuru-iK4rNrgHaL8F-XG_ia1pfy_Lhlc6dFVHntwe5HyV/exec'; // ใส่ลิงก์ .../exec ตรงนี้ก็ได้ หรือกรอกในหน้าเว็บ
 
const LS_ITEMS = 'study.items';
const LS_URL = 'study.apiUrl';
 
let items = [];
let apiUrl = localStorage.getItem(LS_URL) || DEFAULT_API_URL;
 
const $ = (id) => document.getElementById(id);
 
/* ---------- ชั้นข้อมูล ---------- */
 
async function api(action, payload) {
  if (!apiUrl) return localApi(action, payload);
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // เลี่ยง preflight ของ CORS
    body: JSON.stringify({ action, ...payload })
  });
  if (!res.ok) throw new Error('เชื่อมต่อชีตไม่สำเร็จ (' + res.status + ')');
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'ชีตตอบกลับว่าทำรายการไม่สำเร็จ');
  return data.items;
}
 
function localApi(action, payload) {
  const saved = JSON.parse(localStorage.getItem(LS_ITEMS) || '[]');
  let next = saved;
  if (action === 'create') next = [...saved, payload.item];
  if (action === 'update') next = saved.map((i) => (i.id === payload.item.id ? payload.item : i));
  if (action === 'delete') next = saved.filter((i) => i.id !== payload.id);
  localStorage.setItem(LS_ITEMS, JSON.stringify(next));
  return Promise.resolve(next);
}
 
/* ---------- ตัวช่วย ---------- */
 
const num = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
const todayStr = () => new Date().toISOString().slice(0, 10);
 
function thaiDate(iso) {
  if (!iso) return 'ไม่กำหนด';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
}
 
function daysLeft(iso) {
  if (!iso) return null;
  const ms = new Date(iso + 'T00:00:00') - new Date(todayStr() + 'T00:00:00');
  return Math.round(ms / 86400000);
}
 
function isLate(item) {
  const d = daysLeft(item.dueDate);
  return d !== null && d < 0 && num(item.progress) < 100;
}
 
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}
 
let toastTimer;
function toast(msg, isError) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.toggle('toast--error', !!isError);
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}
 
/* ---------- การแสดงผล ---------- */
 
function render() {
  renderSummary();
  renderSubjectOptions();
  renderGroups();
}
 
function renderSummary() {
  const total = items.length;
  const done = items.filter((i) => num(i.progress) === 100).length;
  const late = items.filter(isLate).length;
  const subjects = new Set(items.map((i) => i.subject.trim())).size;
  const overall = total ? Math.round(items.reduce((s, i) => s + num(i.progress), 0) / total) : 0;
 
  $('statSubjects').textContent = subjects;
  $('statTotal').textContent = total;
  $('statDone').textContent = done;
  $('statLate').textContent = late;
  $('overallFill').style.width = overall + '%';
  $('overallValue').textContent = overall + '% เสร็จแล้ว';
}
 
function renderSubjectOptions() {
  const subjects = [...new Set(items.map((i) => i.subject.trim()))].sort((a, b) =>
    a.localeCompare(b, 'th')
  );
  $('subjectList').innerHTML = subjects.map((s) => `<option value="${esc(s)}">`).join('');
 
  const sel = $('filterSubject');
  const current = sel.value;
  sel.innerHTML =
    '<option value="">ทุกวิชา</option>' +
    subjects.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
  sel.value = subjects.includes(current) ? current : '';
}
 
function renderGroups() {
  const box = $('groups');
  const filter = $('filterSubject').value;
  const sortBy = $('sortBy').value;
 
  let view = filter ? items.filter((i) => i.subject.trim() === filter) : items.slice();
 
  $('empty').hidden = view.length > 0;
  if (!view.length) {
    box.innerHTML = '';
    $('empty').textContent = items.length
      ? 'ไม่มีหัวข้อในวิชานี้ เลือกวิชาอื่นหรือเพิ่มหัวข้อใหม่'
      : 'ยังไม่มีข้อมูล เริ่มจากกรอกวิชาแรกทางซ้ายได้เลย';
    return;
  }
 
  view.sort((a, b) => {
    if (sortBy === 'progress') return num(a.progress) - num(b.progress);
    if (sortBy === 'subject') return a.subject.localeCompare(b.subject, 'th');
    return (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31');
  });
 
  const groups = {};
  view.forEach((i) => (groups[i.subject.trim()] ||= []).push(i));
 
  box.innerHTML = Object.entries(groups)
    .map(([name, list]) => {
      const pct = Math.round(list.reduce((s, i) => s + num(i.progress), 0) / list.length);
      return `
      <section class="group">
        <div class="group__head">
          <h3 class="group__name">${esc(name)}</h3>
          <span class="group__count">${list.length} หัวข้อ</span>
          <span class="group__pct">${pct}%</span>
        </div>
        ${list.map(itemRow).join('')}
      </section>`;
    })
    .join('');
}
 
function itemRow(i) {
  const p = num(i.progress);
  const late = isLate(i);
  const left = daysLeft(i.dueDate);
 
  let due = `กำหนดส่ง ${thaiDate(i.dueDate)}`;
  if (late) due = `เลยกำหนด ${Math.abs(left)} วัน (${thaiDate(i.dueDate)})`;
  else if (left === 0) due = `ส่งวันนี้ (${thaiDate(i.dueDate)})`;
  else if (left !== null && left <= 7) due = `อีก ${left} วัน (${thaiDate(i.dueDate)})`;
 
  const status =
    p === 100 ? '<span class="tag-done">ทำเสร็จแล้ว</span>' : p === 0 ? 'ยังไม่เริ่ม' : 'กำลังทำ';
 
  return `
  <article class="item ${p === 100 ? 'item--done' : ''}">
    <div class="item__main">
      <div class="item__topic">${esc(i.topic)}</div>
      <div class="item__meta">
        <span class="${late ? 'late' : ''}">${esc(due)}</span>
        <span>${status}</span>
      </div>
      ${i.note ? `<div class="item__note">${esc(i.note)}</div>` : ''}
    </div>
    <div class="item__right">
      <div class="bar"><span style="width:${p}%"></span></div>
      <span class="pct">${p}%</span>
      <button class="iconbtn" data-edit="${esc(i.id)}" type="button">แก้ไข</button>
      <button class="iconbtn iconbtn--danger" data-del="${esc(i.id)}" type="button">ลบ</button>
    </div>
  </article>`;
}
 
/* ---------- ฟอร์ม ---------- */
 
function resetForm() {
  $('itemForm').reset();
  $('itemId').value = '';
  $('progressOut').textContent = '0%';
  $('formTitle').textContent = 'เพิ่มหัวข้อใหม่';
  $('submitBtn').textContent = 'บันทึก';
  $('cancelEdit').hidden = true;
}
 
function fillForm(item) {
  $('itemId').value = item.id;
  $('subject').value = item.subject;
  $('topic').value = item.topic;
  $('dueDate').value = item.dueDate || '';
  $('progress').value = num(item.progress);
  $('progressOut').textContent = num(item.progress) + '%';
  $('note').value = item.note || '';
  $('formTitle').textContent = 'แก้ไขหัวข้อ';
  $('submitBtn').textContent = 'บันทึกการแก้ไข';
  $('cancelEdit').hidden = false;
  $('subject').focus();
}
 
/* ---------- เหตุการณ์ ---------- */
 
$('progress').addEventListener('input', (e) => {
  $('progressOut').textContent = e.target.value + '%';
});
 
$('itemForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = $('itemId').value;
  const item = {
    id: id || 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    subject: $('subject').value.trim(),
    topic: $('topic').value.trim(),
    dueDate: $('dueDate').value || '',
    progress: num($('progress').value),
    note: $('note').value.trim()
  };
  const btn = $('submitBtn');
  btn.disabled = true;
  try {
    items = await api(id ? 'update' : 'create', { item });
    render();
    resetForm();
    toast(id ? 'แก้ไขแล้ว' : 'เพิ่มหัวข้อแล้ว');
  } catch (err) {
    toast(err.message, true);
  } finally {
    btn.disabled = false;
  }
});
 
$('cancelEdit').addEventListener('click', resetForm);
 
$('groups').addEventListener('click', async (e) => {
  const editId = e.target.dataset.edit;
  const delId = e.target.dataset.del;
  if (editId) {
    const item = items.find((i) => i.id === editId);
    if (item) fillForm(item);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  if (delId) {
    const item = items.find((i) => i.id === delId);
    if (!confirm(`ลบ "${item ? item.topic : 'หัวข้อนี้'}" ใช่ไหม`)) return;
    try {
      items = await api('delete', { id: delId });
      render();
      toast('ลบแล้ว');
    } catch (err) {
      toast(err.message, true);
    }
  }
});
 
$('filterSubject').addEventListener('change', renderGroups);
$('sortBy').addEventListener('change', renderGroups);
 
$('settingsBtn').addEventListener('click', () => {
  const s = $('settings');
  s.hidden = !s.hidden;
  if (!s.hidden) $('apiUrl').focus();
});
 
$('saveUrl').addEventListener('click', async () => {
  const url = $('apiUrl').value.trim();
  if (!/\/exec$/.test(url)) return toast('ลิงก์ต้องลงท้ายด้วย /exec', true);
  apiUrl = url;
  localStorage.setItem(LS_URL, url);
  await load();
  toast('เชื่อมต่อ Google ชีตแล้ว');
});
 
$('clearUrl').addEventListener('click', async () => {
  apiUrl = '';
  localStorage.removeItem(LS_URL);
  $('apiUrl').value = '';
  await load();
  toast('กลับมาเก็บข้อมูลในเครื่องนี้');
});
 
/* ---------- เริ่มต้น ---------- */
 
async function load() {
  try {
    items = await api('list', {});
  } catch (err) {
    items = JSON.parse(localStorage.getItem(LS_ITEMS) || '[]');
    toast(err.message + ' — แสดงข้อมูลในเครื่องนี้ไปก่อน', true);
  }
  items = (items || []).map((i) => ({ ...i, progress: num(i.progress) }));
  render();
}
 
$('apiUrl').value = apiUrl;
$('dueDate').min = '2000-01-01';
load();
 