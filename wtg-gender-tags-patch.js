/* WTG 0.1H8r — approved college men/women labels. */
(()=>{
  const css=`
  .game-card .gender-tag{
    margin-left:8px;padding:2px 7px;border-radius:999px;
    border:1px solid rgba(104,205,255,.42);background:rgba(10,85,132,.58);
    color:#fff;font-size:9px;font-weight:1000;letter-spacing:.08em;line-height:1.2;
  }
  @media(max-width:430px){.game-card .gender-tag{font-size:8px;padding:2px 6px;margin-left:6px}}
  `;
  const style=document.createElement('style');
  style.id='wtg-gender-tags-style';
  style.textContent=css;
  document.head.appendChild(style);

  if(typeof renderGame!=="function"){
    console.warn('WTG gender tags: renderGame unavailable');
    return;
  }

  const baseRenderGame=renderGame;
  renderGame=function(game,conflictKeys){
    let html=baseRenderGame(game,conflictKeys);
    const key=String(game?._sportKey||"").toLowerCase();
    const sport=String(game?.sport||"").toLowerCase();
    const league=String(game?.league||"").toLowerCase();
    const isCollegeVolleyball=key==="collegevolleyball"||sport==="college volleyball"||league.includes("college volleyball");
    if(!isCollegeVolleyball)return html;

    const gender=String(game?.gender||"").toLowerCase();
    const label=gender==="women"||gender==="female"?"WOMEN":gender==="men"||gender==="male"?"MEN":"";
    if(!label)return html;

    return html.replace(
      /(<span class="game-sport">)([\s\S]*?)(<\/span>)/,
      `$1$2<span class="gender-tag">${label}</span>$3`
    );
  };

  console.info('WTG 0.1H8r college gender tags loaded');
})();
