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
  { title: "About you", help: "Tell us about yourself so we can understand who THABIRA FLIP should serve. Your name is optional.", questions: [
    {id:"date",label:"Survey date",type:"date"},
    {id:"name",label:"Name (optional)",type:"text",optional:true,placeholder:"Your name (optional)"},
    {id:"role",label:"1. Which group best describes you?",type:"radio",required:true,options:["High School Student","College/University Student","Teacher/Lecturer","Working Professional","Business Owner","Other"],other:true},
    {id:"age",label:"2. What is your age group?",type:"radio",required:true,options:["Under 15","15–18","19–25","26–35","36+"]}
  ]},
  { title: "Your current needs", help: "Tell us how you currently manage learning, work and personal information.", questions: [
    {id:"current_tools",label:"3. Which tools do you currently use to organise your work or learning? (Select all that apply)",type:"checkbox",required:true,options:["Paper notebooks","Phone notes app","Microsoft Word or Google Docs","Calendar or task app","Document scanner or PDF app","Cloud storage","Several separate apps","Other"],other:true},
    {id:"current_problems",label:"4. What is the biggest problem you face when organising notes, documents, tasks or records?",type:"textarea",required:true,placeholder:"Describe the main problem you experience…"},
    {id:"switching_apps",label:"5. How often do you switch between different apps to complete your tasks?",type:"radio",required:true,options:["Never","Sometimes","Often","Very often"]}
  ]},
  { title: "Explore the updated features", help: "Review the feature list above, then tell us which tools would be useful to you.", questions: [
    {id:"useful_features",label:"6. Which THABIRA FLIP features would be most useful to you? (Select all that apply)",type:"checkbox",required:true,options:["Talk to Thabira assistant","Voice input or dictation","Document scanner","File converter","Notes and books","Library for saved work","Tasks and organisation","Student workspace","Business workspace","Profile and privacy settings"]},
    {id:"workspace",label:"7. Which workspace would you use most?",type:"radio",required:true,options:["Student","Business","Worker / Professional","Personal use","More than one workspace","Not sure yet"]},
    {id:"one_place",label:"8. How useful would it be to have these tools together in one app?",type:"radio",required:true,options:["Not useful","A little useful","Useful","Very useful"]}
  ]},
  { title: "Using THABIRA FLIP", help: "We want to understand how the updated app could fit into your daily routine.", questions: [
    {id:"use_app",label:"9. How likely are you to use THABIRA FLIP if it meets your needs?",type:"radio",required:true,options:["Very likely","Somewhat likely","Not sure","Unlikely"]},
    {id:"top_feature",label:"10. Which single feature would you try first?",type:"radio",required:true,options:["Talk to Thabira","Scanner","Converter","Notes and books","Library","Tasks","Student workspace","Business workspace","Profile and settings"]},
    {id:"wanted_feature",label:"11. What would you want THABIRA FLIP to help you do that is difficult today?",type:"textarea",required:false,placeholder:"Describe a task, problem or idea…"}
  ]},
  { title: "Student and education needs", help: "These questions focus on learning and education. If they do not apply to you, you can skip them.", questions: [
    {id:"study_tools",label:"12. Which learning tools would help you? (Select all that apply)",type:"checkbox",required:false,options:["Organise subjects and notes","Study plans and revision","Assignments and deadlines","Scan learning material","Keep documents and books together","Ask questions using the assistant","Not applicable","Other"],other:true},
    {id:"student_value",label:"13. Would a dedicated student workspace help you organise school, college or university work?",type:"radio",required:false,options:["Yes","No","Maybe","Not applicable"]},
    {id:"education_challenges",label:"14. What is one challenge you face when managing school, college or university work?",type:"textarea",required:false,placeholder:"Share your experience…"}
  ]},
  { title: "Business and professional needs", help: "These questions explore the app's usefulness for work, business and everyday organisation.", questions: [
    {id:"work_use",label:"15. Would you use THABIRA FLIP for work or business?",type:"radio",required:false,options:["Yes","No","Maybe"]},
    {id:"work_tasks",label:"16. Which work or business activities could you manage with it? (Select all that apply)",type:"checkbox",required:false,options:["Meeting notes","Tasks and planning","Research and ideas","Customer information","Invoices and expenses","Documents and records","Personal organisation","Not applicable","Other"],other:true}
  ]},
  { title: "Final feedback", help: "Your feedback will help us prioritise the next improvements to THABIRA FLIP.", questions: [
    {id:"improvement",label:"17. What should we improve or add next?",type:"textarea",required:false,placeholder:"Tell us what matters most to you…"},
    {id:"test_app",label:"18. Would you be interested in testing THABIRA FLIP and sharing feedback?",type:"radio",required:false,options:["Yes","No","Maybe"]},
    {id:"future_feedback",label:"19. Would you like to receive information about future testing or updates?",type:"radio",required:false,options:["Yes","No"]},
    {id:"contact_name",label:"Contact name (optional)",type:"text",optional:true,placeholder:"Optional"},
    {id:"contact",label:"Email or phone number (optional)",type:"text",optional:true,placeholder:"Only if you want us to contact you"}
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
