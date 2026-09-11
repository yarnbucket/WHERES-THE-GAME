import { chromium } from "playwright";

const frontend=process.env.WTG_FRONTEND||"http://127.0.0.1:4173/";
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:412,height:915}});

try{
  await page.goto(frontend,{waitUntil:"networkidle",timeout:60000});
  await page.waitForFunction(()=>"serviceWorker" in navigator&&navigator.serviceWorker.ready,{timeout:20000});
  await page.reload({waitUntil:"networkidle",timeout:60000});
  await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller),{timeout:20000});
  const result=await page.evaluate(async()=>{
    const manifestHref=document.querySelector('link[rel="manifest"]')?.href||"";
    const manifestResponse=await fetch(manifestHref);
    const manifest=await manifestResponse.json();
    const iconChecks=await Promise.all(manifest.icons.map(async icon=>({src:icon.src,status:(await fetch(new URL(icon.src,manifestHref))).status})));
    return{
      title:document.title,
      manifestStatus:manifestResponse.status,
      display:manifest.display,
      iconChecks,
      installButton:Boolean(document.getElementById("installAppBtn")),
      controlled:Boolean(navigator.serviceWorker.controller),
      caches:await caches.keys()
    };
  });
  if(result.manifestStatus!==200||result.display!=="standalone")throw new Error("Manifest is not installable");
  if(!result.installButton)throw new Error("Install control is missing");
  if(!result.controlled||!result.caches.some(name=>name==="wtg-shell-0.1H9g"))throw new Error("Offline shell is not active");
  if(result.iconChecks.some(icon=>icon.status!==200))throw new Error("One or more install icons failed to load");
  console.log(`WTG PWA VALIDATION PASS: manifest, ${result.iconChecks.length} icons, install control and offline shell active at mobile viewport.`);
}finally{
  await browser.close();
}
