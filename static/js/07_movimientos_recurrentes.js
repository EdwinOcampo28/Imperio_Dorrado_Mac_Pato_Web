function renderRecurrentes(){
    const items=Array.isArray(localDB.recurrentes)?localDB.recurrentes:[];
    const today=todayISO();
    const due=items.filter(r=>r.proximaFecha<=today);
    $('#recurringDueCount').textContent=`${due.length} ${due.length===1?'PENDIENTE':'PENDIENTES'}`;
    const cats=[...new Set([...state.categories,
    'Comida',
    'Transporte',
    'Hogar',
    'Servicios',
    'Educación',
    'Entretenimiento',
    'Salud',
    'Otros'])];
    $('#recurringCategory').innerHTML=cats.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
    $('#recurringNextDate').value=$('#recurringNextDate').value||today;
    $('#recurringList').innerHTML=items.length?items.slice().sort((a,
    b)=>a.proximaFecha.localeCompare(b.proximaFecha)).map(r=>`<article class="recurring-item ${r.proximaFecha<=today?'is-due':''}"><div><b>${esc(r.nombre)}</b><small>${esc(r.categoria)} · ${r.frecuencia==='weekly'?'Semanal':r.frecuencia==='yearly'?'Anual':'Mensual'} · Próximo: ${fmtDate(r.proximaFecha)}</small></div><strong>${money(r.monto)}</strong><div class="recurring-item-actions"><button class="btn btn-primary" type="button" data-recurring-register="${r.id}">${r.proximaFecha<=today?'Registrar ahora':'Registrar gasto'}</button><button class="btn btn-outline" type="button" data-recurring-delete="${r.id}" aria-label="Eliminar gasto recurrente">Eliminar</button></div></article>`).join(''):'<p class="muted-small">Todavía no tienes gastos recurrentes programados.</p>';
}
function nextRecurringDate(date,
frequency){
    const d=new Date(date+'T12:00:00');
    if(frequency==='weekly')d.setDate(d.getDate()+7);
    else if(frequency==='yearly')d.setFullYear(d.getFullYear()+1);
    else{
        const day=d.getDate();
        d.setDate(1);
        d.setMonth(d.getMonth()+1);
        const last=new Date(d.getFullYear(),
        d.getMonth()+1,
        0).getDate();
        d.setDate(Math.min(day,
        last));
    }
    return iso(d)
}
function renderTransactions(){
    const q=($('#searchInput')?.value||'').toLowerCase().trim(),
    cat=$('#categoryFilter')?.value||'',
    month=$('#monthFilter')?.value||'',
    kind=$('#typeFilter')?.value||'';
    let items=[...state.gastos].filter(g=>(!q||`${g.descripcion} ${g.categoria} ${g.fecha}`.toLowerCase().includes(q))&&(!cat||g.categoria===cat)&&(!month||g.fecha.startsWith(month))&&(!kind||(g.tipo||'gasto')===kind)).sort((a,
    b)=>b.fecha.localeCompare(a.fecha)||b.id-a.id);
    $('#resultCount').textContent=`${items.length} ${items.length===1?'registro':'registros'}`;
    $('#tableFootCount').textContent=`${items.length} registros`;
    $('#visibleTotal').textContent=money(items.filter(g=>isCountedMovement(g)).reduce((s,
    g)=>s+(g.tipo==='ingreso'?Number(g.monto):-Number(g.monto)),
    0));
    $('#allRows').innerHTML=items.length?items.map(g=>`<tr><td>${g.id}</td><td><div class="expense-description"><span class="expense-icon">${catIcons[g.categoria]||'◇'}</span><div>${esc(g.descripcion)}</div></div></td><td><span class="category-chip">${esc(g.categoria)}</span><small class="movement-kind ${g.tipo==='ingreso'?'income-value':''}">${g.tipo==='ingreso'?'Ingreso':'Gasto'}</small></td><td>${fmtDate(g.fecha)}${g.fecha<trackingStart()?'<small class="movement-kind historical-movement">Histórico · no cuenta</small>':''}</td><td class="align-right amount-cell ${g.tipo==='ingreso'?'income-value':''} ${g.fecha<trackingStart()?'historical-amount':''}">${g.tipo==='ingreso'?'+':'−'} ${money(g.monto)}</td><td><div class="action-buttons"><button class="icon-btn" title="Editar gasto" data-edit="${g.id}">✎</button><button class="icon-btn delete" title="Eliminar gasto" data-delete="${g.id}">×</button></div></td></tr>`).join(''):emptyRow(6,
    'No hay movimientos que coincidan con los filtros.');
    $('#categoryFilter').innerHTML='<option value="">Todas las categorías</option>'+[...new Set([...state.categories,
    ...state.gastos.map(g=>g.categoria)])].map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('')+'';
    const catKeep=cat;
    $('#categoryFilter').value=catKeep;
    if($('#typeFilter'))$('#typeFilter').value=kind;
    const months=[...new Set(state.gastos.map(g=>g.fecha.slice(0,
    7)))].sort().reverse();
    const monthKeep=month;
    $('#monthFilter').innerHTML='<option value="">Todas las fechas</option>'+months.map(m=>{
        const [y,
        mo]=m.split('-').map(Number);
        return `<option value="${m}">${new Date(y,mo-1,1).toLocaleDateString('es-CO',{month:'long',year:'numeric'})}</option>`
    }
    ).join('');
    $('#monthFilter').value=monthKeep
}
