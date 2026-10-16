async function api(url,
opts={
}
){
    const method=(opts.method||'GET').toUpperCase(),
    body=opts.body?JSON.parse(opts.body):{
    }
    ,
    path=url.split('?')[0],
    query=new URLSearchParams(url.split('?')[1]||'');
    if(path==='/api/init')return {
        gastos:localDB.gastos,
        categories:['Comida',
        'Transporte',
        'Servicios',
        'Educación',
        'Entretenimiento',
        'Salud',
        'Ropa',
        'Mascotas',
        'Hogar',
        'Deudas',
        'Otros'],
        config:localDB.config,
        alerts:localDB.alerts,
        notifications:localDB.notifications||[],
        dashboard:calcDashboard(),
        presupuestos:localDB.presupuestos,
        metas:localDB.metas,
        cierres:localDB.cierres
    }
    ;
    if(path==='/api/report')return reportData(query.get('type')||'daily');
    if(path==='/api/gastos'&&method==='POST'){
        const g={
            id:Math.max(0,
            ...localDB.gastos.map(x=>Number(x.id)||0))+1,
            monto:Number(body.monto),
            tipo:body.tipo==='ingreso'?'ingreso':'gasto',
            categoria:String(body.categoria||'Otros'),
            descripcion:String(body.descripcion||'').trim(),
            fecha:String(body.fecha||todayISO())
        }
        ;
        if(!(g.monto>0)||!g.descripcion||!/^\d{4}-\d{2}-\d{2}$/.test(g.fecha))throw Error('Completa todos los campos con datos válidos.');
        localDB.gastos.push(g);
        persist();
        return {
            gasto:g,
            alerts_created:[]
        }
    }
    let m=path.match(/^\/api\/gastos\/(\d+)(?:\/edit)?$/);
    if(m){
        const id=Number(m[1]),
        i=localDB.gastos.findIndex(g=>Number(g.id)===id);
        if(method==='DELETE'){
            if(i>=0)localDB.gastos.splice(i,
            1);
            persist();
            return {
                gastos:localDB.gastos
            }
        }
        if(method==='POST'){
            if(i<0)throw Error('No se encontró el movimiento.');
            localDB.gastos[i]={
                ...localDB.gastos[i],
                monto:Number(body.monto),
                tipo:body.tipo==='ingreso'?'ingreso':'gasto',
                categoria:String(body.categoria||'Otros'),
                descripcion:String(body.descripcion||'').trim(),
                fecha:String(body.fecha)
            }
            ;
            if(!(localDB.gastos[i].monto>0)||!localDB.gastos[i].descripcion)throw Error('Revisa el monto y la descripción.');
            persist();
            return {
                gasto:localDB.gastos[i],
                alerts_created:[]
            }
        }
    }
    if(path==='/api/config'&&method==='POST'){
        localDB.config={
            ...localDB.config,
            ...body,
            limites_categoria:body.limites_categoria||localDB.config.limites_categoria||{
            }
        }
        ;
        persist();
        return {
            config:localDB.config
        }
    }
    if(path==='/api/budgets'&&method==='POST'){
        const mensual=Math.max(0,
        Number(body.mensual)||0),
        categorias={
        }
        ;
        for(const [k,
        v] of Object.entries(body.categorias||{
        }
        ))categorias[k]=Math.max(0,
        Number(v)||0);
        localDB.presupuestos={
            mensual,
            categorias
        }
        ;
        persist();
        return localDB.presupuestos
    }
    if(path==='/api/goals'&&method==='POST'){
        const name=String(body.nombre||'').trim(),
        objetivo=Number(body.objetivo),
        ahorrado=Number(body.ahorrado)||0;
        if(name.length<2||!(objetivo>0)||ahorrado<0)throw Error('Revisa el nombre y los montos de la meta.');
        const initial=Math.min(ahorrado,
        objetivo);
        const goal={
            id:Date.now(),
            nombre:name,
            objetivo,
            ahorrado:initial,
            fecha:String(body.fecha||''),
            aportes:initial>0?[{
                monto:initial,
                fecha:todayISO(),
                tipo:'inicial'
            }
            ]:[]
        }
        ;
        localDB.metas.push(goal);
        persist();
        return {
            metas:localDB.metas
        }
    }
    let gm=path.match(/^\/api\/goals\/(\d+)$/);
    if(gm){
        const idx=localDB.metas.findIndex(g=>g.id===Number(gm[1]));
        if(idx<0)throw Error('No se encontró la meta.');
        if(method==='DELETE'){
            localDB.metas.splice(idx,
            1);
            persist();
            return {
                metas:localDB.metas
            }
        }
        if(method==='POST'){
            const aporte=Number(body.aporte);
            if(!(aporte>0))throw Error('El aporte debe ser mayor que cero.');
            const goal=localDB.metas[idx];
            goal.aportes=Array.isArray(goal.aportes)?goal.aportes:[];
            const aplicado=Math.min(aporte,
            Math.max(0,
            Number(goal.objetivo)-Number(goal.ahorrado)));
            if(aplicado<=0)throw Error('La meta ya alcanzó su objetivo.');
            goal.ahorrado=Number(goal.ahorrado)+aplicado;
            goal.aportes.push({
                monto:aplicado,
                fecha:todayISO(),
                tipo:'aporte'
            }
            );
            persist();
            return {
                metas:localDB.metas
            }
        }
    }
    if(path.startsWith('/api/alerts/')&&method==='DELETE'){
        const id=Number(path.split('/').pop());
        localDB.alerts.splice(id,
        1);
        persist();
        return {
            gastos:localDB.gastos,
            categories:[],
            config:localDB.config,
            alerts:localDB.alerts,
            dashboard:calcDashboard()
        }
    }
    if(path==='/api/export-report')return {
        filename:`reporte_${body.type||'diario'}_${todayISO()}.json`,
        report:reportData(body.type||'daily')
    }
    ;
    if(path==='/api/import'&&method==='POST'){
        if(!Array.isArray(body.gastos))throw Error('El respaldo no contiene movimientos válidos.');
        localDB.gastos=body.gastos.map((g,
        i)=>({
            ...g,
            id:Number(g.id)||i+1,
            monto:Number(g.monto),
            tipo:g.tipo==='ingreso'?'ingreso':'gasto'
        }
        )).filter(g=>g.monto>0&&g.descripcion&&g.fecha);
        if(body.config)localDB.config={
            ...DEFAULT_CONFIG,
            ...body.config,
            fecha_inicio_control:body.config.fecha_inicio_control||TRACKING_START_DEFAULT
        }
        ;
        if(Array.isArray(body.alerts))localDB.alerts=body.alerts;
        if(Array.isArray(body.notifications))localDB.notifications=body.notifications;
        if(body.presupuestos)localDB.presupuestos=body.presupuestos;
        if(Array.isArray(body.metas))localDB.metas=body.metas;
        if(Array.isArray(body.cierres))localDB.cierres=body.cierres;
        persist();
        return {
            gastos:localDB.gastos,
            categories:[],
            config:localDB.config,
            alerts:localDB.alerts,
            notifications:localDB.notifications||[],
            dashboard:calcDashboard(),
            presupuestos:localDB.presupuestos,
            metas:localDB.metas,
            cierres:localDB.cierres
        }
    }
    throw Error('Acción no disponible en esta versión local.')
}
