// Hand-authored Tcash mark and listing art. No generated imagery or simulated UI.
import { Resvg } from "@resvg/resvg-js";
import { writeFileSync } from "node:fs";
const ink='#1c1712',paper='#f7f3ea',copper='#a85a2a';
const mark=`<path d="M142 138H370V184H286V338H322V374H190V338H226V184H142Z" fill="${paper}"/><path d="M326 238H372M326 276H356" stroke="${paper}" stroke-width="12"/>`;
const slip=`<path d="M310 54H725V378L706 366L687 378L668 366L649 378L630 366L611 378L592 366L573 378L554 366L535 378L516 366L497 378L478 366L459 378L440 366L421 378L402 366L383 378L364 366L345 378L326 366L310 378Z" fill="${paper}"/><path d="M350 118H685M350 170H540M350 214H600M350 258H490M592 258H685M350 302H685" stroke="${copper}" stroke-width="5"/><circle cx="646" cy="207" r="26" fill="none" stroke="${copper}" stroke-width="5"/>`;
const svg=(w,h,body)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
function out(name,source){writeFileSync(new URL(`../public/${name}.svg`,import.meta.url),source);writeFileSync(new URL(`../public/${name}.png`,import.meta.url),new Resvg(source).render().asPng());}
out('tcash-logo',svg(512,512,`<rect width="512" height="512" fill="${copper}"/>${mark}`));
out('tcash-card',svg(1035,720,`<defs><filter id="blur"><feGaussianBlur stdDeviation="24"/></filter></defs><rect width="1035" height="720" fill="${copper}"/>${slip}<path d="M0 460Q517 394 1035 460V720H0Z" fill="${ink}" opacity="0.15" filter="url(#blur)"/>`));
out('tcash-meta',svg(1200,630,`<rect width="1200" height="630" fill="${paper}"/><rect x="74" y="104" width="332" height="422" fill="${copper}"/><g transform="translate(74 149) scale(.65)">${mark}</g><text x="478" y="258" font-family="Georgia" font-style="italic" font-size="104" fill="${ink}">Tcash</text><text x="478" y="340" font-family="Arial" font-size="30" fill="${ink}">WLD and USDC. M-Pesa Kenya.</text><text x="478" y="396" font-family="Arial" font-size="24" fill="${copper}">Every order, clearly recorded.</text>`));
