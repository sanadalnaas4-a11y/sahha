// ========== js/app.js (مجمّع) ==========
// يشمل: state + FirebaseAuth + Raw&BOM + Production + Spares + Reports + Bootstrap

// ---------- state ----------
const LS_KEY = 'saha.v3';
const defaultState = {
  raw: [], finished: [], bom: [], prodOrders: [],
  spares: [], sparesLog: [],
  reportSettings: {companyName:'شركة صحة', signer:'مسؤول المخازن', notes:''},
  fb: {apiKey:'', authDomain:'', projectId:'', appId:''}
};
function load(){ try{ return JSON.parse(localStorage.getItem(LS_KEY))||structuredClone(defaultState); }catch{ return structuredClone(defaultState); } }
function save(st){ localStorage.setItem(LS_KEY, JSON.stringify(st)); }
function uid(){ return Math.random().toString(36).slice(2,9); }
function fmt(n){ return (n??0).toLocaleString(undefined,{maximumFractionDigits:4}); }
function todayStr(){ const d=new Date(); return d.toISOString().slice(0,10); }

// ---------- helpers ----------
const $ = id=>document.getElementById(id);

// ---------- Firebase Auth ----------
let fbApp=null, fbAuth=null, user=null;
function initFirebaseAuth(){
  const st = load(); const {apiKey,authDomain,projectId,appId}=st.fb||{};
  if(!apiKey||!authDomain){ updateUserBox(); return; }
  try{ fbApp=firebase.initializeApp({apiKey,authDomain,projectId,appId}); fbAuth=firebase.auth(); fbAuth.onAuthStateChanged(u=>{user=u;updateUserBox();}); }catch(e){ console.warn('Firebase init skipped', e); }
  if($('#googleLogin')) $('#googleLogin').onclick=async()=>{ if(!fbAuth) return alert('فعّل إعدادات Firebase أولاً.'); const provider=new firebase.auth.GoogleAuthProvider(); await fbAuth.signInWithPopup(provider); };
  if($('#logoutBtn')) $('#logoutBtn').onclick=async()=>{ if(fbAuth) await fbAuth.signOut(); };
}
function updateUserBox(){ if($('#userEmail')) $('#userEmail').textContent = user?(user.email||'مستخدم'):'غير مسجل'; if($('#googleLogin')) $('#googleLogin').classList.toggle('hidden', !!user); if($('#logoutBtn')) $('#logoutBtn').classList.toggle('hidden', !user); }

// ---------- RAW & BOM ----------
let editingRawId=null, editingBomId=null;
function renderRaw(st){
  const tb=$('rawTableBody'); if(!tb) return; tb.innerHTML='';
  st.raw.forEach(r=>{
    const tr=document.createElement('tr'); const convert=(r.unit==='kg'&&r.packsPerKg)?`${r.packsPerKg} عبوة/كجم`:'—';
    tr.innerHTML=`<td>${r.name}</td><td>${r.unit==='kg'?'كجم':'قطعة'}</td><td>${fmt(r.qty)}</td><td>${fmt(r.reorder||0)}</td><td>${convert}</td>
    <td><button data-ed="${r.id}">تعديل</button><button data-del="${r.id}">حذف</button></td>`; tb.appendChild(tr);
  });
  tb.querySelectorAll('[data-ed]').forEach(b=>b.onclick()=>editRaw(st,b.dataset.ed));
  tb.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>delRaw(st,b.dataset.del));
  const sel=$('bomRaw'); if(sel){ sel.innerHTML=''; st.raw.forEach(r=>{const o=document.createElement('option'); o.value=r.id;o.textContent=r.name;sel.appendChild(o)}); }
  updateStats(st);
}
function editRaw(st,id){ const r=st.raw.find(x=>x.id===id); if(!r) return; editingRawId=id; if($('rawName')) $('rawName').value=r.name; if($('rawUnit')) $('rawUnit').value=r.unit; if($('rawQty')) $('rawQty').value=r.qty; if($('rawReorder')) $('rawReorder').value=r.reorder||0; if($('packsPerKg')) $('packsPerKg').value=r.packsPerKg||''; toggleKgOptions(); }
function delRaw(st,id){ if(!confirm('حذف الخامة؟')) return; st.raw=st.raw.filter(x=>x.id!==id); save(st); renderRaw(st); }
function toggleKgOptions(){ const unit=$('rawUnit')?.value; if($('#kgOptions')) $('#kgOptions').classList.toggle('hidden', unit!=='kg'); }
function saveRaw(st){ const obj={ id:editingRawId||uid(), name:($('rawName')?.value||'').trim(), unit:$('rawUnit')?.value||'pcs', qty:+($('rawQty')?.value||0), reorder:+($('rawReorder')?.value||0) }; if(obj.unit==='kg') obj.packsPerKg=+($('packsPerKg')?.value||0)||0; if(!obj.name) return alert('أدخل اسم الخامة'); if(editingRawId){const i=st.raw.findIndex(x=>x.id===editingRawId); st.raw[i]=obj; editingRawId=null;} else st.raw.push(obj); save(st); resetRawForm(); renderRaw(st); }
function resetRawForm(){ if($('rawName')) $('rawName').value=''; if($('rawQty')) $('rawQty').value=''; if($('rawReorder')) $('rawReorder').value=''; if($('packsPerKg')) $('packsPerKg').value=''; if($('rawUnit')) $('rawUnit').value='pcs'; toggleKgOptions(); editingRawId=null; }

