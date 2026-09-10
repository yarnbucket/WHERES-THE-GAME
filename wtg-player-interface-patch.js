/* WTG 0.1H8n — approved broadcast scorebug/player interface.
   Presentation-only patch: preserves data, filters, favorites, card taps and source priority. */
(()=>{
  const css=`
  /* === WTG 0.1H8n BROADCAST SCOREBUG CARDS === */
  .game-card{
    position:relative!important;display:block!important;padding:0!important;gap:0!important;
    overflow:hidden!important;border-radius:16px!important;
    background:linear-gradient(180deg,rgba(8,28,45,.96),rgba(3,17,29,.98))!important;
    border:1px solid rgba(79,177,232,.34)!important;
    box-shadow:0 12px 28px rgba(0,0,0,.32),inset 0 1px 0 rgba(255,255,255,.035)!important;
  }
  .game-card:before{
    content:"";display:block;height:5px;background:linear-gradient(90deg,#18b9ff,#0b83ff 52%,#55dcff);
    box-shadow:0 0 13px rgba(28,178,255,.55)
  }
  .game-card .game-sport{
    display:flex!important;align-items:center!important;min-height:28px!important;margin:0!important;
    padding:5px 12px!important;color:#dff6ff!important;background:rgba(8,44,70,.88)!important;
    border-bottom:1px solid rgba(81,169,222,.24)!important;font-size:10px!important;font-weight:1000!important;
    letter-spacing:.12em!important;text-transform:uppercase!important
  }
  .game-card .game-title-row{
    margin:0!important;padding:13px 12px 11px!important;min-height:66px!important;
    display:flex!important;align-items:center!important;gap:8px!important;
    background:linear-gradient(90deg,rgba(18,63,94,.70),rgba(5,27,44,.88) 48%,rgba(18,63,94,.70))!important;
    border-bottom:1px solid rgba(76,157,207,.22)!important
  }
  .game-card .game-name{
    margin:0!important;color:#fff!important;font-size:18px!important;line-height:1.12!important;font-weight:1000!important;
    letter-spacing:.01em!important;text-align:center!important;text-transform:uppercase!important;
    text-shadow:0 2px 8px rgba(0,0,0,.65)!important
  }
  .game-card .favorite{
    flex:0 0 32px!important;width:32px!important;height:32px!important;border-radius:8px!important;
    background:rgba(2,20,33,.76)!important;border:1px solid rgba(112,195,239,.30)!important;color:#a7bdca!important
  }
  .game-card .favorite.active{color:#ffd24a!important}
  .game-card .game-time{
    margin:0!important;padding:10px 13px!important;color:#f5fbff!important;font-size:14px!important;font-weight:900!important;
    letter-spacing:.02em!important;border-bottom:1px solid rgba(75,151,199,.18)!important;background:rgba(2,16,27,.58)!important
  }
  .game-card .game-time:before{content:"";display:inline-block;width:7px;height:7px;margin:0 8px 1px 0;border-radius:50%;background:#2ce8ad;box-shadow:0 0 9px rgba(44,232,173,.75)}
  .game-card .game-network,.game-card .game-venue{
    margin:0!important;padding:8px 13px!important;color:#a9c2d2!important;font-size:11px!important;line-height:1.25!important;
    border-bottom:1px solid rgba(75,151,199,.16)!important;background:rgba(3,19,31,.70)!important
  }
  .game-card .directv-box{
    position:relative!important;display:grid!important;grid-template-columns:92px minmax(72px,.75fr) minmax(0,1.25fr)!important;
    align-items:center!important;gap:8px!important;width:100%!important;height:auto!important;min-height:62px!important;
    margin:0!important;padding:8px 13px!important;border:0!important;border-radius:0!important;
    background:linear-gradient(180deg,rgba(3,15,25,.98),rgba(1,11,20,.99))!important
  }
  .game-card .directv-label{color:#829cad!important;font-size:9px!important;font-weight:1000!important;letter-spacing:.14em!important;text-align:left!important}
  .game-card .directv-channel{color:#49c9ff!important;font-size:27px!important;line-height:1!important;font-weight:1000!important;text-align:center!important;text-shadow:0 0 12px rgba(40,178,255,.30)!important}
  .game-card .directv-channel[data-long-source="true"]{font-size:13px!important;line-height:1.08!important}
  .game-card .directv-note{color:#9bb3c3!important;font-size:10px!important;line-height:1.2!important;text-align:right!important;max-width:none!important}
  .game-card .profile-tag{font-size:9px!important}
  @media(max-width:430px){
    .game-card{border-radius:14px!important}
    .game-card .game-sport{padding:5px 10px!important;min-height:26px!important;font-size:9px!important}
    .game-card .game-title-row{padding:11px 10px 10px!important;min-height:60px!important}
    .game-card .game-name{font-size:16px!important}
    .game-card .game-time{padding:9px 11px!important;font-size:13px!important}
    .game-card .game-network,.game-card .game-venue{padding:7px 11px!important;font-size:10px!important}
    .game-card .directv-box{grid-template-columns:78px minmax(64px,.7fr) minmax(0,1.3fr)!important;min-height:58px!important;padding:7px 10px!important;gap:6px!important}
    .game-card .directv-label{font-size:8px!important}.game-card .directv-channel{font-size:24px!important}.game-card .directv-note{font-size:9px!important}
    .game-card .directv-channel[data-long-source="true"]{font-size:11px!important}
  }`;
  const style=document.createElement('style');style.id='wtg-player-interface-style';style.textContent=css;document.head.appendChild(style);
  console.info('WTG 0.1H8n broadcast scorebug/player interface loaded');
})();
