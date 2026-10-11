/*
 NoteWeaver Flip survey
 Offline-first: localStorage draft + response queue, JSON export, optional API sync.
 Set API_URL to your deployed HTTPS Django endpoint to enable central collection.
*/
const API_URL = ""; // Example: "https://your-domain.example/api/survey-responses/"
const STORAGE_KEY = "noteweaver_survey_v1";
const DRAFT_KEY = "noteweaver_survey_draft_v1";

const sections = [
 {title:"About you",help:"Tell us a little about yourself. You can leave your name blank.",questions:[
  {id:"date",label:"Survey date",type:"date"},
  {id:"name",label:"Name",type:"text",optional:true,placeholder:"Your name (optional)"},
  {id:"role",label:"1. Which group best describes you?",type:"radio",required:true,options:["High School Student","College/University Student","Teacher/Lecturer","Working Professional","Other"] ,other:true},
  {id:"age",label:"2. What is your age group?",type:"radio",required:true,options:["Under 15","15–18","19–25","26–35","36+"]},
 ]},
 {title:"Your current note-taking habits",help:"We want to understand how you currently store and find information.",questions:[
  {id:"method",label:"3. How do you currently take notes?",type:"checkbox",required:true,options:["Notebook/Paper","Microsoft Word","Google Docs","Phone Notes App","Tablet Applications","Other"],other:true},
  {id:"current_problems",label:"4. What problems do you experience with your current note-taking method?",type:"textarea",required:true,placeholder:"Describe the problems you face…"},
  {id:"lose_notes",label:"5. How often do you lose, damage, or struggle to find important notes?",type:"radio",required:true,options:["Never","Sometimes","Often","Very Often"]},
 ]},
 {title:"Organisation and learning",help:"Choose all the features that would make managing notes easier.",questions:[
  {id:"organise_difficulty",label:"6. Do you struggle to organise notes by subjects, topics, or projects?",type:"radio",required:true,options:["Yes","No","Sometimes"]},
  {id:"helpful_features",label:"7. Which features would help you manage your notes better? (Select all that apply)",type:"checkbox",required:true,options:["Create digital notebooks","Organise notes into folders/books","Add pictures and files","Search notes quickly","Share notes with others","Access notes anywhere"]},
  {id:"access_importance",label:"8. How important is it for you to access your notes anywhere?",type:"radio",required:true,options:["Not Important","Slightly Important","Important","Very Important"]},
 ]},
 {title:"About NoteWeaver Flip",help:"NoteWeaver Flip is a digital notebook app for creating books, organising pages, adding content, and managing learning or work materials.",questions:[
  {id:"use_app",label:"9. Would you use an app like NoteWeaver Flip?",type:"radio",required:true,options:["Definitely","Maybe","No"]},
  {id:"app_features",label:"10. Which NoteWeaver Flip features interest you most? (Select all that apply)",type:"checkbox",required:true,options:["Digital notebooks/books","Writing and editing notes","Adding images","Searching information quickly","Organising subjects/projects","Cloud backup","Sharing notes","Custom notebook designs"]},
  {id:"wanted_feature",label:"11. What feature would you like to see added?",type:"textarea",required:false,placeholder:"Tell us what you would like the app to do…"},
 ]},
 {title:"Teachers and education",help:"If you are not a teacher, you may skip the teacher-specific question.",questions:[
  {id:"teacher_tools",label:"12. If you are a teacher, would a digital notebook help you organise? (Select all that apply)",type:"checkbox",required:false,options:["Lesson plans","Teaching materials","Student resources","Marking notes","Other"],other:true},
  {id:"recommend_students",label:"13. Would you recommend a note organisation app to students?",type:"radio",required:false,options:["Yes","No","Maybe"]},
  {id:"student_challenges",label:"14. What challenges do students face when managing learning material?",type:"textarea",required:false,placeholder:"Share what you have observed…"},
 ]},
 {title:"Work professionals",help:"These questions explore how the app might support work and business tasks.",questions:[
  {id:"work_use",label:"15. Would you use NoteWeaver Flip for work purposes?",type:"radio",required:false,options:["Yes","No","Maybe"]},
  {id:"work_tasks",label:"16. What would you use it for? (Select all that apply)",type:"checkbox",required:false,options:["Meeting notes","Project planning","Research","Ideas and brainstorming","Personal organisation","Other"],other:true},
 ]},
 {title:"Final feedback",help:"Your suggestions will help us improve NoteWeaver Flip.",questions:[
  {id:"better_than_others",label:"17. What would make NoteWeaver Flip better than other note applications?",type:"textarea",required:false,placeholder:"Your suggestions…"},
  {id:"test_app",label:"18. Would you like to test an early version of NoteWeaver Flip?",type:"radio",required:false,options:["Yes","No"]},
  {id:"future_feedback",label:"19. Would you like to provide future feedback?",type:"radio",required:false,options:["Yes","No"]},
  {id:"contact_name",label:"Contact name",type:"text",optional:true,placeholder:"Optional"},
  {id:"contact",label:"Email or phone number",type:"text",optional:true,placeholder:"Optional"},
 ]}
];

