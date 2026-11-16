const DATA='/data/';
const state={vendors:[],products:[],jurisdictions:[],projects:[],quotes:[],analysis:null,sourceText:'',selectedProject:null,catalogMode:'products'};
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const countryNames={CO:'Colombia',EC:'Ecuador',CL:'Chile',PE:'Perú'};
const categoryTerms={
 TRANSFORMADOR:['transformador','transformers'], CELDA:['celda','switchgear','tablero de media'], PROTECCION:['proteccion','protección','relé','rele','interruptor','fusible'], CABLE:['cable','conductor'], ESTRUCTURA:['estructura','poste','soporte'], PUESTA_A_TIERRA:['puesta a tierra','tierra','grounding'], SERVICIO:['servicio','instalación','instalacion','ingeniería','ingenieria','mantenimiento','montaje']
};
const money=n=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(n)||0);
const moneyLocal=(currency,n)=>new Intl.NumberFormat('es-CO',{style:'currency',currency:currency||'USD',maximumFractionDigits:0}).format(Number(n)||0);
const num=n=>new Intl.NumberFormat('es-CO',{maximumFractionDigits:0}).format(Number(n)||0);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today=()=>new Date().toISOString().slice(0,10);
async function init(){
 try{[state.vendors,state.products,state.jurisdictions,state.projects,state.quotes]=await Promise.all(['catalogs/vendors.json','catalogs/products_services.json','catalogs/jurisdictions.json','projects/demo_projects.json','quotes.json'].map(f=>fetch(DATA+f).then(r=>{if(!r.ok)throw Error('No se pudo cargar '+f);return r.json()})));validateBank();renderInitial();restoreDraft();wire();}
 catch(e){document.querySelector('.content').innerHTML=`<div class="empty-state"><b>No se pudo cargar el banco documental.</b><p>${esc(e.message)}</p>Ejecuta la aplicación desde un servidor web local; abrir el HTML como archivo no permite leer los JSON.</div>`;}
}
function validateBank(){
 const vendors=new Set(state.vendors.map(x=>x.vendor_id)),skus=new Set(state.products.map(x=>x.sku));
 if(state.vendors.length!==12||state.products.length!==40||state.quotes.length!==224||state.projects.length!==4||state.jurisdictions.length!==4)throw Error('El banco cargado no coincide con el manifiesto esperado.');
 for(const q of state.quotes)if(!vendors.has(q.vendor_id)||!skus.has(q.sku))throw Error('Referencia rota en '+q.quote_id);
}
function renderInitial(){
 $('#kpi-suppliers').textContent=state.vendors.length;$('#kpi-items').textContent=state.products.length;$('#kpi-quotes').textContent=state.quotes.length;
 $('#landing-suppliers').textContent=String(state.vendors.length).padStart(2,'0');$('#landing-products').textContent=String(state.products.length).padStart(2,'0');$('#landing-quotes').textContent=String(state.quotes.length);
 $('#projectSelect').innerHTML='<option value="">Seleccionar proyecto demo…</option>'+state.projects.map(p=>`<option value="${esc(p.project_id)}">${esc(p.project_id)} · ${esc(p.name)}</option>`).join('');
 $('#demoCards').innerHTML=state.projects.map((p,i)=>`<div class="demo-card" data-project="${esc(p.project_id)}"><span class="demo-index">0${i+1}</span><div><div class="demo-name">${esc(p.name)}</div><div class="demo-meta">${esc(p.country)} · ${num(p.capacity_kva)} kVA · ${p.target_schedule_days} días</div></div><span class="demo-arrow">→</span></div>`).join('');
 $('#jurisdictionCards').innerHTML=state.jurisdictions.map(j=>`<div class="jurisdiction-card"><b>${esc(j.country)}</b><small>${esc(j.currency)} · Referencia FX de demo: ${esc(j.demo_fx_usd_to_local)}</small><em>Pendiente de validar</em></div>`).join('');
 renderCatalog();
}
function wire(){
 $$('.nav').forEach(b=>b.addEventListener('click',()=>showView(b.dataset.section)));
 $('#startAnalysis').addEventListener('click',()=>showView('analysis'));
 $('#openCatalog').addEventListener('click',()=>showView('catalog'));
 $('.brand').addEventListener('click',e=>{e.preventDefault();showView('landing')});
 $('#projectSelect').addEventListener('change',e=>{if(e.target.value)loadDemo(e.target.value);else{state.selectedProject=null;saveDraft()}});
 $('#tenderText').addEventListener('input',()=>{if(state.selectedProject){state.selectedProject=null;$('#projectSelect').value=''}if(!state.sourceText)state.sourceText='Texto ingresado manualmente';else if(!state.sourceText.includes('(editado)'))state.sourceText+=' (editado)';saveDraft()});
 $('#countrySelect').addEventListener('change',()=>{if(state.selectedProject){state.selectedProject=null;$('#projectSelect').value=''}saveDraft()});
 $('#deadline').addEventListener('input',saveDraft);
 $('#demoCards').addEventListener('click',e=>{const card=e.target.closest('[data-project]');if(card)loadDemo(card.dataset.project)});
 $('#analyzeBtn').addEventListener('click',()=>analyze());
 $('#fileInput').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{const text=await file.text();$('#tenderText').value=text;state.sourceText=file.name;state.selectedProject=null;$('#projectSelect').value='';saveDraft();toast(`Documento leído localmente: ${file.name}`)}catch{toast('No se pudo leer el archivo. Prueba con TXT, MD o CSV.')}});
 $('#dropzone').addEventListener('dragover',e=>{e.preventDefault();e.currentTarget.classList.add('dragging')});$('#dropzone').addEventListener('dragleave',e=>e.currentTarget.classList.remove('dragging'));$('#dropzone').addEventListener('drop',e=>{e.preventDefault();e.currentTarget.classList.remove('dragging');const f=e.dataTransfer.files[0];if(f){if(!/\.(txt|md|csv)$/i.test(f.name)){toast('Formato no compatible. Usa TXT, MD o CSV.');return}f.text().then(t=>{$('#tenderText').value=t;state.sourceText=f.name;state.selectedProject=null;$('#projectSelect').value='';saveDraft();toast(`Documento leído localmente: ${f.name}`)})}});
 $('#noticeDismiss').addEventListener('click',()=>$('.synthetic-notice').classList.add('hidden'));
 $('#catalogSearch').addEventListener('input',renderCatalog);$('#catalogCountry').addEventListener('change',renderCatalog);
 $$('.catalog-tab').forEach(b=>b.addEventListener('click',()=>{state.catalogMode=b.dataset.catalog;$$('.catalog-tab').forEach(t=>t.classList.toggle('active',t===b));$('#catalogSearch').placeholder=({products:'Buscar SKU, producto o categoría…',vendors:'Buscar proveedor, país o ciudad…',quotes:'Buscar cotización, SKU o proveedor…'})[state.catalogMode];renderCatalog()}));
}
function showView(name){
 $$('.view').forEach(v=>v.classList.remove('active'));const view=$('#view-'+name);if(view)view.classList.add('active');
 $$('.nav').forEach(n=>n.classList.toggle('active',n.dataset.section===name));
 $('#crumb').textContent=({landing:'Inicio',analysis:'Nuevo análisis',catalog:'Banco documental',regulatory:'Regulatorio'})[name]||'Resultados';
 window.scrollTo({top:0,behavior:'smooth'});
}
function loadDemo(id){
 const p=state.projects.find(x=>x.project_id===id);if(!p)return;
 state.selectedProject=id;$('#projectSelect').value=id;$('#countrySelect').value=p.jurisdiction_code;$('#deadline').value=p.target_schedule_days;
 $('#tenderText').value=`${p.name}. Proyecto en ${p.country}. Capacidad de referencia ${p.capacity_kva} kVA, tensión ${p.voltage_kv} kV. Categorías requeridas: ${p.required_categories.replaceAll('; ', ', ')}. Fecha objetivo: ${p.target_schedule_days} días. Presupuesto demo: USD ${p.budget_usd_demo}.`;
 state.sourceText=`Proyecto demo ${id}`;showView('analysis');toast(`${id} cargado. Revisa los requerimientos y genera el análisis.`);
 saveDraft();
}
function restoreDraft(){try{const d=JSON.parse(localStorage.getItem('epi-demo-draft-v1')||'null');if(!d)return;if(typeof d.text==='string')$('#tenderText').value=d.text;if(['CO','EC','CL','PE'].includes(d.country))$('#countrySelect').value=d.country;if(d.deadline)$('#deadline').value=d.deadline;if(d.projectId&&state.projects.some(p=>p.project_id===d.projectId)){$('#projectSelect').value=d.projectId;state.selectedProject=d.projectId}if(d.source)state.sourceText=d.source}catch{/* Almacenamiento local puede estar deshabilitado; el flujo sigue disponible. */}}
function saveDraft(){try{localStorage.setItem('epi-demo-draft-v1',JSON.stringify({text:$('#tenderText')?.value||'',country:$('#countrySelect')?.value||'CO',deadline:$('#deadline')?.value||'',projectId:state.selectedProject||'',source:state.sourceText||''}))}catch{/* No se bloquea el análisis si el navegador no permite persistir. */}}
function parseRequirements(text,project,country){
 const normalizedText=text.toLowerCase().replaceAll('_',' ').replace(/\s+/g,' ');
 const categories=project?project.required_categories.split(';').map(x=>x.trim()):Object.entries(categoryTerms).filter(([,terms])=>terms.some(t=>normalizedText.includes(t))).map(([cat])=>cat);
 const unique=[...new Set(categories)].filter(Boolean),req=[];
 const voltageText=project?.voltage_kv||text.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/)?.[0]||'';
 const voltagePair=voltageText.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/)?.slice(1).map(Number)||null;
 for(const category of unique){
  const productCandidates=state.products.filter(p=>p.category===category);
  if(!productCandidates.length){req.push({category,quantity:1,unit:'unidad',product:null});continue}
  const localSkus=new Set(state.quotes.filter(q=>q.country===countryNames[country]).map(q=>q.sku));
  const cap=text.match(/(\d{2,5})\s*kva/i),targetCap=cap?Number(cap[1]):(project?.capacity_kva||null);
  const compatible=productCandidates.map(product=>({product,compat:technicalCompatibility(product,category,voltagePair,targetCap)})).filter(x=>x.compat.ok);
  const candidatePool=compatible.length?compatible:productCandidates.map(product=>({product,compat:{ok:false,reason:'No se encontró una referencia técnica compatible en el catálogo.'}}));
  candidatePool.sort((a,b)=>productMatchScore(text,b.product,category)-productMatchScore(text,a.product,category)||Number(localSkus.has(b.product.sku))-Number(localSkus.has(a.product.sku))||Number(b.compat.exact)-Number(a.compat.exact)||(category==='TRANSFORMADOR'&&targetCap?Math.abs(capacity(a.product)-targetCap)-Math.abs(capacity(b.product)-targetCap):0));
  let chosenEntry=candidatePool[0],chosen=chosenEntry.product;
  const skuMatch=text.match(/\bEPI-\d{3}\b/i);if(skuMatch){const explicit=candidatePool.find(x=>x.product.sku===skuMatch[0].toUpperCase());if(explicit)chosenEntry=explicit;else if(productCandidates.some(p=>p.sku===skuMatch[0].toUpperCase()))chosenEntry={product:productCandidates.find(p=>p.sku===skuMatch[0].toUpperCase()),compat:{ok:false,reason:'El SKU indicado no supera la validación técnica preliminar para la tensión/capacidad requerida.'}};chosen=chosenEntry.product;}
  const term=categoryTerms[category]||[];const pattern=new RegExp(`(?:^|[^\\d])(\\d+(?:[.,]\\d+)?)\\s*(?:x\\s*)?(?:unidades?\\s*(?:de\\s*)?)?(?:${term.map(x=>x.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')).join('|')})`,'i');
  const m=text.match(pattern);const quantity=m?Number(m[1].replace(',','.')):1;
  req.push({category,quantity:Number.isFinite(quantity)&&quantity>0?quantity:1,unit:chosen.unit,product:chosenEntry.compat.ok?chosen:null,technicalStatus:chosenEntry.compat.ok?'compatible_preliminary':'incompatible',technicalReason:chosenEntry.compat.reason||'',voltageText});
 }
 return req;
}
function productMatchScore(text,product,category){const normalize=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9.]+/g,' ');const tender=new Set(normalize(text).split(/\s+/).filter(w=>w.length>=3&&!/^\d/.test(w)));const catWords=new Set(Object.values(categoryTerms).flatMap(terms=>terms.flatMap(t=>normalize(t).split(/\s+/))));const spec=normalize(`${product.name||''} ${JSON.stringify(product.technical_parameters||{})}`).split(/\s+/).filter(w=>w.length>=3&&!/^\d/.test(w));const stop=new Set(['transformador','producto','servicio','cable','proteccion','categoria','documentos','simulados','cumplimiento','validar','referencia','instalacion','tension','nominal','kv','kva']);return spec.filter(w=>!stop.has(w)&&!catWords.has(w)&&tender.has(w)).length;}
function technicalCompatibility(product,category,voltagePair,targetCap){
 const n=(product.name||'').match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*kV/i);
 if(category==='TRANSFORMADOR'){
  if(targetCap&&capacity(product)&&capacity(product)<targetCap)return {ok:false,reason:`Capacidad ${capacity(product)} kVA menor que los ${targetCap} kVA requeridos.`};
  if(voltagePair){if(!n)return {ok:false,reason:'La ficha no especifica ambas tensiones nominales del transformador.'};const pair=[Number(n[1]),Number(n[2])];if(Math.abs(pair[0]-voltagePair[0])>.05||Math.abs(pair[1]-voltagePair[1])>.02)return {ok:false,reason:`Tensión nominal ${pair.join('/')} kV distinta de ${voltagePair.join('/')} kV requerida.`};return {ok:true,exact:true};}
  return {ok:true,exact:false};
 }
 if(voltagePair){
  const rated=(product.name||'').match(/(\d+(?:\.\d+)?)\s*kV/i);const volts=(product.name||'').match(/(\d{2,5})\s*V\b/i);
  if(rated&&Number(rated[1])+0.01<voltagePair[0])return {ok:false,reason:`Tensión de equipo ${rated[1]} kV por debajo de ${voltagePair[0]} kV nominales.`};
  if(!rated&&volts&&Number(volts[1])/1000+0.01<voltagePair[0])return {ok:false,reason:`Tensión nominal indicada ${volts[1]} V, inferior a ${voltagePair[0]} kV.`};
  if(!rated&&!volts&&['CELDA','PROTECCION','CABLE'].includes(category))return {ok:false,reason:`La ficha de ${category.toLowerCase()} no declara tensión nominal; compatibilidad con ${voltagePair[0]} kV pendiente de ingeniería.`};
 }
 return {ok:true,exact:false};
}
function capacity(p){const m=(p.name||'').match(/([\d.]+)\s*kVA/i);return m?Number(m[1]):0}
function candidateOffers(req,country){
 if(!req.product)return [];
 return state.quotes.filter(q=>q.sku===req.product.sku&&q.country===countryNames[country]).map(q=>({...q,vendor:state.vendors.find(v=>v.vendor_id===q.vendor_id)})).filter(q=>q.vendor);
}
function analyze(){
 const text=$('#tenderText').value.trim();if(!text){toast('Carga un proyecto demo o pega el texto de la licitación.');return}
 const project=state.projects.find(p=>p.project_id===$('#projectSelect').value)||null;const country=$('#countrySelect').value;
 const req=parseRequirements(text,project,country);if(!req.length){toast('No identifiqué materiales o servicios. Especifica categorías como transformador, cable, protección o servicio.');return}
 const deadline=Number($('#deadline').value)||Number(project?.target_schedule_days)||null;
 state.analysis=buildAnalysis({text,project,country,deadline,requirements:req,source:state.sourceText||'Texto ingresado por el usuario'});saveDraft();
 renderResults();showView('results');
}
function isQuoteCurrent(q){return q.date&&new Date(q.date+'T00:00:00Z')<=new Date(today()+'T00:00:00Z')&&new Date(new Date(q.date+'T00:00:00Z').getTime()+q.validity_days*86400000)>=new Date(today()+'T00:00:00Z')}
function normalized(q,quantity){const product=q.unit_price_usd*quantity;const freight=Number(q.shipping_usd_demo)||0;const tax=product*(Number(q.tax_rate_demo)||0);return {product,freight,tax,total:product+freight+tax,preTax:product+freight}}
function quoteRisk(q,deadline){
 const age=Math.floor((Date.now()-new Date(q.date+'T00:00:00Z').getTime())/86400000),risk=[];
 if(!isQuoteCurrent(q))risk.push({level:'high',title:'Cotización vencida',detail:`Emitida ${age} días atrás; vigencia ${q.validity_days} días. Precio solo referencial, requiere actualización.`});
 risk.push({level:'medium',title:'Disponibilidad no confirmada',detail:'El banco no informa stock actual. Solicitar confirmación escrita al proveedor.'});
 risk.push({level:'medium',title:'Confiabilidad no validada',detail:'No hay datos operativos verificados para medir desempeño del proveedor.'});
 risk.push({level:'medium',title:'Variación cambiaria',detail:`FX snapshot ${q.fx_local_per_usd_snapshot} ${q.currency}/USD; no hay serie actual para medir variación y no representa tasa vigente.`});
 if(deadline&&q.delivery_days>deadline)risk.push({level:'high',title:'Plazo excede objetivo',detail:`Entrega ${q.delivery_days} días vs. objetivo ${deadline}.`});
 else risk.push({level:'medium',title:'Tiempo de entrega histórico',detail:`${q.delivery_days} días provienen de una cotización anterior; confirmar plazo actual.`});
 risk.push({level:'medium',title:'Dependencia de importación desconocida',detail:'El banco no especifica origen, stock local ni ruta de importación. Confirmar procedencia y trámites.'});
 risk.push({level:q.warranty_months<12?'high':'medium',title:'Garantía por reconfirmar',detail:`La fuente indica ${q.warranty_months} meses (dato demo); confirmar alcance, inicio y condiciones.`});
 risk.push({level:'medium',title:'Información técnica incompleta',detail:'La ficha es referencial y requiere validación de ingeniería para la instalación específica.'});
 risk.push({level:'medium',title:'Transporte no validado',detail:`Transporte USD ${q.shipping_usd_demo} es simulado; ruta, cobertura, seguro y alcance no están confirmados.`});
 risk.push({level:'medium',title:'Certificaciones pendientes',detail:'No hay evidencia verificada de certificaciones aplicables a la jurisdicción.'});
 return risk;
}
function buildAnalysis(input){
 const all=input.requirements.map(req=>{const offers=candidateOffers(req,input.country).map(q=>({...q,cost:normalized(q,req.quantity),risks:quoteRisk(q,input.deadline)}));return {...req,offers,missing:offers.length===0}});
 const tiers=[
  makeTier('TIER 1','OPTIMIZACIÓN DE COSTOS','Minimiza el costo estimado entre alternativas técnicamente candidatas y dentro del plazo obligatorio.',all,input.deadline,'cost'),
  makeTier('TIER 2','EQUILIBRIO COSTO Y TIEMPO','Pondera costo, plazo y señales de confiabilidad disponibles. Los datos ausentes reducen la confianza.',all,input.deadline,'balance'),
  makeTier('TIER 3','SEGURIDAD DE SUMINISTRO','Favorece diversificación y menor exposición logística. La disponibilidad sigue pendiente de confirmación.',all,input.deadline,'supply')
 ];
 for(const t of tiers){t.budget=input.project?.budget_usd_demo||null;t.budgetExceeded=t.complete&&t.budget!=null&&t.total!=null&&t.total>t.budget;}
 const anyCoverage=all.some(r=>r.offers.length),total=tiers.map(t=>t.total).filter(x=>x!=null);return {...input,requirements:all,tiers,coverage:all.filter(r=>!r.missing).length,coveragePct:all.length?all.filter(r=>!r.missing).length/all.length:0,estimate:total.length?Math.min(...total):null,onlyHistorical:all.some(r=>r.offers.some(q=>!isQuoteCurrent(q))),generatedAt:new Date().toISOString(),anyCoverage};
}
function makeTier(code,title,description,requirements,deadline,mode){
 const selected=[],gaps=[];let counts={};
 for(const req of requirements){
  if(req.missing){gaps.push(req.technicalStatus==='incompatible'?`${req.category}: ${req.technicalReason||'no se identificó un producto técnicamente compatible.'}`:`${req.category}: no se halló cotización del país para el producto seleccionado.`);continue}
  let offers=req.offers.filter(q=>!deadline||q.delivery_days<=deadline);
  if(!offers.length){gaps.push(`${req.category}: existen antecedentes, pero ninguno cumple el plazo objetivo.`);continue}
  if(mode==='cost')offers.sort((a,b)=>a.cost.total-b.cost.total||a.delivery_days-b.delivery_days);
  if(mode==='balance')offers.sort((a,b)=>scoreOffer(a,offers)-scoreOffer(b,offers));
  if(mode==='supply')offers.sort((a,b)=>(counts[a.vendor_id]||0)-(counts[b.vendor_id]||0)||riskPenalty(a)-riskPenalty(b)||a.cost.total-b.cost.total);
  const chosen=offers[0];selected.push({...chosen,requirement:req});counts[chosen.vendor_id]=(counts[chosen.vendor_id]||0)+1;
 }
 const total=selected.length?selected.reduce((s,x)=>s+x.cost.total,0):null,preTax=selected.length?selected.reduce((s,x)=>s+x.cost.preTax,0):null;
 const delivery=selected.length?Math.max(...selected.map(x=>x.delivery_days)):null;
 const complete=!gaps.length&&selected.length===requirements.length;
 let score=0;if(selected.length){const cover=selected.length/requirements.length;const supplyBonus=mode==='supply'?Math.min(12,new Set(selected.map(x=>x.vendor_id)).size*3):0;score=Math.round(cover*74+supplyBonus+(complete?10:0)-(mode==='balance'?Math.min(8,Math.round((delivery||0)/20)):0));}
 const riskMap=new Map();selected.forEach(x=>x.risks.forEach(r=>riskMap.set(r.title+'|'+x.vendor_id,{...r,vendor:x.vendor.legal_name,quote:x.quote_id})));
 const vendorUsage=Object.values(counts);if(vendorUsage.length&&Math.max(...vendorUsage)>1)riskMap.set('Concentración de proveedor',{level:'medium',title:'Dependencia de un proveedor',vendor:'Escenario',quote:'Asignaciones',detail:`Un proveedor cubre ${Math.max(...vendorUsage)} de ${selected.length} partidas asignadas. Considera alternativas o confirma capacidad agregada.`});
 if(mode==='supply'&&vendorUsage.length>1&&Math.max(...vendorUsage)>1)riskMap.set('Diversificación limitada',{level:'medium',title:'Diversificación limitada',vendor:'Escenario',quote:'Asignaciones',detail:'La cobertura del banco y el universo de SKUs restringen la diversificación; no equivale a continuidad garantizada.'});
 return {code,title,description,selected,gaps,total,preTax,delivery,complete,score,vendorCount:new Set(selected.map(x=>x.vendor_id)).size,risks:[...riskMap.values()]};
}
function scoreOffer(q,offers){const cs=offers.map(o=>o.cost.total),ds=offers.map(o=>o.delivery_days),cmin=Math.min(...cs),cmax=Math.max(...cs),dmin=Math.min(...ds),dmax=Math.max(...ds);const c=cmax===cmin?0:(q.cost.total-cmin)/(cmax-cmin),d=dmax===dmin?0:(q.delivery_days-dmin)/(dmax-dmin);return c*.52+d*.33+riskPenalty(q)*.15}
function riskPenalty(q){return q.risks.reduce((n,r)=>n+(r.level==='high'?3:1),0)}
function renderResults(){
 const a=state.analysis;if(!a)return;const gapReq=a.requirements.filter(r=>r.missing||!r.offers.some(q=>!a.deadline||q.delivery_days<=a.deadline));const allSelected=a.tiers[0].selected;
 const total=a.tiers[0].total;const report=document.createElement('div');report.className='page-heading result-heading';
 const summary=`<div class="page-heading result-heading"><div><button class="back-btn" id="backToAnalysis">← Volver al análisis</button><div class="eyebrow" style="margin-top:15px">REPORTE DE ABASTECIMIENTO · ${esc(a.project?.project_id||'LICITACIÓN NUEVA')}</div><h1>${esc(a.project?.name||'Análisis de licitación')}</h1><div class="report-meta"><span>${esc(countryNames[a.country])}</span><span>·</span><span>${new Date(a.generatedAt).toLocaleDateString('es-CO')}</span><span>·</span><span>Fuente: ${esc(a.source)}</span><span>·</span><span class="status-tag">FICTICIO — DEMOSTRACIÓN</span></div></div><div class="result-actions"><button class="secondary-btn" id="exportExcel">↓ Exportar Excel</button><button class="primary-btn" id="exportPdf" style="width:auto;margin:0;padding:9px 12px">Imprimir / PDF <b>↗</b></button></div></div>`;
 const metrics=`<div class="summary-strip"><div class="summary-metric"><small>COBERTURA DOCUMENTAL</small><b>${a.coverage}/${a.requirements.length}</b><em>categorías con antecedente local</em><div class="progress-bar"><span style="width:${Math.round(a.coveragePct*100)}%"></span></div></div><div class="summary-metric"><small>${a.coverage===a.requirements.length?'MENOR ESTIMACIÓN HISTÓRICA':'ESTIMACIÓN DE PARTIDAS CUBIERTAS'}</small><b>${total==null?'—':money(total)}</b><em>${total==null?'Sin base comparable':a.coverage===a.requirements.length?'No es oferta vigente':'Subtotal parcial · excluye brechas'}</em></div><div class="summary-metric"><small>PLAZO REFERENCIAL</small><b>${a.tiers[0].delivery==null?'—':a.tiers[0].delivery+' días'}</b><em>${a.deadline?`Objetivo ${a.deadline} días`:'Objetivo sin definir'}</em></div><div class="summary-metric"><small>DISPONIBILIDAD</small><b>Pendiente</b><em>No confirmada por el banco</em></div></div>`;
 const gapBanner=gapReq.length?`<div class="alert-strip red"><b>Brechas de cobertura:</b><span>${gapReq.map(r=>`${esc(r.category)}${r.missing?' (sin cotización del país)':' (no cumple plazo)'}`).join(' · ')}. El sistema no completa estas partidas por inferencia.</span></div>`:'';
 const historical=a.onlyHistorical?'<div class="alert-strip"><b>Precios solo referenciales:</b><span>Las cotizaciones disponibles están vencidas. Se usan únicamente para estimación histórica y no deben tratarse como ofertas vigentes.</span></div>':'';
 const cards=`<div class="tier-grid">${a.tiers.map(t=>tierHtml(t,a)).join('')}</div>`;
 const sources=[...new Set(a.requirements.map(r=>r.product?.sku).filter(Boolean))].map(sku=>`<a href="/data/technical_sheets/${sku}.md" target="_blank" rel="noreferrer">Ficha ${sku} ↗</a>`).join('');
 const reqs=`<section class="source-block"><h2>Requerimientos identificados</h2><div class="panel" style="padding:12px"><div class="catalog-table-wrap" style="border:0"><table class="data-table"><thead><tr><th>CATEGORÍA</th><th>PRODUCTO CANDIDATO</th><th>CANTIDAD</th><th>OFERTAS HISTÓRICAS</th><th>ESTADO</th></tr></thead><tbody>${a.requirements.map(r=>`<tr><td>${esc(r.category)}</td><td>${r.product?`${esc(r.product.sku)} · ${esc(r.product.name)}`:`Sin producto compatible${r.technicalReason?` — ${esc(r.technicalReason)}`:''}`}</td><td>${num(r.quantity)} ${esc(r.unit)}</td><td>${r.offers.length}</td><td><span class="${r.offers.length?'sku-chip':'status-tag'}">${r.offers.length?'Antecedente':r.technicalStatus==='incompatible'?'Brecha técnica':'Brecha de cotización'}</span></td></tr>`).join('')}</tbody></table></div></div></section>`;
 $('#view-results').innerHTML=summary+`<div id="printReport">${metrics}${gapBanner}${historical}${cards}${reqs}<section class="source-block"><h2>Trazabilidad documental</h2><div class="source-chips">${sources}<a href="/data/catalogs/jurisdictions.json" target="_blank">Matriz de jurisdicción (demo) ↗</a>${allSelected.map(x=>`<a href="/data/${esc(x.source)}" target="_blank">Cotización ${esc(x.quote_id)} ↗</a>`).filter((x,i,ar)=>ar.indexOf(x)===i).join('')}</div><div class="notice-inline">Los documentos enlazados son sintéticos. Matrices regulatorias pendientes de validación humana.</div></section><section class="source-block"><h2>Resumen ejecutivo</h2><div class="panel" style="padding:14px;color:#5e6b80;font-size:10px;line-height:1.7">${executiveSummary(a)}</div></section></div>`;
 $('#backToAnalysis').onclick=()=>showView('analysis');$('#exportPdf').onclick=()=>window.print();$('#exportExcel').onclick=exportWorkbook;
}
function tierHtml(t,a){
 const alloc=t.selected.map(x=>{const localTotal=x.cost.total*x.fx_local_per_usd_snapshot;return `<div class="allocation"><div class="allocation-head"><b>${esc(x.requirement.category)} · ${esc(x.sku)}</b><span>${money(x.cost.total)}</span></div><div class="allocation-meta">${esc(x.vendor.legal_name)} · ${esc(x.country)}<br>${esc(x.quote_id)} · ${esc(x.date)} · ${x.delivery_days} días · FX histórico ${x.currency} ${num(x.fx_local_per_usd_snapshot)}/USD · garantía ${x.warranty_months} meses<br>Precio USD ${money(x.cost.product)} + transporte demo ${money(x.cost.freight)} + impuesto demo ${money(x.cost.tax)}<br>Estimado en moneda local: ${moneyLocal(x.currency,localTotal)} (FX snapshot histórico)</div><a href="/data/${esc(x.source)}" target="_blank" rel="noreferrer">Abrir cotización fuente ↗</a></div>`}).join('')||'<div class="empty-state">Sin asignaciones disponibles.</div>';
 const risks=t.risks.map(r=>`<li class="${r.level==='high'?'high':''}"><b>${esc(r.title)} · ${esc(r.vendor)}</b> (${esc(r.quote)}): ${esc(r.detail)}</li>`).join('');
 return `<article class="tier-card ${t.code==='TIER 1'?'best':''}"><div class="tier-top"><span class="tier-badge">${t.code}</span><div class="tier-score"><b>${t.score}/100</b>índice de cobertura demo</div><h2>${t.title}</h2><p>${t.description}</p></div><div class="tier-stats"><div><small>${t.complete?'COSTO TOTAL DEMO':'SUBTOTAL PARTIDAS CUBIERTAS'}</small><b>${t.total==null?'—':money(t.total)}</b></div><div><small>ENTREGA MÁXIMA</small><b>${t.delivery==null?'—':t.delivery+' días'}</b></div><div><small>PROVEEDORES</small><b>${t.vendorCount}</b></div><div><small>COBERTURA</small><b>${t.selected.length}/${a.requirements.length}</b></div></div>${t.budget!=null?`<div class="budget-line ${t.budgetExceeded?'over':''}">Presupuesto demo ${money(t.budget)} · ${t.total==null?'sin estimación':!t.complete?'comparación pendiente: faltan partidas':t.budgetExceeded?'excede el presupuesto':'dentro del presupuesto'}</div>`:''}${t.gaps.length?`<div class="gap-list"><b>Brechas de este tier</b><br>${t.gaps.map(esc).join('<br>')}</div>`:''}<ul class="tier-list"><li>Compatibilidad preliminar solo para parámetros declarados</li><li class="gap">Cotizaciones históricas; disponibilidad por confirmar</li></ul><details class="tier-detail"><summary>Ver asignaciones, riesgos y trazabilidad</summary><div class="allocations">${alloc}</div><ul class="risk-list">${risks}</ul></details></article>`;
}
function executiveSummary(a){const t=a.tiers[0],n=t.selected.length,req=a.requirements.length;let s=`El análisis encontró antecedentes documentales para ${a.coverage} de ${req} categorías requeridas en ${esc(countryNames[a.country])}. El escenario TIER 1 asigna ${n} categorías con un costo histórico demo estimado de ${t.total==null?'no disponible':money(t.total)} y un plazo máximo referencial de ${t.delivery==null?'no disponible':t.delivery+' días'}. `;if(t.gaps.length)s+=`Quedan brechas sin cubrir: ${t.gaps.map(esc).join('; ')}. `;s+='Todas las cotizaciones disponibles están sujetas a reconfirmación; el banco no confirma stock, precios vigentes, confiabilidad real, certificaciones ni cumplimiento regulatorio. Las cifras son sintéticas y excluyen conceptos que no constan en la fuente.';return s}
function renderCatalog(){if(!state.products.length)return;const q=($('#catalogSearch')?.value||'').toLowerCase(),country=$('#catalogCountry')?.value||'';let html='';
 if(state.catalogMode==='products'){
  const rows=state.products.filter(p=>`${p.sku} ${p.name} ${p.category}`.toLowerCase().includes(q)).map(p=>{const offers=state.quotes.filter(x=>x.sku===p.sku&&(!country||state.vendors.find(v=>v.vendor_id===x.vendor_id)?.jurisdiction_code===country));const min=offers.length?Math.min(...offers.map(x=>x.unit_price_usd)):null;return `<tr><td><span class="sku-chip">${esc(p.sku)}</span></td><td>${esc(p.name)}</td><td>${esc(p.category)}</td><td>${esc(p.unit)}</td><td>${min==null?'—':money(min)}</td><td>${offers.length} históricas</td><td><span class="status-tag">Sintético</span></td></tr>`}).join('');html=`<table class="data-table"><thead><tr><th>SKU</th><th>PRODUCTO / SERVICIO</th><th>CATEGORÍA</th><th>UNIDAD</th><th>MENOR PRECIO UNITARIO HISTÓRICO USD</th><th>REFERENCIAS</th><th>ORIGEN</th></tr></thead><tbody>${rows||'<tr><td colspan="7">No hay resultados</td></tr>'}</tbody></table>`;
 }else if(state.catalogMode==='vendors'){
  const rows=state.vendors.filter(v=>(!country||v.jurisdiction_code===country)&&`${v.vendor_id} ${v.legal_name} ${v.country} ${v.city} ${v.payment_terms}`.toLowerCase().includes(q)).map(v=>`<tr><td><span class="sku-chip">${esc(v.vendor_id)}</span></td><td>${esc(v.legal_name)}</td><td><span class="country-chip">${esc(v.country)}</span></td><td>${esc(v.city)}</td><td>${esc(v.currency)}</td><td>${esc(v.incoterm)}</td><td><span class="status-tag">Solo demo</span></td></tr>`).join('');html=`<table class="data-table"><thead><tr><th>ID</th><th>PROVEEDOR</th><th>PAÍS</th><th>CIUDAD</th><th>MONEDA</th><th>INCOTERM (DEMO)</th><th>ESTADO</th></tr></thead><tbody>${rows||'<tr><td colspan="7">No hay resultados</td></tr>'}</tbody></table>`;
 }else{
  const qrows=state.quotes.filter(x=>{const v=state.vendors.find(z=>z.vendor_id===x.vendor_id);return (!country||v?.jurisdiction_code===country)&&`${x.quote_id} ${x.vendor_id} ${x.sku} ${x.item_name} ${v?.legal_name||''}`.toLowerCase().includes(q)}).sort((a,b)=>b.date.localeCompare(a.date)).map(x=>`<tr><td><span class="sku-chip">${esc(x.quote_id)}</span></td><td>${esc(x.sku)} · ${esc(x.item_name)}</td><td>${esc(x.vendor_id)}</td><td>${esc(x.country)}</td><td>${money(x.unit_price_usd)}</td><td>${esc(x.date)}</td><td>${x.delivery_days} días</td><td><span class="status-tag">${isQuoteCurrent(x)?'Dentro vigencia documental':'Vencida · histórica'}</span></td></tr>`).join('');html=`<table class="data-table"><thead><tr><th>ID COTIZACIÓN</th><th>PRODUCTO</th><th>PROVEEDOR</th><th>PAÍS</th><th>PRECIO UNITARIO USD</th><th>FECHA</th><th>ENTREGA</th><th>ESTADO DOCUMENTAL</th></tr></thead><tbody>${qrows||'<tr><td colspan="8">No hay resultados</td></tr>'}</tbody></table>`;
 }
 $('#catalogTable').innerHTML=`<div class="catalog-table-wrap">${html}</div>`}
