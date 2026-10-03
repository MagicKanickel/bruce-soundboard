// ============================================================
//  Soundboard  —  Bruce (T-Embed CC1101)
// ------------------------------------------------------------
//  Plays WAV files from a folder. Favorites, loop, color
//  themes and auto-detection of new sounds.
//
//  Sounds live in:  /sounds/   (drop more .wav files there;
//  detected on start or via Settings > Rescan).
//
//  Controls (T-Embed: encoder + top button):
//    Rotate encoder       = scroll the list
//    Press encoder (SEL)  = play the selected sound
//    Top button  (ESC)    = open options (Loop / Favorite)
//                           on a sound; go back elsewhere
//    Menu row "Exit"      = quit the app
//
//  Note: a single WAV cannot be stopped mid-play, and a
//  looping sound can only be stopped by rebooting the
//  device (hardware/interpreter limitation).
//
//  (c) Benjamin Clark — see About for the license.
// ============================================================

var keyboard = require("keyboard");
var audio    = require("audio");
var display  = require("display");
var storage  = require("storage");

// ------- config -------
// Sounds are read from the app's own install folder (App Store puts
// everything in /BruceJS/<category>/). Falls back to /sounds for a
// standalone install. Resolved at runtime in main().
var SOUND_DIR = "/sounds";
var STATE_FILE = "/sounds/.soundboard.json";
function resolveDir(){
  var d = (typeof __dirpath!=="undefined" && __dirpath) ? __dirpath
        : (typeof __dirname!=="undefined" && __dirname) ? __dirname
        : "/sounds";
  d = ""+d;
  if(d.length>1 && d.charAt(d.length-1)==="/") d=d.substring(0,d.length-1);
  return d;
}
var LICENSE = "All sounds and this app belong to Benjamin Clark. "
            + "You may use and play them freely, but NOT commercially.";
var THEMES = ["System","Red","Orange","Green","Blue","Yellow","Cyan","Magenta","White"];

// ------- color helpers -------
function C(r,g,b){ return display.color(r,g,b); }
function themeAccent(name){
  if(name==="System"){ return (typeof BRUCE_PRICOLOR!=="undefined")? BRUCE_PRICOLOR : C(232,149,74); }
  if(name==="Red")     return C(230,70,70);
  if(name==="Orange")  return C(232,149,74);
  if(name==="Green")   return C(95,195,125);
  if(name==="Blue")    return C(90,150,255);
  if(name==="Yellow")  return C(240,210,70);
  if(name==="Cyan")    return C(70,210,220);
  if(name==="Magenta") return C(225,90,210);
  if(name==="White")   return C(235,235,235);
  return C(232,149,74);
}
var BG,FG,MUTED,GOLD,GREEN,SELBG,HEADBG,FAVBG,ACCENT;
var themeName="System";
function applyTheme(){
  BG     = (themeName==="System" && typeof BRUCE_BGCOLOR!=="undefined")? BRUCE_BGCOLOR : C(0,0,0);
  FG     = C(235,231,221);
  MUTED  = C(140,134,122);
  GOLD   = C(255,205,70);
  GREEN  = C(95,195,125);
  SELBG  = C(45,45,52);
  HEADBG = C(20,20,26);
  FAVBG  = C(40,30,12);
  ACCENT = themeAccent(themeName);
}

// ------- string helpers (engine-safe, no regex) -------
function lower(s){ return (""+s).toLowerCase(); }
function endsWav(name){ var s=lower(name),n=s.length; return n>4 && s.substring(n-4)===".wav"; }
function baseName(p){ var s=""+p,i=s.length-1; while(i>=0 && s.charAt(i)!=="/" && s.charAt(i)!=="\\") i--; return s.substring(i+1); }
function stripExt(n){ var i=n.lastIndexOf("."); return i>0? n.substring(0,i): n; }
function pretty(n){
  var b=stripExt(baseName(n)), us=b.indexOf("_");
  if(us>=0 && us<=3){            // strip an optional numeric prefix like "03_"
    var pre=b.substring(0,us), allnum=true;
    for(var i=0;i<pre.length;i++){ var c=pre.charAt(i); if(c<"0"||c>"9"){allnum=false;break;} }
    if(allnum) b=b.substring(us+1);
  }
  // snake_case / kebab-case -> "Title Case"
  var out="", up=true;
  for(var j=0;j<b.length;j++){
    var ch=b.charAt(j);
    if(ch==="_"||ch==="-"){ out+=" "; up=true; }
    else if(up){ out+=ch.toUpperCase(); up=false; }
    else out+=ch;
  }
  return out;
}

