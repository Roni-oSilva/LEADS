import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Script de incorporação:
 *   <script src="https://SEU-APP/embed.js" data-leadfinder-form="slug-do-formulario" async></script>
 * Insere um iframe com o formulário, repassa os parâmetros UTM da página e ajusta a altura automaticamente.
 */
export function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const js = `(function(){
  var ORIGIN=${JSON.stringify(origin)};
  var scripts=document.querySelectorAll('script[data-leadfinder-form]');
  Array.prototype.forEach.call(scripts,function(s){
    if(s.getAttribute('data-lf-done'))return; s.setAttribute('data-lf-done','1');
    var slug=s.getAttribute('data-leadfinder-form'); if(!/^[a-z0-9-]{3,60}$/.test(slug||''))return;
    var q=new URLSearchParams(location.search), p=new URLSearchParams();
    ['utm_source','utm_medium','utm_campaign','utm_term','utm_content'].forEach(function(k){if(q.get(k))p.set(k,q.get(k));});
    if(document.referrer)p.set('ref',document.referrer);
    var f=document.createElement('iframe');
    f.src=ORIGIN+'/embed/'+slug+(p.toString()?'?'+p.toString():'');
    f.title='Formulário'; f.loading='lazy'; f.style.cssText='width:100%;border:0;min-height:420px;color-scheme:dark;';
    s.parentNode.insertBefore(f,s);
    window.addEventListener('message',function(e){
      if(e.origin!==ORIGIN||!e.data||e.data.type!=='leadfinder:height'||e.data.slug!==slug)return;
      f.style.height=Math.max(200,Number(e.data.height)||0)+'px';
    });
  });
})();`;
  return new NextResponse(js, { headers: { "Content-Type": "application/javascript; charset=utf-8", "Cache-Control": "public, max-age=300" } });
}
