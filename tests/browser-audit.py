"""Responsive visual regression + navigation timing, on isolated fixture pages.
No production data is queried or modified. External requests are mocked/aborted.
"""
import argparse, functools, json, threading, time
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from statistics import median
from playwright.sync_api import sync_playwright

WIDTHS = [320, 390, 768, 1024, 1440]
ROOT_PAGES = ['index.html','calendar-preview.html','calendar-preview.html?theme=dark','admin-home-calendar-preview.html','student-journey-preview.html','student-resources-preview.html']
LANDING_PAGES = ['index.html','disponibilidade.html','admin.html','visit/home.html','visit/aluno.html','visit/perfil.html','visit/recursos.html','visit/enviar-material.html','visit/pergunte-ao-daniel.html']
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass

def server(path):
    s=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(path)))
    threading.Thread(target=s.serve_forever,daemon=True).start()
    return s

def external(route):
    # Browser never calls the real Supabase. Assets from public CDNs are optional, but no user data leaves localhost.
    u=route.request.url
    if u.startswith('http://127.0.0.1:'): route.continue_()
    elif 'supabase.co/' in u:
        route.fulfill(status=200,content_type='application/json',headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*'},body='[]')
    elif u.startswith(('https://fonts.googleapis.com/','https://fonts.gstatic.com/','https://cdn.jsdelivr.net/')):
        route.continue_()
    else: route.abort()

def audit(root,browser):
    servers=[server(root),server(root/'landing/dist')]
    rows=[]
    try:
        for s,paths in zip(servers,[ROOT_PAGES,LANDING_PAGES]):
            for path in paths:
                for width in WIDTHS:
                    context=browser.new_context(viewport={'width':width,'height':900},device_scale_factor=1,reduced_motion='reduce')
                    context.route('**/*',external)
                    page=context.new_page()
                    url=f'http://127.0.0.1:{s.server_port}/{path}'
                    try:
                        page.goto(url,wait_until='domcontentloaded',timeout=20000)
                        if path.startswith('visit/'):
                            page.wait_for_function("document.querySelector('#main-content')?.innerText.trim().length > 20",timeout=8000)
                        page.wait_for_timeout(300)
                        result=page.evaluate("""() => {
                          const root=document.documentElement,n=performance.getEntriesByType('navigation')[0],paint=performance.getEntriesByName('first-contentful-paint')[0];
                          const candidates=[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.right>root.clientWidth+2&&getComputedStyle(e).position!=='fixed'&&!e.closest('[hidden],.hidden,.crm-table-wrap,.crm-month-scroll')}).slice(0,5).map(e=>e.tagName+'.'+String(e.className).split(' ')[0]);
                          return {viewport:root.clientWidth,overflow:Math.max(0,root.scrollWidth-root.clientWidth),dcl:Math.round(n.domContentLoadedEventEnd),fcp:paint?Math.round(paint.startTime):null,offenders:candidates}
                        }""")
                        rows.append(dict(surface='portal' if s==servers[0] else 'landing',page=path,width=width,**result))
                    except Exception as e:
                        rows.append(dict(surface='portal' if s==servers[0] else 'landing',page=path,width=width,error=str(e)[:300]))
                    finally: context.close()
    finally:
        for s in servers:s.shutdown();s.server_close()
    return rows

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--baseline',type=Path);p.add_argument('--candidate',type=Path,default=Path.cwd());p.add_argument('--out',type=Path,default=Path('browser-audit-results.json'));a=p.parse_args()
    with sync_playwright() as pw:
        b=pw.chromium.launch()
        before=audit(a.baseline.resolve(),b) if a.baseline else []
        after=audit(a.candidate.resolve(),b)
        b.close()
    a.out.write_text(json.dumps({'baseline':before,'candidate':after},ensure_ascii=False,indent=2))
    old={(r['surface'],r['page'],r['width']):r for r in before}
    for r in after:
        previous=old.get((r['surface'],r['page'],r['width']),{})
        print(f"{r['surface']} {r['page']} {r['width']}px: overflow {previous.get('overflow','—')} -> {r.get('overflow','erro')}px; DOM {previous.get('dcl','—')} -> {r.get('dcl','—')}ms; {r.get('error','')}")
    failures=[r for r in after if 'error' in r or r.get('overflow',0)>2]
    print('RESULTS:',len(after),'checks;',len(failures),'overflow/errors')
    if failures: raise SystemExit(1)
