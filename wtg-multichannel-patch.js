/* WTG 0.1H8v — approved global viewing-source priority + responsive multi-channel DIRECTV card
   Priority: local/regional linear > national linear > streaming > sport package.
   Up to two verified DIRECTV channels are shown as separate channel/source pairs.
*/
(function(){
  if(typeof window.getDirectvDisplay!=="function"){
    console.warn("WTG source-priority patch: base display function unavailable");
    return;
  }

  const previousGetDirectvDisplay=window.getDirectvDisplay;
  const clean=value=>String(value??"").trim();
  const channelFromOption=item=>clean(item?.directvChannel||item?.channel);
  const labelFromOption=item=>clean(item?.network||item?.station||item?.source||item?.feed);
  function priority(item){
    const type=clean(item?.type).toLowerCase();
    if(type==="local"||type==="regional")return 0;
    if(type==="national")return 1;
    if(type==="streaming")return 2;
    if(type==="package")return 3;
    return 4;
  }

  function verifiedLinearOptions(game){
    const options=[];
    const add=(item,sourceOrder)=>{
      const channel=channelFromOption(item);
      if(!channel)return;
      const type=clean(item?.type).toLowerCase();
      if(!["local","regional","national"].includes(type))return;
      options.push({...item,_channel:channel,_label:labelFromOption(item),_priority:priority(item),_sourceOrder:sourceOrder});
    };
    (Array.isArray(game?.directv)?game.directv:[]).forEach((item,index)=>add(item,index));
    (Array.isArray(game?.providerChannels)?game.providerChannels:[]).forEach((item,index)=>{
      const type=clean(item?.type).toLowerCase()||"national";
      add({...item,type,directvChannel:item?.directvChannel||item?.channel},100+index);
    });
    (Array.isArray(game?.directvGuide?.channels)?game.directvGuide.channels:[]).forEach((item,index)=>{
      const type=clean(item?.type).toLowerCase();
      if(type==="package")return;
      add({...item,type:type||"national",directvChannel:item?.channel},200+index);
    });
    options.sort((a,b)=>a._priority-b._priority||a._sourceOrder-b._sourceOrder);
    const seenChannels=new Set();
    return options.filter(item=>{
      // A DIRECTV number identifies the actual tuning destination. Resolver,
      // provider and guide aliases must not create duplicate pills for it.
      const key=item._channel.toLowerCase();
      if(seenChannels.has(key))return false;
      seenChannels.add(key);return true;
    });
  }

  window.getDirectvDisplay=function(game,conflictKeys=new Set()){
    const base=previousGetDirectvDisplay(game,conflictKeys);
    const verified=verifiedLinearOptions(game);
    if(!verified.length)return base;
    const visible=verified.slice(0,2);
    const hiddenCount=Math.max(0,verified.length-visible.length);
    return {
      ...base,
      channel:visible.map(item=>item._channel).join(" / ")+(hiddenCount?` +${hiddenCount}`:""),
      note:visible.map(item=>item._label||"DIRECTV").join(" / "),
      channels:visible.map(item=>({channel:item._channel,label:item._label||"DIRECTV"})),
      hiddenChannelCount:hiddenCount
    };
  };

  // Convert the legacy combined channel text into compact per-channel pills after each render.
  function splitMultiChannelCards(root=document){
    root.querySelectorAll('.game-card .directv-box').forEach(box=>{
      const channel=box.querySelector('.directv-channel');
      const note=box.querySelector('.directv-note');
      if(!channel||!note||box.dataset.multiFixed==='1')return;
      const channels=channel.textContent.trim().split(/\s[•\/]\s/).map(s=>s.trim()).filter(Boolean);
      const labels=note.textContent.trim().split(/\s[•\/]\s/).map(s=>s.trim()).filter(Boolean);
      if(channels.length<2)return;
      box.dataset.multiFixed='1';
      box.classList.add('multi-channel');
      const rows=document.createElement('div');
      rows.className='directv-channel-list';
      channels.forEach((ch,i)=>{
        const row=document.createElement('div');row.className='directv-channel-row';
        const num=document.createElement('strong');num.className='directv-channel-pill';num.textContent=ch;
        const lab=document.createElement('span');lab.className='directv-channel-name';lab.textContent=labels[i]||labels[0]||'DIRECTV';
        row.append(num,lab);rows.appendChild(row);
      });
      channel.style.display='none';note.style.display='none';box.appendChild(rows);
    });
  }
  const style=document.createElement('style');
  style.textContent=`
    .game-card .directv-box.multi-channel{display:block!important;min-height:0!important;padding:0!important}
    .game-card .directv-box.multi-channel .directv-label{display:block!important;width:auto!important;padding:6px 10px!important;border-right:0!important;border-bottom:1px solid rgba(255,182,39,.28)!important;text-align:left!important}
    .game-card .directv-channel-list{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;width:100%!important}
    .game-card .directv-channel-row{display:grid!important;grid-template-columns:auto minmax(0,1fr)!important;align-items:center!important;gap:7px!important;min-width:0!important;padding:7px 9px!important;border-right:1px solid rgba(255,182,39,.20)!important}
    .game-card .directv-channel-row:last-child{border-right:0!important}
    .game-card .directv-channel-pill{color:#ffb627!important;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;font-size:21px!important;line-height:1!important;font-weight:900!important;text-shadow:0 0 10px rgba(255,182,39,.35)!important;white-space:nowrap!important}
    .game-card .directv-channel-name{min-width:0!important;color:#b4c8d5!important;font-size:9px!important;font-weight:800!important;line-height:1.1!important;text-transform:uppercase!important;white-space:normal!important;overflow-wrap:anywhere!important}
    @media(max-width:380px){.game-card .directv-channel-pill{font-size:18px!important}.game-card .directv-channel-row{gap:5px!important;padding:7px!important}.game-card .directv-channel-name{font-size:8px!important}}
  `;
  document.head.appendChild(style);
  const observer=new MutationObserver(()=>splitMultiChannelCards());
  observer.observe(document.body,{childList:true,subtree:true});
  queueMicrotask(()=>splitMultiChannelCards());
  console.info("WTG 0.1H8v multi-channel cards active");
})();
