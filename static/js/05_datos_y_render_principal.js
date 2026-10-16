function setData(data){
    if(data.gastos)state.gastos=data.gastos;
    if(data.categories)state.categories=data.categories;
    if(data.config)state.config=data.config;
    if(data.alerts)state.alerts=data.alerts;
    if(data.notifications)state.notifications=data.notifications;
    if(data.dashboard)state.dashboard=data.dashboard;
    if(data.presupuestos)state.presupuestos=data.presupuestos;
    if(data.metas)state.metas=data.metas;
    if(data.cierres)state.cierres=data.cierres;
}
async function refresh(){
    const data=await api('/api/init');
    setData(data);
    renderAll()
}
function renderAll(){
    renderDashboard();
    renderTransactions();
    renderAlerts();
    renderSettings();
    renderReport();
    renderBudgets();
    renderGoals();
    renderMonthlyClose();
    $('#alertBadge').textContent=state.alerts.length;
    updateNotificationBadge();
    $('#alertsCountHead').textContent=`${state.alerts.length} ${state.alerts.length===1?'alerta':'alertas'}`
}
