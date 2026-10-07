// Listing illustrations, not screenshots. Use real World App captures for review evidence.
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, writeFileSync } from "node:fs";
const icon=readFileSync(new URL('../public/tcash-logo.png',import.meta.url)).toString('base64');
const captions=[['Buy WLD or USDC','Pay with M-Pesa in Kenya.'],['Sell for M-Pesa','Review your payout before sending.'],['Keep track of every order','An operator checks each payment.']];
for(const [i,[title,subtitle]] of captions.entries()){
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920"><rect width="1080" height="1920" fill="#f7f3ea"/><image href="data:image/png;base64,${icon}" x="390" y="380" width="300" height="300"/><text x="540" y="900" font-family="Georgia" font-style="italic" font-size="112" fill="#1c1712" text-anchor="middle">Tcash</text><path d="M120 1000H960" stroke="#a85a2a" stroke-width="3"/><text x="540" y="1150" font-family="Arial" font-size="60" fill="#1c1712" text-anchor="middle">${title}</text><text x="540" y="1240" font-family="Arial" font-size="38" fill="#6c6152" text-anchor="middle">${subtitle}</text></svg>`;
 const png=new Resvg(svg).render().asPng();
 for(const name of [`tcash-showcase-${i+1}.png`,`showcase_img_${i+1}.png`])writeFileSync(new URL('../public/'+name,import.meta.url),png);
}
writeFileSync(new URL('../public/content_card_image.png',import.meta.url),readFileSync(new URL('../public/tcash-card.png',import.meta.url)));