let currentSection = 0;
let answers = {};
let deferredInstallPrompt = null;
const form = document.getElementById("surveyForm");
const sectionContent = document.getElementById("sectionContent");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const saveBtn = document.getElementById("saveBtn");
const errorBox = document.getElementById("formError");
const saveStatus = document.getElementById("saveStatus");

function loadLocal() {
  try { answers = JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}"); } catch { answers = {}; }
  if (!answers.date) answers.date = new Date().toISOString().slice(0,10);
}
function saveDraft(message="Draft saved on this device.") {
  collectVisibleValues();
  localStorage.setItem(DRAFT_KEY, JSON.stringify(answers));
  saveStatus.textContent = message + (navigator.onLine ? " Internet is available." : " You are offline.");
}
function collectVisibleValues() {
  sections.forEach(section => section.questions.forEach(q => {
    if(q.type==="radio") {
      const selected=document.querySelector(`input[name="${q.id}"]:checked`);
      if(selected) answers[q.id]=selected.value;
      else if(!(q.id in answers)) answers[q.id]="";
      const other=document.querySelector(`[name="${q.id}_other"]`);
      if(other) answers[q.id+"_other"]=other.value;
    } else if(q.type==="checkbox") {
      answers[q.id]=Array.from(document.querySelectorAll(`input[name="${q.id}"]:checked`)).map(el=>el.value);
      const other=document.querySelector(`[name="${q.id}_other"]`);
      if(other) answers[q.id+"_other"]=other.value;
    } else {
      const el=document.querySelector(`[name="${q.id}"]`);
      if(el) answers[q.id]=el.value;
    }
  }));
}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function renderQuestion(q) {
  const required=q.required ? '<span class="optional"> · Required</span>' : '<span class="optional"> · Optional</span>';
  let html=`<div class="question" data-question="${q.id}">`;
  if(q.type==="radio" || q.type==="checkbox") {
    html+=`<fieldset style="border:0;padding:0;margin:0"><legend>${esc(q.label)}${required}</legend><div class="options">`;
    q.options.forEach((option,i)=>{
      const checked=q.type==="radio" ? answers[q.id]===option : (answers[q.id]||[]).includes(option);
      html+=`<label class="option"><input type="${q.type}" name="${q.id}" value="${esc(option)}" ${checked?"checked":""}><span>${esc(option)}</span></label>`;
    });
    html+='</div>';
    if(q.other) html+=`<label class="question-label" style="font-size:13px;margin-top:12px" for="${q.id}_other">If other, please specify</label><input type="text" id="${q.id}_other" name="${q.id}_other" value="${esc(answers[q.id+"_other"]||"")}" placeholder="Write your answer…">`;
    html+='</fieldset>';
  } else {
    html+=`<label class="question-label" for="${q.id}">${esc(q.label)}${required}</label>`;
    if(q.type==="textarea") html+=`<textarea id="${q.id}" name="${q.id}" placeholder="${esc(q.placeholder||"Write your answer…")}">${esc(answers[q.id]||"")}</textarea>`;
    else html+=`<input type="${q.type==="date"?"date":q.type==="email"?"email":"text"}" id="${q.id}" name="${q.id}" value="${esc(answers[q.id]||"")}" placeholder="${esc(q.placeholder||"")}">`;
  }
  html+='</div>';return html;
}
function renderSection() {
  const s=sections[currentSection];
  sectionContent.innerHTML=`<p class="section-kicker">SECTION ${currentSection+1} OF ${sections.length}</p><h2 class="section-title">${esc(s.title)}</h2><p class="section-help">${esc(s.help)}</p>${s.questions.map(renderQuestion).join("")}`;
  prevBtn.disabled=currentSection===0;
  nextBtn.textContent=currentSection===sections.length-1?"Review & submit →":"Next →";
  document.getElementById("sectionLabel").textContent=`Section ${currentSection+1} of ${sections.length}`;
  const pct=Math.round(((currentSection+1)/sections.length)*100);
  document.getElementById("progressPercent").textContent=`${pct}%`;
  document.getElementById("progressBar").style.width=`${pct}%`;
  errorBox.textContent="";
  sectionContent.querySelectorAll("input,textarea").forEach(el=>el.addEventListener("change",()=>saveDraft("Your answers are saved locally.")));
}
function validateSection() {
  collectVisibleValues();
  const s=sections[currentSection];
  for(const q of s.questions) {
    if(!q.required) continue;
    const val=answers[q.id];
    if(q.type==="checkbox" && (!val || val.length===0)) {errorBox.textContent=`Please select at least one answer for: ${q.label}`;return false;}
    if(q.type==="radio" && !val) {errorBox.textContent=`Please choose an answer for: ${q.label}`;return false;}
    if((q.type==="textarea"||q.type==="text") && !String(val||"").trim()) {errorBox.textContent=`Please complete: ${q.label}`;return false;}
  }
  return true;
}
function getResponses(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");}catch{return [];}}
function setResponses(items){localStorage.setItem(STORAGE_KEY,JSON.stringify(items));}
function createResponse(){return {id:crypto.randomUUID?crypto.randomUUID():`resp_${Date.now()}_${Math.random().toString(16).slice(2)}`,survey_name:"NoteWeaver Flip Research Survey",schema_version:1,answers:{...answers},client_created_at:new Date().toISOString(),sync_status:"pending"};}
async function syncPending() {
  updateConnectionBadge();
  if(!navigator.onLine || !API_URL) return;
  const items=getResponses(); let changed=false;
  for(let i=0;i<items.length;i++){
    if(items[i].sync_status==="synced") continue;
    try{
      const res=await fetch(API_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(items[i])});
      if(!res.ok) throw new Error(`Server returned ${res.status}`);
      items[i].sync_status="synced";items[i].synced_at=new Date().toISOString();changed=true;
    }catch(err){console.warn("Survey sync pending:",err);break;}
  }
  if(changed){setResponses(items);saveStatus.textContent="Online sync complete for saved responses.";}
}
function updateConnectionBadge(){
  const badge=document.getElementById("connectionBadge");
  if(navigator.onLine){badge.textContent=API_URL?"Online · sync enabled":"Online · local save";badge.className="status online";}
  else{badge.textContent="Offline · saved on device";badge.className="status offline";}
}
function submitResponse(){
  collectVisibleValues();
  const response=createResponse();
  const items=getResponses();items.push(response);setResponses(items);
  localStorage.removeItem(DRAFT_KEY);
  form.hidden=true;document.querySelector(".intro").hidden=true;document.getElementById("thankYou").hidden=false;
  saveStatus.textContent="Response saved on this device. Pending online sync if a server is configured.";
  syncPending();
}
function exportResponses() {
  const payload = {
    exported_at: new Date().toISOString(),
    survey: "NoteWeaver Flip Research Survey",
    responses: getResponses(),
    draft: JSON.parse(
      localStorage.getItem(DRAFT_KEY) || "null"
    )
  };

  const date = new Date().toISOString().slice(0, 10);
  const filename = `NoteWeaver_Flip_Responses_${date}`;

  function downloadFile(content, type, extension) {
    const blob = new Blob([content], {
      type: `${type};charset=utf-8;`
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${filename}.${extension}`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function escapeCSV(value) {
    if (Array.isArray(value)) {
      value = value.join("; ");
    }

    if (value === null || value === undefined) {
      value = "";
    }

    return `"${String(value).replace(/"/g, '""')}"`;
  }

  function exportJSON() {
    downloadFile(
      JSON.stringify(payload, null, 2),
      "application/json",
      "json"
    );
  }

  function exportCSV() {
    const responses = payload.responses;

    if (!responses.length) {
      alert("There are no submitted responses to export yet.");
      return;
    }

    const headers = [
      "Response ID",
      "Survey",
      "Created At",
      "Sync Status",
      ...new Set(
        responses.flatMap(response =>
          Object.keys(response.answers || {})
        )
      )
    ];

    const rows = responses.map(response => [
      response.id,
      response.survey_name,
      response.client_created_at,
      response.sync_status,
      ...headers.slice(4).map(key =>
        response.answers?.[key] ?? ""
      )
    ]);

    const csv = [
      headers.map(escapeCSV).join(","),
      ...rows.map(row => row.map(escapeCSV).join(","))
    ].join("\r\n");

    downloadFile("\uFEFF" + csv, "text/csv", "csv");
  }

  function printResponses() {
    const responses = payload.responses;

    if (!responses.length) {
      alert("There are no submitted responses to print.");
      return;
    }

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      alert("Please allow pop-ups to print the responses.");
      return;
    }

    const responseHTML = responses.map((response, index) => {
      const answerHTML = Object.entries(response.answers || {})
        .map(([question, answer]) => `
          <tr>
            <th>${escapeHTML(question)}</th>
            <td>${escapeHTML(
              Array.isArray(answer)
                ? answer.join(", ")
                : answer
            )}</td>
          </tr>
        `).join("");

      return `
        <section class="response">
          <h2>Response ${index + 1}</h2>
          <p><strong>Submitted:</strong>
            ${escapeHTML(response.client_created_at || "")}
          </p>
          <p><strong>Sync status:</strong>
            ${escapeHTML(response.sync_status || "unknown")}
          </p>
          <table>${answerHTML}</table>
        </section>
      `;
    }).join("");

    function escapeHTML(value) {
      return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[char]);
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>NoteWeaver Flip Survey Responses</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 30px;
            color: #222;
          }
          h1 { margin-bottom: 8px; }
          .response {
            margin-top: 30px;
            page-break-inside: avoid;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th, td {
            padding: 8px;
            border: 1px solid #ccc;
            text-align: left;
            vertical-align: top;
          }
          th {
            width: 30%;
            background: #f2f2f2;
          }
          @media print {
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <h1>NoteWeaver Flip Research Survey</h1>
        <p>Exported: ${escapeHTML(payload.exported_at)}</p>
        ${responseHTML}
        <button onclick="window.print()">Print / Save as PDF</button>
      </body>
      </html>
    `);

    printWindow.document.close();
  }

  const choice = prompt(
    "EXPORT SURVEY RESPONSES\n\n" +
    "1 - Download JSON (complete data)\n" +
    "2 - Download CSV (Excel spreadsheet)\n" +
    "3 - Print / Save as PDF\n\n" +
    "Enter 1, 2, or 3:"
  );

  if (choice === "1") {
    exportJSON();
  } else if (choice === "2") {
    exportCSV();
  } else if (choice === "3") {
    printResponses();
  } else if (choice !== null) {
    alert("Invalid choice. Please select 1, 2, or 3.");
  }
}
prevBtn.addEventListener("click",()=>{collectVisibleValues();saveDraft();if(currentSection>0){currentSection--;renderSection();window.scrollTo({top:0,behavior:"smooth"});}});
nextBtn.addEventListener("click",()=>{if(!validateSection())return;saveDraft();if(currentSection<sections.length-1){currentSection++;renderSection();window.scrollTo({top:0,behavior:"smooth"});}else submitResponse();});
saveBtn.addEventListener("click",()=>saveDraft());
document.getElementById("exportBtn").addEventListener("click",exportResponses);
document.getElementById("exportAfterBtn").addEventListener("click",exportResponses);
document.getElementById("newResponseBtn").addEventListener("click",()=>{answers={date:new Date().toISOString().slice(0,10)};currentSection=0;document.getElementById("thankYou").hidden=true;document.querySelector(".intro").hidden=false;form.hidden=false;renderSection();window.scrollTo({top:0,behavior:"smooth"});});
window.addEventListener("online",()=>{updateConnectionBadge();syncPending();});
window.addEventListener("offline",updateConnectionBadge);
window.addEventListener("beforeunload",()=>{try{collectVisibleValues();localStorage.setItem(DRAFT_KEY,JSON.stringify(answers));}catch{}});
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstallPrompt=e;document.getElementById("installBtn").hidden=false;});
document.getElementById("installBtn").addEventListener("click",async()=>{if(!deferredInstallPrompt)return;deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;document.getElementById("installBtn").hidden=true;});
loadLocal();renderSection();updateConnectionBadge();syncPending();
if("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("./service-worker.js").catch(console.warn);
