/*
 * THABIRA FLIP Research Survey
 * Offline-first: local draft + response queue + JSON/CSV export + API synchronisation.
 * Keep the existing storage keys so previously saved NoteWeaver survey responses remain accessible.
 */
const API_URL = "https://noteweaver-survey-beckend.onrender.com/api/survey-responses/";
const STORAGE_KEY = "noteweaver_survey_v1";
const DRAFT_KEY = "noteweaver_survey_draft_v1";
const SURVEY_NAME = "THABIRA FLIP Research Survey";

const sections = [
  { title: "About you", help: "Tell us a little about yourself. You can leave your name blank.", questions: [
    {id:"date",label:"Survey date",type:"date"},
    {id:"name",label:"Name",type:"text",optional:true,placeholder:"Your name (optional)"},
    {id:"role",label:"1. Which group best describes you?",type:"radio",required:true,options:["High School Student","College/University Student","Teacher/Lecturer","Working Professional","Other"],other:true},
    {id:"age",label:"2. What is your age group?",type:"radio",required:true,options:["Under 15","15–18","19–25","26–35","36+"]}
  ]},
  { title: "Your current note-taking habits", help: "We want to understand how you currently store and find information.", questions: [
    {id:"method",label:"3. How do you currently take notes?",type:"checkbox",required:true,options:["Notebook/Paper","Microsoft Word","Google Docs","Phone Notes App","Tablet Applications","Other"],other:true},
    {id:"current_problems",label:"4. What problems do you experience with your current note-taking method?",type:"textarea",required:true,placeholder:"Describe the problems you face…"},
    {id:"lose_notes",label:"5. How often do you lose, damage, or struggle to find important notes?",type:"radio",required:true,options:["Never","Sometimes","Often","Very Often"]}
  ]},
  { title: "Organisation and learning", help: "Choose the features that would make managing notes easier.", questions: [
    {id:"organise_difficulty",label:"6. Do you struggle to organise notes by subjects, topics, or projects?",type:"radio",required:true,options:["Yes","No","Sometimes"]},
    {id:"helpful_features",label:"7. Which features would help you manage your notes better? (Select all that apply)",type:"checkbox",required:true,options:["Create digital notebooks","Organise notes into folders/books","Add pictures and files","Search notes quickly","Share notes with others","Access notes anywhere"]},
    {id:"access_importance",label:"8. How important is it for you to access your notes anywhere?",type:"radio",required:true,options:["Not Important","Slightly Important","Important","Very Important"]}
  ]},
  { title: "About THABIRA FLIP", help: "THABIRA FLIP is being developed as a digital workspace for creating and organising notes, documents, photos and books, including a book-style page-flipping experience. Some features may still be under development.", questions: [
    {id:"use_app",label:"9. Would you use an app like THABIRA FLIP?",type:"radio",required:true,options:["Definitely","Maybe","No"]},
    {id:"app_features",label:"10. Which THABIRA FLIP features interest you most? (Select all that apply)",type:"checkbox",required:true,options:["Digital notebooks/books","Writing and editing notes","Adding images","Scanning documents","Converting photos to PDF","Searching information quickly","Organising subjects/projects","Cloud backup","Offline access and later sync","Sharing notes","Custom notebook designs"]},
    {id:"wanted_feature",label:"11. What feature would you like to see added to THABIRA FLIP?",type:"textarea",required:false,placeholder:"Share your ideas…"}
  ]},
  { title: "For teachers and educators", help: "These questions are most relevant to teachers and lecturers, but everyone may answer if they have an observation to share.", questions: [
    {id:"teacher_tools",label:"12. If you are a teacher or lecturer, would a digital notebook help you organise your work? (Select all that apply)",type:"checkbox",required:false,options:["Lesson plans","Teaching materials","Student resources","Marking notes","Not applicable","Other"],other:true},
    {id:"recommend_students",label:"13. Would you recommend a note organisation app to students?",type:"radio",required:false,options:["Yes","No","Maybe","Not applicable"]},
    {id:"student_challenges",label:"14. What challenges do students face when managing learning material?",type:"textarea",required:false,placeholder:"Share what you have observed…"}
  ]},
  { title: "For work and business", help: "These questions explore how THABIRA FLIP might support work and business tasks.", questions: [
    {id:"work_use",label:"15. Would you use THABIRA FLIP for work or business purposes?",type:"radio",required:false,options:["Yes","No","Maybe"]},
    {id:"work_tasks",label:"16. What would you use it for? (Select all that apply)",type:"checkbox",required:false,options:["Meeting notes","Project planning","Research","Ideas and brainstorming","Personal organisation","Documents and records","Other"],other:true}
  ]},
  { title: "Final feedback", help: "Your suggestions will help us improve THABIRA FLIP.", questions: [
    {id:"better_than_others",label:"17. What would make THABIRA FLIP better than other note-taking applications?",type:"textarea",required:false,placeholder:"Your suggestions…"},
    {id:"test_app",label:"18. Would you like to test an early version of THABIRA FLIP?",type:"radio",required:false,options:["Yes","No"]},
    {id:"future_feedback",label:"19. Would you like to provide future feedback?",type:"radio",required:false,options:["Yes","No"]},
    {id:"contact_name",label:"Contact name",type:"text",optional:true,placeholder:"Optional"},
    {id:"contact",label:"Email or phone number",type:"text",optional:true,placeholder:"Optional"}
  ]}
];

