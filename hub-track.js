/* hub-track.js — 通用达人ref+埋点(接 Lumee 增长中台 via /api/track)
 * 用法: 页面引入 <script src="/hub-track.js"></script>
 *   自动: 抓 ?ref=达人码 存本地 + 发 landing 事件 + 离开时发 view(带停留秒数)
 *   手动: window.hubTrack('purchase', {amount:4.99})  —— 关键转化事件
 * 所有事件带 ref_code + distinct_id → 中台按达人码切片(看没看/看多久/转化)+ 自动算佣金
 */
(function(){
  function ls(k,v){try{return v===undefined?localStorage.getItem(k):(localStorage.setItem(k,v),v);}catch(e){return null;}}
  // 1) 抓 ref(URL 优先,否则用已存的)
  var u=new URLSearchParams(location.search);
  var ref=(u.get('ref')||u.get('utm_ref')||'').slice(0,64);
  if(ref) ls('hub_ref',ref);
  ref=ref||ls('hub_ref')||'';
  // 2) 持久 distinct_id(匿名用户标识)
  var did=ls('hub_did');
  if(!did){ did='d_'+Math.random().toString(36).slice(2)+Date.now().toString(36); ls('hub_did',did); }
  // 3) 上报函数
  function post(event,props){
    try{
      var body=JSON.stringify({event:event,ref_code:ref,distinct_id:did,props:props||{}});
      if(navigator.sendBeacon){ navigator.sendBeacon('/api/track', new Blob([body],{type:'application/json'})); }
      else{ fetch('/api/track',{method:'POST',headers:{'Content-Type':'application/json'},body:body,keepalive:true}).catch(function(){}); }
    }catch(e){}
  }
  window.hubTrack=function(event,props){ post(event, Object.assign({path:location.pathname},props||{})); };
  // 4) landing(带来源)
  window.hubTrack('landing',{ref:ref,referrer:document.referrer||'',ua:navigator.userAgent.slice(0,120)});
  // 5) view 停留秒数(离开/切后台时发)
  var t0=Date.now(), sent=false;
  function flushView(){ if(sent)return; sent=true; window.hubTrack('view',{seconds:Math.round((Date.now()-t0)/1000)}); }
  document.addEventListener('visibilitychange',function(){ if(document.visibilityState==='hidden') flushView(); });
  window.addEventListener('pagehide',flushView);
})();
