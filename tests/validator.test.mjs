import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, stat, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const cli = resolve('skills/requirements/scripts/requirements.mjs');
const hash = s => createHash('sha256').update(s).digest('hex');
const files = {
  'README.md': '# Requirements\n\nUser groups: Readers.\nGoals: Find a book.\n\n[Find a book](journeys/find-book.md)\n',
  'journeys/find-book.md': '# REQ-001: Find a book\n\nActor: Reader\nGoal: Find a book\nUser value: Can choose a book\nEntry point: Catalog\nActions and responses:\n1. Reader searches -> Results appear\nSuccess: Reader sees book details\nFailure and recovery: No results; reader changes search\n',
  'non-functional.md': '# Quality constraints\n\n- NFR-001: Search results appear within 2 seconds for 95% of requests.\n',
  'evidence.md': '# Evidence\n\n- EVD-001 | Source: Interview | Provenance: Reader A | Accessed: 2026-09-25 | Finding: Search is useful | Confidence: Confirmed | Supports: REQ-001\n',
  'ledger.md': '# Decision ledger\n\n## 2026-09-25\n- LED-001 | Decision: Establish baseline | Reason: Initial project inspection | Affects: REQ-001, NFR-001 | Before: no maintained requirements | After: baseline requirements\n'
};
async function fixture() {
  const target = await mkdtemp(join(tmpdir(), 'req-test-'));
  const dir = join(target, 'docs/requirements'); await mkdir(join(dir,'journeys'), {recursive:true});
  for (const [name, data] of Object.entries(files)) await writeFile(join(dir,name),data);
  await writeFile(join(dir,'integrity.json'),JSON.stringify({version:1,revision:'LED-001',hashes:Object.fromEntries(Object.entries(files).map(([k,v])=>[k,hash(v)]))},null,2)+'\n');
  return {target,dir};
}
const run = (...args) => spawnSync(process.execPath,[cli,...args],{encoding:'utf8'});
const git = (target,...args) => spawnSync('git',args,{cwd:target,encoding:'utf8'});
async function init(target) { git(target,'init','-q'); git(target,'config','user.email','test@example.test'); git(target,'config','user.name','Test'); git(target,'add','.'); git(target,'commit','-qm','baseline'); }

test('valid current set passes; missing Git is reported as a draft limitation', async () => {
  const {target}=await fixture();
  const noGit=run('validate',target); assert.notEqual(noGit.status,0); assert.match(noGit.stderr,/Git|git/);
  await init(target); const valid=run('validate',target); assert.equal(valid.status,0,valid.stderr);
});

test('broken references, hash and revision links are rejected through CLI', async () => {
  const {target,dir}=await fixture(); await init(target);
  const data=await readFile(join(dir,'journeys/find-book.md'),'utf8');
  await writeFile(join(dir,'journeys/find-book.md'),data.replace('REQ-001','REQ-999'));
  let result=run('validate',target); assert.notEqual(result.status,0); assert.match(result.stderr,/hash|REQ-001|REQ-999/);
  await writeFile(join(dir,'journeys/find-book.md'),data);
  const integrity=JSON.parse(await readFile(join(dir,'integrity.json'),'utf8')); integrity.revision='LED-999';
  await writeFile(join(dir,'integrity.json'),JSON.stringify(integrity));
  result=run('validate',target); assert.notEqual(result.status,0); assert.match(result.stderr,/revision/);
});

test('apply rejects invalid candidate and leaves canonical bytes intact', async () => {
  const {target,dir}=await fixture(); await init(target);
  const original=await readFile(join(dir,'README.md'));
  const candidate=join(target,'candidate'); await mkdir(join(candidate,'journeys'),{recursive:true});
  for(const [name,data] of Object.entries(files)) await writeFile(join(candidate,name),data);
  await writeFile(join(candidate,'integrity.json'),'{bad');
  const result=run('apply',target,candidate); assert.notEqual(result.status,0); assert.match(result.stderr,/integrity.json/);
  assert.deepEqual(await readFile(join(dir,'README.md')),original);
  assert.ok(await stat(join(candidate,'README.md')));
});

test('committed unpaired current revision is rejected', async () => {
  const {target,dir}=await fixture(); await init(target);
  const data=await readFile(join(dir,'README.md'),'utf8'); await writeFile(join(dir,'README.md'),data+'\nMore context.\n');
  const meta=JSON.parse(await readFile(join(dir,'integrity.json'),'utf8')); meta.hashes['README.md']=hash(data+'\nMore context.\n');
  await writeFile(join(dir,'integrity.json'),JSON.stringify(meta,null,2)+'\n');
  git(target,'add','.'); git(target,'commit','-qm','unpaired');
  const result=run('validate',target); assert.notEqual(result.status,0); assert.match(result.stderr,/ledger.md/);
});

