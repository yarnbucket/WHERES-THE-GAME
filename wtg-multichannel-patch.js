/* WTG 0.1H8m — approved global viewing-source priority + compact DIRECTV card
   Sunny Cups approved hierarchy:
   1. Local / regional linear TV
   2. National linear TV
   3. Mainstream streaming
   4. Sport-specific paid package

   Card rule:
   - Show at most two verified DIRECTV channels.
   - Local/regional channels appear before national channels.
   - If more than two verified linear channels exist, show +N instead of congesting the card.
   - Streaming stays secondary when linear TV is available.
*/
(function(){
  if(typeof window.getDirectvDisplay!=="function"){
    console.warn("WTG source-priority patch: base display function unavailable");
    return;
  }

  const previousGetDirectvDisplay=window.getDirectvDisplay;

  function clean(value){
    return String(value??"").trim();
  }

  function channelFromOption(item){
    return clean(item?.directvChannel||item?.channel);
  }

  function labelFromOption(item){
    return clean(item?.network||item?.station||item?.source||item?.feed);
  }

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

    // Provider channels can carry valid local/national mappings even when directv[] is sparse.
    (Array.isArray(game?.providerChannels)?game.providerChannels:[]).forEach((item,index)=>{
      const type=clean(item?.type).toLowerCase()||"national";
      add({...item,type,directvChannel:item?.directvChannel||item?.channel},100+index);
    });

    // DIRECTV guide results are useful after resolver/provider mappings.
    (Array.isArray(game?.directvGuide?.channels)?game.directvGuide.channels:[]).forEach((item,index)=>{
      const type=clean(item?.type).toLowerCase();
      if(type==="package")return;
      add({...item,type:type||"national",directvChannel:item?.channel},200+index);
    });

    options.sort((a,b)=>a._priority-b._priority||a._sourceOrder-b._sourceOrder);

    const seenChannels=new Set();
    return options.filter(item=>{
      const key=item._channel.toLowerCase();
      if(seenChannels.has(key))return false;
      seenChannels.add(key);
      return true;
    });
  }

  window.getDirectvDisplay=function(game,conflictKeys=new Set()){
    const base=previousGetDirectvDisplay(game,conflictKeys);
    const verified=verifiedLinearOptions(game);
    if(!verified.length)return base;

    const visible=verified.slice(0,2);
    const hiddenCount=Math.max(0,verified.length-visible.length);
    const channelText=visible.map(item=>item._channel).join(" • ")+(hiddenCount?` +${hiddenCount}`:"");
    const labelText=visible.map(item=>item._label).filter(Boolean).join(" • ");

    return {
      ...base,
      channel:channelText,
      note:labelText||base?.note||"DIRECTV"
    };
  };

  console.info("WTG 0.1H8m source priority active: local > national > streaming > package");
})();
