async function init(){
    setDuckMotivation();
    try{
        setupAuth();
        await refresh();
        if($('#recurringNextDate'))$('#recurringNextDate').value=todayISO();
        if($('#recurringList'))renderRecurrentes();
        const d=new Date();
        $('#todayLabel').textContent=d.toLocaleDateString('es-CO',
        {
            weekday:'short',
            day:'numeric',
            month:'short',
            year:'numeric'
        }
        );
        $$('[data-view]').forEach(b=>b.addEventListener('click',
        ()=>switchView(b.dataset.view)));
        $$('[data-goto]').forEach(b=>b.addEventListener('click',
        ()=>switchView(b.dataset.goto)));
        $('#addFromDash').onclick=$('#addFromList').onclick=()=>openModal();
        $('#closeModal').onclick=$('#cancelModal').onclick=closeModal;
        $('#expenseModal').addEventListener('click',
        e=>{
            if(e.target===$('#expenseModal'))closeModal()
        }
        );
        document.addEventListener('keydown',
        e=>{
            if(e.key==='Escape')closeModal()
        }
        );
        $('#mobileMenu').onclick=()=>$('#sidebar').classList.toggle('open');
        $('#movementTypeInput').addEventListener('change',
        syncCategoryForMovement);
        $('#recurringForm').addEventListener('submit',
        e=>{
            e.preventDefault();
            const editId=$('#recurringId').value;
            const item={
                nombre:$('#recurringName').value.trim(),
                monto:Number($('#recurringAmount').value),
                categoria:$('#recurringCategory').value,
                frecuencia:$('#recurringFrequency').value,
                proximaFecha:$('#recurringNextDate').value
            }
            ;
            if(!item.nombre||!(item.monto>0)||!/^\d{4}-\d{2}-\d{2}$/.test(item.proximaFecha)){
                toast('Revisa el concepto, monto y próxima fecha.',
                'error');
                return
            }
            localDB.recurrentes=Array.isArray(localDB.recurrentes)?localDB.recurrentes:[];
            if(editId){
                const index=localDB.recurrentes.findIndex(r=>String(r.id)===editId);
                if(index<0){
                    toast('No encontré ese pago recurrente. Actualiza la lista e inténtalo de nuevo.','error');
                    resetRecurringForm();
                    return
                }
                item.id=localDB.recurrentes[index].id;
                localDB.recurrentes[index]={...localDB.recurrentes[index],...item};
            }else{
                item.id=Date.now();
                localDB.recurrentes.push(item);
            }
            persist();
            resetRecurringForm();
            renderRecurrentes();
            if(editId){
                logNotificationAction('Pago recurrente actualizado',`${item.nombre} · ${money(item.monto)}.`);
                toast('Cambios del pago recurrente guardados.');
            }else{
                logNotificationAction('Gasto recurrente programado',`${item.nombre} · ${money(item.monto)}.`);
                toast('Gasto recurrente programado.');
            }
        }
        );
        $('#cancelRecurringEdit').addEventListener('click',resetRecurringForm);
        $('#recurringList').addEventListener('click',
        async e=>{
            const register=e.target.closest('[data-recurring-register]'),
            edit=e.target.closest('[data-recurring-edit]'),
            del=e.target.closest('[data-recurring-delete]');
            if(edit){
                editRecurringItem(edit.dataset.recurringEdit);
                return
            }
            if(del){
                if($('#recurringId').value===del.dataset.recurringDelete)resetRecurringForm();
                localDB.recurrentes=(localDB.recurrentes||[]).filter(r=>String(r.id)!==del.dataset.recurringDelete);
                persist();
                renderRecurrentes();
                toast('Gasto recurrente eliminado.');
                return
            }
            if(register){
                const r=(localDB.recurrentes||[]).find(x=>String(x.id)===register.dataset.recurringRegister);
                if(!r)return;
                try{
                    await api('/api/gastos',
                    {
                        method:'POST',
                        body:JSON.stringify({
                            monto:r.monto,
                            tipo:'gasto',
                            categoria:r.categoria,
                            fecha:todayISO(),
                            descripcion:r.nombre
                        }
                        )
                    }
                    );
                    r.proximaFecha=nextRecurringDate(r.proximaFecha,
                    r.frecuencia);
                    persist();
                    await refresh();
                    renderRecurrentes();
                    logNotificationAction('Gasto recurrente registrado',
                    `${r.nombre} · ${money(r.monto)}.`);
                    toast('Gasto registrado y próxima fecha actualizada.')
                }
                catch(err){
                    toast(err.message,
                    'error')
                }
            }
        }
        );
        $('#searchInput').addEventListener('input',
        renderTransactions);
        $('#categoryFilter').addEventListener('change',
        renderTransactions);
        $('#monthFilter').addEventListener('change',
        renderTransactions);
        if($('#typeFilter'))$('#typeFilter').addEventListener('change',
        renderTransactions);
        $('#clearFilters').onclick=()=>{
            $('#searchInput').value='';
            $('#categoryFilter').value='';
            $('#monthFilter').value='';
            if($('#typeFilter'))$('#typeFilter').value='';
            renderTransactions()
        }
        ;
        $('#allRows').addEventListener('click',
        async e=>{
            const edit=e.target.closest('[data-edit]'),
            del=e.target.closest('[data-delete]');
            if(edit){
                const g=state.gastos.find(x=>x.id===Number(edit.dataset.edit));
                if(g)openModal(g)
            }
            if(del){
                const g=state.gastos.find(x=>x.id===Number(del.dataset.delete));
                if(g&&confirm(`¿Eliminar el gasto “${g.descripcion}” por ${money(g.monto)}? Esta acción no se puede deshacer.`)){
                    try{
                        setData(await api('/api/gastos/'+g.id,
                        {
                            method:'DELETE'
                        }
                        ));
                        await refresh();
                        logNotificationAction('Movimiento eliminado',
                        `${g.descripcion} · ${money(g.monto)}.`,
                        'warning');
                        toast('Gasto eliminado correctamente.')
                    }
                    catch(err){
                        toast(err.message,
                        'error')
                    }
                }
            }
        }
        );
        $('#expenseForm').addEventListener('submit',
        async e=>{
            e.preventDefault();
            const payload={
                monto:$('#amountInput').value,
                tipo:$('#movementTypeInput').value,
                categoria:$('#movementTypeInput').value==='ingreso'?'Ingreso':$('#categoryInput').value,
                fecha:$('#dateInput').value,
                descripcion:$('#descriptionInput').value.trim()
            }
            ;
            try{
                const endpoint=state.editing?`/api/gastos/${state.editing}/edit`:'/api/gastos';
                const result=await api(endpoint,
                {
                    method:'POST',
                    body:JSON.stringify(payload)
                }
                );
                closeModal();
                await refresh();
                if(state.view==='reports')await renderReport();
                toast(state.editing?'Movimiento actualizado.':'Movimiento registrado correctamente.');
                logNotificationAction(state.editing?'Movimiento actualizado':'Movimiento registrado',
                `${payload.tipo==='ingreso'?'Ingreso':'Gasto'}: ${payload.descripcion} · ${money(payload.monto)}.`);
                if(result.alerts_created?.length)toast(`Se generaron ${result.alerts_created.length} alerta(s) de gasto.`,
                'error')
            }
            catch(err){
                toast(err.message,
                'error')
            }
        }
        );
        $$('[data-report]').forEach(b=>b.addEventListener('click',
        ()=>{
            state.report=b.dataset.report;
            $$('[data-report]').forEach(x=>x.classList.toggle('active',
            x===b));
            renderReport()
        }
        ));
        $('#budgetForm').addEventListener('submit',
        async e=>{
            e.preventDefault();
            const categorias={
            }
            ;
            $$('[data-budget-cat]').forEach(i=>categorias[i.dataset.budgetCat]=Number(i.value)||0);
            try{
                state.presupuestos=await api('/api/budgets',
                {
                    method:'POST',
                    body:JSON.stringify({
                        mensual:Number($('#monthlyBudget').value)||0,
                        categorias
                    }
                    )
                }
                );
                renderBudgets();
                renderDashboard();
                logNotificationAction('Presupuestos actualizados',
                'Se guardaron los límites mensuales y por categoría.');
                toast('Presupuestos guardados.')
            }
            catch(err){
                toast(err.message,
                'error')
            }
        }
        );
        $('#goalForm').addEventListener('submit',
        async e=>{
            e.preventDefault();
            try{
                const r=await api('/api/goals',
                {
                    method:'POST',
                    body:JSON.stringify({
                        nombre:$('#goalName').value,
                        objetivo:$('#goalTarget').value,
                        ahorrado:$('#goalSaved').value,
                        fecha:$('#goalDate').value
                    }
                    )
                }
                );
                state.metas=r.metas;
                $('#goalForm').reset();
                $('#goalSaved').value='0';
                renderGoals();
                logNotificationAction('Meta de ahorro creada',
                `${$('#goalName').value || 'Nueva meta'} quedó registrada.`);
                toast('Meta de ahorro creada.')
            }
            catch(err){
                toast(err.message,
                'error')
            }
        }
        );
        $('#goalsList').addEventListener('submit',
        async e=>{
            const form=e.target.closest('[data-goal-form]');
            if(!form)return;
            e.preventDefault();
            try{
                const r=await api('/api/goals/'+form.dataset.goalForm,
                {
                    method:'POST',
                    body:JSON.stringify({
                        aporte:form.elements.aporte.value
                    }
                    )
                }
                );
                state.metas=r.metas;
                renderGoals();
                logNotificationAction('Aporte de ahorro registrado',
                'Se añadió un aporte a una de tus metas.');
                toast('Aporte registrado.')
            }
            catch(err){
                toast(err.message,
                'error')
            }
        }
        );
        $('#goalsList').addEventListener('click',
        async e=>{
            const contributions=e.target.closest('[data-goal-contributions]');
            if(contributions){
                const card=contributions.closest('.goal-card'),showAll=contributions.getAttribute('aria-expanded')!=='true';
                card.querySelector('.contribution-top-three').hidden=showAll;
                card.querySelector('.contribution-history').hidden=!showAll;
                contributions.setAttribute('aria-expanded',String(showAll));
                contributions.textContent=showAll?'Mostrar los 3 mayores':'Ver todos los aportes';
                return
            }
            const b=e.target.closest('[data-goal-delete]');
            if(!b)return;
            const goal=state.metas.find(g=>g.id===Number(b.dataset.goalDelete));
            if(!goal||!confirm(`¿Eliminar la meta ${goal.nombre}?`))return;
            try{
                const r=await api('/api/goals/'+goal.id,
                {
                    method:'DELETE'
                }
                );
                state.metas=r.metas;
                renderGoals();
                logNotificationAction('Meta eliminada',
                `Se eliminó la meta ${goal.nombre}.`,
                'warning');
                toast('Meta eliminada.')
            }
            catch(err){
                toast(err.message,
                'error')
            }
        }
        );
        $('#pendingForm').addEventListener('submit',async e=>{
            e.preventDefault();
            const persona=$('#pendingPerson').value.trim();
            try{
                const r=await api('/api/pending',{method:'POST',body:JSON.stringify({persona,monto:$('#pendingAmount').value,concepto:$('#pendingConcept').value,fecha:todayISO(),fechaVencimiento:$('#pendingDueDate').value,notas:$('#pendingNotes').value})});
                state.pendientes=r.pendientes;$('#pendingForm').reset();renderPendingBalances();toast(`Saldo pendiente de ${persona} registrado por separado.`)
            }catch(err){toast(err.message,'error')}
        });
        $('#pendingList').addEventListener('submit',async e=>{
            const form=e.target.closest('[data-pending-payment]');if(!form)return;e.preventDefault();
            try{const r=await api('/api/pending/'+form.dataset.pendingPayment,{method:'POST',body:JSON.stringify({abono:form.elements.abono.value})});state.pendientes=r.pendientes;renderPendingBalances();toast('Abono registrado. El saldo pendiente se actualizó.')}
            catch(err){toast(err.message,'error')}
        });
        $('#pendingList').addEventListener('click',async e=>{
            const button=e.target.closest('[data-pending-delete]');if(!button)return;
            const item=state.pendientes.find(x=>Number(x.id)===Number(button.dataset.pendingDelete));
            if(!item||!confirm(`¿Eliminar el saldo pendiente de ${item.persona}?`))return;
            try{const r=await api('/api/pending/'+item.id,{method:'DELETE'});state.pendientes=r.pendientes;renderPendingBalances();toast('Saldo pendiente eliminado.')}
            catch(err){toast(err.message,'error')}
        });
        $('#alertsList').addEventListener('click',
        async e=>{
            const b=e.target.closest('[data-alert-delete]');
            if(!b)return;
            try{
                setData(await api('/api/alerts/'+b.dataset.alertDelete,
                {
                    method:'DELETE'
                }
                ));
                renderAlerts();
                $('#alertBadge').textContent=activeAlerts().length;
                updateNotificationBadge();
                $('#alertsCountHead').textContent=`${activeAlerts().length} ${activeAlerts().length===1?'alerta':'alertas'}`;
                toast('Alerta eliminada.')
            }
            catch(err){
                toast(err.message,
                'error')
            }
        }
        );
        $('#settingsForm').addEventListener('submit',
        async e=>{
            e.preventDefault();
            const limits={
            }
            ;
            $$('[data-cat-limit]').forEach(i=>limits[i.dataset.catLimit]=Number(i.value)||0);
            try{
                const d=await api('/api/config',
                {
                    method:'POST',
                    body:JSON.stringify({
                        limite_diario:Number($('#dailyLimit').value)||0,
                        limite_semanal:Number($('#weeklyLimit').value)||0,
                        limites_categoria_mensuales:limits
                    }
                    )
                }
                );
                state.config=d.config;
                await refresh();
                logNotificationAction('Límites actualizados',
                'Se guardaron los topes en pesos y se revisó el gasto acumulado.');
                toast(d.alerts_created?.length?`Límites guardados. Ya superaste ${d.alerts_created.length} tope(s); revisa las alertas.`:'Límites guardados y comprobados con tus gastos actuales.')
            }
            catch(err){
                toast(err.message,
                'error')
            }
        }
        );
        $('#closeMonth').addEventListener('change',
        renderMonthlyClose);
        if($('#habitsMonth'))$('#habitsMonth').addEventListener('change',
        renderSpendingHabits);
        $('#saveMonthlyClose').addEventListener('click',
        saveMonthlyClose);
        $('#monthlyCloseHistory').addEventListener('click',
        e=>{
            const b=e.target.closest('[data-view-close]');
            if(!b)return;
            $('#closeMonth').value=b.dataset.viewClose;
            renderMonthlyClose();
            window.scrollTo({
                top:0,
                behavior:'smooth'
            }
            )
        }
        );
        $('#resetSettings').onclick=async()=>{
            if(!confirm('¿Apagar todos los topes configurados?'))return;
            const defaults={limite_diario:0,limite_semanal:0,limites_categoria_mensuales:{}}
            ;
            try{
                await api('/api/config',
                {
                    method:'POST',
                    body:JSON.stringify(defaults)
                }
                );
                await refresh();
                toast('Se apagaron todos los topes.')
            }
            catch(e){
                toast(e.message,
                'error')
            }
        }
        ;
        $('#notificationsList').addEventListener('click',
        e=>{
            const read=e.target.closest('[data-notification-read]'),
            del=e.target.closest('[data-notification-delete]');
            if(read){
                const n=localDB.notifications.find(x=>String(x.id)===read.dataset.notificationRead);
                if(n){
                    n.leida=true;
                    persist();
                    renderNotifications()
                }
            }
            if(del){
                localDB.notifications=localDB.notifications.filter(x=>String(x.id)!==del.dataset.notificationDelete);
                state.notifications=localDB.notifications;
                persist();
                renderNotifications()
            }
        }
        );
        $('#markAllNotificationsRead').onclick=()=>{
            localDB.notifications.forEach(n=>n.leida=true);
            state.notifications=localDB.notifications;
            persist();
            renderNotifications()
        }
        ;
        $('#clearReadNotifications').onclick=()=>{
            localDB.notifications=localDB.notifications.filter(n=>!n.leida);
            state.notifications=localDB.notifications;
            persist();
            renderNotifications()
        }
        ;
        $('#backupBtn').onclick=backup;
        $('#deleteAllDataBtn').onclick=deleteAllFinancialData;
        $('#restoreBtn').onclick=()=>$('#restoreFile').click();
        $('#restoreFile').addEventListener('change',
        async e=>{
            const file=e.target.files[0];
            if(!file)return;
            try{
                const obj=JSON.parse(await file.text());
                if(!obj||typeof obj!=='object'||!Array.isArray(obj.gastos))throw new Error('Respaldo inválido: falta la lista de movimientos.');
                if(obj.gastos.some(g=>!g||typeof g!=='object'||!(Number(g.monto)>0)||!String(g.descripcion||'').trim()||!/^\d{4}-\d{2}-\d{2}$/.test(String(g.fecha||''))))throw new Error('El respaldo contiene movimientos con monto, descripción o fecha inválidos. No se modificó ningún dato.');
                for(const key of ['alerts',
                'notifications',
                'metas',
                'pendientes',
                'cierres'])if(obj[key]!==undefined&&!Array.isArray(obj[key]))throw new Error(`El respaldo contiene una sección inválida: ${key}.`);
                if(obj.recurrentes!==undefined&&(!Array.isArray(obj.recurrentes)||obj.recurrentes.some(r=>!r||!String(r.nombre||'').trim()||!(Number(r.monto)>0)||!/^\d{4}-\d{2}-\d{2}$/.test(String(r.proximaFecha||'')))))throw new Error('La lista de gastos recurrentes del respaldo no es válida.');
                if(obj.pendientes!==undefined&&obj.pendientes.some(p=>!p||typeof p!=='object'||!String(p.persona||'').trim()||!(Number(p.monto)>0)||Number(p.abonado||0)<0||Number(p.abonado||0)>Number(p.monto)||p.pagos!==undefined&&!Array.isArray(p.pagos)))throw new Error('La lista de saldos pendientes del respaldo no es válida.');
                if(!await showConfirm({
                    title:'Crear respaldo preventivo',
                    message:'Antes de reemplazar los datos, descarga una copia de seguridad de la información actual. Después podrás confirmar la restauración.',
                    confirmText:'Descargar respaldo',
                    tone:'normal'
                }
                ))return;
                backup();
                if(!await showConfirm({
                    title:'Restaurar copia de seguridad',
                    message:`Se importarán ${obj.gastos.length} movimientos. Se reemplazarán los datos incluidos en el archivo; esta acción no se puede deshacer.`,
                    confirmText:'Restaurar datos',
                    tone:'normal'
                }
                ))return;
                setData(await api('/api/import',
                {
                    method:'POST',
                    body:JSON.stringify({
                        gastos:obj.gastos,
                        recurrentes:obj.recurrentes||[],
                        config:obj.config,
                        alerts:obj.alerts,
                        notifications:obj.notifications,
                        presupuestos:obj.presupuestos,
                        metas:obj.metas,
                        pendientes:obj.pendientes,
                        cierres:obj.cierres
                    }
                    )
                }
                ));
                localDB.recurrentes=obj.recurrentes||[];
                persist();
                await refresh();
                logNotificationAction('Respaldo restaurado',
                'Se importaron los datos de una copia JSON.',
                'warning');
                toast('Respaldo restaurado correctamente.')
            }
            catch(err){
                toast(err.message||'No se pudo leer el respaldo.',
                'error')
            }
            finally{
                e.target.value=''
            }
        }
        );
    }
    catch(e){
        document.body.innerHTML=`<div style="max-width:600px;margin:12vh auto;padding:28px;background:#fffdf9;border:1px solid #e9ded0;border-radius:16px;color:#302219;font:15px/1.6 system-ui"><h1>No se pudo iniciar el gestor</h1><p>${esc(e.message)}</p><p>Recarga la página e inténtalo de nuevo.</p></div>`
    }
}
document.addEventListener('DOMContentLoaded',
init);