test('stamp computes candidate hashes; apply replaces valid canonical set', async () => {
  const {target,dir}=await fixture(); await init(target);
  const candidate=join(target,'candidate'); await mkdir(join(candidate,'journeys'),{recursive:true});
  for(const [name,data] of Object.entries(files)) await writeFile(join(candidate,name),data);
  const nextLedger=files['ledger.md'].replace('## 2026-09-25','## 2026-09-26\n- LED-002 | Decision: Clarify result | Reason: Reader feedback | Affects: REQ-001 | Before: Details shown | After: Details include location\n\n## 2026-09-25');
  await writeFile(join(candidate,'ledger.md'),nextLedger);
  const stamped=run('stamp',candidate,'LED-002'); assert.equal(stamped.status,0,stamped.stderr);
  const applied=run('apply',target,candidate); assert.equal(applied.status,0,applied.stderr);
  assert.equal(await readFile(join(dir,'ledger.md'),'utf8'),nextLedger);
  assert.equal(JSON.parse(await readFile(join(dir,'integrity.json'),'utf8')).revision,'LED-002');
});

test('committed ledger rewrite is detected even when current metadata is restamped', async () => {
  const {target,dir}=await fixture(); await init(target);
  const ledger=(await readFile(join(dir,'ledger.md'),'utf8')).replace('Initial project inspection','Rewritten reason');
  await writeFile(join(dir,'ledger.md'),ledger);
  assert.equal(run('stamp',dir,'LED-001').status,0);
  git(target,'add','.'); git(target,'commit','-qm','rewrite');
  const result=run('validate',target); assert.notEqual(result.status,0); assert.match(result.stderr,/historical ledger entry LED-001/);
});

test('valid committed addition, edit, and removal keep one new ledger entry per revision', async () => {
  const {target,dir}=await fixture(); await init(target);
  async function revision(id, date, decision, before, after) {
    const ledger=await readFile(join(dir,'ledger.md'),'utf8');
    await writeFile(join(dir,'ledger.md'),ledger.replace('# Decision ledger\n',`# Decision ledger\n\n## ${date}\n- ${id} | Decision: ${decision} | Reason: Reader confirmation | Affects: REQ-001 | Before: ${before} | After: ${after}\n`));
    assert.equal(run('stamp',dir,id).status,0);
    git(target,'add','.'); git(target,'commit','-qm',decision);
    const result=run('validate',target);assert.equal(result.status,0,result.stderr);
  }
  const newJourney='# REQ-002: Save book\nActor: Reader\nGoal: Save book\nUser value: Find it later\nEntry point: Book details\nActions and responses:\n1. Reader saves -> Confirmation appears\nSuccess: Book appears in saved list\nFailure and recovery: Save fails; reader retries\n';
  await writeFile(join(dir,'journeys/save-book.md'),newJourney);
  await writeFile(join(dir,'README.md'),files['README.md']+'[Save book](journeys/save-book.md)\n');
  await revision('LED-002','2026-09-26','Add save flow','Cannot save','Can save');
  await writeFile(join(dir,'journeys/find-book.md'),files['journeys/find-book.md'].replace('Reader sees book details','Reader sees book details and availability'));
  await revision('LED-003','2026-09-27','Show availability','Details only','Details and availability');
  await rm(join(dir,'journeys/save-book.md'));
  await writeFile(join(dir,'README.md'),files['README.md']);
  await revision('LED-004','2026-09-28','Remove save flow','Can save','Cannot save');
});

test('invalid date, duplicate IDs, and broken evidence references fail', async () => {
  const {target,dir}=await fixture(); await init(target);
  await writeFile(join(dir,'ledger.md'),files['ledger.md'].replace('2026-09-25','2026-02-30'));
  assert.equal(run('stamp',dir,'LED-001').status,0);
  let result=run('validate',target);assert.notEqual(result.status,0);assert.match(result.stderr,/invalid date/);
  await writeFile(join(dir,'ledger.md'),files['ledger.md']);
  await writeFile(join(dir,'evidence.md'),files['evidence.md'].replace('REQ-001','REQ-999'));
  assert.equal(run('stamp',dir,'LED-001').status,0);
  result=run('validate',target);assert.notEqual(result.status,0);assert.match(result.stderr,/broken Supports reference REQ-999/);
});

