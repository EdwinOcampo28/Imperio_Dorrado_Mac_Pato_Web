function toast(message,
type='success'){
    const el=document.createElement('div');
    el.className=`toast ${type}`;
    el.textContent=message;
    $('#toastRegion').append(el);
    setTimeout(()=>el.remove(),
    3600)
}
function addNotification(title,
message,
type='info'){
    const item={
        id:Date.now()+Math.floor(Math.random()*1000),
        title:String(title),
        message:String(message),
        type,
        fecha:new Date().toISOString(),
        leida:false
    }
    ;
    localDB.notifications=Array.isArray(localDB.notifications)?localDB.notifications:[];
    localDB.notifications.unshift(item);
    localDB.notifications=localDB.notifications.slice(0,
    100);
    state.notifications=localDB.notifications;
    persist();
    updateNotificationBadge();
    if(state.view==='notifications')renderNotifications();
    return item
}
function updateNotificationBadge(){
    const list=localDB.notifications||[],
    unread=list.filter(n=>!n.leida).length,
    badge=$('#notificationBadge');
    if(badge){
        badge.textContent=unread>99?'99+':String(unread);
        badge.hidden=unread===0
    }
    const tag=$('#notificationUnreadTag');
    if(tag)tag.textContent=`${unread} PENDIENTES`
}
function renderNotifications(){
    const list=$('#notificationsList');
    if(!list)return;
    const items=localDB.notifications||[],
    unread=items.filter(n=>!n.leida).length;
    $('#notificationsSummary').textContent=`${items.length} notificación(es) · ${unread} sin leer`;
    updateNotificationBadge();
    list.innerHTML=items.length?items.map(n=>`<article class="notification-item ${n.leida?'is-read':'is-unread'}"><span class="notification-symbol ${esc(n.type||'info')}">${n.type==='success'?'✓':n.type==='warning'?'!':'•'}</span><div class="notification-copy"><div class="notification-title-row"><h3>${esc(n.title)}</h3><time>${new Date(n.fecha).toLocaleString('es-CO',{dateStyle:'medium',timeStyle:'short'})}</time></div><p>${esc(n.message)}</p><div class="notification-actions">${n.leida?'':'<button class="text-btn" data-notification-read="'+n.id+'">Marcar como leída</button>'}<button class="text-btn notification-delete" data-notification-delete="${n.id}">Eliminar</button></div></div></article>`).join(''):'<div class="notifications-empty"><span>✓</span><h3>Todo al día</h3><p>Cuando registres movimientos o realices cambios importantes, aparecerán aquí.</p></div>'
}
function logNotificationAction(action,
detail,
type='success'){
    addNotification(action,
    detail,
    type)
}
function emptyRow(cols,
message='No hay registros para mostrar.'){
    return `<tr><td class="empty-state" colspan="${cols}"><span class="empty-illustration">⌁</span><br>${message}</td></tr>`
}
function esc(s){
    return String(s??'').replace(/[&<>"']/g,
    c=>({
        '&':'&amp;',
        '<':'&lt;',
        '>':'&gt;',
        '"':'&quot;',
        "'":'&#39;'
    }
    [c]))
}
