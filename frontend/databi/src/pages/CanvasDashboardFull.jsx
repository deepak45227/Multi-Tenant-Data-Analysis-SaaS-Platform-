import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ComposedChart,
} from "recharts";

// ─── TOKENS ───────────────────────────────────────────────────────────────────
const T = {
  bg:"#07090f",canvas:"#090b13",surface:"#0d1018",card:"#101420",
  cardHov:"#151a2a",border:"#191f36",borderHi:"#263050",
  text:"#dde4ff",mid:"#636d96",dim:"#333c5e",
  accent:"#4d7fff",teal:"#00c9a7",orange:"#ff6d3b",pink:"#d946ef",
  yellow:"#f59e0b",green:"#22c55e",red:"#f43f5e",violet:"#8b5cf6",
  sel:"rgba(77,127,255,0.15)",selBdr:"#4d7fff",
  glow:"rgba(77,127,255,0.11)",
  fn:"'DM Sans',sans-serif",fnM:"'DM Mono',monospace",fnD:"'Syne',sans-serif",
};
const PAL=[T.accent,T.teal,T.orange,T.pink,T.yellow,T.green,T.red,T.violet];
const SNAP=20,MIN_W=160,MIN_H=120;

// ─── DEMO DATA ────────────────────────────────────────────────────────────────
const monthly=[
  {m:"Jan",rev:42,exp:28,pft:14,usr:12},{m:"Feb",rev:51,exp:31,pft:20,usr:16},
  {m:"Mar",rev:47,exp:30,pft:17,usr:14},{m:"Apr",rev:63,exp:34,pft:29,usr:20},
  {m:"May",rev:58,exp:32,pft:26,usr:19},{m:"Jun",rev:74,exp:38,pft:36,usr:23},
  {m:"Jul",rev:69,exp:36,pft:33,usr:22},{m:"Aug",rev:82,exp:41,pft:41,usr:26},
  {m:"Sep",rev:76,exp:39,pft:37,usr:24},{m:"Oct",rev:91,exp:44,pft:47,usr:29},
  {m:"Nov",rev:87,exp:43,pft:45,usr:28},{m:"Dec",rev:105,exp:49,pft:56,usr:33},
];
const cats=[
  {name:"Electronics",val:38},{name:"Clothing",val:24},{name:"Food",val:19},
  {name:"Books",val:12},{name:"Sports",val:16},{name:"Beauty",val:9},
];
const radar=[
  {s:"Sales",A:85,B:72},{s:"Mktg",A:76,B:68},{s:"Dev",A:91,B:85},
  {s:"Supp",A:63,B:74},{s:"Fin",A:78,B:61},{s:"HR",A:69,B:79},
];

const KPI_PRESETS=[
  {label:"Total Revenue",value:"$847K",delta:"+18.4%",up:true, color:T.accent},
  {label:"Active Users", value:"24.3K",delta:"+7.2%", up:true, color:T.teal},
  {label:"Avg Order",    value:"$142", delta:"-3.1%", up:false,color:T.orange},
  {label:"Churn Rate",   value:"2.8%", delta:"-0.9%", up:true, color:T.pink},
];

const WIDGET_TYPES=[
  {id:"area",  label:"Area Chart",  icon:"◭",dw:420,dh:260},
  {id:"bar",   label:"Bar Chart",   icon:"▦",dw:380,dh:260},
  {id:"line",  label:"Line Chart",  icon:"⟋",dw:400,dh:260},
  {id:"pie",   label:"Donut",       icon:"◎",dw:300,dh:280},
  {id:"combo", label:"Combo",       icon:"⊞",dw:440,dh:260},
  {id:"radar", label:"Radar",       icon:"⬡",dw:320,dh:300},
  {id:"tile",  label:"Tile Card",   icon:"▣",dw:240,dh:140},
  {id:"kpi",   label:"KPI Card",    icon:"◈",dw:200,dh:140},
  {id:"text",  label:"Text Block",  icon:"T",dw:260,dh:130},
  {id:"table", label:"Data Table",  icon:"≡",dw:480,dh:280},
];

const DATA_WIDGET_TYPES=new Set(["area","bar","line","pie","combo","radar","table"]);
const toNumber=(v)=>{
  const n=Number(v);
  return Number.isFinite(n)?n:0;
};
const inferRowMapping=(rows=[])=>{
  const first=(Array.isArray(rows)&&rows[0]&&typeof rows[0]==="object")?rows[0]:null;
  if(!first) return { xKey:"dimension", yKey:"value" };
  const keys=Object.keys(first);
  const numericKeys=keys.filter((k)=>rows.some((r)=>Number.isFinite(Number(r?.[k]))));
  const preferredX=keys.find((k)=>["dimension","label","name","x","category"].includes(String(k).toLowerCase()));
  const preferredY=keys.find((k)=>["value","y","metric","amount","total"].includes(String(k).toLowerCase()));
  return {
    xKey:preferredX||keys.find((k)=>!numericKeys.includes(k))||keys[0]||"dimension",
    yKey:preferredY||numericKeys[0]||keys[1]||keys[0]||"value",
  };
};
const normalizeChartRows=(rows=[],mapping={})=>{
  if(!Array.isArray(rows)) return [];
  const inferred=inferRowMapping(rows);
  const xKey=mapping?.x_column||mapping?.xKey||inferred.xKey;
  const yKey=mapping?.y_column||mapping?.yKey||inferred.yKey;
  return rows.map((row,idx)=>{
    if(row&&typeof row==="object"){
      const entries=Object.entries(row);
      const valueEntry=entries.find(([k,v])=>k===yKey||(typeof v==="number"||(!Number.isNaN(Number(v))&&v!==null&&v!=="")));
      const labelEntry=entries.find(([k])=>k===xKey||(k!=="value"&&k!=="dimension"));
      return{
        dimension:String(row?.[xKey] ?? row.dimension ?? labelEntry?.[1] ?? `Row ${idx+1}`),
        value:toNumber(row?.[yKey] ?? row.value ?? valueEntry?.[1]),
      };
    }
    return{dimension:`Row ${idx+1}`,value:toNumber(row)};
  });
};
// ─── RBAC ROLES ───────────────────────────────────────────────────────────────
const ROLES = {
  owner:  { label:"Owner",  color:T.red,    can:{ edit:true,  delete:true,  share:true,  export:true,  viewOnly:false }},
  admin:  { label:"Admin",  color:T.orange, can:{ edit:true,  delete:true,  share:true,  export:true,  viewOnly:false }},
  member: { label:"Member", color:T.teal,   can:{ edit:false, delete:false, share:false, export:false, viewOnly:true  }},
};
const normalizeRole=(r)=>ROLES[r]?r:"member";
const CHART_SKINS={
  classic:{primary:T.accent,secondary:T.teal,palette:PAL},
  neon:{primary:"#7c3aed",secondary:"#06b6d4",palette:["#7c3aed","#06b6d4","#22c55e","#f59e0b","#ec4899"]},
  mint:{primary:"#10b981",secondary:"#3b82f6",palette:["#10b981","#3b82f6","#14b8a6","#84cc16","#f97316"]},
  sunset:{primary:"#f43f5e",secondary:"#f59e0b",palette:["#f43f5e","#f59e0b","#fb7185","#fbbf24","#a78bfa"]},
};
const CARD_STYLE_PRESETS=[
  {id:"midnight",label:"Midnight",bg:"#101420",border:"#191f36",br:12},
  {id:"glass",label:"Glass",bg:"rgba(18,22,36,0.8)",border:"#2a3356",br:14},
  {id:"clean",label:"Clean",bg:"#f7f9fc",border:"#d9e0ee",br:12},
  {id:"cyber",label:"Cyber",bg:"#111426",border:"#2f3b70",br:10},
];
const LAYOUT_SECTIONS=[
  {id:"hero",label:"Hero",x:40,y:60,w:1160,h:160},
  {id:"left",label:"Left",x:40,y:240,w:560,h:360},
  {id:"right",label:"Right",x:620,y:240,w:580,h:360},
  {id:"bottom",label:"Bottom",x:40,y:620,w:1160,h:260},
];

// ─── SIMPLE LZ COMPRESS (no external lib needed) ─────────────────────────────
const compress = (str) => {
  try { return btoa(encodeURIComponent(str)); } catch { return str; }
};
const decompress = (str) => {
  try { return decodeURIComponent(atob(str)); } catch { return str; }
};

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS=`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&family=Syne:wght@700;800&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{background:${T.bg};color:${T.text};font-family:${T.fn};-webkit-font-smoothing:antialiased;overflow:hidden;}
::-webkit-scrollbar{width:4px;height:4px;}
::-webkit-scrollbar-track{background:${T.surface};}
::-webkit-scrollbar-thumb{background:${T.border};border-radius:2px;}
@keyframes fadeIn{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:scale(1)}}
@keyframes slideRight{from{opacity:0;transform:translateX(-12px)}to{opacity:1;transform:translateX(0)}}
@keyframes slideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes shimmer{0%{opacity:.5}100%{opacity:1}}
.fadeIn{animation:fadeIn .22s ease both;}
.slideRight{animation:slideRight .22s ease both;}
.slideUp{animation:slideUp .2s ease both;}
select,input,textarea{background:${T.surface};border:1px solid ${T.border};color:${T.text};border-radius:7px;padding:6px 9px;font-size:12px;font-family:${T.fn};outline:none;transition:border-color .15s;width:100%;}
select:focus,input:focus,textarea:focus{border-color:${T.accent};box-shadow:0 0 0 2px ${T.glow};}
.btn{display:inline-flex;align-items:center;gap:5px;padding:6px 13px;border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;transition:all .15s;border:1px solid ${T.border};background:none;color:${T.mid};font-family:${T.fn};white-space:nowrap;}
.btn:hover{color:${T.text};border-color:${T.borderHi};background:${T.card};}
.btn:disabled{opacity:.4;cursor:default;}
.btn.primary{background:${T.accent};border-color:${T.accent};color:#fff;box-shadow:0 2px 12px ${T.accent}45;}
.btn.primary:hover{transform:translateY(-1px);box-shadow:0 4px 18px ${T.accent}55;}
.btn.danger{color:${T.red};border-color:${T.red}40;}
.btn.danger:hover{background:${T.red}12;}
.btn.success{color:${T.teal};border-color:${T.teal}40;}
.btn.success:hover{background:${T.teal}12;}
.icon-btn{background:none;border:none;cursor:pointer;color:${T.mid};padding:5px;border-radius:6px;display:flex;align-items:center;justify-content:center;transition:all .15s;font-size:14px;}
.icon-btn:hover{color:${T.text};background:${T.card};}
.icon-btn.active{color:${T.accent};}
.tab{padding:5px 12px;border-radius:7px;font-size:11px;font-weight:600;cursor:pointer;transition:all .15s;border:none;background:none;color:${T.mid};letter-spacing:.02em;font-family:${T.fn};}
.tab:hover{color:${T.text};background:${T.card};}
.tab.active{background:${T.accent}20;color:${T.accent};}
.chip{display:inline-flex;align-items:center;gap:3px;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;border:1px solid;white-space:nowrap;}
.widget-type{display:flex;align-items:center;gap:7px;padding:6px 9px;border-radius:7px;border:1px solid ${T.border};background:none;color:${T.mid};cursor:pointer;font-family:${T.fn};font-size:11px;font-weight:600;transition:all .15s;text-align:left;width:100%;}
.widget-type:hover{color:${T.text};border-color:${T.borderHi};background:${T.card};}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);display:flex;align-items:center;justify-content:center;z-index:8000;backdrop-filter:blur(8px);}
.modal{background:${T.surface};border:1px solid ${T.borderHi};border-radius:18px;box-shadow:0 12px 80px rgba(0,0,0,.7);}
input[type=range]{-webkit-appearance:none;height:3px;border-radius:2px;background:${T.border};outline:none;width:100%;}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:13px;height:13px;border-radius:50%;background:${T.accent};cursor:pointer;}
`;

