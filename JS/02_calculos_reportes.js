function calcDashboard(){
    const today=todayISO(),
    gs=countedMovements(localDB.gastos,
    today),
    expenses=gs.filter(g=>(g.tipo||'gasto')==='gasto'),
    income=gs.filter(g=>g.tipo==='ingreso'),
    now=new Date(),
    month=today.slice(0,
    7),
    weekStart=iso(startOfWeek(now));
    const sum=a=>a.reduce((s,
    g)=>s+Number(g.monto||0),
    0);
    const todayGs=expenses.filter(g=>g.fecha===today),
    weekGs=expenses.filter(g=>g.fecha>=weekStart&&g.fecha<=today),
    monthGs=expenses.filter(g=>g.fecha.startsWith(month)),
    monthIncome=income.filter(g=>g.fecha.startsWith(month));
    const dates=[...new Set(expenses.map(g=>g.fecha))];
    const weeks=[...new Set(expenses.map(g=>{
        const d=new Date(g.fecha+'T12:00:00');
        d.setDate(d.getDate()-((d.getDay()+6)%7));
        return iso(d)
    }
    ))];
    const total=sum(expenses),
    dailyAvg=dates.length?total/dates.length:0,
    weeklyAvg=weeks.length?total/weeks.length:0;
    const by_category={
    }
    ;
    expenses.forEach(g=>by_category[g.categoria]=(by_category[g.categoria]||0)+Number(g.monto||0));
    const last7=[];
    for(let i=6;
    i>=0;
    i--){
        const d=new Date();
        d.setDate(d.getDate()-i);
        const date=iso(d);
        last7.push({
            date,
            total:sum(expenses.filter(g=>g.fecha===date)),
            income:sum(income.filter(g=>g.fecha===date))
        }
        )
    }
    const prevDate=new Date(now.getFullYear(),
    now.getMonth()-1,
    1),
    prevMonth=iso(prevDate).slice(0,
    7);
    const prevTotal=sum(expenses.filter(g=>g.fecha.startsWith(prevMonth)));
    return {
        total,
        count:expenses.length,
        month_total:sum(monthGs),
        month_count:monthGs.length,
        week_total:sum(weekGs),
        average_daily:dailyAvg,
        average_weekly:weeklyAvg,
        last7,
        by_category,
        today_total:sum(todayGs),
        daily_limit:Number(localDB.config.limite_diario)||0,
        weekly_limit:Number(localDB.config.limite_semanal)||0,
        income_total:sum(income),
        income_month:sum(monthIncome),
        balance_available:sum(income)-total,
        net_month:sum(monthIncome)-sum(monthGs),
        previous_month_total:prevTotal,
        expenses:sum(expenses)
    }
}
function reportData(type){
    const today=todayISO(),
    d=new Date();
    let start=today,
    title='Reporte diario';
    if(type==='weekly'){
        start=iso(startOfWeek(d));
        title='Reporte semanal'
    }
    if(type==='monthly'){
        start=today.slice(0,
        7)+'-01';
        title='Reporte mensual'
    }
    const items=countedMovements(localDB.gastos,
    today).filter(g=>g.fecha>=start&&g.fecha<=today&&(type!=='monthly'||g.fecha.startsWith(today.slice(0,
    7))));
    const gastos=items.filter(g=>(g.tipo||'gasto')==='gasto').reduce((s,
    g)=>s+Number(g.monto||0),
    0),
    ingresos=items.filter(g=>g.tipo==='ingreso').reduce((s,
    g)=>s+Number(g.monto||0),
    0);
    return {
        type,
        title,
        total:gastos,
        ingresos,
        gastos,
        saldo:ingresos-gastos,
        items
    }
}
