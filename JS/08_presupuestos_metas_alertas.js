function renderBudgets(){
    const b=state.presupuestos||{mensual:0,categorias:{}};
    if($('#monthlyBudget'))$('#monthlyBudget').value=b.mensual||'';
    if($('#budgetCategories'))$('#budgetCategories').innerHTML=[...new Set([...state.categories,...Object.keys(b.categorias||{})])].map(cat=>`<div class="category-limit-row"><label for="budget-${slug(cat)}">${esc(cat)}</label><input id="budget-${slug(cat)}" type="number" min="0" step="1000" value="${Number(b.categorias?.[cat]||0)}" data-budget-cat="${esc(cat)}" aria-label="Presupuesto para ${esc(cat)}"></div>`).join('');
    const month=todayISO().slice(0,7),expenses=countedMovements(state.gastos).filter(g=>(g.tipo||'gasto')==='gasto'&&g.fecha.startsWith(month)),sum=items=>items.reduce((a,g)=>a+Number(g.monto||0),0),total=sum(expenses);
    let html='';
    if(b.mensual>0)html+=budgetBar('Presupuesto mensual',total,b.mensual,true);
    for(const [cat,limit] of Object.entries(b.categorias||{}))if(Number(limit)>0)html+=budgetBar(cat,sum(expenses.filter(g=>g.categoria===cat)),Number(limit));
    if(!html)html='<p class="muted-small">Configura un presupuesto mensual o por categoría para ver tu avance.</p>';
    $('#budgetProgress').innerHTML=html;
    $('#budgetMonthLabel').textContent=new Date().toLocaleDateString('es-CO',{month:'long',year:'numeric'});
}
function budgetBar(name,used,limit,summary=false){
    const pct=limit>0?Math.min(100,used/limit*100):0,over=used>limit;
    return `<div class="budget-progress-item${summary?' budget-progress-total':''}"><div class="budget-progress-head"><b>${esc(name)}</b><span class="${over?'over-budget':''}">${money(used)} / ${money(limit)}</span></div><div class="budget-track"><div class="budget-fill ${over?'over-budget':''}" style="width:${pct}%"></div></div><small>${over?`Excedido por ${money(used-limit)}`:`Quedan ${money(limit-used)}`}</small></div>`
}
function goalIconFor(name){
    const value=String(name||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''),icons=[
        [/viaje|vacacion|paseo/,'↗'],[/casa|vivienda|hogar/,'⌂'],[/carro|auto|moto|vehicul/,'▰'],[/estudio|educacion|curso|universidad/,'▤'],[/emergencia|reserva|imprevisto/,'✚'],[/salud|medic/,'＋'],[/negocio|emprend/,'◆'],[/computador|laptop|celular|tecnologia/,'▣']
    ];
    return icons.find(([pattern])=>pattern.test(value))?.[1]||catIcons.Otros||'◎'
}
function renderGoals(){
    const list=$('#goalsList');
    if(!list)return;
    list.innerHTML=state.metas.length?state.metas.map(g=>{
        g.aportes=Array.isArray(g.aportes)?g.aportes:[];
        if(!g.aportes.length&&Number(g.ahorrado)>0)g.aportes.push({monto:Number(g.ahorrado),fecha:todayISO(),tipo:'saldo previo'});
        const pct=Math.min(100,g.objetivo>0?g.ahorrado/g.objetivo*100:0),aporteTotal=g.aportes.reduce((n,a)=>n+Number(a.monto||0),0),largest=[...g.aportes].sort((a,b)=>Number(b.monto||0)-Number(a.monto||0)||String(b.fecha||'').localeCompare(String(a.fecha||''))).slice(0,3),history=[...g.aportes].sort((a,b)=>String(b.fecha||'').localeCompare(String(a.fecha||''))),renderAporte=a=>`<div><span>${a.tipo==='inicial'?'Ahorro inicial':'Aporte'} · ${fmtDate(a.fecha)}</span><b>${money(a.monto)}</b></div>`;
        return `<article class="panel goal-card"><div class="goal-card-top"><span class="goal-symbol expense-icon" aria-hidden="true">${goalIconFor(g.nombre)}</span><button class="icon-btn delete" data-goal-delete="${g.id}" title="Eliminar meta" aria-label="Eliminar meta">×</button></div><h2>${esc(g.nombre)}</h2><div class="goal-amounts"><strong>${money(g.ahorrado)}</strong><span>de ${money(g.objetivo)}</span></div><div class="budget-track"><div class="budget-fill" style="width:${pct}%"></div></div><div class="goal-progress-foot"><span>${Math.round(pct)}% completado</span><span>${g.fecha?`Meta: ${fmtDate(g.fecha)}`:'Sin fecha objetivo'}</span></div><section class="contribution-summary"><div class="contribution-summary-head"><b>Resumen de aportes</b><span>${g.aportes.length} ${g.aportes.length===1?'registro':'registros'}</span></div><div class="contribution-total">${money(aporteTotal)} <small>aportado en total</small></div>${largest.length?`<div class="contribution-list contribution-top-three">${largest.map(renderAporte).join('')}</div>${g.aportes.length>3?`<button class="btn btn-outline contribution-history-toggle" type="button" data-goal-contributions="${g.id}" aria-controls="goal-history-${g.id}" aria-expanded="false">Ver todos los aportes</button><div class="contribution-history" id="goal-history-${g.id}" hidden><div class="contribution-list">${history.map(renderAporte).join('')}</div></div>`:''}`:'<p class="contribution-empty">Aún no hay aportes registrados.</p>'}</section>${pct>=100?'<p class="goal-complete">¡Meta alcanzada!</p>':`<form class="goal-contribute" data-goal-form="${g.id}"><input type="number" min="1" step="1" name="aporte" placeholder="Valor del aporte" required><button class="btn btn-soft" type="submit">＋ Aportar</button></form>`}</article>`
    }).join(''):'<div class="panel empty-state"><span class="empty-illustration">◎</span><br>Aún no tienes metas de ahorro.<span class="empty-copy">Crea tu primera meta y registra tus aportes para ver el progreso.</span></div>';
    renderPendingBalances();
}
function renderPendingBalances(){
    const list=$('#pendingList');
    if(!list)return;
    const items=Array.isArray(state.pendientes)?state.pendientes:[],open=items.filter(x=>Math.max(0,Number(x.monto)-Number(x.abonado||0))>0),total=open.reduce((n,x)=>n+Math.max(0,Number(x.monto)-Number(x.abonado||0)),0);
    $('#pendingTotal').textContent=money(total);
    $('#pendingCount').textContent=`${open.length} ${open.length===1?'persona debe':'personas deben'}`;
    list.innerHTML=items.length?[...items].sort((a,b)=>String(b.fecha||'').localeCompare(String(a.fecha||''))).map(item=>{
        const due=Math.max(0,Number(item.monto)-Number(item.abonado||0)),paid=due<=0;
        const payments=Array.isArray(item.pagos)?item.pagos:[];
        return `<article class="pending-card ${paid?'is-settled':''}"><div class="pending-card-top"><span class="expense-icon pending-icon" aria-hidden="true">↗</span><div class="pending-person"><h3>${esc(item.persona||'Sin nombre')}</h3><p>${esc(item.concepto||'Saldo pendiente')}${item.fecha?` · Registrado ${fmtDate(item.fecha)}`:''}</p></div><button class="icon-btn delete" type="button" data-pending-delete="${item.id}" title="Eliminar saldo pendiente" aria-label="Eliminar saldo pendiente de ${esc(item.persona||'persona')}">×</button></div><div class="pending-amounts"><span>Prestado / acordado <b>${money(item.monto)}</b></span><span>Abonado <b>${money(item.abonado||0)}</b></span><strong class="${paid?'pending-paid':''}">${paid?'Pagado':`Debe ${money(due)}`}</strong></div>${item.fechaVencimiento?`<p class="pending-due">Fecha acordada: ${fmtDate(item.fechaVencimiento)}</p>`:''}${item.notas?`<p class="pending-notes">${esc(item.notas)}</p>`:''}${payments.length?`<details class="pending-payments"><summary>${payments.length} ${payments.length===1?'abono':'abonos'}</summary>${payments.map(p=>`<div><span>${fmtDate(p.fecha)}</span><b>${money(p.monto)}</b></div>`).join('')}</details>`:''}${paid?'<p class="pending-settled-note">Este registro quedó saldado y se conserva aquí como historial.</p>':`<form class="pending-payment" data-pending-payment="${item.id}"><label class="sr-only" for="pending-pay-${item.id}">Registrar abono de ${esc(item.persona||'persona')}</label><input id="pending-pay-${item.id}" type="number" min="1" max="${due}" step="1" name="abono" placeholder="Registrar abono" required><button class="btn btn-soft" type="submit">＋ Abonar</button></form>`}</article>`
    }).join(''):'<div class="panel empty-state"><span class="empty-illustration">↗</span><br>No tienes saldos pendientes.<span class="empty-copy">Registra aquí las personas que te deben. Estos saldos se guardan aparte y no afectan movimientos, ingresos, presupuestos ni metas de ahorro.</span></div>';
}
function activeAlerts(){return state.alerts.filter(a=>!a.eliminada)}
function renderAlerts(){
    const list=$('#alertsList');
    if(!list)return;
    const alerts=activeAlerts();
    if(!alerts.length){list.innerHTML='<div class="panel empty-state"><span class="empty-illustration">⚑</span><br>No hay alertas registradas.<span class="empty-copy">Cuando un gasto supere un tope que configuraste, aparecerá aquí.</span></div>';return}
    list.innerHTML=alerts.map(a=>({a,i:state.alerts.indexOf(a)})).reverse().map(({a,i})=>`<article class="alert-card"><div class="alert-card-icon">⚑</div><div class="alert-card-content"><div class="alert-card-top"><b>${esc(a.mensaje||'Límite de gasto superado')}</b><span class="alert-type">${esc(a.tipo||'Aviso')}</span></div><p>${esc(a.categoria||'General')} · ${fmtDate(a.fecha)}</p><div class="alert-meta"><span>Gastaste: <strong>${money(a.monto)}</strong></span><span>Tope: <strong>${money(a.limite)}</strong></span><span>Te pasaste por: <strong>${money(Math.max(0,Number(a.monto)-Number(a.limite)))}</strong></span></div></div><button class="alert-delete" data-alert-delete="${i}" title="Eliminar alerta" aria-label="Eliminar alerta">×</button></article>`).join('')
}
function renderSettings(){
    const c=state.config||{},daily=$('#dailyLimit'),weekly=$('#weeklyLimit');
    if(!daily||!weekly)return;
    daily.value=Number(c.limite_diario)>0?Number(c.limite_diario):'';
    weekly.value=Number(c.limite_semanal)>0?Number(c.limite_semanal):'';
    const limits=c.limites_categoria_mensuales||{},keys=[...new Set([...state.categories,...Object.keys(limits)])];
    $('#categoryLimits').innerHTML=keys.map(cat=>`<div class="category-limit-row"><label for="limit-${slug(cat)}">${esc(cat)}</label><div class="limit-currency-input"><span>$</span><input id="limit-${slug(cat)}" type="number" min="0" step="1" placeholder="0 = apagado" value="${Number(limits[cat])>0?Number(limits[cat]):''}" data-cat-limit="${esc(cat)}" aria-label="Tope mensual para ${esc(cat)}"></div></div>`).join('');
    $('#limitStatusSubtitle').textContent=`Los totales cuentan movimientos desde ${fmtDate(trackingStart())}.`;
    $('#settingsPreview').innerHTML=`<b>¿Cómo funcionan los topes?</b><br>Escribe el máximo que quieres gastar en pesos. Un valor vacío o en cero apaga ese aviso.<br><span>Diario: ${Number(c.limite_diario)>0?money(c.limite_diario):'apagado'} · Esta semana: ${Number(c.limite_semanal)>0?money(c.limite_semanal):'apagado'} · Las categorías se controlan por mes.</span>`;
    const month=todayISO().slice(0,7),expenses=countedMovements(state.gastos).filter(g=>(g.tipo||'gasto')==='gasto');
    const dailySpent=expenses.filter(g=>g.fecha===todayISO()).reduce((n,g)=>n+Number(g.monto||0),0),weekStart=iso(startOfWeek(new Date())),weekSpent=expenses.filter(g=>g.fecha>=weekStart&&g.fecha<=todayISO()).reduce((n,g)=>n+Number(g.monto||0),0);
    const rows=[['Hoy',dailySpent,Number(c.limite_diario)||0],['Esta semana',weekSpent,Number(c.limite_semanal)||0],...Object.entries(limits).filter(([,limit])=>Number(limit)>0).map(([cat,limit])=>[`${cat} · este mes`,expenses.filter(g=>g.categoria===cat&&g.fecha.startsWith(month)).reduce((n,g)=>n+Number(g.monto||0),0),Number(limit)])];
    $('#limitStatus').innerHTML=rows.length?rows.map(([label,used,limit])=>{const pct=limit?Math.min(100,used/limit*100):0,over=limit>0&&used>limit;return `<div class="limit-item"><div class="limit-info"><span>${esc(label)}</span><b>${money(used)} / ${limit?money(limit):'Sin tope'}</b></div><div class="limit-track"><div class="limit-fill ${over?'warning':''}" style="width:${limit?pct:0}%"></div></div><div class="limit-caption"><span>${!limit?'Configura un máximo para recibir avisos':over?`Superado por ${money(used-limit)}`:`Disponible ${money(limit-used)}`}</span><b>${limit?`${Math.round(used/limit*100)}%`:'—'}</b></div></div>`}).join(''):'<p class="muted-small">Configura un tope diario, semanal o por categoría para empezar.</p>';
}
function slug(s){return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-')}
