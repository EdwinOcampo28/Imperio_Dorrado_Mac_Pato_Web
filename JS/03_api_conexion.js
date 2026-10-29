function makeLimitAlerts(){
    const today=todayISO(),weekStart=iso(startOfWeek(new Date())),month=today.slice(0,7),expenses=countedMovements(localDB.gastos,today).filter(g=>(g.tipo||'gasto')==='gasto'),sum=items=>items.reduce((n,g)=>n+Number(g.monto||0),0),config=localDB.config||{},checks=[];
    const dailyLimit=Number(config.limite_diario)||0,weeklyLimit=Number(config.limite_semanal)||0;
    if(dailyLimit>0)checks.push({key:`daily:${today}:${dailyLimit}`,tipo:'Diario',categoria:'General',spent:sum(expenses.filter(g=>g.fecha===today)),limit:dailyLimit,period:today,label:'tope diario'});
    if(weeklyLimit>0)checks.push({key:`weekly:${weekStart}:${weeklyLimit}`,tipo:'Semanal',categoria:'General',spent:sum(expenses.filter(g=>g.fecha>=weekStart&&g.fecha<=today)),limit:weeklyLimit,period:weekStart,label:'tope semanal'});
    for(const [category,value] of Object.entries(config.limites_categoria_mensuales||{})){
        const limit=Number(value)||0;
        if(limit>0)checks.push({key:`category:${month}:${category}:${limit}`,tipo:'Mensual por categoría',categoria:category,spent:sum(expenses.filter(g=>g.categoria===category&&g.fecha.startsWith(month))),limit,period:month,label:`tope mensual de ${category}`});
    }
    const created=[];
    for(const check of checks){
        if(check.spent<=check.limit||localDB.alerts.some(a=>a.clave===check.key))continue;
        const alert={id:Date.now()+created.length,clave:check.key,tipo:check.tipo,categoria:check.categoria,fecha:today,periodo:check.period,monto:check.spent,limite:check.limit,promedio:0,mensaje:`Superaste el ${check.label}: llevas ${money(check.spent)} de ${money(check.limit)}.`};
        localDB.alerts.push(alert);created.push(alert);
        localDB.notifications=Array.isArray(localDB.notifications)?localDB.notifications:[];
        localDB.notifications.unshift({id:`alert-${alert.id}`,fecha:new Date().toISOString(),type:'warning',title:`Límite ${check.tipo.toLowerCase()} superado`,message:alert.mensaje,leida:false});
    }
    if(created.length){localDB.notifications=localDB.notifications.slice(0,300);persist()}
    return created
}
async function apiLocal(url,
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
        cierres:localDB.cierres,
        pendientes:localDB.pendientes||[],
        alerts_created:makeLimitAlerts()
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
        const alerts_created=g.tipo==='gasto'?makeLimitAlerts():[];
        persist();
        return {
            gasto:g,
            alerts_created
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
            const alerts_created=localDB.gastos[i].tipo==='gasto'?makeLimitAlerts():[];
            persist();
            return {
                gasto:localDB.gastos[i],
                alerts_created
            }
        }
    }
    if(path==='/api/config'&&method==='POST'){
        localDB.config={
            ...localDB.config,
            ...body,
            limites_categoria_mensuales:body.limites_categoria_mensuales||localDB.config.limites_categoria_mensuales||{}
        }
        ;
        persist();
        const alerts_created=makeLimitAlerts();
        return {
            config:localDB.config,
            alerts:localDB.alerts,
            notifications:localDB.notifications,
            alerts_created
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
        if(localDB.alerts[id])localDB.alerts[id].eliminada=true;
        persist();
        return {
            gastos:localDB.gastos,
            categories:[],
            config:localDB.config,
            alerts:localDB.alerts,
            dashboard:calcDashboard()
        }
    }
    if(path==='/api/pending'&&method==='POST'){
        const persona=String(body.persona||'').trim(),monto=Number(body.monto),concepto=String(body.concepto||'').trim();
        if(persona.length<2||!(monto>0))throw Error('Escribe el nombre de la persona y un monto mayor que cero.');
        const pending={id:Date.now(),persona,concepto,monto,abonado:0,fecha:String(body.fecha||todayISO()),fechaVencimiento:String(body.fechaVencimiento||''),notas:String(body.notas||'').trim(),pagos:[]};
        localDB.pendientes=Array.isArray(localDB.pendientes)?localDB.pendientes:[];localDB.pendientes.push(pending);persist();return {pendientes:localDB.pendientes}
    }
    let pm=path.match(/^\/api\/pending\/(\d+)$/);
    if(pm){
        const idx=(localDB.pendientes||[]).findIndex(x=>Number(x.id)===Number(pm[1]));
        if(idx<0)throw Error('No se encontró el saldo pendiente.');
        if(method==='DELETE'){localDB.pendientes.splice(idx,1);persist();return {pendientes:localDB.pendientes}}
        if(method==='POST'){
            const item=localDB.pendientes[idx],due=Math.max(0,Number(item.monto)-Number(item.abonado||0)),abono=Number(body.abono);
            if(!(abono>0)||abono>due)throw Error(`El abono debe ser mayor que cero y no superar ${money(due)}.`);
            item.abonado=Number(item.abonado||0)+abono;item.pagos=Array.isArray(item.pagos)?item.pagos:[];item.pagos.push({monto:abono,fecha:todayISO()});persist();return {pendientes:localDB.pendientes}
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
        if(Array.isArray(body.pendientes))localDB.pendientes=body.pendientes;
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
            cierres:localDB.cierres,
            pendientes:localDB.pendientes||[]
        }
    }
    throw Error('Acción no disponible en esta versión local.')
}

