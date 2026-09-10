/* WTG 0.1H8u — restore approved gold tuner/channel accent. */
(()=>{
  const css=`
  .game-card .directv-label{
    color:#FFB627!important;
    background:rgba(255,182,39,.08)!important;
    border-right:1px solid rgba(255,182,39,.35)!important;
  }
  .game-card .directv-channel{
    color:#FFB627!important;
    background:rgba(255,182,39,.08)!important;
    border-right:1px solid rgba(255,182,39,.35)!important;
    text-shadow:0 0 14px rgba(255,182,39,.55)!important;
  }
  `;
  const style=document.createElement('style');
  style.id='wtg-gold-channel-style';
  style.textContent=css;
  document.head.appendChild(style);
  console.info('WTG 0.1H8u gold channel accent loaded');
})();
