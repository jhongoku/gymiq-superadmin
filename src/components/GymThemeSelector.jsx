import { useEffect, useRef } from "react";

const THEMES = [
  { id: "aurora",    label: "Aurora boreal" },
  { id: "breath",    label: "Respiración" },
  { id: "dusk",      label: "Atardecer sereno" },
  { id: "mist",      label: "Capas de neblina" },
  { id: "gradH",     label: "Degradado horizontal" },
  { id: "plasma",    label: "Plasma" },
  { id: "vortex",    label: "Vórtice" },
  { id: "lava",      label: "Lava" },
  { id: "stripesH",  label: "Franjas horizontales" },
  { id: "stripesV",  label: "Franjas verticales" },
  { id: "stripesD",  label: "Franjas diagonales" },
  { id: "circles",   label: "Círculos concéntricos" },
  { id: "grid",      label: "Cuadrícula" },
  { id: "triangles", label: "Triángulos (patrón)" },
  { id: "hexagons",  label: "Hexágonos (patrón)" },
  { id: "diamonds",  label: "Diamantes (patrón)" },
  { id: "dots",      label: "Puntos (patrón)" },
  { id: "waves",     label: "Ondas" },
  { id: "tapiz",     label: "🖼 Tapiz de logo" },
];

function hex2rgb(h) { return [parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)]; }
function rgba(hex,a) { const [r,g,b]=hex2rgb(hex); return `rgba(${r},${g},${b},${a})`; }
function lighten(hex,a) { const [r,g,b]=hex2rgb(hex); return `rgb(${Math.round(r+(255-r)*a)},${Math.round(g+(255-g)*a)},${Math.round(b+(255-b)*a)})`; }
function mix(h1,h2,t) { const [r1,g1,b1]=hex2rgb(h1),[r2,g2,b2]=hex2rgb(h2); return `rgb(${Math.round(r1+(r2-r1)*t)},${Math.round(g1+(g2-g1)*t)},${Math.round(b1+(b2-b1)*t)})`; }