test('latest ledger cannot cite never-established requirement; removed IDs may cite committed documents', async () => {
  const {target,dir}=await fixture();
  await writeFile(join(dir,'journeys/old-flow.md'),files['journeys/find-book.md'].replace('REQ-001: Find a book','REQ-002: Old flow'));
  await writeFile(join(dir,'README.md'),files['README.md']+'[Old flow](journeys/old-flow.md)\n');
  await writeFile(join(dir,'ledger.md'),files['ledger.md'].replace('REQ-001, NFR-001','REQ-001, REQ-002, NFR-001'));
  assert.equal(run('stamp',dir,'LED-001').status,0); await init(target);
  await rm(join(dir,'journeys/old-flow.md'));
  await writeFile(join(dir,'README.md'),files['README.md']);
  await writeFile(join(dir,'ledger.md'),files['ledger.md'].replace('REQ-001, NFR-001','REQ-999'));
  assert.equal(run('stamp',dir,'LED-001').status,0);
  let result=run('validate',target);assert.notEqual(result.status,0);assert.match(result.stderr,/REQ-999/);
  const removed=`# Decision ledger\n\n## 2026-09-26\n- LED-002 | Decision: Remove old flow | Reason: Reader confirmation | Affects: REQ-002 | Before: Old flow exists | After: Old flow removed\n\n## 2026-09-25\n- LED-001 | Decision: Establish baseline | Reason: Initial project inspection | Affects: REQ-001, REQ-002, NFR-001 | Before: no maintained requirements | After: baseline requirements\n`;
  await writeFile(join(dir,'ledger.md'),removed);
  assert.equal(run('stamp',dir,'LED-002').status,0);
  result=run('validate',target);assert.equal(result.status,0,result.stderr);
});

test('README link to missing journey is rejected', async () => {
  const {target,dir}=await fixture(); await init(target);
  await writeFile(join(dir,'README.md'),files['README.md']+'[Missing](journeys/missing.md)\n');
  assert.equal(run('stamp',dir,'LED-001').status,0);
  const result=run('validate',target);assert.notEqual(result.status,0);assert.match(result.stderr,/missing.md/);
});

test('empty confirmed quality set does not require an invented NFR', async () => {
  const {target,dir}=await fixture(); await init(target);
  await writeFile(join(dir,'non-functional.md'),'# Quality constraints\n\nNo quality constraints confirmed yet.\n');
  await writeFile(join(dir,'evidence.md'),files['evidence.md']);
  await writeFile(join(dir,'ledger.md'),files['ledger.md'].replace('REQ-001, NFR-001','REQ-001'));
  assert.equal(run('stamp',dir,'LED-001').status,0);
  const result=run('validate',target);assert.equal(result.status,0,result.stderr);
});

test('committed baseline cannot establish a requirement absent from its documents', async () => {
  const {target,dir}=await fixture();
  await writeFile(join(dir,'ledger.md'),files['ledger.md'].replace('REQ-001, NFR-001','REQ-001, REQ-999, NFR-001'));
  assert.equal(run('stamp',dir,'LED-001').status,0); await init(target);
  const result=run('validate',target);assert.notEqual(result.status,0);assert.match(result.stderr,/REQ-999/);
});

test('candidate inside canonical is rejected without deleting it', async () => {
  const {target,dir}=await fixture(); await init(target);
  const nested=join(dir,'candidate'); await mkdir(join(nested,'journeys'),{recursive:true});
  for(const [name,data] of Object.entries(files)) await writeFile(join(nested,name),data);
  assert.equal(run('stamp',nested,'LED-001').status,0);
  const result=run('apply',target,nested);assert.notEqual(result.status,0);assert.match(result.stderr,/outside|nested|canonical/i);
  assert.ok(await stat(nested));
});

test('null integrity metadata yields actionable validation error', async () => {
  const {target,dir}=await fixture(); await init(target);
  await writeFile(join(dir,'integrity.json'),'null\n');
  const result=run('validate',target);assert.notEqual(result.status,0);assert.match(result.stderr,/integrity.json:.*object|invalid/i);
});

test('ledger entries before a date group and duplicate IDs are rejected', async () => {
  const {target,dir}=await fixture(); await init(target);
  await writeFile(join(dir,'ledger.md'),files['ledger.md'].replace('## 2026-09-25','- LED-002 | Decision: Extra | Reason: Confirmed | Affects: REQ-001 | Before: A | After: B\n\n## 2026-09-25'));
  assert.equal(run('stamp',dir,'LED-002').status,0);
  let result=run('validate',target);assert.notEqual(result.status,0);assert.match(result.stderr,/date group/);
  await writeFile(join(dir,'ledger.md'),files['ledger.md'].replace(/\n$/, '\n- LED-001 | Decision: Duplicate | Reason: Confirmed | Affects: REQ-001 | Before: A | After: B\n'));
  assert.equal(run('stamp',dir,'LED-001').status,0);
  result=run('validate',target);assert.notEqual(result.status,0);assert.match(result.stderr,/duplicate LED-001/);
});

