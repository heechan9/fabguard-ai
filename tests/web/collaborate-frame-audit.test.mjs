import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {reconcile, expectedFrames, syntheticPayloads, changedPayload, fixture} from '../../web/collaborate/frame-audit.mjs';

test('payload digests match the actual synthetic UTF-8 bytes', () => {
  assert.deepEqual(expectedFrames.map(row => row.digest),
    syntheticPayloads.map(value => createHash('sha256').update(value, 'utf8').digest('hex')));
  assert.equal(fixture('digest')[1].digest, createHash('sha256').update(changedPayload, 'utf8').digest('hex'));
});
test('both captures on one stream survive the same arrival time', () => {
  assert.deepEqual(reconcile(expectedFrames, fixture('complete')),
    {expectedCount:2,archivedCount:2,fixtureMatches:true,findings:[]});
});
test('equal count substitution identifies both deletion and duplicate', () => {
  const r = reconcile(expectedFrames, fixture('substitution'));
  assert.equal(r.expectedCount,r.archivedCount);
  assert.deepEqual(r.findings,[
    {type:'missing frame',key:'camera-a:frame-1'},
    {type:'duplicate archive entry',key:'camera-a:frame-2'}]);
});
test('restamping, digest mutation and stream substitution are distinct', () => {
  assert.equal(reconcile(expectedFrames, fixture('restamped')).findings[0].type,'capture time changed');
  const rows=fixture('digest');
  assert.deepEqual(reconcile(expectedFrames,rows).findings,[{type:'payload digest changed',key:'camera-a:frame-2'}]);
  rows[1].stream='camera-b';
  assert.deepEqual(reconcile(expectedFrames, rows).findings.map(x=>x.type),['missing frame','unexpected frame']);
});
test('order invariant and invalid metadata rejected instead of guessed', () => {
  assert.deepEqual(reconcile(expectedFrames, fixture('substitution')),reconcile([...expectedFrames].reverse(),fixture('substitution').reverse()));
  assert.throws(() => reconcile(expectedFrames, [{...fixture('complete')[0],arrivalAt:0}]), /Invalid frame/);
  assert.throws(() => reconcile(expectedFrames, [{...fixture('complete')[0],id:'frame-1\n'}]), /Invalid frame/);
  assert.throws(() => reconcile([expectedFrames[0],expectedFrames[0]], []), /unique/);
  assert.throws(() => fixture('foreign'), /Unknown/);
});
test('page keeps separate controls and local scripts only', () => {
  const html=readFileSync(new URL('../../web/collaborate/index.html',import.meta.url),'utf8');
  for(const id of ['scenario','run','status','frame-scenario','frame-run','frame-status']) {
    assert.equal(html.match(new RegExp(`id="${id}"`,'g')).length,1);
  }
  assert.match(html,/<script type="module" src="\.\/frame-audit\.mjs">/);
  assert.match(html,/connect-src 'none'/);
});
