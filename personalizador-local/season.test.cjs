'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const season=require('./season-recipe.js'),core=require('./core.js'),assets=require('./season-assets.js');
const digest=data=>crypto.createHash('sha256').update(data).digest('hex');

// Independently assembled packet with all native Enigma command families.
function nativeVector(){
  const b=[];const put=(v,n)=>{for(let i=n-1;i>=0;i--)b.push(v>>>i&1);};
  put(0,1);put(0,1);put(2,4); // three incrementing words, header start 5
  put(0,1);put(1,1);put(1,4); // two common words, header common 9
  put(1,1);put(0,2);put(2,4);put(0,2);put(7,11); // repeated 7
  put(1,1);put(1,2);put(1,4);put(1,2);put(10,11); // increment, H-flipped
  put(1,1);put(2,2);put(1,4);put(2,2);put(12,11); // decrement, V-flipped
  put(7,3);put(1,4);put(3,2);put(4,11);put(0,2);put(8,11); // literals
  put(127,7);while(b.length%16)b.push(0);
  const out=new Uint8Array(6+b.length/8);out.set([11,3,0,5,0,9]);b.forEach((v,i)=>out[6+(i>>>3)]|=v<<(7-(i&7)));return out;
}
test('native Enigma decodes independent command vector and caller base',()=>{
  const vector=nativeVector(),expected=[5,6,7,9,9,7,7,7,0x80a,0x80b,0x100c,0x100b,0x1804,8];
  assert.deepEqual(season.decodeEnigma(vector,0).words,expected);
  assert.deepEqual(season.decodeEnigma(vector,0,0x809d).words,expected.map(n=>n+0x809d));
});
test('Enigma literal encoder preserves all legal tile/flip bits across packet boundaries',()=>{
  const words=Array.from({length:1120},(_,i)=>i*73&8191),encoded=season.encodeEnigmaLiterals(words);
  assert.deepEqual(season.decodeEnigma(encoded,0).words,words);
  assert.deepEqual(season.decodeEnigma(season.encodeEnigmaLiterals([]),0).words,[]);
  for(const bad of [-1,0x2000,0xffff,1.5])assert.throws(()=>season.encodeEnigmaLiterals([bad]));
});
test('Enigma rejects unsupported flags, truncation and unbounded output',()=>{
  const vector=nativeVector();assert.throws(()=>season.decodeEnigma(vector.slice(0,8),0),/Truncated/);
  for(const bad of [0,12]){const data=vector.slice();data[0]=bad;assert.throws(()=>season.decodeEnigma(data,0),/header/);}
  const wrongFlags=vector.slice();wrongFlags[1]=31;assert.throws(()=>season.decodeEnigma(wrongFlags,0),/header/);
  const noTerminator=new Uint8Array(20000);noTerminator[0]=11;assert.throws(()=>season.decodeEnigma(noTerminator,0),/limit/);
});
test('public assets contain exactly the authorized eleven palettes and graphics',()=>{
  assert.equal(assets.portraits.length,11);assert.equal(assets.payloadBytes,25685);let bytes=0;
  assert.deepEqual(assets.portraits.map(p=>p.slot),Array.from({length:11},(_,i)=>i));
  for(const portrait of assets.portraits){assert.deepEqual(portrait.blocks.map(b=>b.length),[26,2309]);
    for(const block of portrait.blocks){const data=Buffer.from(block.hex,'hex');bytes+=data.length;assert.equal(data.length,block.length);assert.equal(digest(data),block.sha256);}
    const graphics=Uint8Array.from(Buffer.from(portrait.blocks[1].hex,'hex'));
    const decoded=core.decodeKosinski(graphics,0,{maxInput:2309,maxOutput:2048});assert.equal(decoded.data.length,2048);assert.equal(decoded.nextOffset,2309);
  }
  assert.equal(bytes,25685);assert.equal(digest(JSON.stringify(assets)),season.metadata.assetsSha256);
});
test('composition rejects unsupported or corrupt originals before producing output',()=>{
  assert.throws(()=>season.compose(new Uint8Array(100)),/size mismatch/);
  assert.throws(()=>season.compose(new Uint8Array(1048576)),/SHA-256 mismatch/);
});
const realInputs=process.env.ROM_TEST && process.env.BASELINE_TEST;
test('real original reconstructs the complete reference byte for byte; input remains unchanged',{skip:!realInputs},()=>{
  const original=new Uint8Array(fs.readFileSync(process.env.ROM_TEST)),before=original.slice(),expected=fs.readFileSync(process.env.BASELINE_TEST);
  const result=season.compose(original);assert.deepEqual(original,before);assert.deepEqual(Buffer.from(result.rom),expected);
  assert.equal(result.sha256,digest(expected));assert.equal(result.sha256,season.metadata.baseline.sha256);
  assert.equal(result.checksum,0x86f3);assert.equal(result.sourceSha256,digest(before));assert.equal(result.recipeSha256,season.metadata.recipeSha256);
  const derived=season.rebuildResources(original);assert.equal(derived.reduce((n,b)=>n+b.data.length,0),14496);
  for(const block of derived)assert.deepEqual(Buffer.from(block.data),expected.subarray(block.offset,block.offset+block.data.length));
  const old=assets.portraits[0].blocks[0].hex;assets.portraits[0].blocks[0].hex='00'+old.slice(2);
  try{assert.throws(()=>season.compose(original),/integrity mismatch/);}finally{assets.portraits[0].blocks[0].hex=old;}
  const corrupt=original.slice();corrupt[0x28002]^=1;assert.throws(()=>season.compose(corrupt),/SHA-256 mismatch/);
});
