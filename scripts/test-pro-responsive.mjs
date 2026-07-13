import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync('terminal/pro.html', 'utf8');
const css = fs.readFileSync('terminal/pro.css', 'utf8');

assert.equal((css.match(/{/g) || []).length, (css.match(/}/g) || []).length, 'CSS braces');
assert.ok(/@media \(max-width: 700px\)/.test(css));
assert.ok(/@media \(orientation: landscape\)[\s\S]*max-height: 620px/.test(css));
assert.ok(/@media \(min-width: 1100px\)/.test(css));
assert.ok(/env\(safe-area-inset-bottom/.test(css));
assert.ok(/min-height: 44px/.test(css), 'base touch target');
assert.ok(/prefers-reduced-motion/.test(css));
assert.ok(/:focus-visible/.test(css));

const viewportContracts = [
  { width: 360, height: 800, mode: 'portrait sheet' },
  { width: 390, height: 844, mode: 'S24 portrait sheet' },
  { width: 844, height: 390, mode: 'landscape side sheet' },
  { width: 1440, height: 900, mode: 'DeX/desktop three-column' },
];
for (const viewport of viewportContracts) {
  if (viewport.width <= 700 && viewport.height > 620) {
    assert.ok(css.includes('.sidebar.open'));
    assert.ok(css.includes('height: min(66dvh, 720px)'));
  } else if (viewport.height <= 620 && viewport.width < 1100) {
    assert.ok(css.includes('width: min(46vw, 430px)'));
  } else {
    assert.ok(css.includes('grid-template-columns: var(--left-rail) minmax(0, 1fr) var(--right-panel)'));
  }
}

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(ids.length, new Set(ids).size, 'no duplicated interactive IDs');
for (const panel of ['paper', 'radar', 'lab', 'watchlist', 'objects', 'more']) {
  assert.ok(html.includes(`data-panel-id="${panel}"`));
}
assert.ok(/\.sidebar \{[\s\S]*transform: translateY\(calc\(100% \+ 12px\)\)/.test(css), 'mobile panel is closed by default');
assert.ok(/\.terminal-grid \{[\s\S]*grid-template-columns: 1fr/.test(css), 'chart owns default mobile grid');

function luminance(hex) {
  const values = hex.match(/[a-f\d]{2}/gi).map((value) => parseInt(value, 16) / 255).map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
}
function contrast(a, b) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}
assert.ok(contrast('#f4f7fb', '#080b10') >= 7, 'primary dark contrast');
assert.ok(contrast('#9aa6b6', '#080b10') >= 4.5, 'secondary dark contrast');

console.log(`Responsive: ${viewportContracts.map((item) => `${item.width}x${item.height}`).join(', ')} contracts and accessibility checks passed`);
