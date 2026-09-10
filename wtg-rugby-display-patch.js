/* WTG 0.1H8v — Rugby Union end-to-end frontend bridge.
   Uses the live WTG Rugby resolver directly and reports viewing-mode filtering clearly. */
(()=>{
  if(typeof loadGames!=="function")return;
  const originalLoadGames=loadGames;

  loadGames=async function(){
    if(selectedSport!=="rugby")return originalLoadGames();

    favoritesOnly=false;
    updateDateMeta();
    todayNav.classList.add("active");
    favoritesNav.classList.remove("active");
    dateLabel.textContent=formatDate(selectedDate);
    scheduleTitle.textContent="Rugby Games";
    gamesList.innerHTML="";
    setStatus("Loading Rugby Union…",true);

    try{
      const date=toApiDate(selectedDate);
      const url=`${API_BASE}/resolve?sport=rugby&date=${date}&provider=directv&_=${Date.now()}`;
      const response=await fetch(url,{cache:"no-store"});
      if(!response.ok)throw new Error(`Rugby HTTP ${response.status}`);
      const data=await response.json();
      const loadedGames=(Array.isArray(data.games)?data.games:[]).map(game=>({...game,_sportKey:"rugby"}));
      const activeGames=activeOrFutureGames(loadedGames);
      currentGames=filterGamesForViewingMode(activeGames);

      const modePrefix=selectedViewingMode==="standard"?"":`${VIEWING_MODES[selectedViewingMode].label} • `;
      scheduleTitle.textContent=`${modePrefix}Rugby Games (${currentGames.length})`;

      if(!loadedGames.length){
        setStatus(`Rugby backend returned 0 games for ${date}.`);
        return;
      }

      if(!currentGames.length){
        const modeName=VIEWING_MODES[selectedViewingMode]?.label||selectedViewingMode;
        setStatus(`${loadedGames.length} Rugby game${loadedGames.length===1?"":"s"} loaded, but 0 match ${modeName} viewing mode. Switch to STANDARD to see all TV + streaming games.`);
        return;
      }

      renderCollegeFilter();
      renderProFilter();
      hideStatus();
      renderGames(currentGames);
      console.info(`WTG Rugby frontend check: date=${date} backend=${loadedGames.length} visible=${currentGames.length} mode=${selectedViewingMode}`);
    }catch(error){
      console.error("WTG Rugby frontend bridge failed",error);
      setStatus(`Could not load Rugby Union: ${error?.message||"request failed"}`);
    }
  };

  console.info("WTG 0.1H8v Rugby frontend bridge loaded");
})();
