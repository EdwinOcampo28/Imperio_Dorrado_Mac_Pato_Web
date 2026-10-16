function renderBudgets(){
    const b=state.presupuestos||{
        mensual:0,
        categorias:{
        }
    }
    ;
    if($('#monthlyBudget'))$('#monthlyBudget').value=b.mensual||'';
    if($('#budgetCategories'))$('#budgetCategories').innerHTML=[...new Set([...state.categories,
    ...Object.keys(b.categorias||{
    }
    )])].map(cat=>`<div class="category-limit-row"><label for="budget-${slug(cat)}">${esc(cat)}</label><input id="budget-${slug(cat)}" type="number" min="0" step="1000" value="${Number(b.categorias?.[cat]||0)}" data-budget-cat="${esc(cat)}" aria-label="Presupuesto para ${esc(cat)}"></div>`).join('');
    const month=todayISO().slice(0,
    7),
    expenses=countedMovements(state.gastos).filter(g=>(g.tipo||'gasto')==='gasto'&&g.fecha.startsWith(month)),
    sum=items=>items.reduce((a,
    g)=>a+Number(g.monto||0),
    0),
    total=sum(expenses),
    pct=(a,
    b)=>b>0?Math.min(100,
    a/b*100):0;
    let html='';
    if(b.mensual>0)html+=budgetBar('Presupuesto mensual',
    total,
    b.mensual);
    for(const [cat,
    limit] of Object.entries(b.categorias||{
    }
    )){
        if(Number(limit)>0){
            const used=sum(expenses.filter(g=>g.categoria===cat));
            html+=budgetBar(cat,
            used,
            Number(limit))
        }
    }
    if(!html)html='<p class="muted-small">Configura un presupuesto mensual o por categoría para ver tu avance.</p>';
    $('#budgetProgress').innerHTML=html;
    $('#budgetMonthLabel').textContent=new Date().toLocaleDateString('es-CO',
    {
        month:'long',
        year:'numeric'
    }
    )
}
function budgetBar(name,
used,
limit){
    const pct=limit>0?Math.min(100,
    used/limit*100):0,
    over=used>limit;
    return `<div class="budget-progress-item"><div class="budget-progress-head"><b>${esc(name)}</b><span class="${over?'over-budget':''}">${money(used)} / ${money(limit)}</span></div><div class="budget-track"><div class="budget-fill ${over?'over-budget':''}" style="width:${pct}%"></div></div><small>${over?`Excedido por ${
        money(used-limit)
    }
    `:`Quedan ${
        money(limit-used)
    }
    `}</small></div>`
}
function renderGoals(){
    const list=$('#goalsList');
    if(!list)return;
    list.innerHTML=state.metas.length?state.metas.map(g=>{
        g.aportes=Array.isArray(g.aportes)?g.aportes:[];
        if(!g.aportes.length&&Number(g.ahorrado)>0)g.aportes.push({
            monto:Number(g.ahorrado),
            fecha:todayISO(),
            tipo:'saldo previo'
        }
        );
        const pct=Math.min(100,
        g.objetivo>0?g.ahorrado/g.objetivo*100:0),
        aporteTotal=g.aportes.reduce((n,
        a)=>n+Number(a.monto||0),
        0),
        recent=[...g.aportes].slice(-3).reverse();
        return `<article class="panel goal-card"><div class="goal-card-top"><span class="goal-symbol">◎</span><button class="icon-btn delete" data-goal-delete="${g.id}" title="Eliminar meta" aria-label="Eliminar meta">×</button></div><h2>${esc(g.nombre)}</h2><div class="goal-amounts"><strong>${money(g.ahorrado)}</strong><span>de ${money(g.objetivo)}</span></div><div class="budget-track"><div class="budget-fill" style="width:${pct}%"></div></div><div class="goal-progress-foot"><span>${Math.round(pct)}% completado</span><span>${g.fecha?`Meta: ${
            fmtDate(g.fecha)
        }
        `:'Sin fecha objetivo'}</span></div><section class="contribution-summary"><div class="contribution-summary-head"><b>Resumen de aportes</b><span>${g.aportes.length} ${g.aportes.length===1?'registro':'registros'}</span></div><div class="contribution-total">${money(aporteTotal)} <small>aportado en total</small></div>${recent.length?`<div class="contribution-list">${
            recent.map(a=>`<div><span>${a.tipo==='inicial'?'Ahorro inicial':'Aporte'} · ${fmtDate(a.fecha)}</span><b>${money(a.monto)}</b></div>`).join('')
        }
        </div>`:'<p class="contribution-empty">Aún no hay aportes registrados.</p>'}</section>${pct>=100?'<p class="goal-complete">¡Meta alcanzada!</p>':`<form class="goal-contribute" data-goal-form="${g.id}"><input type="number" min="1" step="1" name="aporte" placeholder="Valor del aporte" required><button class="btn btn-soft" type="submit">＋ Aportar</button></form>`}</article>`
    }
    ).join(''):'<div class="panel empty-state"><span class="empty-illustration">◎</span><br>Aún no tienes metas de ahorro.<span class="empty-copy">Crea tu primera meta y registra tus aportes para ver el progreso.</span></div>'
}
function renderAlerts(){
    const list=$('#alertsList');
    if(!state.alerts.length){
        list.innerHTML=`<div class="panel empty-state"><span class="empty-illustration">♧</span><br>No hay alertas registradas.<span class="empty-copy">Cuando un gasto supere tus límites configurados, aparecerá aquí.</span></div>`;
        return
    }
    list.innerHTML=[...state.alerts].map((a,
    i)=>({
        a,
        i
    }
    )).reverse().map(({
        a,
        i
    }
    )=>`<article class="alert-card"><div class="alert-card-icon">⚑</div><div class="alert-card-content"><div class="alert-card-top"><b>${esc(a.mensaje||'Límite de gasto superado')}</b><span class="alert-type">${esc(a.tipo||'Aviso')}</span></div><p>${esc(a.categoria||'General')} · ${fmtDate(a.fecha)}</p><div class="alert-meta"><span>Gasto: <strong>${money(a.monto)}</strong></span><span>Promedio: <strong>${money(a.promedio)}</strong></span><span>Límite: <strong>${money(a.limite)}</strong></span></div></div><button class="alert-delete" data-alert-delete="${i}" title="Eliminar alerta" aria-label="Eliminar alerta">×</button></article>`).join('')
}
function renderSettings(){
    const c=state.config;
    $('#dailyLimit').value=c.porcentaje_alerta_diaria??50;
    $('#weeklyLimit').value=c.porcentaje_alerta_semanal??40;
    const keys=[...new Set([...state.categories,
    ...Object.keys(c.limites_categoria||{
    }
    )])];
    $('#categoryLimits').innerHTML=keys.map(cat=>`<div class="category-limit-row"><label for="limit-${slug(cat)}">${esc(cat)}</label><input id="limit-${slug(cat)}" type="number" min="1" max="1000" value="${Number(c.limites_categoria?.[cat]??50)}" data-cat-limit="${esc(cat)}" aria-label="Límite para ${esc(cat)}"></div>`).join('');
    $('#settingsPreview').innerHTML=`<b>Referencia actual</b><br>Alerta diaria: ${money(state.dashboard.daily_limit)} · Alerta semanal: ${money(state.dashboard.weekly_limit)}<br><span>Los cálculos cuentan movimientos desde ${fmtDate(trackingStart())}. Los anteriores se conservan en el historial, pero no afectan los totales.</span>`
}
function slug(s){
    return String(s).toLowerCase().replace(/[^a-z0-9]+/g,
    '-')
}