// ------- state (favorites + theme) persistence -------
// File format: {"fav":["a.wav",...],"theme":"Orange"}
var favSet={};
var loopSet={};   // session only, NOT persisted
function loadState(){
  favSet={}; themeName="System";
  var txt="";
  try{ txt=storage.read(STATE_FILE); }catch(e1){ txt=""; }
  if(!txt) return;
  parseArray(txt,"fav",favSet);
  var th=parseString(txt,"theme");
  if(th && isTheme(th)) themeName=th;
}
function isTheme(t){ for(var i=0;i<THEMES.length;i++) if(THEMES[i]===t) return true; return false; }
function parseArray(txt,key,set){
  var kpos=txt.indexOf('"'+key+'"'); if(kpos<0) return;
  var lb=txt.indexOf("[",kpos); if(lb<0) return;
  var rb=txt.indexOf("]",lb); if(rb<0) return;
  var inner=txt.substring(lb+1,rb), cur="", inStr=false;
  for(var i=0;i<inner.length;i++){
    var ch=inner.charAt(i);
    if(ch==='"'){ if(inStr){ if(cur.length)set[cur]=true; cur=""; inStr=false; } else inStr=true; }
    else if(inStr) cur+=ch;
  }
}
function parseString(txt,key){
  var kpos=txt.indexOf('"'+key+'"'); if(kpos<0) return "";
  var q1=txt.indexOf('"',kpos+key.length+2); if(q1<0) return "";
  var q2=txt.indexOf('"',q1+1); if(q2<0) return "";
  return txt.substring(q1+1,q2);
}
function saveState(){
  var fav=[]; for(var k in favSet){ if(favSet[k]) fav.push(k); }
  var q=""; for(var i=0;i<fav.length;i++){ if(i)q+=","; q+='"'+fav[i]+'"'; }
  var s='{"fav":['+q+'],"theme":"'+themeName+'"}';
  try{ storage.write(STATE_FILE, s, "write"); }catch(e2){}
}

// ------- scan sounds -------
var files=[]; // {file,name}
function scanSounds(){
  files=[];
  var list=[];
  try{ list=storage.readdir(SOUND_DIR); }catch(e3){ list=[]; }
  if(!list) list=[];
  for(var i=0;i<list.length;i++){
    var entry=list[i];
    var nm=(typeof entry==="string")? entry : (entry&&entry.name? entry.name : "");
    if(!nm) continue;
    if(nm.charAt(0)===".") continue;
    if(!endsWav(nm)) continue;
    files.push({ file:nm, name:pretty(nm) });
  }
  for(var a=0;a<files.length;a++)
    for(var b=a+1;b<files.length;b++)
      if(lower(files[b].file)<lower(files[a].file)){ var t=files[a]; files[a]=files[b]; files[b]=t; }
}

// ------- rows -------
var rows=[];
function buildRows(){
  rows=[];
  var favs=[];
  for(var i=0;i<files.length;i++){ if(favSet[files[i].file]) favs.push(i); }
  rows.push({t:"head",txt:"FAVORITES",fav:true});
  if(favs.length===0) rows.push({t:"info",txt:"(none - press ESC on a sound)"});
  else for(var f=0;f<favs.length;f++) rows.push({t:"sound",i:favs[f]});
  rows.push({t:"head",txt:"ALL SOUNDS ("+files.length+")",fav:false});
  if(files.length===0) rows.push({t:"info",txt:"No .wav files in /sounds"});
  else for(var s=0;s<files.length;s++) rows.push({t:"sound",i:s});
  rows.push({t:"head",txt:"MENU",fav:false});
  rows.push({t:"menu",action:"settings",txt:"Settings"});
  rows.push({t:"menu",action:"about",txt:"About"});
  rows.push({t:"menu",action:"exit",txt:"Exit"});
}
function isSelectable(r){ var t=rows[r].t; return t==="sound"||t==="menu"; }
function firstSelectable(){ for(var i=0;i<rows.length;i++) if(isSelectable(i)) return i; return 0; }