function renderBOM(st){ const tb=$('bomTableBody'); if(!tb) return; tb.innerHTML=''; st.bom.forEach(b=>{ const raw=st.raw.find(r=>r.id===b.rawId); const usage=b.usageType==='grams'?'جرام':'عبوات/قطع'; const tr=document.createElement('tr'); tr.innerHTML=`<td>${b.product}</td><td>${raw?raw.name:'—'}</td><td>${usage}</td><td>${fmt(b.qtyPerUnit)}</td><td><button data-edb="${b.id}">تعديل</button><button data-delb="${b.id}">حذف</button></td>`; tb.appendChild(tr); }); tb.querySelectorAll('[data-edb]').forEach(b=>b.onclick=()=>editBom(st,b.dataset.edb)); tb.querySelectorAll('[data-delb]').forEach(b=>b.onclick=()=>delBom(st,b.dataset.delb)); }
function editBom(st,id){ const b=st.bom.find(x=>x.id===id); if(!b) return; editingBomId=id; if($('bomProduct')) $('bomProduct').value=b.product; if($('bomRaw')) $('bomRaw').value=b.rawId; if($('bomUsageType')) $('bomUsageType').value=b.usageType; if($('bomQtyPerUnit')) $('bomQtyPerUnit').value=b.qtyPerUnit; }
function delBom(st,id){ if(!confirm('حذف بند BOM؟')) return; st.bom=st.bom.filter(x=>x.id!==id); save(st); renderBOM(st); }
function saveBOM(st){ const obj={ id:editingBomId||uid(), product:($('bomProduct')?.value||'').trim(), rawId:$('bomRaw')?.value||'', usageType:$('bomUsageType')?.value||'pcs', qtyPerUnit:+($('bomQtyPerUnit')?.value||0) }; if(!obj.product||!obj.rawId) return alert('أكمل الحقول'); if(editingBomId){const i=st.bom.findIndex(x=>x.id===editingBomId); st.bom[i]=obj; editingBomId=null;} else st.bom.push(obj); save(st); resetBomForm(); renderBOM(st); }
function resetBomForm(){ if($('bomProduct')) $('bomProduct').value=''; if($('bomQtyPerUnit')) $('bomQtyPerUnit').value=''; }

function computeConsumptionForOrder(st, product, qty){ const bomLines=st.bom.filter(b=>b.product===product); if(!bomLines.length) throw new Error('لا يوجد BOM لهذا المنتج'); const materials=[]; bomLines.forEach(b=>{ const raw=st.raw.find(r=>r.id===b.rawId); if(!raw) return; let needPcs=0, needKg=0; if(b.usageType==='pcs'){ const totalPcs=b.qtyPerUnit*qty; if(raw.unit==='kg'){ const ppk=+raw.packsPerKg||0; if(!ppk) throw new Error('حدد العبوات/كجم للخامة '+raw.name); needKg= totalPcs/ppk; } else needPcs= totalPcs; } else if(b.usageType==='grams'){ const totalGrams=b.qtyPerUnit*qty; if(raw.unit==='kg') needKg= totalGrams/1000; else throw new Error('لو الخامة بالقطعة لا تستخدم الجرامات'); } if(needKg){ raw.qty= +(raw.qty-needKg).toFixed(4); materials.push({rawId:raw.id, usedQty:+needKg.toFixed(4), unit:'kg'}); } if(needPcs){ raw.qty= +(raw.qty-needPcs).toFixed(4); materials.push({rawId:raw.id, usedQty:+needPcs.toFixed(4), unit:'pcs'}); } }); return materials; }