function drawTheme(canvas,id,c1,c2,c3,tapizImageRef={current:null},tapizBgColor="#1565C0",tapizOpacity=0.3,tapizLogoSize=70){
  const ctx=canvas.getContext("2d"),W=canvas.width,H=canvas.height;
  ctx.clearRect(0,0,W,H);
  if(id==="aurora"){
    ctx.fillStyle=lighten(c3,.55);ctx.fillRect(0,0,W,H);
    [[c1,.2,.35,.55],[c2,.65,.6,.48],[c3,.85,.25,.4]].forEach(([c,cx,cy,rx])=>{
      const gr=ctx.createRadialGradient(W*cx,H*cy,0,W*cx,H*cy,W*rx);
      gr.addColorStop(0,rgba(c,.55));gr.addColorStop(1,rgba(c,0));ctx.fillStyle=gr;ctx.fillRect(0,0,W,H);});
  } else if(id==="breath"){
    const g=ctx.createRadialGradient(W*.5,H*.5,0,W*.5,H*.5,W*.8);
    g.addColorStop(0,lighten(c2,.55));g.addColorStop(.5,lighten(c1,.3));g.addColorStop(1,lighten(c3,.15));
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  } else if(id==="dusk"){
    const g=ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,c1);g.addColorStop(.5,mix(c1,c2,.5));g.addColorStop(.8,lighten(c2,.3));g.addColorStop(1,lighten(c3,.4));
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  } else if(id==="mist"){
    ctx.fillStyle=lighten(c1,.55);ctx.fillRect(0,0,W,H);
    [.75,.5,.28].forEach((y,i)=>{
      const g=ctx.createLinearGradient(0,H*(y-.1),0,H*(y+.18));
      g.addColorStop(0,rgba([c1,c2,c3][i],0));g.addColorStop(.4,rgba([c1,c2,c3][i],.28));g.addColorStop(1,rgba([c1,c2,c3][i],0));
      ctx.fillStyle=g;ctx.fillRect(0,H*(y-.12),W,H*.35);});
  } else if(id==="gradH"){
    const g=ctx.createLinearGradient(0,0,W,0);
    g.addColorStop(0,c1);g.addColorStop(.5,c2);g.addColorStop(1,c3);ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  } else if(id==="plasma"){
    const g=ctx.createRadialGradient(W*.5,H*.5,0,W*.5,H*.5,W*.7);
    g.addColorStop(0,c2);g.addColorStop(.4,c1);g.addColorStop(1,c3);ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  } else if(id==="vortex"){
    const g=ctx.createRadialGradient(W*.5,H*.5,0,W*.5,H*.5,W*.8);
    g.addColorStop(0,c2);g.addColorStop(.45,c1);g.addColorStop(1,c3);ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  } else if(id==="lava"){
    const g=ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,c3);g.addColorStop(.5,c1);g.addColorStop(1,mix(c1,c2,.4));ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  } else if(id==="stripesH"){
    ctx.fillStyle=c1; ctx.fillRect(0,0,W,H/3);
    ctx.fillStyle=c2; ctx.fillRect(0,H/3,W,H/3);
    ctx.fillStyle=c3; ctx.fillRect(0,H*2/3,W,H/3);
  } else if(id==="stripesV"){
    ctx.fillStyle=c1; ctx.fillRect(0,0,W/3,H);
    ctx.fillStyle=c2; ctx.fillRect(W/3,0,W/3,H);
    ctx.fillStyle=c3; ctx.fillRect(W*2/3,0,W/3,H);
  } else if(id==="stripesD"){
    const slant=H*0.6;
    ctx.fillStyle=c1; ctx.fillRect(0,0,W,H);
    ctx.beginPath();
    ctx.moveTo(W*0.33-slant,0); ctx.lineTo(W*0.66-slant,H);
    ctx.lineTo(W*0.66+slant,H); ctx.lineTo(W*0.33+slant,0);
    ctx.closePath(); ctx.fillStyle=c2; ctx.fill();
    ctx.beginPath();
    ctx.moveTo(W*0.66-slant,0); ctx.lineTo(W+slant,0);
    ctx.lineTo(W+slant,H); ctx.lineTo(W*0.66+slant,H);
    ctx.closePath(); ctx.fillStyle=c3; ctx.fill();
  } else if(id==="circles"){
    ctx.fillStyle=c1; ctx.fillRect(0,0,W,H);
    const cx=W/2, cy=H/2;
    [.9,.65,.38].forEach((r,i)=>{
      ctx.beginPath();
      ctx.arc(cx,cy,Math.min(W,H)*r/2,0,Math.PI*2);
      ctx.fillStyle=[c2,c3,c2][i]; ctx.fill();
    });
  } else if(id==="grid"){
    const cols=6, rows=4, colors=[c1,c2,c3];
    const cw=W/cols, ch=H/rows;
    for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
      ctx.fillStyle=colors[(r+c)%3];
      ctx.fillRect(c*cw,r*ch,cw,ch);
    }
  } else if(id==="triangles"){
    const s=Math.min(W,H)*0.18;
    const cols=Math.ceil(W/(s*2))+1, rows=Math.ceil(H/(s*1.5))+1;
    const colors=[c1,c2,c3];
    for(let row=0;row<rows;row++) for(let col=0;col<cols*2;col++){
      const x=col*s-(row%2===0?0:s), y=row*s*1.5;
      ctx.beginPath();
      if(col%2===0){ ctx.moveTo(x,y+s); ctx.lineTo(x+s,y); ctx.lineTo(x+s*2,y+s); }
      else { ctx.moveTo(x,y); ctx.lineTo(x+s,y+s); ctx.lineTo(x+s*2,y); }
      ctx.closePath();
      ctx.fillStyle=colors[(row*2+col)%3]; ctx.fill();
      ctx.strokeStyle="rgba(0,0,0,0.08)"; ctx.lineWidth=0.5; ctx.stroke();
    }
  } else if(id==="hexagons"){
    const s=Math.min(W,H)*0.11;
    const hw=s*Math.sqrt(3), hh=s*2;
    const cols=Math.ceil(W/hw)+2, rows=Math.ceil(H/(hh*0.75))+2;
    const colors=[c1,c2,c3];
    for(let row=0;row<rows;row++) for(let col=0;col<cols;col++){
      const cx=col*hw+(row%2===0?0:hw/2)-hw/2, cy=row*hh*0.75-hh/2;
      ctx.beginPath();
      for(let k=0;k<6;k++){
        const a=Math.PI/180*(60*k-30);
        k===0?ctx.moveTo(cx+s*Math.cos(a),cy+s*Math.sin(a)):ctx.lineTo(cx+s*Math.cos(a),cy+s*Math.sin(a));
      }
      ctx.closePath();
      ctx.fillStyle=colors[(row*3+col)%3]; ctx.fill();
      ctx.strokeStyle="rgba(0,0,0,0.1)"; ctx.lineWidth=0.5; ctx.stroke();
    }
  } else if(id==="diamonds"){
    const s=Math.min(W,H)*0.13;
    const cols=Math.ceil(W/(s*2))+2, rows=Math.ceil(H/(s*2))+2;
    const colors=[c1,c2,c3];
    for(let row=0;row<rows;row++) for(let col=0;col<cols;col++){
      const cx=col*s*2+(row%2===0?0:s)-s, cy=row*s*2-s;
      ctx.beginPath();
      ctx.moveTo(cx,cy-s); ctx.lineTo(cx+s,cy); ctx.lineTo(cx,cy+s); ctx.lineTo(cx-s,cy);
      ctx.closePath();
      ctx.fillStyle=colors[(row+col)%3]; ctx.fill();
      ctx.strokeStyle="rgba(0,0,0,0.08)"; ctx.lineWidth=0.5; ctx.stroke();
    }
  } else if(id==="dots"){
    ctx.fillStyle=c1; ctx.fillRect(0,0,W,H);
    const spacing=Math.min(W,H)*0.12;
    const cols=Math.ceil(W/spacing)+2, rows=Math.ceil(H/spacing)+2;
    const colors=[c2,c3];
    for(let row=0;row<rows;row++) for(let col=0;col<cols;col++){
      const cx=col*spacing+(row%2===0?0:spacing/2)-spacing/2, cy=row*spacing-spacing/2;
      ctx.beginPath(); ctx.arc(cx,cy,spacing*0.35,0,Math.PI*2);
      ctx.fillStyle=colors[(row+col)%2]; ctx.fill();
    }
  } else if(id==="waves"){
    ctx.fillStyle=c1; ctx.fillRect(0,0,W,H);
    [0.3,0.6,0.85].forEach((yp,i)=>{
      ctx.beginPath(); ctx.moveTo(0,H);
      for(let x=0;x<=W;x+=4){
        const y=H*yp+Math.sin(x/W*Math.PI*4)*H*0.07;
        ctx.lineTo(x,y);
      }
      ctx.lineTo(W,H); ctx.closePath();
      ctx.fillStyle=rgba([c3,c2,c1][i],0.85); ctx.fill();
    });
  } else if(id==="tapiz"){
    ctx.fillStyle=tapizBgColor||c1;
    ctx.fillRect(0,0,W,H);
    if(tapizImageRef.current){
      const s=tapizLogoSize*(W/400);
      const cols=Math.ceil(W/s)+2, rows=Math.ceil(H/s)+2;
      ctx.globalAlpha=tapizOpacity;
      for(let row=0;row<rows;row++) for(let col=0;col<cols;col++){
        const x=col*s+(row%2===0?0:s*0.5)-s, y=row*s-s;
        ctx.drawImage(tapizImageRef.current,x,y,s,s);
      }
      ctx.globalAlpha=1.0;
    }
  }
}