// ------- layout / draw -------
var W,H, ROWH=20, TITLEH=14, top=0, sel=0, curPlaying=-1;
function visibleRows(){ return Math.floor((H-TITLEH)/ROWH); }
function clampView(){
  var vis=visibleRows();
  if(sel<top) top=sel;
  if(sel>=top+vis) top=sel-vis+1;
  if(top<0) top=0;
}
function iconStar(x,y,filled){
  if(filled){ display.drawFillCircle(x,y,5,GOLD); display.drawFillCircle(x,y,2,BG); }
  else display.drawCircle(x,y,5,MUTED);
}
function iconLoop(x,y){ display.drawCircle(x,y,5,GREEN); display.drawCircle(x,y,4,GREEN); }
function iconPlay(x,y,c){ for(var k=0;k<7;k++){ var h=7-k; display.drawLine(x+k,y-h,x+k,y+h,c); } }

function drawRow(r,yy){
  var row=rows[r];
  if(r===sel && isSelectable(r)) display.drawFillRect(0,yy,W,ROWH,SELBG);
  if(row.t==="head"){
    display.drawFillRect(0,yy,W,ROWH,row.fav?FAVBG:HEADBG);
    display.setTextSize(1); display.setTextColor(row.fav?GOLD:ACCENT); display.setTextAlign("left","top");
    display.drawText(row.txt,8,yy+6); return;
  }
  if(row.t==="info"){
    display.setTextSize(1); display.setTextColor(MUTED); display.setTextAlign("left","top");
    display.drawText(row.txt,16,yy+6); return;
  }
  if(row.t==="menu"){
    display.setTextSize(1); display.setTextColor(FG); display.setTextAlign("left","top");
    display.drawText((r===sel?"> ":"  ")+row.txt,10,yy+6); return;
  }
  var snd=files[row.i], playing=(curPlaying===row.i);
  iconPlay(8,yy+ROWH/2, playing?GREEN:FG);
  display.setTextSize(1); display.setTextColor(FG); display.setTextAlign("left","top");
  var maxc=Math.floor((W-60)/6);
  var nm=snd.name; if(nm.length>maxc) nm=nm.substring(0,maxc-1)+"~";
  display.drawText(nm,24,yy+6);
  if(playing) iconLoop(W-16,yy+ROWH/2);
  else iconStar(W-16,yy+ROWH/2, !!favSet[snd.file]);
}
function draw(){
  display.fill(BG);
  display.drawFillRect(0,0,W,TITLEH,HEADBG);
  display.setTextSize(1); display.setTextColor(ACCENT); display.setTextAlign("left","top");
  display.drawText("SOUNDBOARD",6,3);
  display.setTextColor(MUTED); display.setTextAlign("right","top");
  display.drawText("SEL play  ESC opts",W-6,3);
  display.setTextAlign("left","top");
  clampView();
  var y=TITLEH,i=top;
  while(y+ROWH<=H && i<rows.length){ drawRow(i,y); y+=ROWH; i++; }
}
function wrapText(s,maxc){
  var out=[],words=(""+s).split(" "),line="";
  for(var i=0;i<words.length;i++){
    var w=words[i];
    if(line.length===0) line=w;
    else if((line.length+1+w.length)<=maxc) line=line+" "+w;
    else { out.push(line); line=w; }
  }
  if(line.length) out.push(line);
  return out;
}

// ------- playback -------
function playSelected(idx){
  var snd=files[idx], path=SOUND_DIR+"/"+snd.file;
  curPlaying=idx; draw();
  if(loopSet[snd.file]){
    while(true){ try{ audio.playFile(path); }catch(e5){ break; } delay(30); }
  } else {
    try{ audio.playFile(path); }catch(e4){}
  }
  curPlaying=-1; draw();
}