// ---------- Production ----------
function renderProd(st){ const tb=$('prodTableBody'); if(!tb) return; tb.innerHTML=''; st.prodOrders.forEach(o=>{ const used=o.materials.map(m=>`• ${rawName(st,m.rawId)}: ${fmt(m.usedQty)} ${m.unit==='kg'?'كجم':'قطعة'}`).join('<br>'); const tr=document.createElement('tr'); tr.innerHTML=`<td>${new Date(o.ts).toLocaleString()}</td><td>${o.product}</td><td>${o.qty}</td><td>${used}</td>`; tb.appendChild(tr); }); }
function rawName(st,id){ return (st.raw.find(r=>r.id===id)||{}).name||'—'; }
function runProduction(st){ const product=($('prodProduct')?.value||'').trim(); const qty=+($('prodQty')?.value||0); if(!product||qty<=0) return alert('أدخل المنتج والكمية'); try{ const materials=computeConsumptionForOrder(st,product,qty); const fin=st.finished.find(f=>f.product===product); if(fin) fin.qty+=qty; else st.finished.push({product,qty}); st.prodOrders.unshift({ts:Date.now(),product,qty,materials}); save(st); renderRaw(st); renderProd(st); alert('تم تشغيل الأمر وخصم الخامات'); }catch(e){ alert(e.message); } }

