const fs = require('node:fs');
const path = require('node:path');
const { instance } = require('@viz-js/viz');
const { execFileSync } = require('node:child_process');
const root = path.join(__dirname, '..');
const graph = JSON.parse(fs.readFileSync(path.join(root,'docs/architecture.json'),'utf8'));
const escape = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const q = value => JSON.stringify(value);
const plain = value => value.replaceAll('→','->').replaceAll('↔','<->').replaceAll('·','/').replaceAll('’',"'").replaceAll('–','-');

async function build() {
  const ids = new Set(graph.nodes.map(n=>n.id));
  if(ids.size!==graph.nodes.length||graph.edges.some(e=>!ids.has(e.from)||!ids.has(e.to))) throw new Error('Invalid graph references.');
  const lines=['digraph veilx {',
    'graph [rankdir=TB, newrank=true, bgcolor="#f5effd", fontname="Arial", fontsize=17, nodesep=.32, ranksep=.8, pad=.45, splines=ortho, outputorder=edgesfirst];',
    'node [shape=box, style="rounded,filled", fontname="Arial", fontsize=12, fontcolor="#302c40", color="#afa6ca", penwidth=1, margin=".16,.11", width=2.1];',
    'edge [fontname="Arial", fontsize=9, color="#858093", fontcolor="#686174", arrowsize=.55, penwidth=.9];'];
  const rows = new Map();
  graph.groups.forEach(group=>{
    lines.push(`subgraph ${q('cluster_'+group.id)} { label=${q(plain(group.label))}; labelloc=t; labeljust=l; style="rounded,filled"; color="#d9d2e5"; fillcolor="#fdfcff"; margin=24;`);
    graph.nodes.filter(n=>n.group===group.id).forEach(node=>{
      const module=node.module.split('/').slice(-2).join('/');
      const label=`<B>${escape(plain(node.label))}</B><BR/><FONT POINT-SIZE="9">${escape(plain(module))}</FONT>${node.phase.includes('Phase 2')||node.phase==='Stretch'?`<BR/><FONT POINT-SIZE="8">${escape(node.phase.toUpperCase())}</FONT>`:''}`;
      lines.push(`${q(node.id)} [id=${q('node-'+node.id)}, label=<${label}>, fillcolor=${q(group.color)}${node.id==='placeholder-map'||node.id==='sqlite-cache'||node.id==='cookie-jar'||node.id==='preferences'||node.id==='session-storage'?', shape=cylinder':''}${node.id==='user'?', shape=ellipse':''}];`);
    });
    const members=graph.nodes.filter(n=>n.group===group.id).map(n=>n.id);
    const chunks=group.id==='experience' ? [['user'],['shell'],['composer','reply-panel','popup','settings'],['onboarding','why-panel','progress-panel','cookie-panel'],['site-consent','risk-badge','mode-controller']] : Array.from({length:Math.ceil(members.length/3)},(_,i)=>members.slice(i*3,i*3+3));
    rows.set(group.id,chunks);
    chunks.forEach((chunk,i)=>{
      lines.push(`{rank=same; ${chunk.map(q).join(';')};}`);
      for(let j=1;j<chunk.length;j++)lines.push(`${q(chunk[j-1])} -> ${q(chunk[j])} [style=invis,weight=100,constraint=false];`);
      if(i)lines.push(`${q(chunks[i-1][0])} -> ${q(chunk[0])} [style=invis,weight=100,minlen=1];`);
    });
    lines.push('}');
  });
  const layers=[['experience'],['detection','entities'],['redaction','cookies'],['providers','restoration'],['auditclient'],['backend','tinyfish','publicweb'],['support','stretch']];
  layers.forEach((layer,i)=>{
    lines.push(`{rank=same; ${layer.map(group=>q(rows.get(group)[0][0])).join(';')};}`);
    if(i)for(const previous of layers[i-1])for(const next of layer)lines.push(`${q(rows.get(previous).at(-1)[0])} -> ${q(rows.get(next)[0][0])} [style=invis,weight=100,minlen=2];`);
  });
  graph.edges.forEach(edge=>{
    const color=edge.flows.includes('audit')?'#8b64b5':edge.flows.includes('cookie')?'#458468':edge.flows.some(f=>f==='prompt'||f==='restore')?'#557eb9':edge.flows.includes('stretch')?'#b17c3e':'#9a96a3';
    lines.push(`${q(edge.from)} -> ${q(edge.to)} [id=${q('edge-'+edge.id)}, xlabel=${q(plain(edge.label))}, color=${q(color)}, constraint=false${edge.flows[0]==='platform'||edge.flows[0]==='stretch'?', style=dashed':''}];`);
  });
  lines.push('}');
  const dot=lines.join('\n')+'\n';
  fs.writeFileSync(path.join(root,'docs/architecture.dot'),dot);
  const viz=await instance();
  const result=viz.render(dot,{format:'svg'});
  const errors=result.errors.filter(error=>error.level==='error');
  if(result.status!=='success'||errors.length)throw new Error(JSON.stringify(result.errors.slice(0,6)));
  if(result.errors.length)process.stderr.write(JSON.stringify(result.errors.slice(0,3))+'\n');
  let svg=result.output.replace(/<\?xml[^>]*\?>\s*/,'').replace(/<!DOCTYPE[\s\S]*?>\s*/,'').replaceAll('&#45;','-');
  svg=svg.replace(/<svg\s/,'<svg id="architecture-svg" role="group" aria-label="Complete VeilX proposed architecture graph" ');
  graph.nodes.forEach(node=>{
    const group=`<g id="node-${node.id}" class="node">`;
    svg=svg.replace(group,`${group}<desc>${escape(node.label+' — '+node.detail)}</desc>`);
  });
  fs.writeFileSync(path.join(root,'docs/veilx-system-map.svg'),svg.replace('role="group"','role="img"'));
  graph.nodes.forEach(node=>{
    svg=svg.replace(`<g id="node-${node.id}" class="node">`,`<g id="node-${node.id}" class="node" tabindex="0" role="button" aria-pressed="false" aria-label="${escape(node.label)}">`);
  });
  const shell=fs.readFileSync(path.join(root,'docs/map-shell.html'),'utf8');
  const buttons=graph.flows.map((flow,i)=>`<button type="button" data-flow="${flow.id}" aria-pressed="${i===0}">${escape(flow.label)}</button>`).join('');
  const html=shell.replace('<!-- SYSTEM_GRAPH -->',()=>svg).replace('<!-- FLOW_BUTTONS -->',()=>buttons)
    .replace('/* SYSTEM_MODEL */',()=>JSON.stringify(graph).replaceAll('<','\\u003c'))
    .replace('<!-- NODE_COUNT -->',String(graph.nodes.length)).replace('<!-- EDGE_COUNT -->',String(graph.edges.length));
  if(/SYSTEM_GRAPH|SYSTEM_MODEL|FLOW_BUTTONS/.test(html))throw new Error('Unfilled template.');
  fs.writeFileSync(path.join(root,'index.html'),html);
  execFileSync(process.execPath,[path.join(__dirname,'seal-html.cjs')],{stdio:'inherit'});
  process.stdout.write(`Built ${graph.nodes.length} components and ${graph.edges.length} connections.\n`);
}
build().catch(error=>{process.stderr.write(error.message+'\n');process.exitCode=1;});