// ------- options popup (opened with ESC on a sound) -------
function optionsPopup(idx){
  var snd=files[idx], opt=0;
  while(true){
    var bw=Math.floor(W*0.82), bh=92, bx=Math.floor((W-bw)/2), by=Math.floor((H-bh)/2);
    display.drawFillRect(bx,by,bw,bh,C(25,25,32));
    display.drawRect(bx,by,bw,bh,ACCENT);
    display.setTextSize(1); display.setTextColor(ACCENT); display.setTextAlign("left","top");
    var tn=snd.name, mc=Math.floor((bw-16)/6); if(tn.length>mc)tn=tn.substring(0,mc-1)+"~";
    display.drawText(tn,bx+8,by+6);
    var items=["Play","Loop: "+(loopSet[snd.file]?"ON":"off"),"Favorite: "+(favSet[snd.file]?"YES":"no"),"Close"];
    for(var i=0;i<items.length;i++){
      var yy=by+24+i*16;
      if(i===opt) display.drawFillRect(bx+4,yy-2,bw-8,14,SELBG);
      display.setTextColor(i===opt?FG:MUTED);
      display.drawText((i===opt?">":" ")+items[i],bx+8,yy);
    }
    var acted=false;
    while(!acted){
      if(keyboard.getNextPress()){ opt=(opt+1)%4; acted=true; }
      else if(keyboard.getPrevPress()){ opt=(opt+3)%4; acted=true; }
      else if(keyboard.getSelPress(false)){
        if(opt===0){ playSelected(idx); return; }
        if(opt===1){
          if(!loopSet[snd.file]){ if(warnLoop()) loopSet[snd.file]=true; }
          else delete loopSet[snd.file];
          acted=true;
        }
        if(opt===2){ if(favSet[snd.file])delete favSet[snd.file]; else favSet[snd.file]=true; saveState(); buildRows(); acted=true; }
        if(opt===3){ return; }
      }
      else if(keyboard.getEscPress()){ return; }
      delay(50);
    }
  }
}
function warnLoop(){
  var bw=Math.floor(W*0.9), bh=86, bx=Math.floor((W-bw)/2), by=Math.floor((H-bh)/2);
  display.drawFillRect(bx,by,bw,bh,C(40,20,20));
  display.drawRect(bx,by,bw,bh,C(230,80,80));
  display.setTextSize(1); display.setTextColor(C(255,170,170)); display.setTextAlign("left","top");
  var lines=wrapText("Loop can only be stopped by rebooting the device. Enable loop?",Math.floor((bw-16)/6));
  for(var i=0;i<lines.length;i++) display.drawText(lines[i],bx+8,by+8+i*10);
  display.setTextColor(FG);
  display.drawText("SEL = yes   ESC = no",bx+8,by+bh-16);
  while(true){
    if(keyboard.getSelPress(false)) return true;
    if(keyboard.getEscPress()) return false;
    delay(50);
  }
}

// ------- Settings -------
function settingsScreen(){
  var opt=0;
  while(true){
    display.fill(BG);
    display.drawFillRect(0,0,W,TITLEH,HEADBG);
    display.setTextSize(1); display.setTextColor(ACCENT); display.setTextAlign("left","top");
    display.drawText("SETTINGS",6,3);
    var items=["Color: "+themeName,"Rescan sounds","Back"];
    for(var i=0;i<items.length;i++){
      var yy=TITLEH+10+i*22;
      if(i===opt) display.drawFillRect(0,yy-4,W,20,SELBG);
      display.setTextColor(i===opt?FG:MUTED);
      display.drawText((i===opt?"> ":"  ")+items[i],10,yy);
    }
    display.setTextColor(MUTED);
    display.drawText("SEL: select   ESC: back",8,H-12);
    var acted=false;
    while(!acted){
      if(keyboard.getNextPress()){ opt=(opt+1)%3; acted=true; }
      else if(keyboard.getPrevPress()){ opt=(opt+2)%3; acted=true; }
      else if(keyboard.getSelPress(false)){
        if(opt===0){ cycleTheme(); applyTheme(); saveState(); acted=true; }
        else if(opt===1){ scanSounds(); buildRows(); toast("Rescanned: "+files.length+" sounds"); acted=true; }
        else return;
      }
      else if(keyboard.getEscPress()){ return; }
      delay(50);
    }
  }
}
function cycleTheme(){
  var idx=0; for(var i=0;i<THEMES.length;i++) if(THEMES[i]===themeName){ idx=i; break; }
  themeName=THEMES[(idx+1)%THEMES.length];
}
function toast(msg){
  var bw=Math.floor(W*0.8), bh=30, bx=Math.floor((W-bw)/2), by=Math.floor((H-bh)/2);
  display.drawFillRect(bx,by,bw,bh,C(25,25,32)); display.drawRect(bx,by,bw,bh,ACCENT);
  display.setTextSize(1); display.setTextColor(FG); display.setTextAlign("left","top");
  display.drawText(msg,bx+8,by+10); delay(900);
}

