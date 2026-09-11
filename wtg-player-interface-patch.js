/* WTG 0.1H9g — readable broadcast-guide cards with final LOVE-team palette overrides.
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
    font-size:12px!important;font-weight:1000!important;letter-spacing:.10em!important;text-transform:uppercase!important
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
    display:grid!important;grid-template-columns:46px minmax(0,1fr)!important;align-items:center!important;
    gap:8px!important;min-width:0!important
  }
  .game-card .team-mark{
    display:grid!important;place-items:center!important;width:46px!important;height:46px!important;border-radius:10px!important;
    background:linear-gradient(145deg,rgba(17,102,161,.96),rgba(5,51,87,.98))!important;
    border:1px solid rgba(87,198,255,.42)!important;color:#fff!important;font-size:15px!important;font-weight:1000!important;
    box-shadow:inset 0 1px 0 rgba(255,255,255,.10),0 4px 10px rgba(0,0,0,.20)!important
  }
  .game-card .team-copy{min-width:0!important}
  .game-card .team-copy span{
    display:block!important;color:#9bb9ca!important;font-size:12px!important;font-weight:750!important;line-height:1.15!important;
    letter-spacing:.035em!important;text-transform:uppercase!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important
  }
  .game-card .team-copy strong{
    display:block!important;margin-top:3px!important;color:#f7fbff!important;font-size:21px!important;line-height:1.08!important;
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
    font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;font-size:20px!important;font-weight:800!important;letter-spacing:.02em!important
  }
  .game-card .game-time:before{
    content:""!important;display:inline-block!important;width:5px!important;height:5px!important;margin:0 7px 1px 0!important;
    border-radius:50%!important;background:#36dca1!important;box-shadow:0 0 8px rgba(54,220,161,.65)!important
  }
  .game-card .meta-dot{display:none!important}
  .game-card .game-network{
    grid-column:3!important;margin:0!important;padding:0!important;color:#9cb5c5!important;background:transparent!important;border:0!important;
    font-size:14px!important;font-weight:850!important;letter-spacing:.025em!important;text-transform:uppercase!important;text-align:right!important
  }
  .game-card .stream-badges{margin:0!important;padding:5px 10px!important;border-bottom:1px solid rgba(86,163,205,.14)!important;background:rgba(3,17,29,.92)!important}
  .game-card .game-venue{
    margin:0!important;padding:6px 10px!important;color:#8fa8b9!important;background:rgba(3,17,29,.92)!important;
    border-bottom:1px solid rgba(86,163,205,.16)!important;font-size:13px!important;line-height:1.25!important
  }
  .game-card .venue-glyph{color:#159de8!important}
  .game-card .directv-box{
    position:relative!important;display:grid!important;grid-template-columns:72px minmax(0,1fr)!important;
    grid-template-rows:18px minmax(30px,auto)!important;align-items:center!important;column-gap:0!important;row-gap:0!important;
    width:100%!important;height:auto!important;min-height:72px!important;margin:0!important;padding:0!important;
    border:0!important;border-radius:0!important;background:linear-gradient(180deg,rgba(2,13,23,.99),rgba(1,10,18,.995))!important;overflow:hidden!important
  }
  .game-card .directv-label{
    grid-column:1!important;grid-row:1!important;align-self:end!important;min-width:0!important;margin:0!important;padding:5px 6px 0!important;
    color:#159de8!important;background:rgba(21,157,232,.10)!important;border-right:1px solid rgba(21,157,232,.35)!important;
    font-size:10px!important;font-weight:1000!important;line-height:1!important;letter-spacing:.12em!important;text-transform:uppercase!important;text-align:center!important;
    white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important
  }
  .game-card .directv-channel{
    grid-column:1!important;grid-row:2!important;align-self:stretch!important;display:flex!important;align-items:flex-start!important;justify-content:center!important;
    min-width:0!important;max-width:none!important;margin:0!important;padding:1px 4px 6px!important;
    color:#159de8!important;background:rgba(21,157,232,.10)!important;border-right:1px solid rgba(21,157,232,.35)!important;
    font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace!important;font-size:32px!important;line-height:1!important;font-weight:900!important;
    text-align:center!important;text-shadow:0 0 12px rgba(21,157,232,.45)!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important
  }
  .game-card .directv-channel[data-long-source="true"]{font-size:12px!important;line-height:1.05!important;align-items:center!important;white-space:normal!important}
  .game-card .directv-note{
    grid-column:2!important;grid-row:1 / span 2!important;min-width:0!important;max-width:none!important;margin:0!important;padding:8px 11px!important;
    color:#d0dde5!important;font-size:13px!important;line-height:1.25!important;text-align:left!important;white-space:normal!important;
    overflow:hidden!important;display:-webkit-box!important;-webkit-line-clamp:3!important;-webkit-box-orient:vertical!important
  }
  .game-card .profile-tag{font-size:8px!important}
  /* 0.1H9c: final-layer LOVE-team palette overrides. These intentionally
     follow the base interface rules because that layer uses !important. */
  .game-card.loved-team-colors{
    background:linear-gradient(180deg,var(--team-primary),color-mix(in srgb,var(--team-primary) 62%,#000))!important;
    border-color:var(--team-secondary)!important;
    box-shadow:0 10px 24px rgba(0,0,0,.38),inset 0 2px 0 color-mix(in srgb,var(--team-secondary) 55%,transparent)!important
  }
  .game-card.loved-team-colors .card-top{background:linear-gradient(90deg,var(--team-secondary),color-mix(in srgb,var(--team-secondary) 68%,var(--team-primary)))!important;border-color:color-mix(in srgb,var(--team-secondary) 70%,#fff)!important}
  .game-card.loved-team-colors .game-sport,.game-card.loved-team-colors .gender-tag{color:var(--team-mark-text)!important}
  .game-card.loved-team-colors .matchup,.game-card.loved-team-colors .event-title{background:linear-gradient(180deg,color-mix(in srgb,var(--team-primary) 88%,#000),color-mix(in srgb,var(--team-primary) 66%,#000))!important}
  .game-card.loved-team-colors .team-mark{background:linear-gradient(145deg,var(--team-secondary),color-mix(in srgb,var(--team-secondary) 72%,#000))!important;border-color:var(--team-text)!important;color:var(--team-mark-text)!important}
  .game-card.loved-team-colors .team-copy span{color:color-mix(in srgb,var(--team-text) 72%,var(--team-secondary))!important}
  .game-card.loved-team-colors .team-copy strong,.game-card.loved-team-colors .event-title{color:var(--team-text)!important}
  .game-card.loved-team-colors .team-rank,.game-card.loved-team-colors .venue-glyph{color:var(--team-secondary)!important}
  .game-card.loved-team-colors .game-meta,.game-card.loved-team-colors .stream-badges,.game-card.loved-team-colors .game-venue{background:color-mix(in srgb,var(--team-primary) 72%,#000)!important;border-color:color-mix(in srgb,var(--team-secondary) 28%,transparent)!important}
  .game-card.loved-team-colors .game-time,.game-card.loved-team-colors .game-network,.game-card.loved-team-colors .game-venue{color:var(--team-text)!important}
  .game-card.loved-team-colors .directv-box{background:linear-gradient(180deg,color-mix(in srgb,var(--team-primary) 55%,#000),color-mix(in srgb,var(--team-primary) 32%,#000))!important}
  .game-card.loved-team-colors .directv-label,.game-card.loved-team-colors .directv-channel{color:var(--team-secondary)!important;background:color-mix(in srgb,var(--team-secondary) 10%,transparent)!important;border-color:color-mix(in srgb,var(--team-secondary) 45%,transparent)!important}
  .game-card.loved-team-colors .directv-note{color:var(--team-text)!important}
  @media(max-width:430px){
    .game-card{border-radius:13px!important}
    .game-card .game-sport{font-size:11px!important;padding:6px 9px!important}
    .game-card .matchup{grid-template-columns:minmax(0,1fr) 20px minmax(0,1fr)!important;gap:6px!important;padding:10px 8px 9px!important}
    .game-card .team{grid-template-columns:42px minmax(0,1fr)!important;gap:7px!important}
    .game-card .team-mark{width:42px!important;height:42px!important;border-radius:9px!important;font-size:14px!important}
    .game-card .team-copy span{font-size:11px!important}.game-card .team-copy strong{font-size:19px!important}
    .game-card .at-mark{width:20px!important;height:20px!important;font-size:10px!important}
    .game-card .game-meta{padding:8px 9px!important}.game-card .game-time{font-size:19px!important}.game-card .game-network{font-size:13px!important}
    .game-card .game-venue{padding:7px 9px!important;font-size:12px!important}
    .game-card .directv-box{grid-template-columns:78px minmax(0,1fr)!important;min-height:68px!important}
    .game-card .directv-label{font-size:9px!important}
    .game-card .directv-channel{font-size:30px!important}.game-card .directv-channel[data-long-source="true"]{font-size:13px!important}
    .game-card .directv-note{font-size:12px!important;padding:8px 10px!important}
  }`;
  const style=document.createElement('style');
  style.id='wtg-player-interface-style';
  style.textContent=css;
  document.head.appendChild(style);
  console.info('WTG 0.1H9g readable broadcast-guide interface loaded');
})();
