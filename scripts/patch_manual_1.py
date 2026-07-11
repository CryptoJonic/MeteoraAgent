#!/usr/bin/env python3
from pathlib import Path
R=Path(__file__).resolve().parents[1]
def rep(s,a,b,n):
 c=s.count(a)
 if c!=1: raise SystemExit(f'{n}: {c}')
 return s.replace(a,b,1)
p=R/'terminal/pro.html';s=p.read_text()
s=rep(s,'pro.css?v=1','pro.css?v=2','css version');s=rep(s,'pro.js?v=1','pro.js?v=2','js version')
s=rep(s,'      <button data-tool="horizontal" title="Горизонтальная линия">—</button>\n','      <button data-tool="horizontal" title="Горизонтальная линия">—</button>\n      <button data-tool="manualGalka" title="Выбрать уровень галки">G</button>\n','tool')
s=rep(s,'        <div class="panel-title"><b id="botTitle">Galka bot · BTC</b><span id="botState">Ожидание</span></div>\n        <div id="campaignCard" class="card muted">Активной кампании нет.</div>\n','        <div class="panel-title"><b id="botTitle">Galka bot · BTC</b><span id="botState">Ожидание</span></div>\n        <div class="manual-actions">\n          <button id="manualGalkaBtn" class="primary">Указать галку на графике</button>\n          <button id="cancelManualGalka">Снять уровень</button>\n        </div>\n        <div class="training-row"><span>Сохранено примеров: <b id="manualExamplesCount">0</b></span><button id="exportManualExamples">JSON</button></div>\n        <div id="campaignCard" class="card muted">Активной кампании нет.</div>\n','controls')
s=rep(s,'            <label>Макс. часов<input id="maxHours" type="number" min="1" max="336"></label>\n            <label>Режим выхода<select id="exitMode">','            <label>Макс. часов<input id="maxHours" type="number" min="1" max="336"></label>\n            <label>Сигнал<select id="signalMode"><option value="manual">Выбираю галку сам</option><option value="auto">Автопоиск (эксперимент)</option></select></label>\n            <label>Шаг лимиток, %<input id="ladderStepPct" type="number" min="0.05" max="2" step="0.05"></label>\n            <label>Глубина лестницы, %<input id="manualDepthPct" type="number" min="0.15" max="10" step="0.15"></label>\n            <label>Режим выхода<select id="exitMode">','settings')
p.write_text(s)
p=R/'terminal/pro.css';s=p.read_text()+'''\n.leftbar button[data-tool="manualGalka"]{font-weight:900;color:var(--orange);border:1px solid color-mix(in srgb,var(--orange) 45%,transparent)}
.leftbar button[data-tool="manualGalka"].active{background:color-mix(in srgb,var(--orange) 18%,var(--panel))!important;color:var(--orange)!important;outline-color:var(--orange)}
.manual-actions{display:grid;grid-template-columns:1fr auto;gap:6px;padding:8px;border-bottom:1px solid var(--line)}
.manual-actions button{min-height:38px;border-radius:5px}
.training-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 9px;color:var(--muted);border-bottom:1px solid var(--line);font-size:11px}
.training-row button{height:30px;border-radius:4px}
''';p.write_text(s)
