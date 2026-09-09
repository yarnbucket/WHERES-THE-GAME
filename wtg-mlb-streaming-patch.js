/* WTG 0.1H8k — MLB verified-national + package-only streaming rule
   Sunny Cups approved:
   - Schedule feed decides whether a game is actually national/local/regional.
   - DIRECTV 213/213-1 only supply channel numbers when MLB Network is listed by the schedule feed.
   - Mainstream streamers (Apple TV+, Netflix, Prime, Peacock, ESPN+, etc.) stay normal.
   - MLB.TV / MLB Extra Innings-only games show MLB STREAMING ONLY.
   - Package-only MLB games sort to the bottom alphabetically.
*/
(function(){
  if(typeof window.getViewingSourceDisplay!=="function" || typeof window.sortProGames!=="function"){
    console.warn("WTG MLB patch: base app functions unavailable");
    return;
  }

  const originalHasDirectvChannel=window.hasDirectvChannel;
  const originalIsStreamingOnlyGame=window.isStreamingOnlyGame;
  const originalIsTelevisedGame=window.isTelevisedGame;
  const originalGetDirectvDisplay=window.getDirectvDisplay;
  const originalGetViewingSourceDisplay=window.getViewingSourceDisplay;

  function isMlbGame(game){
    return String(game?._sportKey||window.selectedSport||"").toLowerCase()==="mlb";
  }

  function scheduleNetworkText(game){
    return [game?.broadcast,game?.network].filter(Boolean).join(" • ").toLowerCase();
  }

  function scheduleListsMlbNetwork(game){
    const text=scheduleNetworkText(game);
    return /(^|[^a-z0-9])mlbn([^a-z0-9]|$)/.test(text) || text.includes("mlb network");
  }

  function isVerifiedGuideChannel(game,item){
    if(!item?.channel)return false;
    const channel=String(item.channel);
    const type=String(item?.type||"").toLowerCase();
    if(type==="package")return false;
    if(channel==="213"||channel==="213-1")return scheduleListsMlbNetwork(game);
    return true;
  }

  function isVerifiedOption(game,item){
    if(!item?.directvChannel)return false;
    const channel=String(item.directvChannel);
    const type=String(item?.type||"").toLowerCase();
    if(type==="package")return false;
    if(channel==="213"||channel==="213-1"||type==="national"){
      if(/mlb network|mlbn/i.test(String(item?.network||"")))return scheduleListsMlbNetwork(game);
    }
    return ["national","local","regional"].includes(type);
  }

  function structuredSourceText(game){
    const values=[];
    const push=v=>{
      if(v==null)return;
      if(typeof v==="string"||typeof v==="number")values.push(String(v));
      else if(Array.isArray(v))v.forEach(push);
      else if(typeof v==="object"){
        for(const key of ["name","label","network","service","source","provider","package","channel","type"])push(v[key]);
      }
    };
    push(game?.streaming);
    push(game?.sources);
    push(game?.providerChannels);
    push(game?.leaguePackage);
    return values.join(" • ").toLowerCase();
  }

  function mainstreamStreamingPresent(game){
    const streams=typeof window.getStreamingServices==="function" ? window.getStreamingServices(game) : [];
    if(streams.some(name=>String(name).toLowerCase()!=="mlb.tv"))return true;
    const text=structuredSourceText(game);
    return [
      "netflix","apple tv","prime video","amazon prime","peacock","paramount+","paramount plus",
      "espn+","espn plus","disney+","disney plus","hulu","max","hbo max","youtube","fubo","sling"
    ].some(token=>text.includes(token));
  }

  function hasNormalMlbTv(game){
    const options=Array.isArray(game?.directv)?game.directv:[];
    const guide=Array.isArray(game?.directvGuide?.channels)?game.directvGuide.channels:[];
    if(options.some(x=>isVerifiedOption(game,x)))return true;
    if(guide.some(x=>isVerifiedGuideChannel(game,x)))return true;
    if(typeof window.getDirectvFallback==="function"){
      const fallback=window.getDirectvFallback(game);
      if(fallback){
        const channel=String(fallback.channel||"");
        if((channel==="213"||channel==="213-1")&&!scheduleListsMlbNetwork(game))return false;
        return true;
      }
    }
    const providerChannels=game?.providerChannels;
    if(Array.isArray(providerChannels) && providerChannels.some(x=>x?.channel||x?.directvChannel))return true;
    return false;
  }

  function hasMlbPackageSignal(game){
    const guide=Array.isArray(game?.directvGuide?.channels)?game.directvGuide.channels:[];
    if(guide.some(x=>x?.channel && String(x?.type||"").toLowerCase()==="package"))return true;
    const streams=typeof window.getStreamingServices==="function" ? window.getStreamingServices(game) : [];
    if(streams.some(name=>String(name).toLowerCase()==="mlb.tv"))return true;
    const text=[
      game?.directvGuide?.package,
      game?.leaguePackage?.name,
      game?.leaguePackage?.label,
      game?.leaguePackage,
      structuredSourceText(game),
      game?.broadcast,
      game?.network
    ].filter(Boolean).map(v=>typeof v==="object"?JSON.stringify(v):String(v)).join(" • ").toLowerCase();
    return text.includes("mlb.tv") || text.includes("mlb tv") || text.includes("mlb extra innings") || text.includes("extra innings");
  }

  function isMlbPackageOnlyGame(game){
    if(!isMlbGame(game))return false;
    if(hasNormalMlbTv(game))return false;
    if(mainstreamStreamingPresent(game))return false;
    return hasMlbPackageSignal(game);
  }

  window.isMlbPackageOnlyGame=isMlbPackageOnlyGame;

  window.hasDirectvChannel=function(game){
    if(!isMlbGame(game))return originalHasDirectvChannel(game);
    const options=Array.isArray(game?.directv)?game.directv:[];
    const guide=Array.isArray(game?.directvGuide?.channels)?game.directvGuide.channels:[];
    if(options.some(x=>isVerifiedOption(game,x)))return true;
    if(guide.some(x=>isVerifiedGuideChannel(game,x)))return true;
    if(typeof window.getDirectvFallback==="function"){
      const fallback=window.getDirectvFallback(game);
      if(!fallback)return false;
      const channel=String(fallback.channel||"");
      if((channel==="213"||channel==="213-1")&&!scheduleListsMlbNetwork(game))return false;
      return true;
    }
    return false;
  };

  window.isStreamingOnlyGame=function(game){
    if(isMlbPackageOnlyGame(game))return true;
    return originalIsStreamingOnlyGame(game);
  };

  window.isTelevisedGame=function(game){
    if(isMlbPackageOnlyGame(game))return false;
    return originalIsTelevisedGame(game);
  };

  window.getDirectvDisplay=function(game,conflictKeys=new Set()){
    if(!isMlbGame(game))return originalGetDirectvDisplay(game,conflictKeys);

    const options=Array.isArray(game?.directv)?game.directv:[];
    const guide=Array.isArray(game?.directvGuide?.channels)?game.directvGuide.channels:[];

    const national=options.find(x=>x?.directvChannel&&String(x?.type||"").toLowerCase()==="national"&&isVerifiedOption(game,x));
    if(national)return {channel:national.directvChannel,note:national.network||"National"};

    const local=options.find(x=>x?.directvChannel&&String(x?.type||"").toLowerCase()==="local");
    if(local)return {channel:local.directvChannel,note:local.station?`${local.station} • ${local.network||""}`:(local.network||"Local")};

    const regional=options.find(x=>x?.directvChannel&&String(x?.type||"").toLowerCase()==="regional");
    if(regional)return {channel:regional.directvChannel,note:regional.network||"Regional"};

    const verifiedGuide=guide.find(x=>isVerifiedGuideChannel(game,x));
    if(verifiedGuide)return {channel:`${verifiedGuide.channel}${verifiedGuide.hd?" HD":""}`,note:verifiedGuide.feed||verifiedGuide.network||"DIRECTV Sports Guide"};

    if(typeof window.getDirectvFallback==="function"){
      const fallback=window.getDirectvFallback(game);
      if(fallback){
        const channel=String(fallback.channel||"");
        if(!((channel==="213"||channel==="213-1")&&!scheduleListsMlbNetwork(game)))return {channel:fallback.channel,note:fallback.network};
      }
    }

    return {channel:"TBD",note:"Channel not assigned yet"};
  };

  window.getViewingSourceDisplay=function(game,conflictKeys=new Set()){
    if(isMlbPackageOnlyGame(game)){
      const streams=typeof window.getStreamingServices==="function" ? window.getStreamingServices(game) : [];
      return {
        label:"STREAMING",
        channel:"MLB STREAMING ONLY",
        note:"MLB.TV / MLB Extra Innings package required",
        streams
      };
    }
    return originalGetViewingSourceDisplay(game,conflictKeys);
  };

  window.sortProGames=function(games){
    return [...games].sort((a,b)=>{
      const aPackage=isMlbPackageOnlyGame(a);
      const bPackage=isMlbPackageOnlyGame(b);
      if(aPackage!==bPackage)return aPackage?1:-1;
      if(aPackage&&bPackage){
        const awayCmp=String(a?.away||a?.name||"").localeCompare(String(b?.away||b?.name||""),undefined,{sensitivity:"base"});
        if(awayCmp)return awayCmp;
        const homeCmp=String(a?.home||"").localeCompare(String(b?.home||""),undefined,{sensitivity:"base"});
        if(homeCmp)return homeCmp;
        return String(a?.id||"").localeCompare(String(b?.id||""));
      }
      const fav=(typeof window.isFavorite==="function"?window.isFavorite(b.id):false)-(typeof window.isFavorite==="function"?window.isFavorite(a.id):false);
      if(fav)return fav;
      const priority=(typeof window.proPriorityScore==="function"?window.proPriorityScore(b):0)-(typeof window.proPriorityScore==="function"?window.proPriorityScore(a):0);
      if(priority)return priority;
      const live=(typeof window.isLiveGame==="function"?window.isLiveGame(b):false)-(typeof window.isLiveGame==="function"?window.isLiveGame(a):false);
      if(live)return live;
      return (Date.parse(a?.startTime||"")||0)-(Date.parse(b?.startTime||"")||0);
    });
  };

  console.info("WTG 0.1H8k MLB verified-national rule active");
})();
