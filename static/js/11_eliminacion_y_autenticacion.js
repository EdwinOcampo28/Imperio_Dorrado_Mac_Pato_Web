async function deleteAllFinancialData(){
    const first=await showConfirm({
        title:'Crear copia de seguridad',
        message:'Antes de borrar los datos, descargaremos un respaldo JSON con tus movimientos, límites, presupuestos, metas y cierres mensuales.',
        confirmText:'Crear respaldo',
        tone:'normal'
    }
    );
    if(!first)return;
    backup();
    const proceed=await showConfirm({
        title:'¿Eliminar todos los datos?',
        message:'Guarda el archivo descargado en una carpeta segura. Esta acción eliminará los movimientos, alertas, presupuestos, metas y cierres mensuales. Tu usuario y contraseña se conservarán.',
        confirmText:'Sí, eliminar datos',
        tone:'danger'
    }
    );
    if(!proceed){
        toast('Eliminación cancelada. No se borró ningún dato.');
        return
    }
    localDB.gastos=[];
    localDB.recurrentes=[];
    localDB.config=JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    localDB.alerts=[];
    localDB.presupuestos={
        mensual:0,
        categorias:{
        }
    }
    ;
    localDB.metas=[];
    localDB.cierres=[];
    persist();
    refresh().then(()=>{
        renderProfile();
        localDB.notifications=[];
        logNotificationAction('Datos financieros eliminados',
        'Se reinició la información financiera tras generar el respaldo.',
        'warning');
        toast('Se eliminaron los datos financieros. La cuenta se conservó.')
    }
    ).catch(err=>toast(err.message||'No se pudieron actualizar los datos.',
    'error'))
}
const AUTH_KEY='gestor_gastos_edwin_auth_v1';
const SESSION_KEY='gestor_gastos_edwin_session_v1';
const THEME_KEY='gestor_gastos_edwin_theme_v1';
let authSetup=!safeGet(AUTH_KEY);
async function passwordDigest(value){
    const data=new TextEncoder().encode(String(value));
    if(window.crypto&&crypto.subtle){
        const hash=await crypto.subtle.digest('SHA-256',
        data);
        return [...new Uint8Array(hash)].map(b=>b.toString(16).padStart(2,
        '0')).join('')
    }
    // Compatibilidad con navegadores que no exponen Web Crypto al abrir el archivo directamente.
    let h=2166136261;
    for(const b of data){
        h^=b;
        h=Math.imul(h,
        16777619)
    }
    return 'local-'+(h>>>0).toString(16);
}
function monthLabel(month){
    if(!/^\d{4}-\d{2}$/.test(month))return month;
    const [y,
    m]=month.split('-').map(Number);
    return new Date(y,
    m-1,
    1).toLocaleDateString('es-CO',
    {
        month:'long',
        year:'numeric'
    }
    )
}