// ------- About & Help (scrollable) -------
function aboutScreen(){
  var txt=[
    "H:HOW TO USE",
    "Rotate wheel: scroll the list.",
    "Press encoder (SEL): play the",
    "  selected sound.",
    "Top button (ESC): open options",
    "  (Loop / Favorite) for the",
    "  selected sound.",
    "In options: rotate = choose,",
    "  press = confirm, top = close.",
    "Favorites appear in the",
    "  highlighted top section.",
    "",
    "H:ADD YOUR OWN SOUNDS",
    "Copy .wav files into this",
    "app's own folder, then run",
    "Settings > Rescan (or restart).",
    "",
    "H:LOOP",
    "A looping sound can only be",
    "stopped by rebooting the device.",
    "",
    "H:COLOR THEME",
    "Change it in Settings. 'System'",
    "uses your Bruce config colors.",
    "",
    "H:LICENSE"
  ];
  var lic=wrapText(LICENSE,Math.floor((W-16)/6));
  for(var i=0;i<lic.length;i++) txt.push(lic[i]);
  txt.push(""); txt.push("(c) Benjamin Clark");

  var topi=0, per=Math.floor((H-TITLEH-13)/11);
  while(true){
    display.fill(BG);
    display.drawFillRect(0,0,W,TITLEH,HEADBG);
    display.setTextSize(1); display.setTextColor(ACCENT); display.setTextAlign("left","top");
    display.drawText("ABOUT & HELP",6,3);
    for(var k=0;k<per;k++){
      var li=topi+k; if(li>=txt.length) break;
      var line=txt[li], col=FG;
      if(line.substring(0,2)==="H:"){ col=ACCENT; line=line.substring(2); }
      display.setTextColor(col);
      display.drawText(line,8,TITLEH+4+k*11);
    }
    display.setTextColor(MUTED);
    display.drawText(((topi+per<txt.length)?"v ":"  ")+"rotate=scroll  ESC=back",8,H-11);
    var acted=false;
    while(!acted){
      if(keyboard.getNextPress()){ if(topi+per<txt.length) topi++; acted=true; }
      else if(keyboard.getPrevPress()){ if(topi>0) topi--; acted=true; }
      else if(keyboard.getEscPress()){ return; }
      else if(keyboard.getSelPress(false)){ return; }
      delay(50);
    }
  }
}

// ------- main -------
function main(){
  W=display.width(); H=display.height();
  SOUND_DIR=resolveDir();
  scanSounds();
  if(files.length===0 && SOUND_DIR!=="/sounds"){ SOUND_DIR="/sounds"; scanSounds(); }
  STATE_FILE=SOUND_DIR+"/.soundboard.json";
  loadState(); applyTheme();
  buildRows();
  sel=firstSelectable(); draw();
  while(true){
    var changed=false;
    if(keyboard.getNextPress()){
      var n=sel; do{ n++; }while(n<rows.length && !isSelectable(n));
      if(n<rows.length){ sel=n; changed=true; }
    }
    else if(keyboard.getPrevPress()){
      var p=sel; do{ p--; }while(p>=0 && !isSelectable(p));
      if(p>=0){ sel=p; changed=true; }
    }
    else if(keyboard.getSelPress(false)){          // encoder = play / open menu entry
      var row=rows[sel];
      if(row.t==="sound"){ playSelected(row.i); changed=true; }
      else if(row.t==="menu"){
        if(row.action==="settings"){ settingsScreen(); applyTheme(); }
        else if(row.action==="about"){ aboutScreen(); applyTheme(); }
        else if(row.action==="exit"){ break; }
        changed=true;
      }
    }
    else if(keyboard.getEscPress()){               // top button = options on a sound
      var row2=rows[sel];
      if(row2.t==="sound"){ optionsPopup(row2.i); changed=true; }
      else { break; }                              // on menu rows: quit
    }
    if(changed) draw();
    delay(50);
  }
  display.fill(BG); display.setTextSize(2); display.setTextColor(FG); display.setTextAlign("left","top");
  display.drawText("Bye!",10,20);
}
main();