test('committed two-entry ledger cannot establish a ghost requirement in older entry', async () => {
  const {target,dir}=await fixture();
  const ledger=`# Decision ledger\n\n## 2026-09-26\n- LED-002 | Decision: Remove ghost | Reason: Confirmation | Affects: REQ-999 | Before: Ghost exists | After: Ghost removed\n\n## 2026-09-25\n- LED-001 | Decision: Establish baseline | Reason: Initial inspection | Affects: REQ-001, REQ-999, NFR-001 | Before: no maintained requirements | After: baseline requirements\n`;
  await writeFile(join(dir,'ledger.md'),ledger);
  assert.equal(run('stamp',dir,'LED-002').status,0);await init(target);
  const result=run('validate',target);assert.notEqual(result.status,0);assert.match(result.stderr,/REQ-999/);
});

test('merge resolution changing current docs without ledger entry is rejected', async () => {
  const {target,dir}=await fixture();await init(target);
  const main=git(target,'branch','--show-current').stdout.trim();
  git(target,'checkout','-qb','feature');await writeFile(join(target,'feature.txt'),'feature\n');git(target,'add','.');git(target,'commit','-qm','feature');
  git(target,'checkout','-q',main);await writeFile(join(target,'main.txt'),'main\n');git(target,'add','.');git(target,'commit','-qm','main');
  const merge=git(target,'merge','--no-ff','--no-commit','feature');assert.equal(merge.status,0,merge.stderr);
  const readme=await readFile(join(dir,'README.md'),'utf8');await writeFile(join(dir,'README.md'),readme+'\nNew behavior.\n');
  assert.equal(run('stamp',dir,'LED-001').status,0);
  git(target,'add','.');git(target,'commit','-qm','merge with unpaired requirements change');
  const result=run('validate',target);assert.notEqual(result.status,0);assert.match(result.stderr,/Commit .*ledger.md/);
});

test('uncommitted ghost ID fails even when older ledger text mentions it', async () => {
  const {target,dir}=await fixture(); await init(target);
  const ledger=`# Decision ledger\n\n## 2026-09-26\n- LED-002 | Decision: Remove ghost | Reason: Confirmation | Affects: REQ-999 | Before: Ghost exists | After: Ghost removed\n\n## 2026-09-25\n- LED-001 | Decision: Establish baseline | Reason: Initial inspection | Affects: REQ-001, REQ-999, NFR-001 | Before: no maintained requirements | After: baseline requirements\n`;
  await writeFile(join(dir,'ledger.md'),ledger);
  assert.equal(run('stamp',dir,'LED-002').status,0);
  const result=run('validate',target);assert.notEqual(result.status,0);assert.match(result.stderr,/REQ-999/);
});

test('empty quality file still needs a heading', async () => {
  const {target,dir}=await fixture(); await init(target);
  await writeFile(join(dir,'non-functional.md'),'No quality constraints confirmed yet.\n');
  await writeFile(join(dir,'ledger.md'),files['ledger.md'].replace('REQ-001, NFR-001','REQ-001'));
  assert.equal(run('stamp',dir,'LED-001').status,0);
  const result=run('validate',target);assert.notEqual(result.status,0);assert.match(result.stderr,/non-functional.md.*heading/);
});


test('unrelated commits do not trigger repeated requirements tree scans', async () => {
  const {target}=await fixture(); await init(target);
  for(let i=0;i<12;i++) {await writeFile(join(target,`note-${i}.txt`),`note ${i}\n`);git(target,'add','.');git(target,'commit','-qm',`note ${i}`);}
  const bin=join(target,'bin');await mkdir(bin);
  const realGit=spawnSync('which',['git'],{encoding:'utf8'}).stdout.trim();
  const log=join(target,'git-invocations.log');
  const shim=`#!/usr/bin/env node\nconst {spawnSync}=require('node:child_process');const {appendFileSync}=require('node:fs');if(process.argv[2]==='ls-tree')appendFileSync(process.env.GIT_COUNT_LOG,'tree\\n');const r=spawnSync(process.env.REAL_GIT,process.argv.slice(2),{stdio:'inherit'});process.exit(r.status??1);\n`;
  await writeFile(join(bin,'git'),shim);await chmod(join(bin,'git'),0o755);
  const result=spawnSync(process.execPath,[cli,'validate',target],{encoding:'utf8',env:{...process.env,PATH:`${bin}:${process.env.PATH}`,GIT_COUNT_LOG:log,REAL_GIT:realGit}});
  assert.equal(result.status,0,result.stderr);
  const scans=(await readFile(log,'utf8')).trim().split('\n').length;
  assert.ok(scans<=3,`expected at most 3 requirements tree scans; got ${scans}`);
});