function exportWorkbook(){const a=state.analysis;if(!a)return;const rows=[['Resumen ejecutivo','Valor'],['Proyecto',a.project?.name||'Licitación nueva'],['País',countryNames[a.country]],['Datos','FICTICIOS - DEMOSTRACIÓN'],['Cobertura',`${a.coverage}/${a.requirements.length}`],['', ''],['Tier','Categoría','SKU','Producto','Proveedor','Cotización','Fecha','Estado vigencia','Cantidad','Subtotal USD','Transporte USD demo','Impuesto USD demo','Total estimado USD','Total estimado moneda local','Entrega días','Moneda','FX snapshot','Garantía meses','Fuente']];for(const t of a.tiers)for(const x of t.selected)rows.push([t.code,x.requirement.category,x.sku,x.item_name,x.vendor.legal_name,x.quote_id,x.date,isQuoteCurrent(x)?'Vigente al cálculo':'Vencida / histórica',x.requirement.quantity,x.cost.product,x.cost.freight,x.cost.tax,x.cost.total,x.cost.total*x.fx_local_per_usd_snapshot,x.delivery_days,x.currency,x.fx_local_per_usd_snapshot,x.warranty_months,x.source]);for(const t of a.tiers)for(const gap of t.gaps)rows.push([t.code,'BRECHA',gap]);
 const xmlCell=v=>`<Cell><Data ss:Type="${typeof v==='number'?'Number':'String'}">${esc(v)}</Data></Cell>`;const xmlRows=rows.map(r=>`<Row>${r.map(xmlCell).join('')}</Row>`).join('');const xml=`<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Escenarios"><Table>${xmlRows}</Table></Worksheet></Workbook>`;download(new Blob([xml],{type:'application/vnd.ms-excel'}),`EPI_${a.project?.project_id||'licitacion'}_reporte.xls`)}
function download(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1200)}
let toastTimer;function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),2800)}
init();
