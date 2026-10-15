const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const root = path.join(__dirname, '..');
const graph = fs.existsSync(path.join(root, 'docs/architecture.json'))
  ? JSON.parse(fs.readFileSync(path.join(root, 'docs/architecture.json'), 'utf8'))
  : { nodes: [], edges: [], groups: [], flows: [] };
const node = id => graph.nodes.find(item => item.id === id);
const linked = (a, b) => graph.edges.some(edge => edge.from === a && edge.to === b);

test('the graph describes the full feature set and every connection has valid endpoints', () => {
  assert.ok(graph.nodes.length >= 100, 'Extended architecture, not a summary diagram');
  assert.ok(graph.edges.length >= 140, 'Show labeled connections across the features');
  assert.equal(new Set(graph.nodes.map(n => n.id)).size, graph.nodes.length);
  for (const edge of graph.edges) {
    assert.ok(node(edge.from) && node(edge.to), `${edge.from} → ${edge.to}`);
    assert.ok(edge.label.trim(), 'Every connection explains its relationship');
  }
  for (const n of graph.nodes) {
    assert.ok(graph.groups.some(g => g.id === n.group));
    assert.ok(graph.edges.some(e => e.from === n.id || e.to === n.id), `${n.id} is disconnected`);
    assert.ok(n.detail && n.module && n.phase, `${n.id} needs a reviewable explanation`);
  }
});

test('names, addresses, email and phone feed local placeholders and protected reply restoration', () => {
  for (const id of ['names','addresses','email','phones']) assert.ok(linked(id,'overlaps'), id);
  for (const [a,b] of [['overlaps','review'],['review','registry'],['registry','placeholder-map'],['placeholder-map','redactor'],['redactor','send-gate'],['send-gate','adapter'],['ai-provider','observer'],['observer','stream-buffer'],['stream-buffer','token-parser'],['token-parser','map-lookup'],['placeholder-map','map-lookup'],['map-lookup','safe-restore'],['safe-restore','reply-panel']]) assert.ok(linked(a,b), `${a} → ${b}`);
});

test('raw personal information and secret inspection never cross the local trust boundary', () => {
  assert.ok(graph.edges.some(e => e.payload === 'pii'));
  assert.ok(graph.edges.some(e => e.payload === 'cookie-secret'));
  for (const edge of graph.edges.filter(e => ['pii','cookie-secret'].includes(e.payload))) {
    assert.equal(node(edge.from).trust,'local',edge.from);
    assert.equal(node(edge.to).trust,'local',edge.to);
  }
  for (const id of ['placeholder-map','cookie-jar','cookie-inspector']) {
    assert.ok(!graph.edges.some(e => e.from===id && ['backend','agent'].includes(node(e.to).trust)),id);
  }
  assert.ok(linked('secret-filter','safe-restore'), 'Credentials stay hidden in restored replies');
});

test('TinyFish connects public policy navigation, validation, caching and fail-safe risk to the extension', () => {
  for (const [a,b] of [['domain-gate','audit-client'],['audit-client','audit-route'],['audit-route','cache-lookup'],['cache-lookup','tinyfish-client'],['tinyfish-client','tinyfish-api'],['tinyfish-api','web-agent'],['web-agent','privacy-page'],['web-agent','terms-page'],['web-agent','controls-page'],['agent-result','schema-validator'],['schema-validator','risk-engine'],['risk-engine','risk-badge'],['risk-engine','mode-controller'],['audit-failure','strict-fallback']]) assert.ok(linked(a,b), `${a} → ${b}`);
  assert.ok(linked('cache-lookup','cached-result'));
  assert.ok(linked('schema-validator','sqlite-cache'));
});

test('Cookie Guard keeps native authentication, local metadata and tracker rules connected', () => {
  for (const [a,b] of [['site-consent','cookie-inspector'],['cookie-jar','cookie-inspector'],['cookie-inspector','discard-values'],['cookie-inspector','cookie-metadata'],['cookie-metadata','cookie-panel'],['cookie-metadata','flag-checks'],['tracker-rules','dnr-engine'],['dnr-engine','tracker-blocked'],['cookie-jar','native-auth'],['native-auth','ai-provider'],['secret-scanner','send-gate']]) assert.ok(linked(a,b), `${a} → ${b}`);
});

test('HTML is a self-contained graph with offline SVG and accessible exploration', () => {
  const file = path.join(root,'index.html');
  const html = fs.existsSync(file) ? fs.readFileSync(file,'utf8') : '';
  assert.match(html, /id="architecture-svg"/);
  assert.match(html, /id="graph-viewport"/);
  assert.match(html, /id="node-details"/);
  assert.match(html, /connect-src 'none'/);
  assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href=|fetch\s*\(|XMLHttpRequest|sendBeacon|innerHTML\s*=/);
  const svg = fs.existsSync(path.join(root,'docs/veilx-system-map.svg')) ? fs.readFileSync(path.join(root,'docs/veilx-system-map.svg'),'utf8') : '';
  assert.match(svg, /<svg/);
  assert.ok(svg.includes('placeholder-map') && svg.includes('tinyfish-api'));
  assert.equal((svg.match(/class="node"/g)||[]).length,graph.nodes.length);
  assert.equal((svg.match(/class="edge"/g)||[]).length,graph.edges.length);
  assert.equal((html.match(/role="button"/g)||[]).length,graph.nodes.length);
  assert.doesNotMatch(svg,/role="button"|<script/);
});

test('feature traces, direct neighborhoods and literal search preserve the full graph model', () => {
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const core=html.match(/<script id="graph-core">([\s\S]*?)<\/script>/)?.[1]||'';
  const context=vm.createContext({});
  vm.runInContext(core,context,{filename:'graph-core.js'});
  const run=source=>vm.runInContext(source,context);
  assert.equal(run("graphSelection().nodes.length"),graph.nodes.length);
  assert.equal(run("graphSelection().edges.length"),graph.edges.length);
  for(const flow of graph.flows) assert.ok(run(`graphSelection('${flow.id}').edges.length`)>0,flow.id);
  assert.equal(run("graphSelection('missing').edges.length"),0);
  assert.equal(run("graphSelection('all','cookie-jar').edges.every(e=>e.from==='cookie-jar'||e.to==='cookie-jar')"),true);
  assert.equal(run("graphSelection('prompt','cookie-jar').nodes.length"),1);
  assert.ok(run("searchComponents(' ADDRESS ').some(n=>n.id==='addresses')"));
  assert.equal(run("searchComponents(' ').length"),0);
  assert.equal(run("searchComponents('<script>not code</script>').length"),0);
  assert.ok(run("searchComponents('local').length")<=8);
});

test('generated scripts, exact CSP hashes and unique IDs remain valid', () => {
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const scripts=[...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length,2);
  scripts.forEach(match=>assert.doesNotThrow(()=>new vm.Script(match[1])));
  for(const block of html.matchAll(/<(?:script|style)[^>]*>([\s\S]*?)<\/(?:script|style)>/g)) {
    assert.ok(html.includes(`'sha256-${createHash('sha256').update(block[1]).digest('base64')}'`));
  }
  const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(match=>match[1]);
  assert.equal(new Set(ids).size,ids.length);
});