// ─── TOOLTIP ──────────────────────────────────────────────────────────────────
const Tip=({active,payload,label})=>{
  if(!active||!payload?.length) return null;
  return(
    <div style={{background:T.card,border:`1px solid ${T.borderHi}`,borderRadius:8,padding:"7px 11px",fontSize:10,fontFamily:T.fn}}>
      {label&&<p style={{color:T.dim,fontSize:9,marginBottom:4,textTransform:"uppercase"}}>{label}</p>}
      {payload.map((p,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:6}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:p.color||p.fill}}/>
          <span style={{color:T.mid,fontSize:9}}>{p.name}:</span>
          <span style={{color:T.text,fontWeight:700,fontFamily:T.fnM}}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};
const ax={fill:T.dim,fontSize:9,fontFamily:T.fnM};
const gr={stroke:T.border,strokeDasharray:"3 6"};

// ─── WIDGET CONTENT ───────────────────────────────────────────────────────────
const WidgetContent=({widget,viewOnly})=>{
  const {type,w,h,props={}}=widget;
  const ch=Math.max(h-50,60);
  const rawRows=Array.isArray(props.rawData)?props.rawData:props.data;
  const sourceRows=normalizeChartRows(rawRows,props.builder||{});
  const hasSourceRows=sourceRows.length>0;
  const trendData=hasSourceRows
    ? sourceRows.map((r)=>({x:r.dimension,y:r.value}))
    : monthly;
  const catData=hasSourceRows
    ? sourceRows.map((r)=>({name:r.dimension,val:r.value}))
    : cats;
  const radarData=hasSourceRows
    ? sourceRows.slice(0,6).map((r)=>({s:r.dimension,v:r.value}))
    : radar;
  const xAxisLabel=props?.builder?.x_axis_label||"";
  const yAxisLabel=props?.builder?.y_axis_label||"";
  const skin=CHART_SKINS[props?.builder?.chart_skin]||CHART_SKINS.classic;
  const palette=skin.palette||PAL;
  if(type==="kpi"){
    const kpi=props.kpi||KPI_PRESETS[0];
    return(
      <div style={{padding:"0.9rem 1rem",height:"100%",display:"flex",flexDirection:"column",justifyContent:"space-between",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-20,right:-20,width:70,height:70,borderRadius:"50%",background:kpi.color,opacity:.07,pointerEvents:"none"}}/>
        <span style={{fontSize:9,fontWeight:700,color:T.dim,textTransform:"uppercase",letterSpacing:"0.08em"}}>{kpi.label}</span>
        <div style={{fontFamily:T.fnD,fontSize:Math.min(w/5,30),fontWeight:800,letterSpacing:"-0.04em",color:T.text}}>{kpi.value}</div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontSize:10,color:kpi.up?T.teal:T.red,fontWeight:700}}>{kpi.up?"↑":"↓"} {kpi.delta}</span>
          <div style={{height:3,width:50,borderRadius:2,background:T.border,overflow:"hidden"}}>
            <div style={{height:"100%",width:"72%",background:kpi.color,borderRadius:2}}/>
          </div>
        </div>
      </div>
    );
  }
  if(type==="text"){
    return(
      <div style={{padding:"0.75rem 0.9rem",height:"100%",display:"flex",flexDirection:"column",gap:5}}>
        <div style={{fontFamily:T.fnD,fontSize:13,fontWeight:700,color:T.text}}>{props.title||"Text Block"}</div>
        <div style={{fontSize:11,color:T.mid,lineHeight:1.65,flex:1,overflow:"hidden"}}>{props.body||"Add your notes here..."}</div>
      </div>
    );
  }
  if(type==="table"){
    const rows=(hasSourceRows?sourceRows:trendData.map((r)=>({dimension:r.m,value:r.rev}))).slice(0,Math.max(Math.floor((h-54)/25),2));
    return(
      <div style={{padding:"0 0.6rem",height:"100%",overflow:"hidden"}}>
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:9,fontFamily:T.fnM}}>
          <thead><tr style={{borderBottom:`1px solid ${T.border}`}}>
            {["Label","Value"].map(h=><th key={h} style={{padding:"5px 5px",color:T.dim,fontWeight:700,textAlign:"left"}}>{h}</th>)}
          </tr></thead>
          <tbody>{rows.map((r,i)=>(
            <tr key={i} style={{borderBottom:`1px solid ${T.border}30`,background:i%2===0?"transparent":`${T.accent}05`}}>
              <td style={{padding:"4px 5px",color:T.mid}}>{r.dimension}</td>
              <td style={{padding:"4px 5px",color:T.accent,fontWeight:600}}>{r.value}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    );
  }
  if(type==="tile"){
    const tile=props.tile||{title:"Tile",value:"0",subtitle:"Details"};
    return(
      <div style={{padding:"0.9rem 1rem",height:"100%",display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
        <p style={{fontSize:10,fontWeight:700,color:T.dim,textTransform:"uppercase",letterSpacing:"0.07em"}}>{tile.title}</p>
        <p style={{fontFamily:T.fnD,fontSize:Math.min(w/4,28),fontWeight:800,color:T.text}}>{tile.value}</p>
        <p style={{fontSize:10,color:T.mid}}>{tile.subtitle}</p>
      </div>
    );
  }
  const charts={
    area:<ResponsiveContainer width="100%" height={ch}><AreaChart data={trendData} style={{shapeRendering:"geometricPrecision"}}><defs><linearGradient id="ag2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={skin.primary} stopOpacity={0.28}/><stop offset="100%" stopColor={skin.primary} stopOpacity={0}/></linearGradient></defs><CartesianGrid {...gr}/><XAxis dataKey="x" tick={ax} axisLine={false} tickLine={false} label={xAxisLabel?{value:xAxisLabel,position:"insideBottom",offset:-2,fill:T.dim,fontSize:10}:{undefined}}/><YAxis tick={ax} axisLine={false} tickLine={false} label={yAxisLabel?{value:yAxisLabel,angle:-90,position:"insideLeft",fill:T.dim,fontSize:10}:{undefined}}/><Tooltip content={<Tip/>}/><Area type="monotone" dataKey="y" stroke={skin.primary} strokeWidth={2} fill="url(#ag2)" isAnimationActive={false}/></AreaChart></ResponsiveContainer>,
    bar:<ResponsiveContainer width="100%" height={ch}><BarChart data={catData} barCategoryGap="30%" style={{shapeRendering:"geometricPrecision"}}><CartesianGrid vertical={false} {...gr}/><XAxis dataKey="name" tick={ax} axisLine={false} tickLine={false} label={xAxisLabel?{value:xAxisLabel,position:"insideBottom",offset:-2,fill:T.dim,fontSize:10}:{undefined}}/><YAxis tick={ax} axisLine={false} tickLine={false} label={yAxisLabel?{value:yAxisLabel,angle:-90,position:"insideLeft",fill:T.dim,fontSize:10}:{undefined}}/><Tooltip content={<Tip/>}/><Bar dataKey="val" radius={[4,4,0,0]} isAnimationActive={false}>{catData.map((_,i)=><Cell key={i} fill={palette[i%palette.length]}/>)}</Bar></BarChart></ResponsiveContainer>,
    line:<ResponsiveContainer width="100%" height={ch}><LineChart data={trendData} style={{shapeRendering:"geometricPrecision"}}><CartesianGrid {...gr}/><XAxis dataKey="x" tick={ax} axisLine={false} tickLine={false} label={xAxisLabel?{value:xAxisLabel,position:"insideBottom",offset:-2,fill:T.dim,fontSize:10}:{undefined}}/><YAxis tick={ax} axisLine={false} tickLine={false} label={yAxisLabel?{value:yAxisLabel,angle:-90,position:"insideLeft",fill:T.dim,fontSize:10}:{undefined}}/><Tooltip content={<Tip/>}/><Line type="monotone" dataKey="y" stroke={skin.secondary} strokeWidth={2.5} dot={false} isAnimationActive={false}/></LineChart></ResponsiveContainer>,
    pie:<ResponsiveContainer width="100%" height={ch}><PieChart style={{shapeRendering:"geometricPrecision"}}><Pie data={catData} dataKey="val" nameKey="name" cx="50%" cy="50%" innerRadius="50%" outerRadius="75%" paddingAngle={3} stroke="none" isAnimationActive={false}>{catData.map((_,i)=><Cell key={i} fill={palette[i%palette.length]}/>)}</Pie><Tooltip content={<Tip/>}/></PieChart></ResponsiveContainer>,
    combo:<ResponsiveContainer width="100%" height={ch}><ComposedChart data={trendData} style={{shapeRendering:"geometricPrecision"}}><CartesianGrid {...gr}/><XAxis dataKey="x" tick={ax} axisLine={false} tickLine={false} label={xAxisLabel?{value:xAxisLabel,position:"insideBottom",offset:-2,fill:T.dim,fontSize:10}:{undefined}}/><YAxis tick={ax} axisLine={false} tickLine={false} label={yAxisLabel?{value:yAxisLabel,angle:-90,position:"insideLeft",fill:T.dim,fontSize:10}:{undefined}}/><Tooltip content={<Tip/>}/><Bar dataKey="y" fill={skin.primary} radius={[3,3,0,0]} opacity={0.8} isAnimationActive={false}/><Line type="monotone" dataKey="y" stroke={skin.secondary} strokeWidth={2.5} dot={false} isAnimationActive={false}/></ComposedChart></ResponsiveContainer>,
    radar:<ResponsiveContainer width="100%" height={ch}><RadarChart data={radarData} cx="50%" cy="50%" outerRadius="65%" style={{shapeRendering:"geometricPrecision"}}><PolarGrid stroke={T.border}/><PolarAngleAxis dataKey="s" tick={{fill:T.dim,fontSize:9}}/><Radar dataKey="v" stroke={skin.primary} fill={skin.primary} fillOpacity={0.2} strokeWidth={2} isAnimationActive={false}/><Tooltip content={<Tip/>}/></RadarChart></ResponsiveContainer>,
  };
  return <div style={{padding:"0 0.4rem 0.4rem",height:"100%",overflow:"hidden"}}>{charts[type]||<div style={{color:T.dim,textAlign:"center",padding:"2rem",fontSize:11}}>{type}</div>}</div>;
};

// ─── RESIZE HANDLES ───────────────────────────────────────────────────────────
const HANDLES=[
  {id:"se",s:{bottom:-4,right:-4,width:10,height:10,borderRadius:"50%"},cursor:"nwse-resize"},
  {id:"sw",s:{bottom:-4,left:-4,width:10,height:10,borderRadius:"50%"},cursor:"nesw-resize"},
  {id:"ne",s:{top:-4,right:-4,width:10,height:10,borderRadius:"50%"},cursor:"nesw-resize"},
  {id:"nw",s:{top:-4,left:-4,width:10,height:10,borderRadius:"50%"},cursor:"nwse-resize"},
  {id:"e", s:{top:"50%",right:-4,width:8,height:24,borderRadius:4,marginTop:-12},cursor:"ew-resize"},
  {id:"w", s:{top:"50%",left:-4,width:8,height:24,borderRadius:4,marginTop:-12},cursor:"ew-resize"},
  {id:"s", s:{bottom:-4,left:"50%",width:24,height:8,borderRadius:4,marginLeft:-12},cursor:"ns-resize"},
  {id:"n", s:{top:-4,left:"50%",width:24,height:8,borderRadius:4,marginLeft:-12},cursor:"ns-resize"},
];

// ─── MINIMAP ──────────────────────────────────────────────────────────────────
const Minimap=({widgets,viewport,scale})=>{
  const mm=150,cs=2800,ratio=mm/cs;
  return(
    <div style={{position:"absolute",bottom:14,right:14,width:mm+2,height:90,background:`${T.surface}ee`,border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden",backdropFilter:"blur(8px)"}}>
      <svg width={mm} height={90} style={{position:"absolute"}}>
        {Array.from({length:6},(_,i)=>Array.from({length:10},(_,j)=>(
          <circle key={`${i}-${j}`} cx={j*(mm/10)+mm/20} cy={i*15+7} r={0.7} fill={T.dim} opacity={0.4}/>
        )))}
      </svg>
      {widgets.map(w=>(
        <div key={w.id} style={{position:"absolute",left:w.x*ratio,top:w.y*ratio,width:Math.max(w.w*ratio,3),height:Math.max(w.h*ratio,2),background:T.accent,opacity:.3,borderRadius:1}}/>
      ))}
      <div style={{position:"absolute",left:(-viewport.x/scale)*ratio,top:(-viewport.y/scale)*ratio,width:(window.innerWidth/scale)*ratio,height:(window.innerHeight/scale)*ratio,border:`1.5px solid ${T.accent}`,borderRadius:2,opacity:.7}}/>
      <div style={{position:"absolute",bottom:2,right:4,fontSize:8,color:T.dim,fontFamily:T.fnM}}>minimap</div>
    </div>
  );
};

// ─── CONTEXT MENU ─────────────────────────────────────────────────────────────
const CtxMenu=({x,y,items,onClose})=>{
  useEffect(()=>{const h=()=>onClose();document.addEventListener("click",h);return()=>document.removeEventListener("click",h);},[]);
  return(
    <div className="fadeIn" style={{position:"fixed",left:x,top:y,background:T.surface,border:`1px solid ${T.borderHi}`,borderRadius:10,padding:"4px",minWidth:175,zIndex:9999,boxShadow:"0 8px 48px rgba(0,0,0,.65)"}}>
      {items.map((item,i)=>item.sep?<div key={i} style={{height:1,background:T.border,margin:"3px 0"}}/>:
        <button key={i} onClick={()=>{item.action();onClose();}} disabled={item.disabled}
          style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"7px 10px",background:"none",border:"none",color:item.danger?T.red:item.disabled?T.dim:T.text,cursor:item.disabled?"default":"pointer",borderRadius:7,fontSize:12,fontFamily:T.fn,textAlign:"left"}}
          onMouseEnter={e=>{if(!item.disabled)e.currentTarget.style.background=T.card;}}
          onMouseLeave={e=>e.currentTarget.style.background="none"}>
          <span style={{opacity:.6,fontSize:13}}>{item.icon}</span>{item.label}
        </button>
      )}
    </div>
  );
};

// ─── SHARE MODAL ─────────────────────────────────────────────────────────────
const ShareModal=({widgets,dashName,onClose})=>{
  const [copied,setCopied]=useState(false);
  const [role,setRole]=useState("member");

  const payload=JSON.stringify({widgets,dashName,role,sharedAt:Date.now()});
  const encoded=compress(payload);
  const shareUrl=`${window.location.origin}${window.location.pathname}?dash=${encoded}`;

  const copy=()=>{navigator.clipboard.writeText(shareUrl).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);});};

  return(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal fadeIn" style={{width:520,padding:"1.5rem"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.25rem"}}>
          <div>
            <h2 style={{fontFamily:T.fnD,fontSize:"1.05rem",fontWeight:800}}>Share Dashboard</h2>
            <p style={{fontSize:11,color:T.mid,marginTop:2}}>{dashName}</p>
          </div>
          <button className="icon-btn" onClick={onClose} style={{fontSize:18}}>✕</button>
        </div>

        {/* Role picker */}
        <div style={{marginBottom:"1.1rem"}}>
          <p style={{fontSize:10,fontWeight:700,color:T.dim,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8}}>Link Permission</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:6}}>
            {Object.entries(ROLES).map(([key,r])=>(
              <div key={key} onClick={()=>setRole(key)} style={{padding:"8px 6px",borderRadius:9,border:`1px solid ${role===key?r.color:T.border}`,background:role===key?`${r.color}12`:"none",cursor:"pointer",textAlign:"center",transition:"all .15s"}}>
                <div style={{fontSize:16,marginBottom:3}}>
                  {key==="owner"?"👑":key==="admin"?"🛠":"👤"}
                </div>
                <p style={{fontSize:10,fontWeight:700,color:role===key?r.color:T.mid}}>{r.label}</p>
                <p style={{fontSize:9,color:T.dim,marginTop:1}}>{r.can.edit?"Edit":"View only"}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Role permissions */}
        <div style={{padding:"8px 12px",borderRadius:9,background:T.card,border:`1px solid ${T.border}`,marginBottom:"1.1rem",display:"flex",gap:12,flexWrap:"wrap"}}>
          {Object.entries(ROLES[normalizeRole(role)].can).map(([k,v])=>(
            <div key={k} style={{display:"flex",alignItems:"center",gap:4,fontSize:10,color:v?T.teal:T.dim}}>
              <span>{v?"✓":"✗"}</span><span style={{textTransform:"capitalize"}}>{k}</span>
            </div>
          ))}
        </div>

        {/* URL */}
        <div style={{marginBottom:"1.1rem"}}>
          <p style={{fontSize:10,fontWeight:700,color:T.dim,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Share Link</p>
          <div style={{display:"flex",gap:6}}>
            <input readOnly value={shareUrl} style={{flex:1,fontFamily:T.fnM,fontSize:10,color:T.mid}}/>
            <button className={`btn ${copied?"success":"primary"}`} onClick={copy} style={{flexShrink:0}}>
              {copied?"✓ Copied!":"⊕ Copy"}
            </button>
          </div>
        </div>

        {/* Embed */}
        <div style={{marginBottom:"1.1rem"}}>
          <p style={{fontSize:10,fontWeight:700,color:T.dim,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6}}>Embed Code</p>
          <textarea readOnly rows={2} value={`<iframe src="${shareUrl}" width="100%" height="600" frameborder="0"></iframe>`}
            style={{fontFamily:T.fnM,fontSize:9,color:T.dim,resize:"none"}}/>
        </div>

        <div style={{display:"flex",justifyContent:"flex-end"}}>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

// ─── EXPORT MODAL ─────────────────────────────────────────────────────────────
const ExportModal=({widgets,dashName,onClose})=>{
  const [exporting,setExporting]=useState(false);
  const [done,setDone]=useState(false);

  const exportJSON=()=>{
    const data=JSON.stringify({dashName,widgets,exportedAt:new Date().toISOString()},null,2);
    const blob=new Blob([data],{type:"application/json"});
    const a=document.createElement("a");
    a.href=URL.createObjectURL(blob);
    a.download=`${dashName.replace(/\s+/g,"-").toLowerCase()}.json`;
    a.click();
    setDone(true);
  };

  const exportPNG=()=>{
    setExporting(true);
    // use html2canvas approach via canvas API
    setTimeout(()=>{
      const canvasEl=document.getElementById("dashboard-canvas-area");
      if(!canvasEl){setExporting(false);return;}
      // Simple screenshot via print (most compatible without external deps)
      const printW=window.open("","_blank");
      if(printW){
        printW.document.write(`<html><head><title>${dashName}</title><style>body{background:#07090f;color:#fff;font-family:sans-serif;}*{box-sizing:border-box;}</style></head><body>`);
        printW.document.write(`<h2 style="color:#4d7fff;font-family:monospace;padding:12px">${dashName} — DataBI Export</h2>`);
        printW.document.write(`<p style="color:#636d96;padding:0 12px 12px;font-size:12px">${widgets.length} widgets · Exported ${new Date().toLocaleString()}</p>`);
        printW.document.write("</body></html>");
        printW.document.close();
        printW.print();
      }
      setExporting(false);
      setDone(true);
    },400);
  };

  return(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal fadeIn" style={{width:460,padding:"1.5rem"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.25rem"}}>
          <h2 style={{fontFamily:T.fnD,fontSize:"1.05rem",fontWeight:800}}>Export</h2>
          <button className="icon-btn" onClick={onClose} style={{fontSize:18}}>✕</button>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:"1.25rem"}}>
          {[
            {label:"Export as JSON",sub:"Download layout file — re-importable",icon:"{ }",action:exportJSON,color:T.accent},
            {label:"Export as PNG",sub:"Print / save as image via browser",icon:"⊡",action:exportPNG,color:T.teal},
          ].map((item,i)=>(
            <button key={i} onClick={item.action} disabled={exporting}
              style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",borderRadius:10,border:`1px solid ${T.border}`,background:"none",color:T.text,cursor:"pointer",textAlign:"left",transition:"all .15s",fontFamily:T.fn}}
              onMouseEnter={e=>{e.currentTarget.style.background=T.card;e.currentTarget.style.borderColor=item.color;}}
              onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.borderColor=T.border;}}>
              <div style={{width:40,height:40,borderRadius:10,background:`${item.color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,color:item.color,flexShrink:0}}>{item.icon}</div>
              <div>
                <p style={{fontSize:13,fontWeight:600}}>{item.label}</p>
                <p style={{fontSize:11,color:T.mid,marginTop:2}}>{item.sub}</p>
              </div>
            </button>
          ))}
        </div>

        {done&&<div style={{padding:"8px 12px",borderRadius:8,background:`${T.teal}12`,border:`1px solid ${T.teal}30`,color:T.teal,fontSize:12,marginBottom:12}}>✓ Export complete!</div>}
        <div style={{display:"flex",justifyContent:"flex-end"}}>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

// ─── IMPORT MODAL ─────────────────────────────────────────────────────────────
const ImportModal=({onImport,onClose})=>{
  const [error,setError]=useState("");
  const fileRef=useRef();

  const handleFile=(e)=>{
    const file=e.target.files[0];
    if(!file){return;}
    const reader=new FileReader();
    reader.onload=(ev)=>{
      try{
        const data=JSON.parse(ev.target.result);
        if(!data.widgets||!Array.isArray(data.widgets)) throw new Error("Invalid format");
        onImport(data);
        onClose();
      }catch(err){setError("Invalid JSON file. Make sure it was exported from DataBI.");}
    };
    reader.readAsText(file);
  };

  const handlePaste=(e)=>{
    try{
      const data=JSON.parse(e.target.value);
      if(!data.widgets||!Array.isArray(data.widgets)) throw new Error("Invalid format");
      onImport(data);
      onClose();
    }catch{setError("Invalid JSON. Paste a valid DataBI export.");}
  };

  return(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal fadeIn" style={{width:460,padding:"1.5rem"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.25rem"}}>
          <h2 style={{fontFamily:T.fnD,fontSize:"1.05rem",fontWeight:800}}>Import Layout</h2>
          <button className="icon-btn" onClick={onClose} style={{fontSize:18}}>✕</button>
        </div>

        <div onClick={()=>fileRef.current?.click()} style={{border:`2px dashed ${T.border}`,borderRadius:12,padding:"2rem",textAlign:"center",cursor:"pointer",marginBottom:12,transition:"all .15s"}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor=T.accent;e.currentTarget.style.background=T.glow;}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background="none";}}>
          <div style={{fontSize:28,marginBottom:8,opacity:0.4}}>⬆</div>
          <p style={{fontSize:12,color:T.mid}}>Click to select a <span style={{color:T.accent}}>DataBI JSON</span> file</p>
          <p style={{fontSize:10,color:T.dim,marginTop:4}}>or paste JSON below</p>
          <input ref={fileRef} type="file" accept=".json" style={{display:"none"}} onChange={handleFile}/>
        </div>

        <textarea rows={4} placeholder='Paste exported JSON here...' onBlur={handlePaste}
          style={{resize:"none",fontFamily:T.fnM,fontSize:10,marginBottom:8}}/>
        {error&&<div style={{padding:"7px 10px",borderRadius:7,background:`${T.red}12`,border:`1px solid ${T.red}30`,color:T.red,fontSize:11,marginBottom:10}}>{error}</div>}
        <div style={{display:"flex",justifyContent:"flex-end"}}>
          <button className="btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

// ─── DASHBOARD MANAGER ────────────────────────────────────────────────────────
const DashboardManager=({dashboards,activeDashId,onSwitch,onCreate,onRename,onDelete,onClose,currentWidgets,role})=>{
  const [newName,setNewName]=useState("");
  const [renamingId,setRenamingId]=useState(null);
  const [renameVal,setRenameVal]=useState("");
  const canEdit=ROLES[role].can.edit;
  const canDel=ROLES[role].can.delete;

  return(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal fadeIn" style={{width:580,maxHeight:"80vh",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"1.25rem 1.5rem",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div>
            <h2 style={{fontFamily:T.fnD,fontSize:"1.05rem",fontWeight:800}}>Dashboard Manager</h2>
            <p style={{fontSize:11,color:T.mid,marginTop:2}}>{dashboards.length} saved dashboards</p>
          </div>
          <button className="icon-btn" onClick={onClose} style={{fontSize:18}}>✕</button>
        </div>

        {/* List */}
        <div style={{flex:1,overflowY:"auto",padding:"0.75rem"}}>
          {dashboards.map((d,i)=>(
            <div key={d.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 12px",borderRadius:10,border:`1px solid ${d.id===activeDashId?T.accent:T.border}`,background:d.id===activeDashId?`${T.accent}0a`:T.card,marginBottom:6,transition:"all .15s"}}>
              <div style={{width:36,height:36,borderRadius:9,background:`${PAL[i%PAL.length]}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>
                {d.id===activeDashId?"◉":"○"}
              </div>
              <div style={{flex:1,minWidth:0}}>
                {renamingId===d.id?(
                  <input autoFocus value={renameVal} onChange={e=>setRenameVal(e.target.value)}
                    onBlur={()=>{onRename(d.id,renameVal);setRenamingId(null);}}
                    onKeyDown={e=>{if(e.key==="Enter"){onRename(d.id,renameVal);setRenamingId(null);}if(e.key==="Escape")setRenamingId(null);}}
                    style={{width:"100%",padding:"3px 7px",fontSize:12}}/>
                ):(
                  <>
                    <p style={{fontSize:12,fontWeight:600,color:d.id===activeDashId?T.accent:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{d.name}</p>
                    <p style={{fontSize:10,color:T.dim,marginTop:1}}>{d.widgets.length} widgets · Saved {new Date(d.savedAt||Date.now()).toLocaleDateString()}</p>
                  </>
                )}
              </div>
              <div style={{display:"flex",gap:4,flexShrink:0}}>
                <button className="btn" style={{padding:"4px 9px",fontSize:10}} onClick={()=>{onSwitch(d.id);onClose();}}>Open</button>
                {canEdit&&<button className="btn" style={{padding:"4px 8px",fontSize:10}} onClick={()=>{setRenamingId(d.id);setRenameVal(d.name);}}>✎</button>}
                {canDel&&dashboards.length>1&&<button className="btn danger" style={{padding:"4px 8px",fontSize:10}} onClick={()=>onDelete(d.id)}>✕</button>}
              </div>
            </div>
          ))}
        </div>

        {/* New dashboard */}
        {canEdit&&(
          <div style={{padding:"0.75rem 1rem",borderTop:`1px solid ${T.border}`,display:"flex",gap:8,flexShrink:0}}>
            <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="New dashboard name..." onKeyDown={e=>{if(e.key==="Enter"&&newName.trim()){onCreate(newName.trim());setNewName("");}}} style={{flex:1}}/>
            <button className="btn primary" onClick={()=>{if(newName.trim()){onCreate(newName.trim());setNewName("");}}} disabled={!newName.trim()}>+ Create</button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── PROPERTIES PANEL ─────────────────────────────────────────────────────────
const MemberManagerModal=({
  orgName,members,loading,error,form,onFormChange,onAdd,onDelete,onReload,onClose,submitting,deletingId,
})=>{
  return(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal fadeIn" style={{width:620,maxHeight:"82vh",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"1.2rem 1.4rem",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <h2 style={{fontFamily:T.fnD,fontSize:"1.05rem",fontWeight:800}}>Organization Members</h2>
            <p style={{fontSize:11,color:T.mid,marginTop:2}}>{orgName||"Organization"}</p>
          </div>
          <button className="icon-btn" onClick={onClose} style={{fontSize:18}}>✕</button>
        </div>
        <div style={{padding:"0.9rem 1rem",borderBottom:`1px solid ${T.border}`,display:"grid",gridTemplateColumns:"1fr 120px 110px",gap:8}}>
          <input value={form.email} onChange={(e)=>onFormChange((p)=>({...p,email:e.target.value}))} placeholder="member@email.com"/>
          <select value={form.role} onChange={(e)=>onFormChange((p)=>({...p,role:e.target.value}))}>
            <option value="member">MEMBER</option>
            <option value="admin">ADMIN</option>
          </select>
          <button className="btn primary" onClick={onAdd} disabled={submitting||!form.email.trim()}>{submitting?"Adding...":"Add Member"}</button>
        </div>
        <div style={{padding:"0.6rem 1rem",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${T.border}`}}>
          <p style={{fontSize:10,color:T.dim,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em"}}>{members.length} members</p>
          <button className="btn" style={{padding:"4px 10px",fontSize:10}} onClick={onReload} disabled={loading}>Refresh</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"0.6rem 0.8rem"}}>
          {loading&&<p style={{fontSize:11,color:T.mid,padding:"0.7rem"}}>Loading members...</p>}
          {!loading&&members.length===0&&<p style={{fontSize:11,color:T.dim,padding:"0.7rem"}}>No members found.</p>}
          {!loading&&members.map((m)=>(
            <div key={m.id} style={{display:"grid",gridTemplateColumns:"1fr 100px 84px",gap:8,alignItems:"center",padding:"8px 10px",border:`1px solid ${T.border}`,borderRadius:9,background:T.card,marginBottom:6}}>
              <div style={{minWidth:0}}>
                <p style={{fontSize:12,color:T.text,fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.user_email||`User #${m.user}`}</p>
                <p style={{fontSize:10,color:T.dim,marginTop:2}}>{m.username||"-"}</p>
              </div>
              <span className="chip" style={{color:m.role==="admin"?T.orange:T.teal,borderColor:m.role==="admin"?`${T.orange}30`:`${T.teal}30`,background:m.role==="admin"?`${T.orange}10`:`${T.teal}10`,justifyContent:"center"}}>
                {String(m.role||"member").toUpperCase()}
              </span>
              <button className="btn danger" style={{padding:"4px 8px",fontSize:10}} onClick={()=>onDelete(m.id)} disabled={deletingId===m.id}>
                {deletingId===m.id?"...":"Delete"}
              </button>
            </div>
          ))}
        </div>
        {error&&<div style={{margin:"0 1rem 0.9rem",padding:"8px 10px",borderRadius:8,background:`${T.red}12`,border:`1px solid ${T.red}30`,color:T.red,fontSize:11}}>{error}</div>}
      </div>
    </div>
  );
};

const TemplateGalleryModal=({onApply,onClose})=>{
  return(
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal fadeIn" style={{width:700,maxHeight:"82vh",display:"flex",flexDirection:"column"}}>
        <div style={{padding:"1.1rem 1.3rem",borderBottom:`1px solid ${T.border}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <h2 style={{fontFamily:T.fnD,fontSize:"1.05rem",fontWeight:800}}>Dashboard Templates</h2>
            <p style={{fontSize:11,color:T.mid}}>Start from advanced preset layouts</p>
          </div>
          <button className="icon-btn" onClick={onClose} style={{fontSize:18}}>✕</button>
        </div>
        <div style={{padding:"0.9rem",display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
          {TEMPLATE_CATALOG.map((t)=>(
            <button key={t.id} className="widget-type" style={{display:"block",padding:"10px",height:140}} onClick={()=>onApply(t.id)}>
              <div style={{height:66,borderRadius:8,background:`linear-gradient(135deg,${T.card},${T.surface})`,border:`1px solid ${T.border}`,marginBottom:8}}/>
              <p style={{fontSize:12,fontWeight:700,color:T.text,textAlign:"left"}}>{t.name}</p>
              <p style={{fontSize:10,color:T.dim,textAlign:"left",marginTop:2}}>{t.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const PropsPanel=({widget,onChange,onDelete,onDuplicate,onBringFront,onSendBack,canEdit})=>{
  if(!widget) return(
    <div style={{padding:"1.2rem 1rem",color:T.dim,textAlign:"center"}}>
      <div style={{fontSize:26,marginBottom:8,opacity:.3}}>◈</div>
      <p style={{fontSize:11,lineHeight:1.5}}>Select a widget to view properties</p>
    </div>
  );
  return(
    <div style={{padding:"0.85rem",overflowY:"auto",height:"100%"}}>
      <div style={{marginBottom:"0.85rem",paddingBottom:"0.7rem",borderBottom:`1px solid ${T.border}`}}>
        <p style={{fontSize:9,fontWeight:700,color:T.dim,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:5}}>Widget</p>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontSize:16}}>{WIDGET_TYPES.find(t=>t.id===widget.type)?.icon||"◈"}</span>
          <span style={{fontSize:12,fontWeight:700,color:T.text}}>{widget.type}</span>
          <span style={{marginLeft:"auto",fontSize:10,color:T.dim,fontFamily:T.fnM}}>#{widget.id.toString().slice(-4)}</span>
        </div>
      </div>

      {canEdit?(
        <>
          <div style={{marginBottom:"0.85rem"}}>
            <p style={{fontSize:9,fontWeight:700,color:T.dim,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:7}}>Position & Size</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
              {[["X","x"],["Y","y"],["W","w"],["H","h"]].map(([l,k])=>(
                <div key={k}>
                  <span style={{fontSize:9,color:T.dim,display:"block",marginBottom:2}}>{l}</span>
                  <input type="number" value={Math.round(widget[k])} onChange={e=>onChange({[k]:+e.target.value})}/>
                </div>
              ))}
            </div>
          </div>

          <div style={{marginBottom:"0.85rem"}}>
            <p style={{fontSize:9,fontWeight:700,color:T.dim,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:5}}>Title</p>
            <input value={widget.title||""} onChange={e=>onChange({title:e.target.value})} placeholder="Widget title"/>
          </div>

          {widget.type==="kpi"&&(
            <div style={{marginBottom:"0.85rem"}}>
              <p style={{fontSize:9,fontWeight:700,color:T.dim,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:5}}>KPI Content</p>
              <div style={{display:"grid",gap:6}}>
                <input value={widget?.props?.kpi?.label||""} onChange={e=>onChange({props:{...(widget.props||{}),kpi:{...(widget.props?.kpi||{}),label:e.target.value}}})} placeholder="KPI label"/>
                <input value={widget?.props?.kpi?.value||""} onChange={e=>onChange({props:{...(widget.props||{}),kpi:{...(widget.props?.kpi||{}),value:e.target.value}}})} placeholder="KPI value"/>
                <input value={widget?.props?.kpi?.delta||""} onChange={e=>onChange({props:{...(widget.props||{}),kpi:{...(widget.props?.kpi||{}),delta:e.target.value}}})} placeholder="KPI delta"/>
              </div>
            </div>
          )}

          {widget.type==="tile"&&(
            <div style={{marginBottom:"0.85rem"}}>
              <p style={{fontSize:9,fontWeight:700,color:T.dim,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:5}}>Tile Content</p>
              <div style={{display:"grid",gap:6}}>
                <input value={widget?.props?.tile?.title||""} onChange={e=>onChange({props:{...(widget.props||{}),tile:{...(widget.props?.tile||{}),title:e.target.value}}})} placeholder="Tile title"/>
                <input value={widget?.props?.tile?.value||""} onChange={e=>onChange({props:{...(widget.props||{}),tile:{...(widget.props?.tile||{}),value:e.target.value}}})} placeholder="Tile value"/>
                <input value={widget?.props?.tile?.subtitle||""} onChange={e=>onChange({props:{...(widget.props||{}),tile:{...(widget.props?.tile||{}),subtitle:e.target.value}}})} placeholder="Tile subtitle"/>
              </div>
            </div>
          )}

          <div style={{marginBottom:"0.85rem"}}>
            <p style={{fontSize:9,fontWeight:700,color:T.dim,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:7}}>Style</p>
            <div style={{display:"flex",gap:4,marginBottom:8,flexWrap:"wrap"}}>
              {[T.card,"#0a1628","#140a1e","#0a1a14"].map(c=>(
                <div key={c} onClick={()=>onChange({bg:c})} style={{width:20,height:20,borderRadius:5,background:c,border:`2px solid ${widget.bg===c?T.accent:T.border}`,cursor:"pointer"}}/>
              ))}
            </div>
            <div style={{display:"flex",gap:4,marginBottom:8,flexWrap:"wrap"}}>
              {[T.border,T.accent,T.teal,T.orange,T.pink].map(c=>(
                <div key={c} onClick={()=>onChange({borderColor:c})} style={{width:20,height:20,borderRadius:5,background:"transparent",border:`2px solid ${c}`,outline:widget.borderColor===c?`2px solid ${T.accent}`:"none",outlineOffset:1,cursor:"pointer"}}/>
              ))}
            </div>
            <div style={{marginBottom:6}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                <span style={{fontSize:9,color:T.dim}}>Border Radius</span>
                <span style={{fontSize:9,fontFamily:T.fnM,color:T.accent}}>{widget.br||12}px</span>
              </div>
              <input type="range" min={0} max={24} value={widget.br||12} onChange={e=>onChange({br:+e.target.value})}/>
            </div>
            <div>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
                <span style={{fontSize:9,color:T.dim}}>Opacity</span>
                <span style={{fontSize:9,fontFamily:T.fnM,color:T.accent}}>{Math.round((widget.opacity||1)*100)}%</span>
              </div>
              <input type="range" min={10} max={100} value={Math.round((widget.opacity||1)*100)} onChange={e=>onChange({opacity:e.target.value/100})}/>
            </div>
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:5,paddingTop:"0.7rem",borderTop:`1px solid ${T.border}`}}>
            <button onClick={onDuplicate} className="btn" style={{width:"100%",justifyContent:"center"}}>⊕ Duplicate</button>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
              <button onClick={onBringFront} className="btn" style={{justifyContent:"center",fontSize:10}}>↑ Front</button>
              <button onClick={onSendBack}   className="btn" style={{justifyContent:"center",fontSize:10}}>↓ Back</button>
            </div>
            <button onClick={onDelete} className="btn danger" style={{width:"100%",justifyContent:"center"}}>✕ Delete</button>
          </div>
        </>
      ):(
        <div style={{padding:"10px",borderRadius:9,background:T.card,border:`1px solid ${T.border}`,textAlign:"center"}}>
          <span style={{fontSize:10,color:T.dim}}>View-only mode</span>
        </div>
      )}
    </div>
  );
};

// ─── VIEW MODE BANNER ─────────────────────────────────────────────────────────
const ViewBanner=({role,onRequestEdit})=>(
  <div style={{background:`${T.orange}15`,border:`1px solid ${T.orange}30`,borderRadius:0,padding:"6px 1.2rem",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
    <div style={{display:"flex",alignItems:"center",gap:8}}>
      <span style={{fontSize:12}}>👁</span>
      <span style={{fontSize:11,color:T.orange,fontWeight:600}}>View-only mode</span>
      <span className="chip" style={{color:T.orange,borderColor:`${T.orange}30`,background:`${T.orange}10`}}>{ROLES[normalizeRole(role)].label}</span>
      <span style={{fontSize:10,color:T.mid}}>You can explore but cannot edit this dashboard.</span>
    </div>
    <button className="btn" style={{fontSize:10,color:T.orange,borderColor:`${T.orange}30`}} onClick={onRequestEdit}>Request Edit Access</button>
  </div>
);

// ─── AUTO-SAVE INDICATOR ──────────────────────────────────────────────────────
const SaveIndicator=({status})=>{
  const colors={saved:T.teal,saving:T.yellow,unsaved:T.orange,error:T.red};
  const labels={saved:"Saved",saving:"Saving...",unsaved:"Unsaved",error:"Save failed"};
  return(
    <div style={{display:"flex",alignItems:"center",gap:5,fontSize:10,fontFamily:T.fnM,color:colors[status]||T.dim}}>
      <div style={{width:5,height:5,borderRadius:"50%",background:colors[status]||T.dim,animation:status==="saving"?"pulse .8s ease infinite":"none"}}/>
      {labels[status]||status}
    </div>
  );
};

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
let idC=100;
const uid=()=>++idC;

const INIT_WIDGETS=[
  {id:1,type:"area",  x:40,  y:60,  w:440,h:260,title:"Revenue Trend",    bg:T.card,borderColor:T.border,br:12,opacity:1,zIndex:1},
  {id:2,type:"pie",   x:500, y:60,  w:300,h:260,title:"Category Mix",     bg:T.card,borderColor:T.border,br:12,opacity:1,zIndex:2},
  {id:3,type:"kpi",   x:820, y:60,  w:210,h:130,title:"Revenue",          bg:T.card,borderColor:T.border,br:12,opacity:1,zIndex:3,props:{kpi:KPI_PRESETS[0]}},
  {id:4,type:"kpi",   x:820, y:206, w:210,h:130,title:"Active Users",     bg:T.card,borderColor:T.border,br:12,opacity:1,zIndex:4,props:{kpi:KPI_PRESETS[1]}},
  {id:5,type:"bar",   x:40,  y:340, w:370,h:260,title:"Category Sales",   bg:T.card,borderColor:T.border,br:12,opacity:1,zIndex:5},
  {id:6,type:"combo", x:430, y:340, w:440,h:260,title:"Revenue vs Profit", bg:T.card,borderColor:T.border,br:12,opacity:1,zIndex:6},
  {id:7,type:"table", x:890, y:340, w:320,h:260,title:"Monthly Data",     bg:T.card,borderColor:T.border,br:12,opacity:1,zIndex:7},
  {id:8,type:"radar", x:40,  y:620, w:300,h:270,title:"Team Performance", bg:T.card,borderColor:T.border,br:12,opacity:1,zIndex:8},
  {id:9,type:"line",  x:360, y:620, w:440,h:270,title:"Monthly Trends",   bg:T.card,borderColor:T.border,br:12,opacity:1,zIndex:9},
  {id:10,type:"text", x:820, y:620, w:280,h:130,title:"Notes",            bg:T.card,borderColor:T.border,br:12,opacity:1,zIndex:10,props:{title:"Q4 Summary",body:"Revenue exceeds targets by 18.4%. Review churn strategies for Q1."}},
];

const TEMPLATE_CATALOG=[
  {id:"fin-dark",name:"Fin Dark",desc:"Finance cards + trends + transactions"},
  {id:"ops-blue",name:"Ops Blue",desc:"KPI strip + charts + table"},
  {id:"clean-light",name:"Clean Light",desc:"Minimal PM style with progress tiles"},
];
const buildTemplateWidgets=(templateId)=>{
  if(templateId==="fin-dark"){
    return [
      {id:uid(),type:"kpi",x:40,y:60,w:240,h:130,title:"Total Balance",bg:"#111426",borderColor:"#232a4a",br:12,opacity:1,zIndex:1,props:{kpi:{label:"Total Balance",value:"$25,230",delta:"+12.5%",up:true,color:T.accent}}},
      {id:uid(),type:"combo",x:300,y:60,w:420,h:260,title:"Top Spending",bg:"#111426",borderColor:"#232a4a",br:12,opacity:1,zIndex:2,props:{builder:{x_axis_label:"Week",y_axis_label:"USD"}}},
      {id:uid(),type:"tile",x:740,y:60,w:280,h:130,title:"Cards",bg:"#131833",borderColor:"#2a3564",br:12,opacity:1,zIndex:3,props:{tile:{title:"Primary Card",value:"8765 5452 6512 5123",subtitle:"Expires 02/30"}}},
      {id:uid(),type:"bar",x:40,y:210,w:360,h:230,title:"Budget",bg:"#111426",borderColor:"#232a4a",br:12,opacity:1,zIndex:4,props:{builder:{x_axis_label:"Day",y_axis_label:"Budget"}}},
      {id:uid(),type:"line",x:420,y:340,w:420,h:230,title:"Cash Flow",bg:"#111426",borderColor:"#232a4a",br:12,opacity:1,zIndex:5,props:{builder:{x_axis_label:"Day",y_axis_label:"Amount"}}},
      {id:uid(),type:"table",x:860,y:210,w:340,h:360,title:"Transactions",bg:"#111426",borderColor:"#232a4a",br:12,opacity:1,zIndex:6},
    ];
  }
  if(templateId==="ops-blue"){
    return [
      {id:uid(),type:"kpi",x:40,y:60,w:220,h:120,title:"Cases",bg:"#0f1730",borderColor:"#21488a",br:12,opacity:1,zIndex:1,props:{kpi:{label:"Open Cases",value:"680",delta:"+8.2%",up:true,color:T.teal}}},
      {id:uid(),type:"kpi",x:280,y:60,w:220,h:120,title:"Tickets",bg:"#0f1730",borderColor:"#21488a",br:12,opacity:1,zIndex:2,props:{kpi:{label:"Tickets",value:"900",delta:"+4.1%",up:true,color:T.accent}}},
      {id:uid(),type:"kpi",x:520,y:60,w:220,h:120,title:"Active",bg:"#0f1730",borderColor:"#21488a",br:12,opacity:1,zIndex:3,props:{kpi:{label:"Active",value:"352",delta:"-1.4%",up:false,color:T.orange}}},
      {id:uid(),type:"line",x:40,y:200,w:700,h:280,title:"General View",bg:"#0f1730",borderColor:"#21488a",br:12,opacity:1,zIndex:4,props:{builder:{x_axis_label:"Date",y_axis_label:"Volume"}}},
      {id:uid(),type:"bar",x:760,y:60,w:340,h:210,title:"Overview",bg:"#0f1730",borderColor:"#21488a",br:12,opacity:1,zIndex:5,props:{builder:{x_axis_label:"Category",y_axis_label:"Count"}}},
      {id:uid(),type:"table",x:760,y:290,w:340,h:190,title:"Activity",bg:"#0f1730",borderColor:"#21488a",br:12,opacity:1,zIndex:6},
    ];
  }
  return [
    {id:uid(),type:"tile",x:40,y:60,w:260,h:130,title:"Projects",bg:"#f6faf8",borderColor:"#d7ebe2",br:12,opacity:1,zIndex:1,props:{tile:{title:"Total Projects",value:"24",subtitle:"Running this month"}}},
    {id:uid(),type:"tile",x:320,y:60,w:260,h:130,title:"Completed",bg:"#f6faf8",borderColor:"#d7ebe2",br:12,opacity:1,zIndex:2,props:{tile:{title:"Ended Projects",value:"10",subtitle:"Closed"}}},
    {id:uid(),type:"tile",x:600,y:60,w:260,h:130,title:"Pending",bg:"#f6faf8",borderColor:"#d7ebe2",br:12,opacity:1,zIndex:3,props:{tile:{title:"Pending",value:"2",subtitle:"Need review"}}},
    {id:uid(),type:"bar",x:40,y:210,w:520,h:260,title:"Project Analytics",bg:"#f6faf8",borderColor:"#d7ebe2",br:12,opacity:1,zIndex:4,props:{builder:{x_axis_label:"Team",y_axis_label:"Projects"}}},
    {id:uid(),type:"pie",x:580,y:210,w:280,h:260,title:"Progress",bg:"#f6faf8",borderColor:"#d7ebe2",br:12,opacity:1,zIndex:5},
    {id:uid(),type:"table",x:880,y:60,w:320,h:410,title:"Team Tasks",bg:"#f6faf8",borderColor:"#d7ebe2",br:12,opacity:1,zIndex:6},
  ];
};

const STORAGE_KEY="databi_dashboards";
const ROLE_KEY="databi_role";
const DEFAULT_DASHBOARDS=[{id:1,name:"My Dashboard",widgets:[],savedAt:Date.now()}];
const asArray=(v)=>Array.isArray(v)?v:[];
const sanitizeDashboards=(value)=>{
  const list=asArray(value).filter((d)=>d&&typeof d==="object").map((d)=>({
    id:d.id ?? Date.now(),
    name:d.name || "Dashboard",
    widgets:asArray(d.widgets),
    savedAt:d.savedAt || Date.now(),
  }));
  return list.length?list:DEFAULT_DASHBOARDS;
};

export default function CanvasDashboardFull({selectedOrg,token,api,getApiErrorMessage}){
  // ── State ────────────────────────────────────────────────────────────────
  const [role,setRole]=useState("member");
  const [dashboards,setDashboards]=useState(()=>{
    try{
      const s=localStorage.getItem(STORAGE_KEY);
      return sanitizeDashboards(s?JSON.parse(s):DEFAULT_DASHBOARDS);
    }catch{
      return DEFAULT_DASHBOARDS;
    }
  });
  const [activeDashId,setActiveDashId]=useState(()=>{
    // check URL for shared dash
    const params=new URLSearchParams(window.location.search);
    if(params.get("dash")) return "shared";
    return 1;
  });
  const [sharedDash,setSharedDash]=useState(()=>{
    try{
      const params=new URLSearchParams(window.location.search);
      const enc=params.get("dash");
      if(!enc) return null;
      const data=JSON.parse(decompress(enc));
      return data;
    }catch{return null;}
  });

  const [widgets,setWidgets]=useState(()=>{
    if(sharedDash) return asArray(sharedDash.widgets);
    const d=dashboards.find(d=>d.id===1);
    return asArray(d?.widgets);
  });

  const effectiveRole=useMemo(()=>{
    if(sharedDash) return normalizeRole(sharedDash.role||"member");
    return normalizeRole(role);
  },[sharedDash,role]);

  const canEdit=ROLES[effectiveRole].can.edit;
  const canShare=ROLES[effectiveRole].can.share;
  const canExport=ROLES[effectiveRole].can.export;
  const isViewOnly=ROLES[effectiveRole].can.viewOnly;

  const [selected,setSelected]=useState(null);
  const [viewport,setViewport]=useState({x:0,y:0});
  const [scale,setScale]=useState(1);
  const [snap,setSnap]=useState(true);
  const [showGrid,setShowGrid]=useState(true);
  const [showSections,setShowSections]=useState(false);
  const [sectionSnap,setSectionSnap]=useState(true);
  const [cardPreset,setCardPreset]=useState("midnight");
  const [showLib,setShowLib]=useState(false);
  const [showProps,setShowProps]=useState(true);
  const [saveStatus,setSaveStatus]=useState("saved");
  const [ctxMenu,setCtxMenu]=useState(null);
  const [modal,setModal]=useState(null); // "share"|"export"|"import"|"manager"|"members"|"templates"
  const [libTab,setLibTab]=useState("widgets");
  const [builderDatasets,setBuilderDatasets]=useState([]);
  const [builderDatasetsLoading,setBuilderDatasetsLoading]=useState(false);
  const [builderQueries,setBuilderQueries]=useState([]);
  const [builderQueriesLoading,setBuilderQueriesLoading]=useState(false);
  const [builderColumns,setBuilderColumns]=useState([]);
  const [builderColumnsLoading,setBuilderColumnsLoading]=useState(false);
  const [builderLoading,setBuilderLoading]=useState(false);
  const [builderError,setBuilderError]=useState("");
  const [chartBuilder,setChartBuilder]=useState({dataset:"",mode:"basic",saved_query:"",name:"",chart_type:"bar",group_by_column:"",metric_column:"",x_column:"",y_column:"",x_axis_label:"",y_axis_label:"",chart_skin:"classic",aggregation:"sum",limit:20});
  const [orgMembers,setOrgMembers]=useState([]);
  const [membersLoading,setMembersLoading]=useState(false);
  const [membersError,setMembersError]=useState("");
  const [memberForm,setMemberForm]=useState({email:"",role:"member"});
  const [memberSubmitting,setMemberSubmitting]=useState(false);
  const [memberDeletingId,setMemberDeletingId]=useState(null);

  const drag=useRef(null);
  const resize=useRef(null);
  const panRef=useRef(null);
  const canvasRef=useRef();
  const saveTimer=useRef(null);

  const activeDash=useMemo(()=>dashboards.find(d=>d.id===activeDashId),[dashboards,activeDashId]);
  const dashName=sharedDash?.dashName||activeDash?.name||"Dashboard";
  const selectedWidget=useMemo(()=>widgets.find(w=>w.id===selected),[widgets,selected]);
  const selectedIsChart=useMemo(()=>!!selectedWidget&&DATA_WIDGET_TYPES.has(selectedWidget.type),[selectedWidget]);
  const selectedBuilderQuery=useMemo(()=>builderQueries.find((q)=>String(q.id)===String(chartBuilder.saved_query||""))||null,[builderQueries,chartBuilder.saved_query]);
  const maxZ=useMemo(()=>Math.max(...asArray(widgets).map((w)=>Number.isFinite(Number(w?.zIndex))?Number(w.zIndex):0),0),[widgets]);
  const snapV=useCallback(v=>snap?Math.round(v/SNAP)*SNAP:v,[snap]);

  useEffect(()=>{
    if(!showLib||!canEdit||!api||!token) return;
    let active=true;
    const orgQuery=selectedOrg?.id?`?organization=${selectedOrg.id}`:"";
    setBuilderDatasetsLoading(true);
    api(`/datasets/list/${orgQuery}`,{},token)
      .then((d)=>{
        if(!active) return;
        const list=d?.datasets||d||[];
        setBuilderDatasets(list);
      })
      .catch(()=>{ if(active) setBuilderDatasets([]); })
      .finally(()=>{ if(active) setBuilderDatasetsLoading(false); });
    return()=>{ active=false; };
  },[showLib,canEdit,api,token,selectedOrg?.id]);

  useEffect(()=>{
    if(!showLib||!canEdit||!api||!token) return;
    let active=true;
    const orgQuery=selectedOrg?.id?`?organization=${selectedOrg.id}`:"";
    setBuilderQueriesLoading(true);
    api(`/queries/${orgQuery}`,{},token)
      .then((d)=>{
        if(!active) return;
        const list=d?.results||d||[];
        setBuilderQueries(Array.isArray(list)?list:[]);
      })
      .catch(()=>{ if(active) setBuilderQueries([]); })
      .finally(()=>{ if(active) setBuilderQueriesLoading(false); });
    return()=>{ active=false; };
  },[showLib,canEdit,api,token,selectedOrg?.id]);

  useEffect(()=>{
    if(!showLib||!canEdit||!selectedIsChart) return;
    const p=selectedWidget?.props||{};
    const b=p.builder||{};
    const mode=(b.mode==="saved"||b.mode==="basic")?b.mode:"basic";
    setChartBuilder({
      dataset:String(b.dataset||builderDatasets[0]?.dataset_id||builderDatasets[0]?.id||""),
      mode,
      saved_query:String(b.saved_query||""),
      name:b.name||selectedWidget?.title||"",
      chart_type:b.chart_type||selectedWidget?.type||"bar",
      group_by_column:b.group_by_column||"",
      metric_column:b.metric_column||"",
      x_column:b.x_column||"",
      y_column:b.y_column||"",
      x_axis_label:b.x_axis_label||"",
      y_axis_label:b.y_axis_label||"",
      chart_skin:b.chart_skin||"classic",
      aggregation:b.aggregation||"sum",
      limit:Number(b.limit)||20,
    });
    setLibTab("builder");
  },[selected,showLib,canEdit,selectedIsChart,builderDatasets]);

  useEffect(()=>{
    if(chartBuilder.mode!=="saved") return;
    if(!selectedBuilderQuery) return;
    const qDataset=String(selectedBuilderQuery.dataset||"");
    if(qDataset&&qDataset!==String(chartBuilder.dataset||"")){
      setChartBuilder((prev)=>({...prev,dataset:qDataset}));
    }
  },[chartBuilder.mode,chartBuilder.dataset,selectedBuilderQuery]);

  useEffect(()=>{
    if(!api||!token||!chartBuilder.dataset||!selectedIsChart){
      setBuilderColumns([]);
      return;
    }
    let active=true;
    setBuilderColumnsLoading(true);
    api(`/datasets/${chartBuilder.dataset}/metadata/`,{},token)
      .then((d)=>{
        if(!active) return;
        const cols=d?.columns||[];
        setBuilderColumns(cols);
        setChartBuilder((prev)=>({
          ...prev,
          group_by_column:prev.group_by_column||cols[0]?.name||"",
          metric_column:prev.metric_column||cols.find((c)=>c.is_numeric)?.name||cols[0]?.name||"",
          x_column:prev.x_column||prev.group_by_column||cols[0]?.name||"",
          y_column:prev.y_column||prev.metric_column||cols.find((c)=>c.is_numeric)?.name||cols[0]?.name||"",
        }));
      })
      .catch(()=>{ if(active) setBuilderColumns([]); })
      .finally(()=>{ if(active) setBuilderColumnsLoading(false); });
    return()=>{ active=false; };
  },[api,token,chartBuilder.dataset,selectedIsChart]);

  const runWidgetBuilderPreview=useCallback(async()=>{
    if(!canEdit||!selectedIsChart||!selected||!api||!token) return;
    if(!chartBuilder.dataset){ setBuilderError("Select dataset."); return; }
    const q=(v)=>`"${String(v||"").replace(/"/g,'""')}"`;
    const agg=String(chartBuilder.aggregation||"sum").toUpperCase();
    const limit=Math.max(1,Number(chartBuilder.limit)||20);
    let sql="";
    let datasetForQuery=String(chartBuilder.dataset||"");
    if(chartBuilder.mode==="saved"){
      if(!selectedBuilderQuery){ setBuilderError("Select saved query."); return; }
      sql=String(selectedBuilderQuery.sql||"").trim();
      datasetForQuery=String(selectedBuilderQuery.dataset||datasetForQuery);
    }else{
      sql=chartBuilder.group_by_column
        ? `SELECT ${q(chartBuilder.group_by_column)} AS dimension, ${agg}(${chartBuilder.aggregation==="count"?"*":q(chartBuilder.metric_column)}) AS value FROM data GROUP BY ${q(chartBuilder.group_by_column)} ORDER BY value DESC LIMIT ${limit}`
        : "";
    }
    if(!sql){ setBuilderError("Configure group/metric or select a saved query."); return; }

    setBuilderLoading(true);
    setBuilderError("");
    try{
      const res=await api("/queries/execute/",{ method:"POST", body:{ dataset:datasetForQuery, sql, max_rows:limit } },token);
      const rawRows=Array.isArray(res?.rows)?res.rows:[];
      const inferred=inferRowMapping(rawRows);
      const nextBuilder={
        ...chartBuilder,
        x_column:chartBuilder.mode==="basic"?"dimension":(chartBuilder.x_column||inferred.xKey),
        y_column:chartBuilder.mode==="basic"?"value":(chartBuilder.y_column||inferred.yKey),
      };
      const rows=normalizeChartRows(rawRows,nextBuilder);
      setWidgets((prev)=>prev.map((w)=>{
        if(w.id!==selected) return w;
        const nextProps={...(w.props||{}),data:rows,rawData:rawRows,builder:nextBuilder};
        return {...w,type:chartBuilder.chart_type,title:chartBuilder.name||w.title,props:nextProps};
      }));
      setChartBuilder(nextBuilder);
    }catch(e){
      const msg=getApiErrorMessage?getApiErrorMessage(e,"Live preview failed."):"Live preview failed.";
      setBuilderError(msg);
    }finally{
      setBuilderLoading(false);
    }
  },[canEdit,selectedIsChart,selected,api,token,chartBuilder,selectedBuilderQuery,getApiErrorMessage]);

  useEffect(()=>{
    if(!showLib||libTab!=="builder"||!selectedIsChart) return;
    const tmr=setTimeout(()=>{ runWidgetBuilderPreview(); },500);
    return()=>clearTimeout(tmr);
  },[showLib,libTab,selectedIsChart,chartBuilder.dataset,chartBuilder.saved_query,chartBuilder.group_by_column,chartBuilder.metric_column,chartBuilder.x_column,chartBuilder.y_column,chartBuilder.x_axis_label,chartBuilder.y_axis_label,chartBuilder.chart_skin,chartBuilder.aggregation,chartBuilder.limit,chartBuilder.chart_type,chartBuilder.name,chartBuilder.mode,runWidgetBuilderPreview]);

  // ── Auto-save ────────────────────────────────────────────────────────────
  useEffect(()=>{
    if(isViewOnly||sharedDash) return;
    setSaveStatus("unsaved");
    if(saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(()=>{
      setSaveStatus("saving");
      try{
        const updated=dashboards.map(d=>d.id===activeDashId?{...d,widgets,savedAt:Date.now()}:d);
        setDashboards(updated);
        localStorage.setItem(STORAGE_KEY,JSON.stringify(updated));
        setSaveStatus("saved");
      }catch{setSaveStatus("error");}
    },1200);
    return()=>clearTimeout(saveTimer.current);
  },[widgets]);

  // ── Role persistence ──────────────────────────────────────────────────────
  useEffect(()=>{
    const r=String(selectedOrg?.current_user_role||"member");
    setRole(ROLES[r]?r:"member");
  },[selectedOrg?.id,selectedOrg?.current_user_role]);

  const loadMembers=useCallback(async()=>{
    if(!api||!token||!selectedOrg?.id) return;
    setMembersLoading(true);
    setMembersError("");
    try{
      const res=await api(`/organizations/members/${selectedOrg.id}/`,{},token);
      setOrgMembers(Array.isArray(res?.members)?res.members:[]);
    }catch(e){
      const msg=getApiErrorMessage?getApiErrorMessage(e,"Failed to load organization members."):"Failed to load organization members.";
      setMembersError(msg);
      setOrgMembers([]);
    }finally{
      setMembersLoading(false);
    }
  },[api,token,selectedOrg?.id,getApiErrorMessage]);

  const addMember=useCallback(async()=>{
    if(!api||!token||!selectedOrg?.id||!memberForm.email.trim()) return;
    setMemberSubmitting(true);
    setMembersError("");
    try{
      await api(`/organizations/members/${selectedOrg.id}/add-member/`,{
        method:"POST",
        body:{email:memberForm.email.trim(),role:memberForm.role||"member"},
      },token);
      setMemberForm({email:"",role:memberForm.role||"member"});
      await loadMembers();
    }catch(e){
      const msg=getApiErrorMessage?getApiErrorMessage(e,"Failed to add member."):"Failed to add member.";
      setMembersError(msg);
    }finally{
      setMemberSubmitting(false);
    }
  },[api,token,selectedOrg?.id,memberForm,loadMembers,getApiErrorMessage]);

  const deleteMember=useCallback(async(membershipId)=>{
    if(!api||!token||!membershipId) return;
    setMemberDeletingId(membershipId);
    setMembersError("");
    try{
      await api(`/organizations/members/${membershipId}/delete/`,{method:"DELETE"},token);
      setOrgMembers((prev)=>prev.filter((m)=>Number(m.id)!==Number(membershipId)));
    }catch(e){
      const msg=getApiErrorMessage?getApiErrorMessage(e,"Failed to delete member."):"Failed to delete member.";
      setMembersError(msg);
    }finally{
      setMemberDeletingId(null);
    }
  },[api,token,getApiErrorMessage]);

  useEffect(()=>{
    if(modal!=="members") return;
    loadMembers();
  },[modal,loadMembers]);

  // ── Widget ops ────────────────────────────────────────────────────────────
  const updateWidget=useCallback((id,patch)=>{
    if(!canEdit) return;
    setWidgets(p=>p.map(w=>w.id===id?{...w,...patch}:w));
  },[canEdit]);
  const applyCardPresetToAll=useCallback((presetId)=>{
    const p=CARD_STYLE_PRESETS.find((x)=>x.id===presetId);
    if(!p||!canEdit) return;
    setCardPreset(presetId);
    setWidgets((prev)=>prev.map((w)=>({...w,bg:p.bg,borderColor:p.border,br:p.br})));
  },[canEdit]);

  const addWidget=useCallback((type)=>{
    if(!canEdit) return;
    const wt=WIDGET_TYPES.find(t=>t.id===type)||WIDGET_TYPES[0];
    const nw={id:uid(),type,title:wt.label,x:snapV(-viewport.x/scale+100),y:snapV(-viewport.y/scale+100),w:wt.dw,h:wt.dh,bg:T.card,borderColor:T.border,br:12,opacity:1,zIndex:maxZ+1,props:type==="kpi"?{kpi:KPI_PRESETS[uid()%4]}:type==="tile"?{tile:{title:"Tile",value:"0",subtitle:"Details"}}:type==="text"?{title:"New Text",body:"Add text here..."}:{}};
    setWidgets(p=>[...p,nw]);
    setSelected(nw.id);
  },[canEdit,viewport,scale,snapV,maxZ]);

  const deleteWidget=useCallback((id)=>{if(!canEdit) return;setWidgets(p=>p.filter(w=>w.id!==id));if(selected===id)setSelected(null);},[canEdit,selected]);
  const duplicateWidget=useCallback((id)=>{if(!canEdit) return;const w=widgets.find(x=>x.id===id);if(!w) return;const nw={...w,id:uid(),x:w.x+SNAP*2,y:w.y+SNAP*2,zIndex:maxZ+1};setWidgets(p=>[...p,nw]);setSelected(nw.id);},[canEdit,widgets,maxZ]);
  const bringFront=useCallback((id)=>updateWidget(id,{zIndex:maxZ+1}),[maxZ,updateWidget]);
  const sendBack=useCallback((id)=>updateWidget(id,{zIndex:Math.max(0,Math.min(...asArray(widgets).map((w)=>Number.isFinite(Number(w?.zIndex))?Number(w.zIndex):0))-1)}),[widgets,updateWidget]);
  const snapToNearestSection=useCallback((w)=>{
    const cx=w.x+(w.w/2);
    const cy=w.y+(w.h/2);
    const nearest=LAYOUT_SECTIONS
      .map((s)=>({s,d:Math.hypot(cx-(s.x+s.w/2),cy-(s.y+s.h/2))}))
      .sort((a,b)=>a.d-b.d)[0]?.s;
    if(!nearest) return w;
    const nx=Math.max(nearest.x,Math.min(nearest.x+nearest.w-w.w,w.x));
    const ny=Math.max(nearest.y,Math.min(nearest.y+nearest.h-w.h,w.y));
    return {...w,x:snapV(nx),y:snapV(ny)};
  },[snapV]);

  // ── Mouse ─────────────────────────────────────────────────────────────────
  const onWidgetMD=useCallback((e,id)=>{
    if(e.button!==0||!canEdit) return;
    e.stopPropagation();
    const w=widgets.find(x=>x.id===id);if(!w) return;
    setSelected(id);bringFront(id);
    drag.current={id,startX:e.clientX,startY:e.clientY,ox:w.x,oy:w.y};
  },[canEdit,widgets,bringFront]);

  const onResizeMD=useCallback((e,id,handle)=>{
    e.stopPropagation();
    const w=widgets.find(x=>x.id===id);if(!w) return;
    resize.current={id,handle,startX:e.clientX,startY:e.clientY,ox:w.x,oy:w.y,ow:w.w,oh:w.h};
  },[widgets]);

  const onCanvasMD=useCallback((e)=>{
    if(e.button===1||(e.button===0&&e.altKey)){panRef.current={startX:e.clientX,startY:e.clientY,ox:viewport.x,oy:viewport.y};return;}
    if(e.button===0){setSelected(null);}
  },[viewport]);

  const onMM=useCallback((e)=>{
    if(panRef.current){const{startX,startY,ox,oy}=panRef.current;setViewport({x:ox+(e.clientX-startX),y:oy+(e.clientY-startY)});return;}
    if(drag.current){
      const{startX,startY,ox,oy}=drag.current;
      const ddx=(e.clientX-startX)/scale,ddy=(e.clientY-startY)/scale;
      setWidgets(p=>p.map(w=>w.id===drag.current.id?{...w,x:snapV(ox+ddx),y:snapV(oy+ddy)}:w));
      return;
    }
    if(resize.current){
      const{id,handle,startX,startY,ox,oy,ow,oh}=resize.current;
      const ddx=(e.clientX-startX)/scale,ddy=(e.clientY-startY)/scale;
      let nx=ox,ny=oy,nw=ow,nh=oh;
      if(handle.includes("e"))nw=Math.max(MIN_W,snapV(ow+ddx));
      if(handle.includes("s"))nh=Math.max(MIN_H,snapV(oh+ddy));
      if(handle.includes("w")){nw=Math.max(MIN_W,snapV(ow-ddx));nx=snapV(ox+ddx);}
      if(handle.includes("n")){nh=Math.max(MIN_H,snapV(oh-ddy));ny=snapV(oy+ddy);}
      updateWidget(id,{x:nx,y:ny,w:nw,h:nh});
    }
  },[scale,snapV,updateWidget]);

  const onMU=useCallback(()=>{
    if(drag.current&&sectionSnap){
      const id=drag.current.id;
      const w=widgets.find((x)=>x.id===id);
      if(w) updateWidget(id,snapToNearestSection(w));
    }
    drag.current=null;resize.current=null;panRef.current=null;
  },[sectionSnap,widgets,updateWidget,snapToNearestSection]);

  const onWheel=useCallback((e)=>{
    if(e.ctrlKey||e.metaKey){e.preventDefault();setScale(s=>Math.min(3,Math.max(0.15,s*(e.deltaY>0?0.9:1.1))));}
    else setViewport(p=>({x:p.x-e.deltaX,y:p.y-e.deltaY}));
  },[]);

  useEffect(()=>{const el=canvasRef.current;if(!el)return;el.addEventListener("wheel",onWheel,{passive:false});return()=>el.removeEventListener("wheel",onWheel);},[onWheel]);

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(()=>{
    const h=(e)=>{
      if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA") return;
      if((e.key==="Delete"||e.key==="Backspace")&&selected) deleteWidget(selected);
      if(e.key==="Escape"){setSelected(null);}
      if(e.key==="d"&&(e.ctrlKey||e.metaKey)&&selected){e.preventDefault();duplicateWidget(selected);}
      if(e.key==="0"&&(e.ctrlKey||e.metaKey)){e.preventDefault();setScale(1);setViewport({x:0,y:0});}
      if(selected&&["ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.key)){
        e.preventDefault();
        const d=e.shiftKey?SNAP:1;
        const dx=e.key==="ArrowLeft"?-d:e.key==="ArrowRight"?d:0;
        const dy=e.key==="ArrowUp"?-d:e.key==="ArrowDown"?d:0;
        const w=widgets.find(x=>x.id===selected);
        if(w)updateWidget(selected,{x:w.x+dx,y:w.y+dy});
      }
    };
    window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);
  },[selected,deleteWidget,duplicateWidget,updateWidget,widgets]);

  // ── Dashboard manager ops ─────────────────────────────────────────────────
  const createDash=(name)=>{
    const id=Date.now();
    const d={id,name,widgets:[],savedAt:Date.now()};
    setDashboards(p=>{const u=[...p,d];localStorage.setItem(STORAGE_KEY,JSON.stringify(u));return u;});
    setActiveDashId(id);setWidgets([]);setSelected(null);
  };
  const switchDash=(id)=>{
    // save current first
    setDashboards(p=>{const u=p.map(d=>d.id===activeDashId?{...d,widgets,savedAt:Date.now()}:d);localStorage.setItem(STORAGE_KEY,JSON.stringify(u));return u;});
    const d=dashboards.find(x=>x.id===id);
    if(d){setActiveDashId(id);setWidgets(d.widgets||[]);setSelected(null);}
  };
  const renameDash=(id,name)=>{setDashboards(p=>{const u=p.map(d=>d.id===id?{...d,name}:d);localStorage.setItem(STORAGE_KEY,JSON.stringify(u));return u;});};
  const deleteDash=(id)=>{
    if(dashboards.length<=1) return;
    const u=dashboards.filter(d=>d.id!==id);
    setDashboards(u);localStorage.setItem(STORAGE_KEY,JSON.stringify(u));
    if(activeDashId===id){setActiveDashId(u[0].id);setWidgets(u[0].widgets||[]);}
  };
  const importDash=(data)=>{
    const id=Date.now();
    const d={id,name:data.dashName||"Imported Dashboard",widgets:data.widgets,savedAt:Date.now()};
    setDashboards(p=>{const u=[...p,d];localStorage.setItem(STORAGE_KEY,JSON.stringify(u));return u;});
    setActiveDashId(id);setWidgets(data.widgets);
  };
  const applyTemplate=(templateId)=>{
    if(!canEdit) return;
    const next=buildTemplateWidgets(templateId);
    setWidgets(next);
    setSelected(null);
    setViewport({x:0,y:0});
    setScale(1);
    setModal(null);
  };
  const fitView=()=>{
    if(!widgets.length) return;
    const minX=Math.min(...widgets.map(w=>w.x)),minY=Math.min(...widgets.map(w=>w.y));
    const maxX=Math.max(...widgets.map(w=>w.x+w.w)),maxY=Math.max(...widgets.map(w=>w.y+w.h));
    const pw=window.innerWidth-(showLib?270:0)-(showProps?220:0);
    const ph=window.innerHeight-52-(isViewOnly?36:0)-26;
    const ns=Math.min(pw/(maxX-minX+80),ph/(maxY-minY+80),1.2);
    const snappedScale=Math.max(0.15,Math.round(ns*20)/20);
    setScale(snappedScale);setViewport({x:Math.round(-minX*snappedScale+40),y:Math.round(-minY*snappedScale+40)});
  };

  const sortedWidgets=useMemo(()=>[...asArray(widgets)].sort((a,b)=>(Number(a?.zIndex)||0)-(Number(b?.zIndex)||0)),[widgets]);

  const ctxItems=ctxMenu?[
    {icon:"⊕",label:"Duplicate",action:()=>duplicateWidget(ctxMenu.id),disabled:!canEdit},
    {icon:"↑",label:"Bring to Front",action:()=>bringFront(ctxMenu.id),disabled:!canEdit},
    {icon:"↓",label:"Send to Back",action:()=>sendBack(ctxMenu.id),disabled:!canEdit},
    {sep:true},
    {icon:"✕",label:"Delete",danger:true,action:()=>deleteWidget(ctxMenu.id),disabled:!canEdit},
  ]:[];

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return(
    <>
      <style>{CSS}</style>
      <div style={{display:"flex",flexDirection:"column",height:"100vh",background:T.bg,overflow:"hidden",fontFamily:T.fn}} onMouseMove={onMM} onMouseUp={onMU}>

        {/* ── TOPBAR ── */}
        <div style={{height:52,background:T.surface,borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",flexShrink:0,zIndex:200}}>
          {/* Logo */}
          <div style={{padding:"0 1.1rem",display:"flex",alignItems:"center",gap:7,borderRight:`1px solid ${T.border}`,height:"100%",flexShrink:0}}>
            <div style={{width:26,height:26,borderRadius:7,background:`linear-gradient(135deg,${T.accent},${T.teal})`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:900,color:"#fff",fontSize:12}}>d</div>
            <span style={{fontFamily:T.fnD,fontWeight:800,fontSize:"0.92rem",letterSpacing:"-0.02em"}}>data<span style={{color:T.accent}}>bi</span></span>
          </div>

          {/* Dashboard name + manager */}
          <div style={{padding:"0 0.9rem",display:"flex",alignItems:"center",gap:7,borderRight:`1px solid ${T.border}`,height:"100%"}}>
            <span style={{fontSize:12,fontWeight:600,color:T.text,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{dashName}</span>
            {!sharedDash&&<button className="icon-btn" onClick={()=>setModal("manager")} title="Manage Dashboards" style={{fontSize:11}}>▾</button>}
          </div>

          {/* Canvas tools */}
          <div style={{padding:"0 0.7rem",display:"flex",alignItems:"center",gap:3,borderRight:`1px solid ${T.border}`,height:"100%"}}>
            {canEdit&&<button className={`icon-btn ${showLib?"active":""}`} onClick={()=>setShowLib(p=>!p)} title="Widgets">⊞</button>}
            <button className={`icon-btn ${showProps?"active":""}`} onClick={()=>setShowProps(p=>!p)} title="Properties">◈</button>
            <div style={{width:1,height:16,background:T.border,margin:"0 2px"}}/>
            <button className={`icon-btn ${showGrid?"active":""}`} onClick={()=>setShowGrid(p=>!p)} title="Grid">⊹</button>
            <button className={`icon-btn ${showSections?"active":""}`} onClick={()=>setShowSections(p=>!p)} title="Sections">▤</button>
            {canEdit&&<button className={`icon-btn ${snap?"active":""}`} onClick={()=>setSnap(p=>!p)} title="Snap">⊞</button>}
            {canEdit&&<button className={`icon-btn ${sectionSnap?"active":""}`} onClick={()=>setSectionSnap(p=>!p)} title="Section Snap">⌗</button>}
            <div style={{width:1,height:16,background:T.border,margin:"0 2px"}}/>
            <button className="icon-btn" onClick={()=>setScale(s=>Math.min(3,s*1.15))}>+</button>
            <div onClick={()=>{setScale(1);setViewport({x:0,y:0});}} style={{minWidth:44,textAlign:"center",fontSize:10,fontFamily:T.fnM,color:T.mid,cursor:"pointer",padding:"2px 5px",borderRadius:5,border:`1px solid ${T.border}`}}>{Math.round(scale*100)}%</div>
            <button className="icon-btn" onClick={()=>setScale(s=>Math.max(0.15,s*0.87))}>−</button>
            <button className="icon-btn" onClick={fitView} title="Fit View" style={{fontSize:11}}>⊡</button>
          </div>

          <div style={{flex:1}}/>

          {/* Right tools */}
          <div style={{padding:"0 0.9rem",display:"flex",alignItems:"center",gap:6}}>
            <SaveIndicator status={saveStatus}/>
            <div style={{width:1,height:16,background:T.border}}/>

            {!sharedDash&&(
              <span className="chip" style={{color:ROLES[effectiveRole].color,borderColor:`${ROLES[effectiveRole].color}30`,background:`${ROLES[effectiveRole].color}10`}}>
                {ROLES[effectiveRole].label}
              </span>
            )}

            <div style={{width:1,height:16,background:T.border}}/>
            {canEdit&&(
              <select value={cardPreset} onChange={(e)=>applyCardPresetToAll(e.target.value)} style={{width:120,fontSize:10,padding:"3px 6px",background:T.surface}}>
                {CARD_STYLE_PRESETS.map((p)=><option key={p.id} value={p.id}>{`Card: ${p.label}`}</option>)}
              </select>
            )}
            {canEdit&&<button className="btn" onClick={()=>setModal("templates")} style={{fontSize:10,padding:"4px 10px"}}>Templates</button>}
            {canEdit&&selectedOrg?.id&&!sharedDash&&<button className="btn" onClick={()=>setModal("members")} style={{fontSize:10,padding:"4px 10px"}}>Members</button>}
            {canEdit&&<button className="btn" onClick={()=>setModal("import")} style={{fontSize:10,padding:"4px 10px"}}>⬆ Import</button>}
            {canExport&&<button className="btn" onClick={()=>setModal("export")} style={{fontSize:10,padding:"4px 10px"}}>⬇ Export</button>}
            {canShare&&<button className="btn success" onClick={()=>setModal("share")} style={{fontSize:10,padding:"4px 10px"}}>⊕ Share</button>}
            {canEdit&&<button className="btn primary" style={{fontSize:10,padding:"4px 12px"}} onClick={()=>addWidget("area")}>+ Widget</button>}
          </div>
        </div>

        {/* View-only banner */}
        {isViewOnly&&<ViewBanner role={effectiveRole} onRequestEdit={()=>alert("Access request sent! (demo)")}/>}

        {/* ── BODY ── */}
        <div style={{flex:1,display:"flex",overflow:"hidden"}}>

          {/* Widget Library / Builder */}
          {showLib&&canEdit&&(
            <div className="slideRight" style={{width:270,background:T.surface,borderRight:`1px solid ${T.border}`,display:"flex",flexDirection:"column",flexShrink:0,overflowY:"auto"}}>
              <div style={{padding:"0.7rem 0.9rem",borderBottom:`1px solid ${T.border}`,position:"sticky",top:0,background:T.surface,zIndex:2}}>
                <div style={{display:"flex",gap:4}}>
                  <button className={`tab ${libTab==="widgets"?"active":""}`} onClick={()=>setLibTab("widgets")}>Widgets</button>
                  <button className={`tab ${libTab==="builder"?"active":""}`} onClick={()=>setLibTab("builder")} disabled={!selectedIsChart}>Chart Builder</button>
                </div>
              </div>

              {libTab==="widgets"&&(
                <div style={{padding:"0.5rem",display:"flex",flexDirection:"column",gap:3}}>
                  {WIDGET_TYPES.map(wt=>(
                    <button key={wt.id} className="widget-type" onClick={()=>addWidget(wt.id)}>
                      <div style={{width:26,height:26,borderRadius:7,background:`${T.border}60`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>{wt.icon}</div>
                      <div>
                        <p style={{fontSize:11,fontWeight:600,color:T.text}}>{wt.label}</p>
                        <p style={{fontSize:9,color:T.dim}}>{wt.dw}x{wt.dh}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {libTab==="builder"&&(
                <div style={{padding:"0.7rem",display:"flex",flexDirection:"column",gap:8}}>
                  {!selectedIsChart&&<p style={{fontSize:11,color:T.dim}}>Select a chart widget first.</p>}
                  {selectedIsChart&&(
                    <>
                      <input value={chartBuilder.name||""} onChange={(e)=>setChartBuilder((p)=>({...p,name:e.target.value}))} placeholder="Chart title"/>
                      <select value={chartBuilder.chart_type} onChange={(e)=>setChartBuilder((p)=>({...p,chart_type:e.target.value}))}>
                        {['bar','line','area','pie','combo','radar','table'].map((ct)=><option key={ct} value={ct}>{ct.toUpperCase()}</option>)}
                      </select>
                      <select value={chartBuilder.chart_skin||"classic"} onChange={(e)=>setChartBuilder((p)=>({...p,chart_skin:e.target.value}))}>
                        {Object.keys(CHART_SKINS).map((s)=><option key={s} value={s}>{`Skin: ${s}`}</option>)}
                      </select>
                      <select value={chartBuilder.dataset||""} onChange={(e)=>setChartBuilder((p)=>({...p,dataset:e.target.value,saved_query:"",group_by_column:"",metric_column:"",x_column:"",y_column:""}))}>
                        <option value="">Select dataset</option>
                        {builderDatasets.map((d)=><option key={d.dataset_id||d.id} value={d.dataset_id||d.id}>{d.name||d.dataset_name}</option>)}
                      </select>
                      <select value={chartBuilder.mode} onChange={(e)=>setChartBuilder((p)=>({...p,mode:e.target.value}))}>
                        <option value="basic">Basic</option>
                        <option value="saved">Saved Query</option>
                      </select>

                      {chartBuilder.mode==="basic"&&(
                        <>
                          <select value={chartBuilder.group_by_column||""} onChange={(e)=>setChartBuilder((p)=>({...p,group_by_column:e.target.value}))} disabled={builderColumnsLoading||!builderColumns.length}>
                            <option value="">Group by column</option>
                            {builderColumns.map((c)=><option key={c.name} value={c.name}>{c.name}</option>)}
                          </select>
                          <select value={chartBuilder.aggregation||"sum"} onChange={(e)=>setChartBuilder((p)=>({...p,aggregation:e.target.value}))}>
                            {['sum','avg','count','min','max'].map((a)=><option key={a} value={a}>{a.toUpperCase()}</option>)}
                          </select>
                          {chartBuilder.aggregation!=="count"&&(
                            <select value={chartBuilder.metric_column||""} onChange={(e)=>setChartBuilder((p)=>({...p,metric_column:e.target.value}))}>
                              <option value="">Metric column</option>
                              {builderColumns.filter((c)=>c.is_numeric).map((c)=><option key={c.name} value={c.name}>{c.name}</option>)}
                            </select>
                          )}
                          <input value={chartBuilder.x_axis_label||""} onChange={(e)=>setChartBuilder((p)=>({...p,x_axis_label:e.target.value}))} placeholder="X-axis title (optional)"/>
                          <input value={chartBuilder.y_axis_label||""} onChange={(e)=>setChartBuilder((p)=>({...p,y_axis_label:e.target.value}))} placeholder="Y-axis title (optional)"/>
                          <input type="number" min={1} max={500} value={chartBuilder.limit||20} onChange={(e)=>setChartBuilder((p)=>({...p,limit:e.target.value}))}/>
                        </>
                      )}

                      {chartBuilder.mode==="saved"&&(
                        <>
                          <select value={chartBuilder.saved_query||""} onChange={(e)=>setChartBuilder((p)=>({...p,saved_query:e.target.value}))} disabled={builderQueriesLoading||!builderQueries.length}>
                            <option value="">Select saved query</option>
                            {builderQueries.map((q)=><option key={q.id} value={q.id}>{q.name||`Query ${q.id}`}</option>)}
                          </select>
                          <input value={chartBuilder.x_axis_label||""} onChange={(e)=>setChartBuilder((p)=>({...p,x_axis_label:e.target.value}))} placeholder="X-axis title (optional)"/>
                          <input value={chartBuilder.y_axis_label||""} onChange={(e)=>setChartBuilder((p)=>({...p,y_axis_label:e.target.value}))} placeholder="Y-axis title (optional)"/>
                          <select value={chartBuilder.x_column||""} onChange={(e)=>setChartBuilder((p)=>({...p,x_column:e.target.value}))}>
                            <option value="">X-axis label column (optional)</option>
                            {builderColumns.map((c)=><option key={`x-${c.name}`} value={c.name}>{c.name}</option>)}
                          </select>
                          <select value={chartBuilder.y_column||""} onChange={(e)=>setChartBuilder((p)=>({...p,y_column:e.target.value}))}>
                            <option value="">Y-axis value column (optional)</option>
                            {builderColumns.filter((c)=>c.is_numeric).map((c)=><option key={`y-${c.name}`} value={c.name}>{c.name}</option>)}
                          </select>
                          <input type="number" min={1} max={500} value={chartBuilder.limit||20} onChange={(e)=>setChartBuilder((p)=>({...p,limit:e.target.value}))}/>
                        </>
                      )}

                      <button className="btn primary" onClick={runWidgetBuilderPreview} disabled={builderLoading||builderDatasetsLoading||builderColumnsLoading}>{builderLoading?"Updating...":"Run Live Update"}</button>
                      {builderDatasetsLoading&&<p style={{fontSize:10,color:T.dim}}>Loading datasets...</p>}
                      {builderQueriesLoading&&<p style={{fontSize:10,color:T.dim}}>Loading saved queries...</p>}
                      {builderColumnsLoading&&<p style={{fontSize:10,color:T.dim}}>Loading columns...</p>}
                      {builderError&&<div style={{padding:"7px 8px",borderRadius:7,background:`${T.red}12`,border:`1px solid ${T.red}30`,color:T.red,fontSize:10}}>{builderError}</div>}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
          {/* ── CANVAS ── */}
          <div ref={canvasRef} id="dashboard-canvas-area" style={{flex:1,position:"relative",overflow:"hidden",background:T.canvas,cursor:panRef.current?"grabbing":"default"}}
            onMouseDown={onCanvasMD}>

            {/* Dot grid */}
            {showGrid&&(
              <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}} xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <pattern id="dotGrid" width={SNAP*scale} height={SNAP*scale} patternUnits="userSpaceOnUse" x={viewport.x%(SNAP*scale)} y={viewport.y%(SNAP*scale)}>
                    <circle cx={SNAP*scale} cy={SNAP*scale} r={0.9} fill="rgba(255,255,255,0.028)"/>
                  </pattern>
                  <pattern id="dotGridLg" width={SNAP*scale*5} height={SNAP*scale*5} patternUnits="userSpaceOnUse" x={viewport.x%(SNAP*scale*5)} y={viewport.y%(SNAP*scale*5)}>
                    <circle cx={SNAP*scale*5} cy={SNAP*scale*5} r={1.5} fill="rgba(255,255,255,0.055)"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#dotGrid)"/>
                <rect width="100%" height="100%" fill="url(#dotGridLg)"/>
              </svg>
            )}

            {showSections&&(
              <div style={{position:"absolute",left:Math.round(viewport.x),top:Math.round(viewport.y),transformOrigin:"0 0",transform:`scale(${Math.round(scale*100)/100})`,pointerEvents:"none"}}>
                {LAYOUT_SECTIONS.map((s)=>(
                  <div key={s.id} style={{position:"absolute",left:s.x,top:s.y,width:s.w,height:s.h,border:`1px dashed ${T.accent}66`,borderRadius:10,background:`${T.accent}08`}}>
                    <span style={{position:"absolute",top:6,left:8,fontSize:9,color:T.accent,fontFamily:T.fnM,textTransform:"uppercase"}}>{s.label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Widgets */}
            <div style={{position:"absolute",left:Math.round(viewport.x),top:Math.round(viewport.y),transformOrigin:"0 0",transform:`scale(${Math.round(scale*100)/100})`,willChange:"transform",backfaceVisibility:"hidden"}}>
              {sortedWidgets.map(widget=>{
                const isSel=selected===widget.id;
                return(
                  <div key={widget.id}
                    style={{position:"absolute",left:widget.x,top:widget.y,width:widget.w,height:widget.h,
                      background:widget.bg||T.card,border:`1px solid ${isSel?T.selBdr:widget.borderColor||T.border}`,
                      borderRadius:widget.br||12,opacity:widget.opacity||1,zIndex:widget.zIndex,
                      boxShadow:isSel?`0 0 0 2px ${T.selBdr},0 8px 40px rgba(0,0,0,.5)`:"0 4px 24px rgba(0,0,0,.4)",
                      display:"flex",flexDirection:"column",
                      cursor:canEdit?(drag.current?.id===widget.id?"grabbing":"grab"):"default",
                      transition:"box-shadow .15s,border-color .15s",userSelect:"none",overflow:"hidden"
                    }}
                    onMouseDown={e=>onWidgetMD(e,widget.id)}
                    onContextMenu={e=>{e.preventDefault();setSelected(widget.id);setCtxMenu({x:e.clientX,y:e.clientY,id:widget.id});}}>

                    {/* Header */}
                    <div style={{padding:"0.5rem 0.75rem 0.4rem",borderBottom:`1px solid ${(widget.borderColor||T.border)}50`,display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
                      <div style={{display:"flex",alignItems:"center",gap:5}}>
                        <span style={{fontSize:9,opacity:.35}}>{WIDGET_TYPES.find(t=>t.id===widget.type)?.icon}</span>
                        <span style={{fontFamily:T.fnD,fontSize:10,fontWeight:700,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",maxWidth:widget.w-70}}>{widget.title}</span>
                      </div>
                      {isSel&&canEdit&&(
                        <div style={{display:"flex",gap:2}}>
                          <button onMouseDown={e=>e.stopPropagation()} onClick={()=>duplicateWidget(widget.id)} style={{background:"none",border:"none",cursor:"pointer",color:T.mid,fontSize:9,padding:"1px 4px",borderRadius:3}}>⊕</button>
                          <button onMouseDown={e=>e.stopPropagation()} onClick={()=>deleteWidget(widget.id)} style={{background:"none",border:"none",cursor:"pointer",color:T.red,fontSize:9,padding:"1px 4px",borderRadius:3}}>✕</button>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div style={{flex:1,overflow:"hidden",minHeight:0}}>
                      <WidgetContent widget={widget} viewOnly={isViewOnly}/>
                    </div>

                    {/* Resize handles */}
                    {isSel&&canEdit&&HANDLES.map(h=>(
                      <div key={h.id} onMouseDown={e=>{e.stopPropagation();onResizeMD(e,widget.id,h.id);}}
                        style={{position:"absolute",...h.s,background:T.accent,cursor:h.cursor,zIndex:10,opacity:.9}}/>
                    ))}

                    {/* View-only lock overlay */}
                    {isViewOnly&&isSel&&(
                      <div style={{position:"absolute",top:6,right:6,background:`${T.orange}18`,border:`1px solid ${T.orange}40`,borderRadius:5,padding:"2px 6px",fontSize:9,color:T.orange,pointerEvents:"none"}}>🔒 View only</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Minimap */}
            <Minimap widgets={widgets} viewport={viewport} scale={scale}/>

            {/* Bottom hint */}
            <div style={{position:"absolute",bottom:14,left:"50%",transform:"translateX(-50%)",fontSize:9,color:T.dim,fontFamily:T.fnM,background:`${T.surface}cc`,padding:"3px 12px",borderRadius:5,border:`1px solid ${T.border}`,pointerEvents:"none",whiteSpace:"nowrap"}}>
              {canEdit?"Alt+drag pan · Ctrl+scroll zoom · Del delete · Ctrl+D duplicate · Arrow nudge":"View only — scroll/zoom to explore"}
            </div>

            {/* Empty state */}
            {widgets.length===0&&(
              <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12,pointerEvents:"none"}}>
                <div style={{width:60,height:60,borderRadius:16,background:`${T.accent}10`,border:`1px dashed ${T.accent}30`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>▦</div>
                <p style={{fontSize:12,color:T.dim}}>Open the Widget Library and click to add widgets</p>
              </div>
            )}
          </div>

          {/* Properties Panel */}
          {showProps&&(
            <div style={{width:215,background:T.surface,borderLeft:`1px solid ${T.border}`,display:"flex",flexDirection:"column",flexShrink:0}}>
              <div style={{padding:"0.6rem 0.85rem",borderBottom:`1px solid ${T.border}`,flexShrink:0,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <p style={{fontSize:9,fontWeight:700,color:T.dim,textTransform:"uppercase",letterSpacing:"0.07em"}}>Properties</p>
                {isViewOnly&&<span className="chip" style={{color:T.orange,borderColor:`${T.orange}30`,background:`${T.orange}10`}}>View only</span>}
              </div>
              <div style={{flex:1,overflowY:"auto"}}>
                <PropsPanel widget={selectedWidget} onChange={p=>updateWidget(selected,p)}
                  onDelete={()=>deleteWidget(selected)} onDuplicate={()=>duplicateWidget(selected)}
                  onBringFront={()=>bringFront(selected)} onSendBack={()=>sendBack(selected)} canEdit={canEdit}/>
              </div>
            </div>
          )}
        </div>

        {/* ── STATUS BAR ── */}
        <div style={{height:26,background:T.surface,borderTop:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 1rem",flexShrink:0}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <div style={{display:"flex",alignItems:"center",gap:5}}>
              <div style={{width:5,height:5,borderRadius:"50%",background:T.teal,animation:"pulse 2s ease infinite"}}/>
              <span style={{fontSize:9,color:T.dim,fontFamily:T.fnM}}>{widgets.length} widgets · z:{maxZ} · {dashboards.length} dashboards</span>
            </div>
            {selectedWidget&&<span style={{fontSize:9,color:T.accent,fontFamily:T.fnM}}>↳ {selectedWidget.title} · {Math.round(selectedWidget.x)},{Math.round(selectedWidget.y)} · {selectedWidget.w}×{selectedWidget.h}</span>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:9,color:T.dim,fontFamily:T.fnM}}>x:{Math.round(-viewport.x/scale)} y:{Math.round(-viewport.y/scale)} · {Math.round(scale*100)}%</span>
            {snap&&<span style={{fontSize:9,color:T.dim,fontFamily:T.fnM}}>SNAP</span>}
          </div>
        </div>
      </div>

      {/* ── MODALS ── */}
      {modal==="share"&&<ShareModal widgets={widgets} dashName={dashName} onClose={()=>setModal(null)}/>}
      {modal==="export"&&<ExportModal widgets={widgets} dashName={dashName} onClose={()=>setModal(null)}/>}
      {modal==="import"&&<ImportModal onImport={importDash} onClose={()=>setModal(null)}/>}
      {modal==="templates"&&<TemplateGalleryModal onApply={applyTemplate} onClose={()=>setModal(null)}/>}
      {modal==="manager"&&<DashboardManager dashboards={dashboards} activeDashId={activeDashId} onSwitch={switchDash} onCreate={createDash} onRename={renameDash} onDelete={deleteDash} onClose={()=>setModal(null)} currentWidgets={widgets} role={effectiveRole}/>}
      {modal==="members"&&(
        <MemberManagerModal
          orgName={selectedOrg?.name}
          members={orgMembers}
          loading={membersLoading}
          error={membersError}
          form={memberForm}
          onFormChange={setMemberForm}
          onAdd={addMember}
          onDelete={deleteMember}
          onReload={loadMembers}
          onClose={()=>setModal(null)}
          submitting={memberSubmitting}
          deletingId={memberDeletingId}
        />
      )}
      {ctxMenu&&<CtxMenu x={ctxMenu.x} y={ctxMenu.y} items={ctxItems} onClose={()=>setCtxMenu(null)}/>}
    </>
  );
}

