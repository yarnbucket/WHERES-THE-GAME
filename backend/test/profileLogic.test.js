import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html=fs.readFileSync(new URL("../../app.html",import.meta.url),"utf8");

function functionSource(name){
  const start=html.indexOf(`function ${name}(`);
  assert.notEqual(start,-1,`${name} should exist`);
  const bodyStart=html.indexOf("{",start);
  let depth=0;
  for(let i=bodyStart;i<html.length;i++){
    if(html[i]==="{")depth++;
    if(html[i]==="}"&&--depth===0)return html.slice(start,i+1);
  }
  throw new Error(`Could not parse ${name}`);
}

test("HATE games are hidden unless the matchup also includes a LOVE team",()=>{
  const context={
    profileAffinity(game){return game.affinity}
  };
  vm.createContext(context);
  vm.runInContext(functionSource("profileAllowsGame"),context);

  assert.equal(context.profileAllowsGame({affinity:{love:false,hate:false}}),true);
  assert.equal(context.profileAllowsGame({affinity:{love:true,hate:false}}),true);
  assert.equal(context.profileAllowsGame({affinity:{love:false,hate:true}}),false);
  assert.equal(context.profileAllowsGame({affinity:{love:true,hate:true}}),true);
});

test("shared schedule filter applies viewing mode and profile rules",()=>{
  const source=functionSource("filterGamesForViewingMode");
  assert.match(source,/filter\(viewingModeMatches\)/);
  assert.match(source,/filter\(profileAllowsGame\)/);
});

test("profile schema and settings include the full preference foundation",()=>{
  for(const token of ["provider","viewingMode","visibleSports","notifications","profileAlertsEnabled","profileConfirmedOnly","profileRivalryAlerts"]){
    assert.match(html,new RegExp(token));
  }
  assert.match(functionSource("activateProfile"),/applyProfilePreferences/);
});

test("team picker has only mutually exclusive LOVE and HATE choices",()=>{
  assert.match(html,/id="teamPickerSearch"/);
  assert.match(html,/data-team-choice="love"/);
  assert.match(html,/data-team-choice="hate"/);
  assert.match(functionSource("setTeamPreference"),/p\[opposite\]=p\[opposite\]\.filter/);
});

test("compact profile controls require explicit loading and expose preference counts",()=>{
  assert.match(html,/id="loadProfileBtn"/);
  assert.doesNotMatch(html,/id="renameProfileBtn"/);
  assert.doesNotMatch(html,/id="duplicateProfileBtn"/);
  for(const id of ["teamPreferenceCount","favoriteSportCount","visibleSportCount","selectedDateGamesCount","loveGamesCount","favoriteGamesCount","hiddenHateGamesCount"]){
    assert.match(html,new RegExp(`id="${id}"`));
  }
});