// ---------- Spares ----------
let editingSpId=null;
function renderSpares(st){ const tb=$('sparesTableBody'); if(tb){ tb.innerHTML=''; st.spares.forEach(s=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${s.name}</td><td>${s.machine||'—'}</td><td>${fmt(s.qty)}</td><td>${fmt(s.reorder||0)}</td><td><button data-eds="${s.id}">تعديل</button><button data-dels="${s.id}">حذف</button></td>`; tb.appendChild(tr); }); tb.querySelectorAll('[data-eds]').forEach(b=>b.onclick=()=>editSpare(st,b.dataset.eds)); tb.querySelectorAll('[data-dels]').forEach(b=>b.onclick=()=>delSpare(st,b.dataset.dels)); }
  const sel=$('spUseName'); if(sel){ sel.innerHTML=''; st.spares.forEach(s=>{ const o=document.createElement('option'); o.value=s.id; o.textContent=s.name; sel.appendChild(o); }); }
  const lb=$('sparesLogBody'); if(lb){ lb.innerHTML=''; st.sparesLog.forEach(l=>{ const tr=document.createElement('tr'); tr.innerHTML=`<td>${new Date(l.ts).toLocaleString()}</td><td>${l.name}</td><td>${l.qty}</td><td>${l.machine||'—'}</td><td>${l.notes||''}</td>`; lb.appendChild(tr); }); }
  updateStats(st);
}
function editSpare(st,id){ const s=st.spares.find(x=>x.id===id); if(!s) return; editingSpId=id; $('spName').value=s.name; $('spMachine').value=s.machine||''; $('spQty').value=s.qty; $('spReorder').value=s.reorder||0; }
function delSpare(st,id){ if(!confirm('حذف القطعة؟')) return; st.spares=st.spares.filter(x=>x.id!==id); save(st); renderSpares(st); }
function saveSpare(st){ const obj={ id:editingSpId||uid(), name:($('spName')?.value||'').trim(), machine:($('spMachine')?.value||'').trim(), qty:+($('spQty')?.value||0), reorder:+($('spReorder')?.value||0) }; if(!obj.name) return alert('أدخل اسم القطعة'); if(editingSpId){ const i=st.spares.findIndex(x=>x.id===editingSpId); st.spares[i]=obj; editingSpId=null; } else st.spares.push(obj); save(st); resetSpForm(); renderSpares(st); }
function resetSpForm(){ if($('spName')) $('spName').value=''; if($('spMachine')) $('spMachine').value=''; if($('spQty')) $('spQty').value=''; if($('spReorder')) $('spReorder').value=''; editingSpId=null; }
function applySpareUse(st){ const id=$('spUseName')?.value||''; const qty=+($('spUseQty')?.value||0); if(!id||qty<=0) return alert('اختر الصنف والكمية'); const s=st.spares.find(x=>x.id===id); if(!s) return; s.qty=+(s.qty-qty).toFixed(2); st.sparesLog.unshift({ts:Date.now(), name:s.name, qty, machine:($('spUseMachine')?.value||''), notes:($('spUseNotes')?.value||'')}); save(st); if($('spUseQty')) $('spUseQty').value=''; if($('spUseMachine')) $('spUseMachine').value=''; if($('spUseNotes')) $('spUseNotes').value=''; renderSpares(st); }

// ---------- Reports ----------
function dayRange(d){ const s=+new Date(d.getFullYear(),d.getMonth(),d.getDate()); const e=+new Date(d.getFullYear(),d.getMonth(),d.getDate()+1); return {start:s,end:e,label:d.toLocaleDateString()}; }
function monthRange(d){ const s=+new Date(d.getFullYear(),d.getMonth(),1); const e=+new Date(d.getFullYear(),d.getMonth()+1,1); return {start:s,end:e,label:d.toLocaleDateString(undefined,{year:'numeric',month:'long'})}; }
function renderReport(st){ if($('#companyName')) $('#companyName').value=st.reportSettings.companyName||''; if($('#reportSigner')) $('#reportSigner').value=st.reportSettings.signer||''; if($('#reportNotes')) $('#reportNotes').value=st.reportSettings.notes||''; const t=$('reportType')?.value||'daily'; const range=t==='daily'? dayRange(new Date($('reportDate')?.value||todayStr())) : monthRange(new Date((($('reportMonth')?.value||todayStr()).slice(0,7)+'-01'))); const lines=[]; lines.push(`${st.reportSettings.companyName}\nتقرير ${t==='daily'?'يومي':'شهري'} — الفترة: ${range.label}`); lines.push(''); const prods=st.prodOrders.filter(o=>o.ts>=range.start && o.ts<range.end); const prodTotal=prods.reduce((a,b)=>a+b.qty,0); lines.push('أولاً: أوامر الإنتاج المنفذة'); if(prods.length){ prods.forEach((o,i)=>{ const d=new Date(o.ts).toLocaleString(); lines.push(`${i+1}) ${d} — المنتج: ${o.product} — الكمية: ${o.qty}`); o.materials.forEach(m=>{ const r=st.raw.find(x=>x.id===m.rawId); lines.push(`   • خصم خامة: ${r?r.name:m.rawId} — ${fmt(m.usedQty)} ${m.unit==='kg'?'كجم':'قطعة'}`); }); }); } else lines.push('— لا توجد أوامر إنتاج في الفترة.'); lines.push(`إجمالي وحدات الإنتاج: ${prodTotal}`); lines.push(''); const low=st.raw.filter(r=>r.qty<= (r.reorder||0)); lines.push('ثانيًا: تنبيهات الخامات (وصلت حد إعادة الطلب)'); if(low.length){ low.forEach((r,i)=>lines.push(`${i+1}) ${r.name} — متاح: ${fmt(r.qty)} ${r.unit==='kg'?'كجم':'قطعة'} — حد إعادة الطلب: ${fmt(r.reorder||0)}`)); } else lines.push('— لا توجد تنبيهات.'); lines.push(''); const spLog=st.sparesLog.filter(x=>x.ts>=range.start && x.ts<range.end); lines.push('ثالثًا: استخدام قطع الغيار'); if(spLog.length){ spLog.forEach((l,i)=> lines.push(`${i+1}) ${new Date(l.ts).toLocaleString()} — ${l.name} — كمية: ${l.qty} — ${l.machine||'—'}${l.notes?(' — ملاحظات: '+l.notes):''}`)); } else lines.push('— لا يوجد استخدام مسجل.'); lines.push(''); lines.push('رابعًا: ملخص المخزون الحالي'); lines.push('• الخامات:'); st.raw.forEach(r=> lines.push(`  - ${r.name}: ${fmt(r.qty)} ${r.unit==='kg'?'كجم':'قطعة'}`)); lines.push('• الإنتاج الجاهز:'); st.finished.forEach(f=> lines.push(`  - ${f.product}: ${fmt(f.qty)} وحدة`)); lines.push('• قطع الغيار:'); st.spares.forEach(s=> lines.push(`  - ${s.name}: ${fmt(s.qty)} قطعة (آلة: ${s.machine||'—'})`)); if(st.reportSettings.notes){ lines.push(''); lines.push('ملاحظات: '+st.reportSettings.notes); } lines.push(`الموقّع: ${st.reportSettings.signer}`); if($('reportText')) $('reportText').textContent=lines.join('\n'); }
function toggleReportMode(){ const monthly=( $('reportType')?.value||'daily')==='monthly'; if($('reportMonth')) $('reportMonth').classList.toggle('hidden', !monthly); if($('reportDate')) $('reportDate').classList.toggle('hidden', monthly); }

// ---------- Dashboard Stats ----------
function updateStats(st){ if($('#statsRaw')) $('#statsRaw').innerHTML=`${st.raw.length} صنف • منخفض: <b>${st.raw.filter(r=>r.qty<=(r.reorder||0)).length}</b>`; const finTotal=st.finished.reduce((a,b)=>a+(b.qty||0),0); if($('#statsFinished')) $('#statsFinished').innerHTML=`${st.finished.length} منتج • إجمالي وحدات: <b>${finTotal}</b>`; if($('#statsSpares')) $('#statsSpares').innerHTML=`${st.spares.length} صنف • منخفض: <b>${st.spares.filter(s=>s.qty<=(s.reorder||0)).length}</b>`; }

// ---------- Wiring / Bootstrap ----------
function boot(){
  const st = load();
  // Firebase fields save
  if($('#saveFbCfg')) $('#saveFbCfg').onclick=()=>{ st.fb.apiKey=$('fb_apiKey')?.value||''; st.fb.authDomain=$('fb_authDomain')?.value||''; st.fb.projectId=$('fb_projectId')?.value||''; st.fb.appId=$('fb_appId')?.value||''; save(st); alert('تم الحفظ. أعد تحميل الصفحة لتطبيق الإعدادات.'); };
  ['fb_apiKey','fb_authDomain','fb_projectId','fb_appId'].forEach(id=>{ const el=$(id); if(el) el.value=st.fb?.[id.replace('fb_','')]||''; });

  // Raw events
  if($('rawUnit')) $('rawUnit').onchange=()=>toggleKgOptions();
  if($('saveRaw')) $('saveRaw').onclick=()=>saveRaw(st);
  if($('resetRaw')) $('resetRaw').onclick=()=>resetRawForm();

  // BOM events
  if($('saveBom')) $('saveBom').onclick=()=>saveBOM(st);
  if($('resetBom')) $('resetBom').onclick=()=>resetBomForm();

  // Production
  if($('runProd')) $('runProd').onclick=()=>runProduction(st);

  // Spares
  if($('saveSpare')) $('saveSpare').onclick=()=>saveSpare(st);
  if($('resetSpare')) $('resetSpare').onclick=()=>resetSpForm();
  if($('applySpareUse')) $('applySpareUse').onclick=()=>applySpareUse(st);

  // Reports
  if($('reportType')) $('reportType').onchange=()=>{toggleReportMode(); renderReport(st);} 
  if($('refreshReport')) $('refreshReport').onclick=()=>renderReport(st);
  if($('printReport')) $('printReport').onclick=()=>window.print();
  if($('shareReport')) $('shareReport').onclick=async()=>{ const text=$('reportText')?.innerText||''; if(navigator.share){ try{ await navigator.share({text}); }catch(e){} } else { await navigator.clipboard.writeText(text); alert('تم نسخ التقرير للنقل.'); } };
  if($('companyName')) $('companyName').onchange=()=>{ st.reportSettings.companyName=$('companyName').value||'شركة صحة'; save(st); };
  if($('reportSigner')) $('reportSigner').onchange=()=>{ st.reportSettings.signer=$('reportSigner').value||'مسؤول المخازن'; save(st); };
  if($('reportNotes')) $('reportNotes').oninput=()=>{ st.reportSettings.notes=$('reportNotes').value||''; save(st); };

  // Initial Renders
  initFirebaseAuth();
  renderRaw(st); renderBOM(st); renderProd(st); renderSpares(st); toggleReportMode(); renderReport(st); updateStats(st);

  // Re-render on section change
  window.addEventListener('saha:render', ()=>{ renderRaw(st); renderBOM(st); renderProd(st); renderSpares(st); renderReport(st); updateStats(st); });
}

boot();
