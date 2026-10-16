function switchView(view){
    state.view=view;
    $$('.view').forEach(v=>v.classList.toggle('active',
    v.id===`view-${view}`));
    $$('.nav-link').forEach(b=>b.classList.toggle('active',
    b.dataset.view===view));
    const names={
        dashboard:'Resumen general',
        transactions:'Movimientos',
        reports:'Reportes',
        'spending-habits':'Hábitos de gasto',
        'monthly-close':'Cierre mensual',
        budgets:'Presupuestos',
        goals:'Metas de ahorro',
        alerts:'Alertas',
        notifications:'Notificaciones',
        limits:'Límites',
        profile:'Mi perfil'
    }
    ;
    $('#crumb').textContent=names[view]||'Resumen general';
    $('#sidebar').classList.remove('open');
    if(view==='reports')renderReport();
    if(view==='spending-habits')renderSpendingHabits();
    if(view==='transactions'){
        renderTransactions();
        renderRecurrentes();
    }
    if(view==='budgets')renderBudgets();
    if(view==='goals')renderGoals();
    if(view==='profile')renderProfile();
    if(view==='notifications')renderNotifications();
    if(view==='monthly-close')renderMonthlyClose();
    window.scrollTo({
        top:0,
        behavior:'smooth'
    }
    )
}
function openModal(g=null){
    state.editing=g?g.id:null;
    $('#modalTitle').textContent=g?`Editar ${g.tipo==='ingreso'?'ingreso':'gasto'}`:'Registrar movimiento';
    $('#saveExpense').textContent=g?'Guardar cambios':'Guardar movimiento';
    $('#movementTypeInput').value=g?.tipo||'gasto';
    $('#movementTypeInput').disabled=!!g;
    $('#amountInput').value=g?g.monto:' ';
    $('#amountInput').value=g?g.monto:'';
    $('#categoryInput').innerHTML=[...new Set([...state.categories,
    ...state.gastos.map(x=>x.categoria)])].map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
    $('#categoryInput').value=g?.categoria||state.categories[0]||'Otros';
    syncCategoryForMovement();
    $('#dateInput').value=g?.fecha||todayISO();
    $('#descriptionInput').value=g?.descripcion||'';
    $('#expenseModal').hidden=false;
    setTimeout(()=>$('#amountInput').focus(),
    60)
}
function syncCategoryForMovement(){
    const isIncome=$('#movementTypeInput').value==='ingreso';
    $('#categoryFieldWrap').hidden=isIncome;
    $('#categoryInput').required=!isIncome;
    if(isIncome)$('#categoryInput').value='Ingreso'
}
function closeModal(){
    $('#expenseModal').hidden=true;
    state.editing=null;
    $('#movementTypeInput').disabled=false;
    $('#expenseForm').reset();
    syncCategoryForMovement()
}
function download(name,
content,
type='application/json;charset=utf-8'){
    const blob=new Blob([content],
    {
        type
    }
    );
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),
    1000)
}
function setDuckMotivation(){
    const messages=['Cada peso que cuidas hoy te acerca a una meta mañana.',
    '¡Buen trabajo! Llevar tus cuentas claras también es progreso.',
    'No se trata de gastar menos en todo, sino de elegir mejor.',
    'Pequeños hábitos, grandes metas: sigue llevando el control.',
    'Tu dinero tiene un plan cuando tú decides cómo usarlo.',
    'Celebra cada avance, incluso los ahorros pequeños.'];
    const el=document.getElementById('duckMotivation');
    if(el)el.textContent=messages[Math.floor(Math.random()*messages.length)]
}
function backup(){
    download(`respaldo_gastos_${todayISO()}.json`,
    JSON.stringify({
        app:'Gestor de Gastos - Edwin Ocampo',
        version:6,
        exportado:new Date().toISOString(),
        gastos:state.gastos,
        recurrentes:localDB.recurrentes||[],
        config:state.config,
        alerts:state.alerts,
        notifications:localDB.notifications||[],
        presupuestos:state.presupuestos,
        metas:state.metas,
        cierres:state.cierres
    }
    ,
    null,
    2));
    logNotificationAction('Respaldo descargado',
    'Se generó una copia de seguridad JSON.');
    return true
}
function showConfirm({
    title='Confirmar acción',
    message='',
    confirmText='Continuar',
    tone='normal'
}
={
}
){
    return new Promise(resolve=>{
        const modal=$('#actionConfirmModal');
        $('#actionConfirmTitle').textContent=title;
        $('#actionConfirmMessage').textContent=message;
        const yes=$('#actionConfirmYes'),
        no=$('#actionConfirmNo'),
        close=$('#actionConfirmClose');
        yes.textContent=confirmText;
        yes.classList.toggle('btn-danger',
        tone==='danger');
        yes.classList.toggle('btn-primary',
        tone!=='danger');
        modal.hidden=false;
        const finish=value=>{
            modal.hidden=true;
            yes.removeEventListener('click',
            onYes);
            no.removeEventListener('click',
            onNo);
            close.removeEventListener('click',
            onNo);
            modal.removeEventListener('click',
            onBackdrop);
            document.removeEventListener('keydown',
            onKey);
            resolve(value)
        }
        ;
        const onYes=()=>finish(true),
        onNo=()=>finish(false),
        onBackdrop=e=>{
            if(e.target===modal)finish(false)
        }
        ,
        onKey=e=>{
            if(e.key==='Escape')finish(false)
        }
        ;
        yes.addEventListener('click',
        onYes);
        no.addEventListener('click',
        onNo);
        close.addEventListener('click',
        onNo);
        modal.addEventListener('click',
        onBackdrop);
        document.addEventListener('keydown',
        onKey);
        no.focus()
    }
    )
}