let currentSection = 0;
let answers = {};
let deferredInstallPrompt = null;
let syncInProgress = false;

const form = document.getElementById("surveyForm");
const sectionContent = document.getElementById("sectionContent");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const saveBtn = document.getElementById("saveBtn");
const errorBox = document.getElementById("formError");
const saveStatus = document.getElementById("saveStatus");
const connectionBadge = document.getElementById("connectionBadge");

function safeParse(value, fallback) { try { return JSON.parse(value); } catch { return fallback; } }
function loadLocal() {
  answers = safeParse(localStorage.getItem(DRAFT_KEY) || "{}", {});
  if (!answers.date) answers.date = new Date().toISOString().slice(0,10);
}
function saveDraft(message = "Draft saved on this device.") {
  collectVisibleValues();
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(answers));
    saveStatus.textContent = message + (navigator.onLine ? " Internet is available." : " You are offline.");
  } catch {
    saveStatus.textContent = "This browser could not save the draft. Check available device storage.";
  }
}
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function questionHTML(q) {
  const requiredMark = q.required ? '<span class="required-star" aria-hidden="true">*</span>' : "";
  const optionalMark = q.optional || !q.required ? '<span class="optional">Optional</span>' : "";
  const label = `<label class="question-label" ${["radio","checkbox"].includes(q.type) ? "" : `for="${q.id}"`}>${escapeHTML(q.label)}${requiredMark}${optionalMark}</label>`;
  let control = "";
  if (q.type === "text" || q.type === "date") {
    control = `<input class="input" id="${q.id}" name="${q.id}" type="${q.type}" ${q.placeholder ? `placeholder="${escapeHTML(q.placeholder)}"` : ""} value="${escapeHTML(answers[q.id] || "")}" ${q.type === "date" ? 'aria-label="Survey date"' : ""}>`;
  } else if (q.type === "textarea") {
    control = `<textarea class="textarea" id="${q.id}" name="${q.id}" placeholder="${escapeHTML(q.placeholder || "")}">${escapeHTML(answers[q.id] || "")}</textarea>`;
  } else {
    const selected = Array.isArray(answers[q.id]) ? answers[q.id] : (answers[q.id] ? [answers[q.id]] : []);
    const inputType = q.type === "radio" ? "radio" : "checkbox";
    const choices = (q.options || []).map((option, index) => {
      const isOther = option === "Other";
      const checked = selected.includes(option) ? "checked" : "";
      return `<label class="choice"><input type="${inputType}" name="${q.id}" value="${escapeHTML(option)}" ${checked}><span>${escapeHTML(option)}</span></label>`;
    }).join("");
    control = `<div class="choice-list">${choices}</div>`;
    if (q.other) {
      const otherValue = answers[`${q.id}_other`] || "";
      control += `<input class="input other-input" type="text" id="${q.id}_other" name="${q.id}_other" placeholder="If other, please specify (optional)" value="${escapeHTML(otherValue)}" aria-label="${escapeHTML(q.label)} other answer">`;
    }
  }
  return `<div class="question" data-question="${q.id}">${label}${control}</div>`;
}
function renderSection() {
  const section = sections[currentSection];
  sectionContent.innerHTML = `<h3 class="section-title">${escapeHTML(section.title)}</h3><p class="section-help">${escapeHTML(section.help)}</p>${section.questions.map(questionHTML).join("")}`;
  prevBtn.disabled = currentSection === 0;
  prevBtn.style.opacity = currentSection === 0 ? ".4" : "1";
  nextBtn.textContent = currentSection === sections.length - 1 ? "Submit response ✓" : "Continue →";
  document.getElementById("sectionCounter").textContent = `Section ${currentSection + 1} of ${sections.length}`;
  document.getElementById("progressBar").style.width = `${((currentSection + 1) / sections.length) * 100}%`;
  errorBox.hidden = true;
}
function collectVisibleValues() {
  const section = sections[currentSection];
  section.questions.forEach(q => {
    if (q.type === "radio") {
      const selected = sectionContent.querySelector(`input[name="${q.id}"]:checked`);
      if (selected) answers[q.id] = selected.value;
      else delete answers[q.id];
    } else if (q.type === "checkbox") {
      answers[q.id] = [...sectionContent.querySelectorAll(`input[name="${q.id}"]:checked`)].map(el => el.value);
      if (!answers[q.id].length) delete answers[q.id];
      const other = sectionContent.querySelector(`#${q.id}_other`);
      if (other) answers[`${q.id}_other`] = other.value.trim();
    } else {
      const el = sectionContent.querySelector(`[name="${q.id}"]`);
      if (el) answers[q.id] = el.value;
    }
  });
}
function validateSection() {
  collectVisibleValues();
  for (const q of sections[currentSection].questions) {
    if (!q.required) continue;
    const val = answers[q.id];
    if (q.type === "checkbox" && (!Array.isArray(val) || !val.length)) {
      errorBox.textContent = `Please select at least one answer for: ${q.label}`; errorBox.hidden = false; return false;
    }
    if (q.type === "radio" && !val) {
      errorBox.textContent = `Please choose an answer for: ${q.label}`; errorBox.hidden = false; return false;
    }
    if (["textarea","text"].includes(q.type) && !String(val || "").trim()) {
      errorBox.textContent = `Please complete: ${q.label}`; errorBox.hidden = false; return false;
    }
  }
  errorBox.hidden = true;
  return true;
}
function getResponses() { return safeParse(localStorage.getItem(STORAGE_KEY) || "[]", []); }
function setResponses(items) { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }
function createResponse() {
  const id = (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : `resp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return { id, client_response_id:id, survey_name:SURVEY_NAME, schema_version:1, answers:{...answers}, client_created_at:new Date().toISOString(), sync_status:"pending" };
}
async function syncPending() {
  updateConnectionBadge();
  if (!navigator.onLine || !API_URL || syncInProgress) return;
  syncInProgress = true;
  let items = getResponses();
  let changed = false;
  try {
    for (let i = 0; i < items.length; i++) {
      if (items[i].sync_status === "synced") continue;
      const payload = {...items[i], client_response_id:items[i].client_response_id || items[i].id};
      try {
        const res = await fetch(API_URL, {
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        items[i].sync_status = "synced";
        items[i].synced_at = new Date().toISOString();
        changed = true;
      } catch (err) {
        console.warn("Survey sync pending:", err);
        break;
      }
    }
    if (changed) {
      setResponses(items);
      saveStatus.textContent = "Online sync complete for saved responses.";
    } else if (items.some(item => item.sync_status !== "synced")) {
      saveStatus.textContent = "Some responses are waiting to sync. They remain saved on this device.";
    }
  } finally {
    syncInProgress = false;
    updateConnectionBadge();
  }
}
function updateConnectionBadge() {
  if (navigator.onLine) {
    connectionBadge.textContent = API_URL ? "Online · sync enabled" : "Online · local save";
    connectionBadge.className = "status online";
  } else {
    connectionBadge.textContent = "Offline · saved on device";
    connectionBadge.className = "status offline";
  }
}
function submitResponse() {
  collectVisibleValues();
  const response = createResponse();
  try {
    const items = getResponses();
    items.push(response);
    setResponses(items);
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    errorBox.textContent = "The response could not be saved on this device. Please export or free device storage and try again.";
    errorBox.hidden = false;
    return;
  }
  form.hidden = true;
  document.querySelector(".intro").hidden = true;
  document.getElementById("thankYou").hidden = false;
  saveStatus.textContent = "Response saved on this device. Online synchronisation will be attempted now.";
  window.scrollTo({top:0,behavior:"smooth"});
  syncPending();
}
function downloadFile(content, type, filename) {
  const blob = new Blob([content], {type:`${type};charset=utf-8;`});
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1200);
}
function csvEscape(value) {
  if (Array.isArray(value)) value = value.join("; ");
  if (value === null || value === undefined) value = "";
  return `"${String(value).replace(/"/g,'""')}"`;
}
function exportResponses() {
  const responses = getResponses();
  const payload = {exported_at:new Date().toISOString(), survey:SURVEY_NAME, responses, draft:safeParse(localStorage.getItem(DRAFT_KEY) || "null", null)};
  const date = new Date().toISOString().slice(0,10);
  const choice = prompt("Export saved responses:\nType JSON or CSV", "JSON");
  if (!choice) return;
  if (choice.trim().toLowerCase() === "json") {
    downloadFile(JSON.stringify(payload, null, 2), "application/json", `THABIRA_FLIP_Responses_${date}.json`);
  } else if (choice.trim().toLowerCase() === "csv") {
    if (!responses.length) { alert("There are no submitted responses saved on this device yet."); return; }
    const keys = [...new Set(responses.flatMap(r => Object.keys(r.answers || {})))];
    const headers = ["Response ID","Survey","Created At","Sync Status",...keys];
    const rows = responses.map(r => [r.client_response_id || r.id, r.survey_name || SURVEY_NAME, r.client_created_at, r.sync_status || "pending", ...keys.map(k => r.answers?.[k] ?? "")]);
    const csv = [headers.map(csvEscape).join(","), ...rows.map(row => row.map(csvEscape).join(","))].join("\r\n");
    downloadFile("\uFEFF" + csv, "text/csv", `THABIRA_FLIP_Responses_${date}.csv`);
  } else {
    alert("Please enter JSON or CSV.");
  }
}
prevBtn.addEventListener("click", () => {
  collectVisibleValues(); saveDraft("Draft saved on this device.");
  if (currentSection > 0) { currentSection--; renderSection(); window.scrollTo({top:0,behavior:"smooth"}); }
});
nextBtn.addEventListener("click", () => {
  if (!validateSection()) return;
  saveDraft("Progress saved on this device.");
  if (currentSection < sections.length - 1) {
    currentSection++; renderSection(); window.scrollTo({top:0,behavior:"smooth"});
  } else submitResponse();
});
saveBtn.addEventListener("click", () => saveDraft());
document.getElementById("exportBtn").addEventListener("click", exportResponses);
document.getElementById("exportAfterBtn").addEventListener("click", exportResponses);
document.getElementById("newResponseBtn").addEventListener("click", () => {
  answers = {date:new Date().toISOString().slice(0,10)};
  currentSection = 0;
  document.getElementById("thankYou").hidden = true;
  document.querySelector(".intro").hidden = false;
  form.hidden = false;
  renderSection(); window.scrollTo({top:0,behavior:"smooth"});
});
window.addEventListener("online", () => { updateConnectionBadge(); syncPending(); });
window.addEventListener("offline", updateConnectionBadge);
window.addEventListener("beforeunload", () => {
  try { collectVisibleValues(); localStorage.setItem(DRAFT_KEY, JSON.stringify(answers)); } catch {}
});
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault(); deferredInstallPrompt = e;
});
document.getElementById("year").textContent = new Date().getFullYear();
loadLocal(); renderSection(); updateConnectionBadge(); syncPending();
if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("./service-worker.js").catch(err => console.warn("Service worker registration failed:", err));
}