function ThemeCanvas({id,c1,c2,c3,selected,onClick,tapizImageRef,tapizBgColor,tapizOpacity,tapizLogoSize}){
  const ref=useRef(null);
  useEffect(()=>{
    if(ref.current) drawTheme(ref.current,id,c1,c2,c3,tapizImageRef,tapizBgColor,tapizOpacity,tapizLogoSize);
  },[id,c1,c2,c3,tapizBgColor,tapizOpacity,tapizLogoSize]);
  return(
    <div onClick={onClick} style={{cursor:"pointer",borderRadius:"8px",overflow:"hidden",border:selected?"3px solid #1976D2":"2px solid #ddd"}}>
      <canvas ref={ref} width={180} height={80} style={{display:"block",width:"100%",height:"80px"}}/>
      <div style={{fontSize:"12px",padding:"5px 8px",background:"#fff",color:"#333",fontWeight:selected?"bold":"normal"}}>{THEMES.find(t=>t.id===id)?.label}</div>
    </div>
  );
}

export default function GymThemeSelector({
  primaryColor,secondaryColor,tertiaryColor,
  themeStyle,onPrimaryColorChange,onSecondaryColorChange,onTertiaryColorChange,onThemeStyleChange,
  trainButtonColor,onTrainButtonColorChange,trainButtonTextColor,onTrainButtonTextColorChange,
  tapizImageUrl,onTapizImageChange,
  tapizBgColor,onTapizBgColorChange,
  tapizOpacity,onTapizOpacityChange,
  tapizLogoSize,onTapizLogoSizeChange,
}){
  const tapizImageRef = useRef(null);

  useEffect(()=>{
    if(!tapizImageUrl) return;
    const img = new Image();
    img.onload = () => { tapizImageRef.current = img; };
    img.src = tapizImageUrl;
  },[tapizImageUrl]);

  const colorInput=(label,value,onChange)=>(
    <div style={{marginBottom:"12px"}}>
      <label style={{display:"block",fontWeight:"bold",marginBottom:"6px",fontSize:"13px"}}>{label}</label>
      <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
        <input type="color" value={value} onChange={(e)=>onChange(e.target.value)} style={{width:"44px",height:"38px",border:"1px solid #ccc",borderRadius:"6px",padding:"2px",cursor:"pointer"}}/>
        <input type="text" value={value} onChange={(e)=>onChange(e.target.value)} placeholder="#000000" style={{flex:1,padding:"8px",border:"1px solid #ccc",borderRadius:"6px",boxSizing:"border-box"}}/>
      </div>
    </div>
  );
  return(
    <div style={{marginTop:"16px",padding:"16px",backgroundColor:"#f0f4ff",border:"1px solid #c5d5f5",borderRadius:"10px"}}>
      <h4 style={{margin:"0 0 14px 0",color:"#1565C0"}}>Tema visual de la app</h4>
      {colorInput("Color 1 (primario)",primaryColor,onPrimaryColorChange)}
      {colorInput("Color 2 (secundario)",secondaryColor,onSecondaryColorChange)}
      {colorInput("Color 3 (terciario)",tertiaryColor,onTertiaryColorChange)}
      {onTrainButtonColorChange && colorInput("Color botón Entrenar hoy",trainButtonColor||"#1976D2",onTrainButtonColorChange)}
      {onTrainButtonTextColorChange && colorInput("Color texto botón Entrenar hoy",trainButtonTextColor||"#FFFFFF",onTrainButtonTextColorChange)}
      <label style={{display:"block",fontWeight:"bold",marginBottom:"10px",fontSize:"13px"}}>Estilo visual</label>
      <div style={{display:"flex",gap:"12px",alignItems:"flex-start"}}>
        <div style={{display:"flex",flexDirection:"column",gap:"4px",minWidth:"170px"}}>
          {THEMES.map((t)=>(
            <div key={t.id} onClick={()=>onThemeStyleChange(t.id)} style={{padding:"8px 12px",borderRadius:"6px",cursor:"pointer",backgroundColor:themeStyle===t.id?"#1976D2":"#fff",color:themeStyle===t.id?"#fff":"#333",border:themeStyle===t.id?"1px solid #1976D2":"1px solid #ddd",fontWeight:themeStyle===t.id?"bold":"normal",fontSize:"13px"}}>
              {t.label}
            </div>
          ))}
        </div>
        <div style={{flex:1}}>
          <ThemeCanvas
            id={themeStyle}
            c1={primaryColor}
            c2={secondaryColor}
            c3={tertiaryColor}
            selected={true}
            onClick={()=>{}}
            tapizImageRef={tapizImageRef}
            tapizBgColor={tapizBgColor}
            tapizOpacity={tapizOpacity}
            tapizLogoSize={tapizLogoSize}
          />
        </div>
      </div>
      {themeStyle==="tapiz" && (
        <div style={{marginTop:"14px",padding:"12px",backgroundColor:"#f9f0ff",border:"1px solid #ce93d8",borderRadius:"8px"}}>
          <label style={{display:"block",fontWeight:"bold",marginBottom:"6px",fontSize:"13px"}}>
            Imagen del tapiz
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e)=>{
              const file=e.target.files?.[0];
              if(!file) return;
              const url=URL.createObjectURL(file);
              const img=new Image();
              img.onload=()=>{ tapizImageRef.current=img; };
              img.src=url;
              if(onTapizImageChange) onTapizImageChange(file);
            }}
            style={{width:"100%",boxSizing:"border-box",marginBottom:"10px"}}
          />
          <label style={{display:"block",fontWeight:"bold",marginBottom:"4px",fontSize:"13px"}}>Color de fondo</label>
          <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"10px"}}>
            <input type="color" value={tapizBgColor||"#1565C0"} onChange={(e)=>onTapizBgColorChange&&onTapizBgColorChange(e.target.value)} style={{width:"44px",height:"38px",border:"1px solid #ccc",borderRadius:"6px",padding:"2px",cursor:"pointer"}}/>
            <input type="text" value={tapizBgColor||"#1565C0"} onChange={(e)=>onTapizBgColorChange&&onTapizBgColorChange(e.target.value)} style={{flex:1,padding:"8px",border:"1px solid #ccc",borderRadius:"6px",boxSizing:"border-box"}}/>
          </div>
          <label style={{display:"block",fontWeight:"bold",marginBottom:"4px",fontSize:"13px"}}>
            Opacidad del logo: {Math.round((tapizOpacity||0.3)*100)}%
          </label>
          <input type="range" min="10" max="100" value={Math.round((tapizOpacity||0.3)*100)}
            onChange={(e)=>onTapizOpacityChange&&onTapizOpacityChange(parseInt(e.target.value)/100)}
            style={{width:"100%",marginBottom:"10px"}}/>
          <label style={{display:"block",fontWeight:"bold",marginBottom:"4px",fontSize:"13px"}}>
            Tamaño del logo: {tapizLogoSize||70}px
          </label>
          <input type="range" min="30" max="150" value={tapizLogoSize||70}
            onChange={(e)=>onTapizLogoSizeChange&&onTapizLogoSizeChange(parseInt(e.target.value))}
            style={{width:"100%"}}/>
        </div>
      )}
    </div>
  );
}
