import test from 'node:test';
import assert from 'node:assert/strict';
import {installMediaPipeInfoFilter,canTrackFrame} from './mediapipe-runtime.mjs';
const INFO='INFO: Created TensorFlow Lite XNNPACK delegate for CPU.';
test('only exact INFO is filtered; errors, arguments, restoration and overlapping sessions survive',()=>{
  const original=console.error, calls=[];
  const sink=function(...args){calls.push(args);}; console.error=sink;
  try{
    const a=installMediaPipeInfoFilter(), captured=console.error;
    console.error(INFO);console.error(INFO+'\n');
    const error=new Error('real model failure'); console.error(error);console.error(INFO,'extra context');console.error('ERROR: failed');console.error('INFO: other');
    assert.deepEqual(calls,[[error],[INFO,'extra context'],['ERROR: failed'],['INFO: other']]);
    const b=installMediaPipeInfoFilter(),c=installMediaPipeInfoFilter();
    a();a();assert.equal(console.error,captured);b();console.error(INFO);assert.equal(calls.length,4);
    c();assert.equal(console.error,sink);
    captured(INFO);assert.equal(calls.length,5);
    const d=installMediaPipeInfoFilter();console.error(INFO);d();assert.equal(console.error,sink);assert.equal(calls.length,5);
  }finally{console.error=original;}
});
test('inference needs loaded pixels, a fresh frame and a strictly increasing finite timestamp',()=>{
  const v={readyState:2,videoWidth:640,videoHeight:480,currentTime:1};
  assert.equal(canTrackFrame(v,0,10,9),true);
  for(const bad of [null,{...v,readyState:1},{...v,videoWidth:0},{...v,videoHeight:0},{...v,currentTime:NaN}])assert.equal(canTrackFrame(bad,0,10,9),false);
  assert.equal(canTrackFrame(v,1,10,9),false);
  assert.equal(canTrackFrame(v,0,10,10),false);assert.equal(canTrackFrame(v,0,9,10),false);assert.equal(canTrackFrame(v,0,NaN,9),false);
});
