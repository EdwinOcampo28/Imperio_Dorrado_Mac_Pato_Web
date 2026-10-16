function renderDashboard(){
    const d=state.dashboard;
    const balance=Number(d.balance_available ?? ((d.income_total||0)-(d.total||0)));
    $('#totalAmount').textContent=money(balance);
    $('#totalAmount').classList.toggle('negative-value',
    balance<0);
    $('#countTotal').textContent=`${state.gastos.length} ${state.gastos.length===1?'movimiento':'movimientos'}`;
    $('#monthAmount').textContent=money(d.month_total);
    $('#monthCount').textContent=`${d.month_count} ${d.month_count===1?'gasto':'gastos'} este mes`;
    $('#incomeMonthAmount').textContent=money(d.income_month||0);
    const budget=Math.max(0,
    Number(state.presupuestos?.mensual)||0),
    spent=Math.max(0,
    Number(d.month_total)||0);
    const remaining=budget-spent,
    pct=budget>0?Math.min(100,
    spent/budget*100):0;
    const remainingAmount=$('#limitRemainingAmount'),
    remainingLabel=$('#limitRemainingLabel'),
    remainingFill=$('#limitRemainingFill');
    if(budget>0){
        remainingAmount.textContent=money(Math.abs(remaining));
        remainingAmount.classList.toggle('negative-value',
        remaining<0);
        remainingLabel.textContent=remaining<0?`Presupuesto excedido por ${money(Math.abs(remaining))}`:`De ${money(budget)} · ${Math.round(pct)}% utilizado`;
        remainingFill.style.width=`${pct}%`;
        remainingFill.classList.toggle('over-budget',
        remaining<0);
    }
    else{
        remainingAmount.textContent='Sin límite';
        remainingAmount.classList.remove('negative-value');
        remainingLabel.textContent='Configura tu presupuesto mensual';
        remainingFill.style.width='0%';
        remainingFill.classList.remove('over-budget');
    }
    const now=new Date();
    $('#monthName').textContent=now.toLocaleDateString('es-CO',
    {
        month:'long',
        year:'numeric'
    }
    );
    renderChart(d.last7||[]);
    renderCategories(d.by_category||{
    }
    );
    const recent=[...state.gastos].sort((a,
    b)=>b.fecha.localeCompare(a.fecha)||b.id-a.id).slice(0,
    5);
    $('#recentRows').innerHTML=recent.length?recent.map(g=>`<tr><td><div class="expense-description"><span class="expense-icon">${catIcons[g.categoria]||'◇'}</span><div>${esc(g.descripcion)}<small>#${g.id}</small></div></div></td><td><span class="category-chip">${esc(g.categoria)}</span> <small>${g.tipo==='ingreso'?'Ingreso':'Gasto'}</small></td><td>${fmtDate(g.fecha)}${g.fecha<trackingStart()?'<small class="movement-kind historical-movement">Histórico · no cuenta</small>':''}</td><td class="align-right amount-cell ${g.tipo==='ingreso'?'income-value':''} ${g.fecha<trackingStart()?'historical-amount':''}">${g.tipo==='ingreso'?'+':'−'} ${money(g.monto)}</td></tr>`).join(''):emptyRow(4,
    'Aún no tienes movimientos registrados.');
    renderLimits(d);
}
function renderChart(days){
    const max=Math.max(1,
    ...days.map(x=>x.total));
    const cap=Math.ceil(max/4);
    $('#chartY3').textContent=money(cap*3);
    $('#chartY2').textContent=money(cap*2);
    $('#chartY1').textContent=money(cap);
    $('#bars').innerHTML=days.map(d=>{
        const date=new Date(d.date+'T12:00:00');
        const height=d.total?Math.max(4,
        d.total/max*100):2;
        return `<div class="bar-column"><span class="bar-value">${d.total?money(d.total):''}</span><div class="bar ${d.date===todayISO()?'today':''}" style="height:${height}%" title="${fmtDate(d.date)}: ${money(d.total)}"></div><span class="bar-day">${date.toLocaleDateString('es-CO',{weekday:'short'}).replace('.','')}</span></div>`
    }
    ).join('')
}
function renderCategories(byCat){
    const entries=Object.entries(byCat).filter(([,
    v])=>v>0);
    const max=Math.max(1,
    ...entries.map(([,
    v])=>v));
    $('#categoryList').innerHTML=entries.length?entries.slice(0,
    7).map(([name,
    value])=>`<div class="category-row"><span class="category-name">${esc(name)}</span><div class="category-track"><div class="category-fill" style="width:${value/max*100}%"></div></div><span class="category-value">${money(value)}</span></div>`).join(''):'<div class="empty-state">Sin datos de categorías todavía.</div>';
    $('#categoryTotal').textContent=money(state.dashboard.total)
}
function renderLimits(d){
    const daily=d.daily_limit||0,
    weekly=d.weekly_limit||0,
    today=d.today_total||0,
    week=d.week_total||0;
    const pct=(a,
    b)=>b>0?Math.min(100,
    a/b*100):0;
    $('#limitSummary').innerHTML=`<div class="limit-item"><div class="limit-info"><span>Gasto de hoy</span><b>${money(today)} / ${money(daily)}</b></div><div class="limit-track"><div class="limit-fill ${today>daily&&daily>0?'warning':''}" style="width:${pct(today,daily)}%"></div></div><div class="limit-caption"><span>Promedio diario como referencia</span><b>${Math.round(pct(today,daily))}%</b></div></div><div class="limit-item"><div class="limit-info"><span>Gasto esta semana</span><b>${money(week)} / ${money(weekly)}</b></div><div class="limit-track"><div class="limit-fill ${week>weekly&&weekly>0?'warning':''}" style="width:${pct(week,weekly)}%"></div></div><div class="limit-caption"><span>Promedio semanal como referencia</span><b>${Math.round(pct(week,weekly))}%</b></div></div>`
}
