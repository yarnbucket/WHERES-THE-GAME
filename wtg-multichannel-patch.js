/* WTG 0.1H8l — approved multi-channel DIRECTV card display
   Rule: when an event has multiple verified DIRECTV channels, show them together:
   DIRECTV 4 • 242
   ABC • USA
   Single-channel events remain unchanged.
*/
(function(){
  if(typeof window.getDirectvDisplay!=="function"){
    console.warn("WTG multi-channel patch: base display function unavailable");
    return;
  }

  const previousGetDirectvDisplay=window.getDirectvDisplay;

  function clean(value){
    return String(value??"").trim();
  }

  function unique(values){
    const seen=new Set();
    const output=[];
    for(const value of values){
      const text=clean(value);
      if(!text)continue;
      const key=text.toLowerCase();
      if(seen.has(key))continue;
      seen.add(key);
      output.push(text);
    }
    return output;
  }

  function channelFromOption(item){
    return clean(item?.directvChannel||item?.channel);
  }

  function labelFromOption(item){
    return clean(item?.network||item?.station||item?.source||item?.feed);
  }

  window.getDirectvDisplay=function(game,conflictKeys=new Set()){
    const base=previousGetDirectvDisplay(game,conflictKeys);
    const options=Array.isArray(game?.directv)?game.directv:[];

    const verified=options.filter(item=>{
      const channel=channelFromOption(item);
      if(!channel)return false;
      const type=clean(item?.type).toLowerCase();
      return ["national","local","regional"].includes(type);
    });

    const channels=unique(verified.map(channelFromOption));
    if(channels.length<2)return base;

    const labels=unique(verified.map(labelFromOption));
    return {
      ...base,
      channel:channels.join(" • "),
      note:labels.length?labels.join(" • "):(base?.note||"Multiple DIRECTV channels")
    };
  };

  console.info("WTG 0.1H8l multi-channel DIRECTV display active");
})();
