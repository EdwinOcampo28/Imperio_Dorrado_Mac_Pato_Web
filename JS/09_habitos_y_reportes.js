function renderSpendingHabits(){
    const input=$('#habitsMonth');
    if(!input)return;
    const now=new Date();
    if(!input.value)input.value=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const month=input.value;
    const [year,
    monthNum]=month.split('-').map(Number);
    if(!year||!monthNum)return;
    const currentStart=`${year}-${String(monthNum).padStart(2,'0')}-01`;
    const prevDate=new Date(year,
    monthNum-2,
    1);
    const previous=`${prevDate.getFullYear()}-${String(prevDate.getMonth()+1).padStart(2,'0')}`;
    const currentLabel=new Date(year,
    monthNum-1,
    1).toLocaleDateString('es-CO',
    {
        month:'long',
        year:'numeric'
    }
    );
    const previousLabel=prevDate.toLocaleDateString('es-CO',
    {
        month:'long',
        year:'numeric'
    }
    );
    const totalsFor=m=>{
        const out={
        }
        ;
        countedMovements(state.gastos,
        `${m}-31`).filter(g=>(g.tipo||'gasto')==='gasto'&&String(g.fecha||'').startsWith(m)).forEach(g=>{
            const c=String(g.categoria||'Otros');
            out[c]=(out[c]||0)+Math.max(0,
            Number(g.monto)||0)
        }
        );
        return out
    }
    ;
    const cur=totalsFor(month),
    prev=totalsFor(previous),
    cats=[...new Set([...Object.keys(cur),
    ...Object.keys(prev)])];
    const sum=o=>Object.values(o).reduce((a,
    b)=>a+b,
    0);
    const curTotal=sum(cur),
    prevTotal=sum(prev),
    diff=curTotal-prevTotal,
    pct=prevTotal?diff/prevTotal*100:null;
    $('#habitsSubtitle').textContent=`${currentLabel} frente a ${previousLabel}. Solo se comparan gastos, no ingresos.`;
    $('#habitsSummary').innerHTML=[['Gastos del mes',
    money(curTotal),
    currentLabel],
    ['Mes anterior',
    money(prevTotal),
    previousLabel],
    ['Variación',
    `${diff>0?'+':''}${money(diff)}`,
    pct===null?'Sin base anterior':`${pct>0?'+':''}${pct.toFixed(1)}% frente al mes anterior`]].map((x,
    i)=>`<article class="panel habits-stat"><span>${x[0]}</span><strong class="${i===2&&diff>0?'habits-increase':i===2&&diff<0?'habits-decrease':''}">${x[1]}</strong><small>${x[2]}</small></article>`).join('');
    const rows=cats.map(c=>({
        name:c,
        current:cur[c]||0,
        previous:prev[c]||0,
        diff:(cur[c]||0)-(prev[c]||0)
    }
    )).sort((a,
    b)=>b.diff-a.diff||b.current-a.current);
    $('#habitsCategories').innerHTML=rows.length?rows.map(r=>{
        const change=r.previous?((r.diff/r.previous)*100):null;
        const width=Math.max(r.current,
        r.previous)?Math.min(100,
        r.current/Math.max(r.current,
        r.previous)*100):0;
        return `<article class="habit-category-row"><div class="habit-category-head"><div class="habit-category-name"><span class="expense-icon habit-category-icon" aria-hidden="true">${catIcons[r.name]||'◇'}</span><b>${esc(r.name)}</b></div><span class="habit-change ${r.diff>0?'habits-increase':r.diff<0?'habits-decrease':''}">${r.previous===0?(r.current>0?'Nuevo gasto':'Sin cambio'):`${
            r.diff>0?'+':''
        }
        ${
            money(r.diff)
        }
        · ${
            change>0?'+':''
        }
        ${
            change.toFixed(1)
        }
        %`}</span></div><div class="habit-values"><span>Este mes <b>${money(r.current)}</b></span><span>Anterior <b>${money(r.previous)}</b></span></div><div class="habit-track"><span style="width:${width}%"></span></div></article>`
    }
    ).join(''):'<div class="empty-state">Todavía no hay gastos para comparar en estos meses.</div>';
    const increases=rows.filter(r=>r.diff>0).sort((a,
    b)=>b.diff-a.diff).slice(0,
    4);
    $('#habitsInsights').innerHTML=increases.length?increases.map(r=>`<div class="habit-insight"><span class="expense-icon habit-insight-icon" aria-hidden="true">${catIcons[r.name]||'◇'}</span><div><b>${esc(r.name)} aumentó ${money(r.diff)}</b><p>Pasó de ${money(r.previous)} en ${previousLabel} a ${money(r.current)} en ${currentLabel}.</p></div></div>`).join(''):'<div class="empty-state">No hay categorías con aumento frente al mes anterior. Si no hay datos previos, registra gastos de ambos meses para obtener una comparación más útil.</div>';
}
async function renderReport(){
    try{
        const data=await api('/api/report?type='+state.report);
        state.reportData=data;
        $('#reportTitle').textContent=data.title;
        $('#reportTotal').textContent=money(data.total);
        $('#reportSubtitle').textContent=`Gastos: ${money(data.gastos)} · Ingresos: ${money(data.ingresos)} · Saldo: ${money(data.saldo)}`;
        $('#reportCount').textContent=`${data.items.length} registros`;
        $('#reportRows').innerHTML=data.items.length?[...data.items].sort((a,
        b)=>b.fecha.localeCompare(a.fecha)||b.id-a.id).map(g=>`<tr><td>${g.id}</td><td><div class="expense-description"><span class="expense-icon">${catIcons[g.categoria]||'◇'}</span><div>${esc(g.descripcion)}</div></div></td><td><span class="category-chip">${esc(g.categoria)}</span> <small>${g.tipo==='ingreso'?'Ingreso':'Gasto'}</small></td><td>${fmtDate(g.fecha)}${g.fecha<trackingStart()?'<small class="movement-kind historical-movement">Histórico · no cuenta</small>':''}</td><td class="align-right amount-cell ${g.tipo==='ingreso'?'income-value':''} ${g.fecha<trackingStart()?'historical-amount':''}">${g.tipo==='ingreso'?'+':'−'} ${money(g.monto)}</td></tr>`).join(''):emptyRow(5,
        'No hay movimientos en este período.');
        const max=Math.max(1,
        data.gastos,
        data.ingresos);
        $('#reportCompare').innerHTML=`<div class="compare-row"><span>Ingresos</span><div class="compare-track"><div class="compare-fill income-fill" style="width:${data.ingresos/max*100}%"></div></div><b>${money(data.ingresos)}</b></div><div class="compare-row"><span>Gastos</span><div class="compare-track"><div class="compare-fill" style="width:${data.gastos/max*100}%"></div></div><b>${money(data.gastos)}</b></div>`;
        const cats={
        }
        ;
        data.items.filter(g=>(g.tipo||'gasto')==='gasto').forEach(g=>cats[g.categoria]=(cats[g.categoria]||0)+Number(g.monto));
        $('#reportCategoryBreakdown').innerHTML=Object.entries(cats).sort((a,
        b)=>b[1]-a[1]).slice(0,
        6).map(([c,
        v])=>`<div class="report-cat-row"><span>${esc(c)}</span><b>${money(v)}</b></div>`).join('')||'<p class="muted-small">No hay gastos por categoría en este período.</p>'
    }
    catch(e){
        toast(e.message,
        'error')
    }
}
