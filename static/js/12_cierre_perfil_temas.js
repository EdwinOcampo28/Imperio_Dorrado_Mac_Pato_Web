function buildMonthlyClose(month){
    const movements=countedMovements(state.gastos,
    `${month}-31`).filter(g=>String(g.fecha||'').startsWith(month)),
    expenses=movements.filter(g=>(g.tipo||'gasto')==='gasto'),
    incomes=movements.filter(g=>g.tipo==='ingreso'),
    sum=a=>a.reduce((t,
    g)=>t+Number(g.monto||0),
    0),
    spent=sum(expenses),
    income=sum(incomes),
    budget=Number(state.presupuestos?.mensual||0),
    categories=[...new Set([...state.categories,
    ...Object.keys(state.presupuestos?.categorias||{
    }
    ),
    ...expenses.map(g=>g.categoria)])].map(c=>{
        const limit=Number(state.presupuestos?.categorias?.[c]||0),
        actual=sum(expenses.filter(g=>g.categoria===c));
        return {
            categoria:c,
            presupuesto:limit,
            gastado:actual,
            diferencia:limit-actual
        }
    }
    ).filter(c=>c.presupuesto>0||c.gastado>0);
    return {
        mes:month,
        etiqueta:monthLabel(month),
        cerradoEn:new Date().toISOString(),
        ingresos:income,
        gastos:spent,
        saldo:income-spent,
        presupuesto:budget,
        diferenciaPresupuesto:budget-spent,
        porcentajePresupuesto:budget>0?Math.round(spent/budget*100):null,
        cantidadMovimientos:movements.length,
        categorias:categories
    }
}
function renderMonthlyClose(){
    const input=$('#closeMonth');
    if(!input)return;
    if(!input.value)input.value=todayISO().slice(0,
    7);
    const month=input.value,
    existing=(state.cierres||[]).find(c=>c.mes===month),
    close=existing||buildMonthlyClose(month),
    stats=[['Presupuesto mensual',
    close.presupuesto?money(close.presupuesto):'Sin definir'],
    ['Gasto real',
    money(close.gastos)],
    ['Diferencia',
    close.presupuesto?money(close.diferenciaPresupuesto):'Sin presupuesto'],
    ['Saldo del mes',
    money(close.saldo)]];
    $('#monthlyClosePreview').innerHTML=stats.map(([label,
    value],
    i)=>`<article class="panel close-stat"><span>${label}</span><strong class="${i===2&&close.diferenciaPresupuesto<0?'negative-value':''}">${value}</strong><small>${i===0?'Límite configurado':i===1?`${
        close.cantidadMovimientos
    }
    movimiento(s)`:i===2?(close.diferenciaPresupuesto<0?'Presupuesto excedido':'Disponible frente al presupuesto'):'Ingresos menos gastos'}</small></article>`).join('');
    $('#closeCategoryRows').innerHTML=close.categorias.length?close.categorias.map(c=>`<tr><td>${esc(c.categoria)}</td><td class="align-right">${c.presupuesto?money(c.presupuesto):'—'}</td><td class="align-right">${money(c.gastado)}</td><td class="align-right ${c.diferencia<0?'negative-value':'income-value'}">${c.presupuesto?money(c.diferencia):'—'}</td><td><span class="category-chip">${c.presupuesto?(c.gastado>c.presupuesto?'Excedido':'Dentro del límite'):'Sin presupuesto'}</span></td></tr>`).join(''):emptyRow(5,
    'No hay movimientos ni presupuestos para este mes.');
    const btn=$('#saveMonthlyClose');
    btn.textContent=existing?'Actualizar cierre guardado':'Guardar cierre del mes';
    $('#monthlyCloseHistory').innerHTML=(state.cierres||[]).length?[...state.cierres].sort((a,
    b)=>b.mes.localeCompare(a.mes)).map(c=>`<article class="close-history-row"><div><b>${esc(c.etiqueta||monthLabel(c.mes))}</b><small>Guardado ${fmtDate((c.cerradoEn||'').slice(0,10))} · ${Number(c.cantidadMovimientos)||0} movimiento(s)</small></div><div class="close-history-values"><span>Gastos <b>${money(c.gastos)}</b></span><span>Presupuesto <b>${Number(c.presupuesto)>0?money(c.presupuesto):'Sin definir'}</b></span><span>Saldo <b class="${c.saldo<0?'negative-value':'income-value'}">${money(c.saldo)}</b></span><button class="btn btn-outline" data-view-close="${esc(c.mes)}">Ver</button></div></article>`).join(''):'<p class="muted-small">Todavía no has guardado cierres mensuales.</p>';
}
function saveMonthlyClose(){
    const input=$('#closeMonth'),
    month=input.value;
    if(!/^\d{4}-\d{2}$/.test(month)){
        toast('Selecciona un mes válido.',
        'error');
        return
    }
    const existing=(state.cierres||[]).find(c=>c.mes===month);
    if(existing&&!confirm(`Ya existe un cierre de ${monthLabel(month)}. ¿Quieres actualizarlo con los movimientos y presupuestos actuales?`))return;
    const snapshot=buildMonthlyClose(month);
    const idx=(state.cierres||[]).findIndex(c=>c.mes===month);
    if(idx>=0)state.cierres[idx]=snapshot;
    else state.cierres.push(snapshot);
    localDB.cierres=state.cierres;
    persist();
    renderMonthlyClose();
    logNotificationAction('Cierre mensual guardado',
    `Se guardó el resumen de ${snapshot.etiqueta}.`);
    toast(`Cierre de ${snapshot.etiqueta} guardado correctamente.`)
}
function renderProfile(){
    const saved=JSON.parse(safeGet(AUTH_KEY)||'{}'),
    name=saved.username||'Usuario';
    const nameEl=$('#profileUsername'),
    avatar=$('#profileAvatarLarge'),
    smallAvatar=$('#profileBtn');
    if(nameEl)nameEl.textContent=name;
    if(avatar)avatar.textContent=name.slice(0,
    2).toUpperCase();
    if(smallAvatar)smallAvatar.textContent=name.slice(0,
    2).toUpperCase()
}
function showAuth(){
    authSetup=!safeGet(AUTH_KEY);
    document.body.classList.add('auth-locked');
    $('#authScreen').hidden=false;
    $('#authTitle').textContent=authSetup?'Crea tu acceso personal':'Tu espacio financiero';
    $('#authDescription').textContent=authSetup?'Configura un usuario y una contraseña para proteger el acceso cotidiano.':'Inicia sesión para entrar a tu gestor de gastos.';
    $('#authSubmit').textContent=authSetup?'Crear acceso':'Iniciar sesión';
    $('#authConfirmWrap').hidden=!authSetup;
    $('#authPassword').autocomplete=authSetup?'new-password':'current-password';
    $('#authError').hidden=true;
    $('#authForm').reset();
    $('#authUsername').value=authSetup?'':(JSON.parse(safeGet(AUTH_KEY)||'{}').username||'');
    setTimeout(()=>$('#authUsername').focus(),
    80)
}
function applyTheme(theme){
    const selected=theme==='moka'?'moka':'moka';
    document.body.dataset.theme=selected;
    try{
        safeSet(THEME_KEY,
        selected)
    }
    catch(e){
        /* El tema visual no debe impedir que la aplicación abra. */
    }
}
function unlockApp(){
    safeSessionSet(SESSION_KEY,
    '1');
    document.body.classList.remove('auth-locked');
    $('#authScreen').hidden=true;
    renderProfile()
}
function setupAuth(){
    applyTheme('moka');
    $('#authForm').addEventListener('submit',
    async e=>{
        e.preventDefault();
        const username=$('#authUsername').value.trim(),
        password=$('#authPassword').value;
        const error=$('#authError');
        error.hidden=true;
        if(username.length<2){
            error.textContent='El usuario debe tener al menos 2 caracteres.';
            error.hidden=false;
            return
        }
        if(password.length<4){
            error.textContent='La contraseña debe tener al menos 4 caracteres.';
            error.hidden=false;
            return
        }
        if(authSetup){
            if(password!==$('#authConfirm').value){
                error.textContent='Las contraseñas no coinciden.';
                error.hidden=false;
                return
            }
            safeSet(AUTH_KEY,
            JSON.stringify({
                username,
                passwordHash:await passwordDigest(password)
            }
            ));
            authSetup=false;
            safeSessionSet(SESSION_KEY,
            '1');
            document.body.classList.remove('auth-locked');
            $('#authScreen').hidden=true;
            renderProfile();
            toast('Acceso personal creado.');
            return
        }
        const saved=JSON.parse(safeGet(AUTH_KEY)||'{}');
        if(username!==saved.username||await passwordDigest(password)!==saved.passwordHash){
            error.textContent='Usuario o contraseña incorrectos.';
            error.hidden=false;
            $('#authPassword').select();
            return
        }
        unlockApp()
    }
    );
    const logout=()=>{
        safeSessionRemove(SESSION_KEY);
        showAuth()
    }
    ;
    $('#logoutBtn').addEventListener('click',
    logout);
    $('#profileLogout').addEventListener('click',
    logout);
    $('#profileBtn').addEventListener('click',
    ()=>switchView('profile'));
    const updatePassword=async()=>{
        const saved=JSON.parse(safeGet(AUTH_KEY)||'{}'),
        current=$('#currentPassword').value,
        next=$('#newPassword').value,
        confirmPass=$('#confirmPassword').value;
        if(await passwordDigest(current)!==saved.passwordHash){
            toast('La contraseña actual no es correcta.',
            'error');
            return
        }
        if(next.length<4){
            toast('La nueva contraseña debe tener al menos 4 caracteres.',
            'error');
            return
        }
        if(next!==confirmPass){
            toast('Las nuevas contraseñas no coinciden.',
            'error');
            return
        }
        saved.passwordHash=await passwordDigest(next);
        safeSet(AUTH_KEY,
        JSON.stringify(saved));
        $('#passwordForm').querySelectorAll('input').forEach(input=>input.value='');
        toast('Contraseña actualizada.');
    }
    ;
    $('#passwordSubmit').addEventListener('click',
    updatePassword);
    $('#passwordForm').querySelectorAll('input').forEach(input=>input.addEventListener('keydown',
    e=>{
        if(e.key==='Enter'){
            e.preventDefault();
            updatePassword()
        }
    }
    ));
    if(safeSessionGet(SESSION_KEY)==='1'&&safeGet(AUTH_KEY)){
        document.body.classList.remove('auth-locked');
        $('#authScreen').hidden=true;
        renderProfile()
    }
    else showAuth()
}
