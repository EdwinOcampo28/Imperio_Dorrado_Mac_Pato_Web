const $ = s => document.querySelector(s),
$$ = s => [...document.querySelectorAll(s)];
const money = n => new Intl.NumberFormat('es-CO',
{
    style:'currency',
    currency:'COP',
    maximumFractionDigits:0
}
).format(Number(n)||0);
const fmtDate = s => {
    if(!s)return '—';
    const [y,
    m,
    d]=s.split('-').map(Number);
    return new Date(y,
    m-1,
    d).toLocaleDateString('es-CO',
    {
        day:'2-digit',
        month:'short',
        year:'numeric'
    }
    );
}
;
const todayISO = () => {
    const d=new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
;
const catIcons={
    'Comida':'◒',
    'Transporte':'↗',
    'Hogar':'⌂',
    'Servicios':'ϟ',
    'Entretenimiento':'♫',
    'Salud':'＋',
    'Otros':'◇',
    'Educación':'▤',
    'Ropa':'◇',
    'Mascotas':'♧',
    'Deudas':'↔'
}
;
const state={
    gastos:[],
    categories:[],
    config:{
    }
    ,
    alerts:[],
    notifications:[],
    dashboard:{
    }
    ,
    presupuestos:{
        mensual:0,
        categorias:{
        }
    }
    ,
    metas:[],
    pendientes:[],
    cierres:[],
    view:'dashboard',
    report:'daily',
    editing:null,
    reportData:null
}
;
const STORE_KEY='gestor_gastos_edwin_v1';
const TRACKING_START_DEFAULT='2026-10-15';
const DEFAULT_CONFIG={
    limite_diario:0,
    limite_semanal:0,
    limites_categoria_mensuales:{},
    fecha_inicio_control:TRACKING_START_DEFAULT
}
;
function safeGet(key){
    try{
        return localStorage.getItem(key)
    }
    catch(e){
        return null
    }
}
function safeSet(key,
value){
    try{
        localStorage.setItem(key,
        value);
        return true
    }
    catch(e){
        throw new Error('El navegador no pudo guardar los datos. Comprueba el espacio disponible y los permisos del navegador; no cierres la página hasta descargar un respaldo.')
    }
}
function safeSessionGet(key){
    try{
        return sessionStorage.getItem(key)
    }
    catch(e){
        return null
    }
}
function safeSessionSet(key,
value){
    try{
        sessionStorage.setItem(key,
        value)
    }
    catch(e){
        /* La sesión puede volver a solicitar acceso al recargar. */
    }
}
function safeSessionRemove(key){
    try{
        sessionStorage.removeItem(key)
    }
    catch(e){
        /* No bloquear el cierre de sesión por permisos del navegador. */
    }
}
function defaultStore(){
    return {
        recurrentes:[],
        notifications:[],
        gastos:(window.GESTOR_INITIAL?.gastos||[]).map((g,
        i)=>({
            ...g,
            id:Number(g.id)||i+1,
            monto:Number(g.monto)||0,
            categoria:String(g.categoria||'Otros'),
            descripcion:String(g.descripcion||''),
            fecha:String(g.fecha||''),
            tipo:g.tipo==='ingreso'?'ingreso':'gasto'
        }
        )),
        config:JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
        alerts:[],
        presupuestos:{
            mensual:0,
            categorias:{
            }
        }
        ,
        metas:[],
        pendientes:[],
        cierres:[]
    }
}
function readStore(){
    const fallback=defaultStore();
    try{
        const raw=safeGet(STORE_KEY),
        x=raw?JSON.parse(raw):null;
        if(!x||!Array.isArray(x.gastos))return fallback;
        const savedConfig=x.config&&typeof x.config==='object'?x.config:{
        }
        ;
        const baseConfig=JSON.parse(JSON.stringify(DEFAULT_CONFIG));
        const config={
            ...baseConfig,
            ...savedConfig,
            limites_categoria:{
                ...(baseConfig.limites_categoria||{
                }
                ),
                ...(savedConfig.limites_categoria||{
                }
                )
            }
        }
        ;
        config.limites_categoria_mensuales={
            ...(baseConfig.limites_categoria_mensuales||{}),
            ...(savedConfig.limites_categoria_mensuales||{})
        };
        return {
            ...fallback,
            ...x,
            // Normaliza esquemas de versiones anteriores sin descartar movimientos.
            gastos:x.gastos.map((g,
            i)=>({
                ...(g&&typeof g==='object'?g:{
                }
                ),
                id:Number(g?.id)||i+1,
                monto:Number(g?.monto)||0,
                categoria:String(g?.categoria||'Otros'),
                descripcion:String(g?.descripcion||''),
                fecha:String(g?.fecha||''),
                tipo:g?.tipo==='ingreso'?'ingreso':'gasto'
            }
            )),
            config,
            alerts:Array.isArray(x.alerts)?x.alerts:[],
            recurrentes:Array.isArray(x.recurrentes)?x.recurrentes.filter(r=>r&&typeof r==='object'&&r.nombre&&Number(r.monto)>0&&/^\d{4}-\d{2}-\d{2}$/.test(r.proximaFecha||'')):[],
            notifications:Array.isArray(x.notifications)?x.notifications:[],
            presupuestos:{
                mensual:Math.max(0,
                Number(x.presupuestos?.mensual)||0),
                categorias:x.presupuestos?.categorias&&typeof x.presupuestos.categorias==='object'?x.presupuestos.categorias:{
                }
            }
            ,
            metas:Array.isArray(x.metas)?x.metas:[],
            pendientes:Array.isArray(x.pendientes)?x.pendientes:[],
            cierres:Array.isArray(x.cierres)?x.cierres:[]
        }
        ;
    }
    catch(e){
        return fallback
    }
}
const storedBeforeMigration=safeGet(STORE_KEY);
let hadTrackingStart=false;
try{
    hadTrackingStart=!!JSON.parse(storedBeforeMigration||'{}')?.config?.fecha_inicio_control
}
catch(e){
}
let localDB=readStore();
if(!Array.isArray(localDB.notifications))localDB.notifications=[];
if(!hadTrackingStart){
    localDB.config.fecha_inicio_control=TRACKING_START_DEFAULT;
    try{
        safeSet(STORE_KEY,
        JSON.stringify(localDB))
    }
    catch(e){
        /* Se volverá a guardar con el siguiente cambio del usuario. */
    }
}
function persist(){
    const serialized=JSON.stringify(localDB);
    if(typeof databaseModeEnabled==='function'&&databaseModeEnabled()&&typeof databaseReady!=='undefined'&&databaseReady){
        if(typeof queueDatabaseSave==='function')queueDatabaseSave(serialized);
        return
    }
    safeSet(STORE_KEY,
    serialized)
}function trackingStart(){
    return /^\d{4}-\d{2}-\d{2}$/.test(String(localDB.config?.fecha_inicio_control||''))?localDB.config.fecha_inicio_control:todayISO()
}
function isCountedMovement(g,
end=todayISO()){
    return !!g&&/^\d{4}-\d{2}-\d{2}$/.test(String(g.fecha||''))&&g.fecha>=trackingStart()&&g.fecha<=end
}
function countedMovements(items,
end=todayISO()){
    return items.filter(g=>isCountedMovement(g,
    end))
}
function startOfWeek(d){
    const x=new Date(d.getFullYear(),
    d.getMonth(),
    d.getDate());
    x.setDate(x.getDate()-((x.getDay()+6)%7));
    return x
}
function iso(d){
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
