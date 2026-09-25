#!/usr/bin/env node
import { readFile, readdir, stat, mkdir, cp, rename, rm, mkdtemp, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, resolve, relative, dirname, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { realpathSync } from 'node:fs';

const [, , command, targetArg, candidateArg] = process.argv;
const usage = 'Usage: node requirements.mjs validate <target-project> | apply <target-project> <candidate-dir> | stamp <candidate-dir> <LED-revision>\nSee references/integrity.md for document and integrity formats.';
const fail = message => { throw new Error(message); };
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const validDate = value => { if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false; const date = new Date(`${value}T00:00:00Z`); return !Number.isNaN(date.getTime()) && date.toISOString().slice(0,10) === value; };
const git = (root, args, allowFail = false) => { const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' }); if (result.error || (!allowFail && result.status !== 0)) fail(`Git ${args.join(' ')} failed: ${result.error?.message || result.stderr.trim()}`); return result; };
const field = (line, name) => { const match = line.match(new RegExp(`(?:^|\\|)\\s*${name}:\\s*([^|]+)`, 'i')); return match?.[1]?.trim(); };
const refs = value => value.split(',').map(s=>s.trim()).filter(Boolean);
const requirementId = id => /^(REQ|NFR)-\d{3,}$/.test(id);
const evidenceId = id => /^EVD-\d{3,}$/.test(id);
const ledgerId = id => /^LED-\d{3,}$/.test(id);
const ensure = (condition, message, errors) => { if (!condition) errors.push(message); };
async function allFiles(root) {
  const result = [];
  async function walk(dir) { for (const entry of await readdir(dir,{withFileTypes:true})) { const path = join(dir,entry.name); if (entry.isDirectory()) await walk(path); else if (entry.isFile()) result.push(relative(root,path).split(sep).join('/')); else fail(`Unsupported file type: ${path}`); } }
  await walk(root); return result.sort();
}
async function checkSet(dir, historicalIds = new Set()) {
  const errors=[]; let names=[];
  try { names=await allFiles(dir); } catch (error) { return [`Cannot read requirements directory ${dir}: ${error.message}`]; }
  const needed=['README.md','non-functional.md','evidence.md','ledger.md','integrity.json'];
  for(const name of needed) ensure(names.includes(name),`Missing ${name}`,errors);
  const journeys=names.filter(n=>/^journeys\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(n));
  ensure(journeys.length>0,'Missing journeys/<slug>.md',errors);
  for(const name of names) ensure(needed.includes(name)||journeys.includes(name),`Unexpected requirements file: ${name}`,errors);
  if(errors.length) return errors;
  const bytes=Object.fromEntries(await Promise.all(names.filter(n=>n!=='integrity.json').map(async n=>[n,await readFile(join(dir,n))])));
  const txt=n=>bytes[n]?.toString('utf8')||'';
  let meta; try { meta=JSON.parse(await readFile(join(dir,'integrity.json'),'utf8')); } catch(error) { errors.push(`integrity.json: invalid JSON (${error.message})`); return errors; }
  if(!meta || typeof meta!=='object' || Array.isArray(meta)) return ['integrity.json: expected an object'];
  ensure(meta.version===1,'integrity.json: version must be 1',errors);
  ensure(ledgerId(meta.revision||''),'integrity.json: revision must be LED-NNN',errors);
  ensure(meta.hashes && typeof meta.hashes==='object' && !Array.isArray(meta.hashes),'integrity.json: hashes object is required',errors);
  if(meta.hashes && typeof meta.hashes==='object') {
    for(const name of Object.keys(bytes)) ensure(meta.hashes[name]===sha(bytes[name]),`integrity.json: hash mismatch for ${name}`,errors);
    for(const name of Object.keys(meta.hashes)) ensure(name in bytes,`integrity.json: unexpected hash ${name}`,errors);
  }
  const reqIds=new Set(), evIds=new Set(), ledgerIds=new Set();
  const readme=txt('README.md');
  ensure(/^# .+/m.test(readme),'README.md: missing title',errors);
  ensure(/User groups:\s*\S/i.test(readme),'README.md: missing User groups',errors);
  ensure(/Goals:\s*\S/i.test(readme),'README.md: missing Goals',errors);
  for(const match of readme.matchAll(/\]\((journeys\/[a-z0-9-]+\.md)\)/g)) ensure(journeys.includes(match[1]),`README.md: broken journey link ${match[1]}`,errors);
  for(const name of journeys) {
    const content=txt(name), match=content.match(/^#\s+(REQ-\d{3,}):\s*\S+/m);
    ensure(!!match,`${name}: title must contain REQ-NNN`,errors);
    if(match) { ensure(!reqIds.has(match[1]),`${name}: duplicate ${match[1]}`,errors); reqIds.add(match[1]); }
    for(const label of ['Actor','Goal','User value','Entry point','Success','Failure and recovery']) ensure(new RegExp(`^${label}:\\s*\\S+`,'mi').test(content),`${name}: missing ${label}`,errors);
    ensure(/^Actions and responses:\s*$/mi.test(content) && /^\d+\.\s+.+\s+->\s+.+/m.test(content),`${name}: missing ordered action -> visible response`,errors);
    ensure(readme.includes(`](${name})`) || readme.includes(`](${name.slice('journeys/'.length)})`),`README.md: missing link to ${name}`,errors);
  }
  ensure(/^# .+/m.test(txt('non-functional.md')),'non-functional.md: missing heading',errors);
  const nfrRows=txt('non-functional.md').split('\n').filter(l=>/^\s*-\s*NFR-/.test(l));
  for(const line of nfrRows) { const match=line.match(/^\s*-\s*(NFR-\d{3,}):\s*(.+)$/); ensure(!!match,`non-functional.md: malformed NFR entry ${line}`,errors); if(match){ensure(!reqIds.has(match[1]),`Duplicate ${match[1]}`,errors);reqIds.add(match[1]);} }
  const evRows=txt('evidence.md').split('\n').filter(l=>/^\s*-\s*EVD-/.test(l));
  ensure(evRows.length>0,'evidence.md: at least one EVD entry required',errors);
  for(const line of evRows) { const match=line.match(/^\s*-\s*(EVD-\d{3,})\s*\|/); ensure(!!match,`evidence.md: malformed entry ${line}`,errors); if(match){ensure(!evIds.has(match[1]),`Duplicate ${match[1]}`,errors);evIds.add(match[1]);} for(const label of ['Source','Provenance','Finding','Confidence','Supports']) ensure(!!field(line,label),`evidence.md: missing ${label} in ${match?.[1]||line}`,errors); const accessed=field(line,'Accessed'); if(accessed) ensure(validDate(accessed),`evidence.md: invalid Accessed date ${accessed}`,errors); for(const id of refs(field(line,'Supports')||'')) ensure(requirementId(id)&&reqIds.has(id),`evidence.md: broken Supports reference ${id}`,errors); }
  for(const name of [...journeys,'non-functional.md']) { for(const id of txt(name).match(/EVD-\d{3,}/g)||[]) ensure(evIds.has(id),`${name}: broken evidence reference ${id}`,errors); }
  const ledger=txt('ledger.md'), groups=[...ledger.matchAll(/^##\s+(\S+)\s*$/gm)];
  ensure(groups.length>0,'ledger.md: missing dated group',errors);
  let lastDate='9999-99-99'; for(const group of groups){ensure(validDate(group[1]),`ledger.md: invalid date ${group[1]}`,errors);ensure(group[1]<lastDate,`ledger.md: date groups must be newest first and unique (${group[1]})`,errors);lastDate=group[1];}
  let groupSeen=false; let groupHasEntry=false;
  for(const line of ledger.split('\n')) {
    if(/^##\s+/.test(line)) { if(groupSeen && !groupHasEntry) errors.push('ledger.md: date group has no entry'); groupSeen=true; groupHasEntry=false; }
    if(/^\s*-\s*LED-/.test(line)) { if(!groupSeen) errors.push('ledger.md: entry appears before a date group'); groupHasEntry=true; }
  }
  if(groupSeen && !groupHasEntry) errors.push('ledger.md: date group has no entry');
  const ledRows=ledger.split('\n').filter(l=>/^\s*-\s*LED-/.test(l));
  ensure(ledRows.length>0,'ledger.md: at least one entry required',errors);
  for(const line of ledRows){const match=line.match(/^\s*-\s*(LED-\d{3,})\s*\|/);ensure(!!match,`ledger.md: malformed entry ${line}`,errors);if(match){ensure(!ledgerIds.has(match[1]),`ledger.md: duplicate ${match[1]}`,errors);ledgerIds.add(match[1]);}for(const label of ['Decision','Reason','Affects','Before','After']) ensure(!!field(line,label),`ledger.md: missing ${label} in ${match?.[1]||line}`,errors);for(const id of refs(field(line,'Affects')||'')) ensure(requirementId(id),`ledger.md: bad Affects ID ${id}`,errors);}
  const latestAffects=refs(field(ledRows[0]||'','Affects')||'');
  for(const id of latestAffects) ensure(reqIds.has(id)||historicalIds.has(id),`ledger.md: latest entry references unknown requirement ${id}`,errors);
  ensure(meta.revision===ledRows[0]?.match(/LED-\d{3,}/)?.[0],`integrity.json: revision ${meta.revision} must equal latest ledger entry ${ledRows[0]?.match(/LED-\d{3,}/)?.[0]||'none'}`,errors);
  return errors;
}
function ledgerEntries(text) { const entries=new Map(); for(const line of text.split('\n')) { const id=line.match(/^\s*-\s*(LED-\d{3,})\s*\|/)?.[1]; if(id) entries.set(id,line.trim()); } return entries; }
function inspectHistory(target) {
  const errors=[]; const repo=git(target,['rev-parse','--show-toplevel'],true);
  if(repo.status!==0) return {errors:['Git repository missing: keep this set as a reviewable draft; final history validation requires Git.'],ids:new Set()};
  const root=repo.stdout.trim(), rel=relative(root,join(realpathSync(target),'docs/requirements')).split(sep).join('/');
  if(rel.startsWith('..')) return {errors:['Requirements directory is outside Git repository'],ids:new Set()};
  const commits=git(root,['rev-list','--reverse','--topo-order','--parents','HEAD'],true).stdout.trim().split('\n').filter(Boolean);
  const show=(commit,name)=>git(root,['show',`${commit}:${rel}/${name}`],true);
  function state(commit) {
    const ledger=show(commit,'ledger.md');
    const integrity=show(commit,'integrity.json');
    const paths=git(root,['ls-tree','-r','--name-only',commit,'--',rel],true).stdout.trim().split('\n').filter(Boolean);
    const ids=new Set();
    for(const path of paths) {
      const name=path.slice(rel.length+1);
      if(name==='non-functional.md') for(const id of show(commit,name).stdout.match(/^-\s*(NFR-\d{3,}):/gm)||[]) ids.add(id.match(/NFR-\d{3,}/)[0]);
      if(name.startsWith('journeys/')) {const id=show(commit,name).stdout.match(/^#\s+(REQ-\d{3,}):/m)?.[1];if(id)ids.add(id);}
    }
    return {ledger:ledger.status===0?ledger.stdout:null,integrity:integrity.status===0?integrity.stdout:null,ids};
  }
  const stateByCommit=new Map(), knownByCommit=new Map();
  for(const line of commits){
    const [commit,...parents]=line.split(' ');
    const comparisons=parents.length?parents:[null];
    const priorKnown=new Set(parents.flatMap(parent=>[...(knownByCommit.get(parent)||[])]));
    const changes=comparisons.map(parent=>parent
      ? git(root,['diff','--name-only',parent,commit,'--',rel],true).stdout.trim().split('\n').filter(Boolean)
      : git(root,['diff-tree','--root','--no-commit-id','--name-only','-r',commit,'--',rel],true).stdout.trim().split('\n').filter(Boolean));
    if(changes.every(paths=>paths.length===0)) {
      stateByCommit.set(commit,parents.length?stateByCommit.get(parents[0]):null);
      knownByCommit.set(commit,priorKnown);
      continue;
    }
    const current=state(commit);
    stateByCommit.set(commit,current);
    knownByCommit.set(commit,new Set([...priorKnown,...current.ids]));
    for(let i=0;i<comparisons.length;i++){
      const parent=comparisons[i], changed=changes[i];
      if(!changed.length) continue;
      const names=changed.map(n=>n.slice(rel.length+1));
      const prefix=`Commit ${commit.slice(0,8)}${parent?` versus parent ${parent.slice(0,8)}`:''}`;
      const ledgerChanged=names.includes('ledger.md'), metaChanged=names.includes('integrity.json');
      const currentChanged=names.some(n=>n!=='ledger.md'&&n!=='integrity.json');
      if(currentChanged && (!ledgerChanged||!metaChanged)) errors.push(`${prefix}: current documents changed without paired ledger.md and integrity.json updates`);
      if((ledgerChanged||metaChanged)&&!(ledgerChanged&&metaChanged)) errors.push(`${prefix}: ledger.md and integrity.json must change together`);
      if(current.ledger===null){errors.push(`${prefix}: missing ledger.md`);continue;}
      if(current.integrity===null){errors.push(`${prefix}: missing integrity.json`);continue;}
      const entries=ledgerEntries(current.ledger);
      const prior=parent?stateByCommit.get(parent):null;
      const priorEntries=ledgerEntries(prior?.ledger||'');
      for(const [id,row] of priorEntries) if(entries.get(id)!==row) errors.push(`${prefix}: historical ledger entry ${id} was changed or removed`);
      if(prior?.ledger && entries.size<=priorEntries.size) errors.push(`${prefix}: ledger.md must add a new entry for an accepted revision`);
      for(const [id,row] of entries) if(!priorEntries.has(id)) {
        for(const affected of refs(field(row,'Affects')||'')) {
          if(!current.ids.has(affected) && !priorKnown.has(affected)) errors.push(`${prefix}: ledger entry ${id} references ${affected} absent from current and committed ancestor documents`);
        }
      }
      try {const meta=JSON.parse(current.integrity);const first=current.ledger.match(/^\s*-\s*(LED-\d{3,})\s*\|/m)?.[1];if(!meta||meta.revision!==first)errors.push(`${prefix}: integrity revision does not match latest ledger entry`);}
      catch {errors.push(`${prefix}: malformed integrity.json`);}
    }
  }
  const status=git(root,['status','--porcelain','--untracked-files=all','--',rel]).stdout.trim();
  if(status) process.stderr.write('Uncommitted requirements changes detected; committed history guarantee applies only through HEAD.\n');
  const head=commits.at(-1)?.split(' ')[0];
  return {errors:[...new Set(errors)],ids:head?(knownByCommit.get(head)||new Set()):new Set()};
}

async function main(){
  if(!['validate','apply','stamp'].includes(command)||!targetArg||((command==='apply'||command==='stamp')&&!candidateArg)) fail(usage);
  if(command==='stamp'){
    if(!ledgerId(candidateArg)) fail('stamp revision must be LED-NNN');
    const dir=resolve(targetArg); const names=(await allFiles(dir)).filter(n=>n!=='integrity.json');
    const hashes=Object.fromEntries(await Promise.all(names.map(async name=>[name,sha(await readFile(join(dir,name)))])));
    await writeFile(join(dir,'integrity.json'),JSON.stringify({version:1,revision:candidateArg,hashes},null,2)+'\n');
    console.log(`Stamped ${dir} at ${candidateArg}.`); return;
  }
  const target=resolve(targetArg), canonical=join(target,'docs/requirements');
  if(command==='validate'){
    const history=inspectHistory(target);
    const errors=[...await checkSet(canonical,history.ids),...history.errors];
    if(errors.length) fail(errors.join('\n'));
    console.log('Requirements valid.'); return;
  }
  const candidate=resolve(candidateArg);
  const actualCandidate=realpathSync(candidate);
  let actualCanonical; try {actualCanonical=realpathSync(canonical);} catch(error) {if(error.code!=='ENOENT') throw error; actualCanonical=join(realpathSync(target),'docs/requirements');}
  if(actualCandidate===actualCanonical || actualCandidate.startsWith(actualCanonical+sep)) fail('Candidate must be outside canonical requirements directory');
  const history=inspectHistory(target);
  const historicalIds=history.ids;
  const errors=await checkSet(candidate,historicalIds);
  if(errors.length||history.errors.length) fail(`Candidate retained at ${candidate}; canonical requirements unchanged.\n${[...errors,...history.errors].join('\n')}`);
  const parent=dirname(canonical); await mkdir(parent,{recursive:true});
  const staging=await mkdtemp(join(parent,'.requirements-stage-'));
  const backup=join(parent,`.requirements-backup-${process.pid}-${Date.now()}`);
  let old=false, installed=false;
  try {
    await cp(candidate,staging,{recursive:true,force:true});
    const stagedErrors=await checkSet(staging,historicalIds);
    if(stagedErrors.length) fail(`Candidate retained at ${candidate}; canonical requirements unchanged.\n${stagedErrors.join('\n')}`);
    try {await stat(canonical);await rename(canonical,backup);old=true;} catch(error) {if(error.code!=='ENOENT') throw error;}
    await rename(staging,canonical); installed=true;
  } catch(error) {
    if(old && !installed) await rename(backup,canonical);
    await rm(staging,{recursive:true,force:true});
    throw error;
  }
  if(old) {try {await rm(backup,{recursive:true,force:true});} catch(error) {process.stderr.write(`Applied requirements; backup remains at ${backup}: ${error.message}\n`);}}
  console.log(`Applied requirements from ${candidate}. Run validate after committing to verify committed history.`);
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
