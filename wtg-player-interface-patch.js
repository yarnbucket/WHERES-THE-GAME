/* WTG 0.1H8t — compact broadcast-guide cards using approved WTG colors.
   Presentation-only patch: preserves data, filters, favorites, card taps and source priority. */
(()=>{
  const css=`
  /* === WTG 0.1H8t COMPACT BROADCAST GUIDE === */
  .games{gap:10px!important}
  .game-card{
    position:relative!important;display:block!important;padding:0!important;gap:0!important;
    overflow:hidden!important;border-radius:15px!important;
    background:linear-gradient(180deg,rgba(7,26,43,.97),rgba(3,16,28,.985))!important;
    border:1px solid rgba(73,188,245,.30)!important;
    box-shadow:0 10px 24px rgba(0,0,0,.30),inset 0 1px 0 rgba(255,255,255,.035)!important;
  }
  .game-card:before{display:none!important}
  .game-card .card-main{padding:0!important}
  .game-card .card-top{
    min-height:30px!important;margin:0!important;padding:0!important;
    display:flex!important;align-items:center!important;justify-content:space-between!important;
    gap:8px!important;background:linear-gradient(90deg,#159de8,#0b7fd7 60%,#0863b9)!important;
    border-bottom:1px solid rgba(111,218,255,.26)!important
  }
  .game-card .game-sport{
    flex:1!important;display:flex!important;align-items:center!important;min-height:30px!important;
    margin:0!important;padding:5px 10px!important;color:#03111d!important;background:transparent!important;border:0!important;
    font-size:10px!important;font-weight:1000!important;letter-spacing:.11em!important;text-transform:uppercase!important
  }
  .game-card .gender-tag{
    display:inline-flex!important;align-items:center!important;margin-left:7px!important;padding:2px 6px!important;
    border-radius:999px!important;border:1px solid rgba(2,25,43,.32)!important;background:rgba(255,255,255,.22)!important;
    color:#03111d!important;font-size:8px!important;font-weight:1000!important;letter-spacing:.08em!important;line-height:1.15!important
  }
  .game-card .favorite{
    flex:0 0 25px!important;width:25px!important;height:25px!important;margin-right:5px!important;
    display:grid!important;place-items:center!important;padding:0!important;border-radius:50%!important;
    background:rgba(2,19,32,.20)!important;border:1px solid rgba(2,19,32,.28)!important;
    color:rgba(2,19,32,.62)!important;font-size:15px!important;line-height:1!important
  }
  .game-card .favorite.active{color:#ffe06b!important;background:rgba(2,19,32,.35)!important;border-color:rgba(255,224,107,.55)!important}
  .game-card .matchup{
    display:grid!important;grid-template-columns:minmax(0,1fr) 24px minmax(0,1fr)!important;
    align-items:center!important;gap:8px!important;margin:0!important;padding:9px 10px 7px!important;
    background:linear-gradient(180deg,rgba(8,31,50,.98),rgba(5,23,38,.98))!important
  }
  .game-card .team{
    display:grid!important;grid-template-columns:40px minmax(0,1fr)!important;align-items:center!important;
    gap:8px!important;min-width:0!important
  }
  .game-card .team-mark{
    display:grid!important;place-items:center!important;width:40px!important;height:40px!important;border-radius:9px!important;
    background:linear-gradient(145deg,rgba(17,102,161,.96),rgba(5,51,87,.98))!important;
    border:1px solid rgba(87,198,255,.42)!important;color:#fff!important;font-size:13px!important;font-weight:1000!important;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.10),0 4px 10px rgba(0,0,0,.20)!important
  }
  .game-card .team-copy{min-width:0!important}
  .game-card .team-copy span{
    display:block!important;color:#83a6bb!important;font-size:9px!important;font-weight:700!important;line-height:1.12!important;
    letter-spacing:.035em!important;text-transform:uppercase!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important
  }
  .game-card .team-copy strong{
    display:block!important;margin-top:2px!important;color:#f7fbff!important;font-size:17px!important;line-height:1.05!important;
    font-weight:1000!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;text-transform:none!important
  }
  .game-card .team-rank{color:#159de8!important;margin-right:3px!important}
  .game-card .at-mark{
    width:24px!important;height:24px!important;border:0!important;border-radius:0!important;background:transparent!important;
    color:#7394a8!important;font-size:11px!important;font-weight:800!important;box-shadow:none!important
  }
  .game-card .event-title{
    margin:0!important;padding:12px 10px!important;color:#f7fbff!important;font-size:18px!important;font-weight:1000!important;
    text-transform:uppercase!important;background:rgba(5,23,38,.98)!important
  }
  .game-card .game-meta{
    display:grid!important;grid-template-columns:auto 1fr auto!important;align-items:center!important;gap:7px!important;
    margin:0!important;padding:7px 10px!important;border-top:1px solid rgba(86,163,205,.20)!important;
    border-bottom:1px solid rgba(86,163,205,.16)!important;background:rgba(3,17,29,.94)!important
  }
  .game-card .game-time{
    margin:0!important;padding:0!important;color:#f5fbff!important;background:transparent!important;border:0!important;
    font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;font-size:14px!important;font-weight:800!important;letter-spacing:.01em!important
  }
  .game-card .game-time:before{
    content:""!important;display:inline-block!important;width:5px!important;height:5px!important;margin:0 7px 1px 0!important;
    border-radius:50%!important;background:#36dca1!important;box-shadow:0 0 8px rgba(54,220,161,.65)!important
  }
  .game-card .meta-dot{display:none!important}
  .game-card .game-network{
    grid-column:3!important;margin:0!important;padding:0!important;color:#9cb5c5!important;background:transparent!important;border:0!important;
    font-size:11px!important;font-weight:800!important;letter-spacing:.035em!important;text-transform:uppercase!important;text-align:right!important
  }
  .game-card .stream-badges{margin:0!important;padding:5px 10px!important;border-bottom:1px solid rgba(86,163,205,.14)!important;background:rgba(3,17,29,.92)!important}
  .game-card .game-venue{
    margin:0!important;padding:6px 10px!important;color:#8fa8b9!important;background:rgba(3,17,29,.92)!important;
    border-bottom:1px solid rgba(86,163,205,.16)!important;font-size:10px!important;line-height:1.2!important
  }
  .game-card .venue-glyph{color:#159de8!important}
  .game-card .directv-box{
    position:relative!important;display:grid!important;grid-template-columns:72px minmax(0,1fr)!important;
    grid-template-rows:18px minmax(30px,auto)!important;align-items:center!important;column-gap:0!important;row-gap:0!important;
    width:100%!important;height:auto!important;min-height:58px!important;margin:0!important;padding:0!important;
    border:0!important;border-radius:0!important;background:linear-gradient(180deg,rgba(2,13,23,.99),rgba(1,10,18,.995))!important;overflow:hidden!important
  }
  .game-card .directv-label{
    grid-column:1!important;grid-row:1!important;align-self:end!important;min-width:0!important;margin:0!important;padding:5px 6px 0!important;
    color:#159de8!important;background:rgba(21,157,232,.10)!important;border-right:1px solid rgba(21,157,232,.35)!important;
    font-size:8px!important;font-weight:1000!important;line-height:1!important;letter-spacing:.12em!important;text-transform:uppercase!important;text-align:center!important;
    white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important
  }
  .game-card .directv-channel{
    grid-column:1!important;grid-row:2!important;align-self:stretch!important;display:flex!important;align-items:flex-start!important;justify-content:center!important;
    min-width:0!important;max-width:none!important;margin:0!important;padding:1px 4px 6px!important;
    color:#159de8!important;background:rgba(21,157,232,.10)!important;border-right:1px solid rgba(21,157,232,.35)!important;
    font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;font-size:27px!important;line-height:1!important;font-weight:900!important;
    text-align:center!important;text-shadow:0 0 12px rgba(21,157,232,.45)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important
  }
  .game-card .directv-channel[data-long-source="true"]{font-size:12px!important;line-height:1.05!important;align-items:center!important;white-space:normal!important}
  .game-card .directv-note{
    grid-column:2!important;grid-row:1 / span 2!important;min-width:0!important;max-width:none!important;margin:0!important;padding:8px 11px!important;
    color:#b4c8d5!important;font-size:10px!important;line-height:1.2!important;text-align:left!important;white-space:normal!important;
    overflow:hidden!important;display:-webkit-box!important;-webkit-line-clamp:3!important;-webkit-box-orient:vertical!important
  }
  .game-card .profile-tag{font-size:8px!important}
  @media(max-width:430px){
    .game-card{border-radius:13px!important}
    .game-card .game-sport{font-size:9px!important;padding:5px 9px!important}
    .game-card .matchup{grid-template-columns:minmax(0,1fr) 20px minmax(0,1fr)!important;gap:6px!important;padding:8px 8px 6px!important}
    .game-card .team{grid-template-columns:36px minmax(0,1fr)!important;gap:6px!important}
    .game-card .team-mark{width:36px!important;height:36px!important;border-radius:8px!important;font-size:11px!important}
    .game-card .team-copy span{font-size:8px!important}.game-card .team-copy strong{font-size:14px!important}
    .game-card .at-mark{width:20px!important;height:20px!important;font-size:10px!important}
    .game-card .game-meta{padding:6px 9px!important}.game-card .game-time{font-size:13px!important}.game-card .game-network{font-size:10px!important}
    .game-card .game-venue{padding:5px 9px!important;font-size:9px!important}
    .game-card .directv-box{grid-template-columns:66px minmax(0,1fr)!important;min-height:54px!important}
    .game-card .directv-channel{font-size:24px!important}.game-card .directv-channel[data-long-source="true"]{font-size:10px!important}
    .game-card .directv-note{font-size:9px!important;padding:7px 9px!important}
  }`;
  const style=document.createElement('style');
  style.id='wtg-player-interface-style';
  style.textContent=css;
  document.head.appendChild(style);
  console.info('WTG 0.1H8t compact broadcast-guide interface loaded');
})();