// When served by server.py, SQLite is the durable store. Opening index.html directly
// keeps the original browser-local storage behavior.
function databaseModeEnabled(){
    return typeof location!=='undefined'&&location.protocol==='http:'&&['127.0.0.1','localhost'].includes(location.hostname)
}
let databaseReady=false;
let databaseWriteQueue=Promise.resolve();
let databaseWriteError=null;
function databaseHasRecords(snapshot){
    if(!snapshot)return false;
    const config=snapshot.config||{},
    limits=config.limites_categoria_mensuales||{},
    categoryBudgets=snapshot.presupuestos?.categorias||{};
    const configChanged=Number(config.limite_diario)>0||
    Number(config.limite_semanal)>0||
    Object.entries(limits).some(([,value])=>Number(value)>0)||
    (config.fecha_inicio_control&&config.fecha_inicio_control!==TRACKING_START_DEFAULT);
    return !!(
        (Array.isArray(snapshot.gastos)&&snapshot.gastos.length>0)||
        (Array.isArray(snapshot.recurrentes)&&snapshot.recurrentes.length>0)||
        (Array.isArray(snapshot.notifications)&&snapshot.notifications.length>0)||
        (Array.isArray(snapshot.alerts)&&snapshot.alerts.length>0)||
        (Array.isArray(snapshot.metas)&&snapshot.metas.length>0)||
        (Array.isArray(snapshot.pendientes)&&snapshot.pendientes.length>0)||
        (Array.isArray(snapshot.cierres)&&snapshot.cierres.length>0)||
        Number(snapshot.presupuestos?.mensual)>0||
        Object.keys(categoryBudgets).length>0||
        configChanged
    )
}function hydrateLocalDatabase(snapshot){
    localDB.gastos=Array.isArray(snapshot.gastos)?snapshot.gastos:[];
    localDB.recurrentes=Array.isArray(snapshot.recurrentes)?snapshot.recurrentes:[];
    localDB.notifications=Array.isArray(snapshot.notifications)?snapshot.notifications:[];
    localDB.alerts=Array.isArray(snapshot.alerts)?snapshot.alerts:[];
    localDB.config={...DEFAULT_CONFIG,...(snapshot.config||{}),limites_categoria:{...(DEFAULT_CONFIG.limites_categoria||{}),...(snapshot.config?.limites_categoria||{})},limites_categoria_mensuales:{...(DEFAULT_CONFIG.limites_categoria_mensuales||{}),...(snapshot.config?.limites_categoria_mensuales||{})}};
    localDB.presupuestos=snapshot.presupuestos&&typeof snapshot.presupuestos==='object'?snapshot.presupuestos:{mensual:0,categorias:{}};
    localDB.metas=Array.isArray(snapshot.metas)?snapshot.metas:[];
    localDB.pendientes=Array.isArray(snapshot.pendientes)?snapshot.pendientes:[];
    localDB.cierres=Array.isArray(snapshot.cierres)?snapshot.cierres:[]
}
async function requestDatabase(method,body){
    const response=await fetch('/api/state',{
        method,
        headers:{'Content-Type':'application/json'},
        ...(body===undefined?{}:{body})
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(payload.error||`Error de base de datos (${response.status}).`);
    return payload
}
function queueDatabaseSave(serialized=JSON.stringify(localDB)){
    if(!databaseModeEnabled()||!databaseReady)return;
    databaseWriteQueue=databaseWriteQueue.catch(()=>{}).then(async()=>{
        await requestDatabase('PUT',serialized);
        databaseWriteError=null
    }).catch(error=>{
        databaseWriteError=error;
        console.error('No se pudo guardar en SQLite:',error)
    })
}
async function flushDatabaseWrites(){
    await databaseWriteQueue;
    if(databaseWriteError){
        const error=databaseWriteError;
        databaseWriteError=null;
        throw error
    }
}
async function connectDatabase(){
    if(!databaseModeEnabled()||databaseReady)return;
    const result=await requestDatabase('GET');
    if(result.initialized&&result.state){
        let browserSnapshot=null;
        try{browserSnapshot=storedBeforeMigration?JSON.parse(storedBeforeMigration):null}catch(e){}
        const browserHasData=databaseHasRecords(browserSnapshot),
        sqliteHasData=databaseHasRecords(result.state);
        if(browserHasData&&sqliteHasData){
            const useBrowser=confirm('Encontré datos guardados en este navegador y datos en la base SQLite. ¿Quieres transferir los datos del navegador a SQLite?\n\nAceptar: conserva los datos del navegador y reemplaza la base SQLite.\nCancelar: abre la base SQLite y deja el almacenamiento anterior del navegador intacto.');
            if(useBrowser){
                hydrateLocalDatabase(browserSnapshot);
                databaseReady=true;
                await requestDatabase('PUT',JSON.stringify(localDB));
                return
            }
        }
        if(browserHasData&&!sqliteHasData){
            hydrateLocalDatabase(browserSnapshot);
            databaseReady=true;
            await requestDatabase('PUT',JSON.stringify(localDB));
            return
        }
        hydrateLocalDatabase(result.state);
        databaseReady=true;
        return
    }
    databaseReady=true;
    await requestDatabase('PUT',JSON.stringify(localDB))
}
async function api(url,opts={}){
    if(!databaseModeEnabled())return apiLocal(url,opts);
    await connectDatabase();
    const result=await apiLocal(url,opts);
    if((opts.method||'GET').toUpperCase()!=='GET'||result.alerts_created?.length)await flushDatabaseWrites();
    return result
}
