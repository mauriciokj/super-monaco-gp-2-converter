/* Public semantic recipe. Original tiles, font, map and engine fields are read
 * only from the user's verified ROM. Generated portrait assets are separate. */
(function(root,factory){
  const api=factory(root);
  if(typeof module==='object' && module.exports) module.exports=api;
  root.Season2026=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  // BEGIN GENERATED RULES
  const RULES = {"version":1,"original":{"size":1048576,"sha256":"c02206602e00dd8e9b6c38943b8a3be41e37d2d21c1768cf342900bce11ab4f0","checksum":23239},"baseline":{"size":2097152,"sha256":"b840fcaa0851daf548c9c4c4dadf18d3cb78ebf9683fde897bb677b44a3ea872","checksum":34547},"teams":["MCLAREN","WILLIAMS","FERRARI","RED BULL","MERCEDES","ALPINE","AUDI","RACING BULLS","ASTON MARTIN","HAAS","CADILLAC"],"small":{"A":["01110","10001","10001","11111","10001","10001","10001"],"B":["11110","10001","10001","11110","10001","10001","11110"],"C":["01111","10000","10000","10000","10000","10000","01111"],"G":["01111","10000","10000","10111","10001","10001","01111"],"I":["11111","00100","00100","00100","00100","00100","11111"],"L":["10000","10000","10000","10000","10000","10000","11111"],"M":["10001","11011","10101","10101","10001","10001","10001"],"N":["10001","11001","10101","10011","10001","10001","10001"],"O":["01110","10001","10001","10001","10001","10001","01110"],"R":["11110","10001","10001","11110","10100","10010","10001"],"S":["01111","10000","10000","01110","00001","00001","11110"],"T":["11111","00100","00100","00100","00100","00100","00100"],"U":["10001","10001","10001","10001","10001","10001","01110"]," ":["00000","00000","00000","00000","00000","00000","00000"]},"mini31":{"2":[3,4,2,7],"4":[10,1,5,11],"6":[6,14,3,4],"8":[8,12,9,13],"9":[2,7,3,4]},"mini33":{"6":[8,9,10,11],"9":[6,8,12,5]},"grid":[{"slot":0,"team":"MCLAREN","driver":"L. NORRIS","country":"ENGLAND"},{"slot":1,"team":"WILLIAMS","driver":"C. SAINZ","country":"SPAIN"},{"slot":2,"team":"FERRARI","driver":"L. HAMILTON","country":"ENGLAND"},{"slot":3,"team":"RED BULL","driver":"M.VERSTAPPEN","country":"NETHERLANDS"},{"slot":4,"team":"MERCEDES","driver":"G. RUSSELL","country":"ENGLAND"},{"slot":5,"team":"ALPINE","driver":"P. GASLY","country":"FRANCE"},{"slot":6,"team":"AUDI","driver":"G. BORTOLETO","country":"BRAZIL"},{"slot":7,"team":"RACING BULLS","driver":"L. LAWSON","country":"NEW ZEALAND"},{"slot":8,"team":"ASTON MARTIN","driver":"F. ALONSO","country":"SPAIN"},{"slot":9,"team":"HAAS","driver":"E. OCON","country":"FRANCE"},{"slot":10,"team":"CADILLAC","driver":"S. PEREZ","country":"MEXICO"}],"writes":[{"offset":420,"hex":"001fffff","label":"expanded ROM end address"},{"offset":72027,"hex":"0b","label":"driver name loop count for twelve characters"},{"offset":509016,"hex":"46455252415249","label":"Ferrari team name"},{"offset":19760,"hex":"028e004a04440222","label":"car colors slot 0"},{"offset":508878,"hex":"00102000","label":"team pointer slot 0"},{"offset":1056768,"hex":"4d434c4152454eff","label":"team label slot 0"},{"offset":509468,"hex":"00102030","label":"driver name pointer slot 0"},{"offset":1056816,"hex":"4c2e204e3052524953ff454e474c414e44ff","label":"driver name and country slot 0"},{"offset":19768,"hex":"0c6208400ec40a82","label":"car colors slot 1"},{"offset":508882,"hex":"00102980","label":"team pointer slot 1"},{"offset":1059200,"hex":"57494c4c49414d53ff","label":"team label slot 1"},{"offset":509480,"hex":"001029b0","label":"driver name pointer slot 1"},{"offset":1059248,"hex":"432e205341494e5aff535041494eff","label":"driver name and country slot 1"},{"offset":19776,"hex":"0eee0aaa000e0008","label":"car colors slot 2"},{"offset":509492,"hex":"00100000","label":"driver name pointer slot 2"},{"offset":1048576,"hex":"4c2e2048414d494c54304eff454e474c414e44ff","label":"driver name and country slot 2"},{"offset":19784,"hex":"00ce000a06200200","label":"car colors slot 3"},{"offset":508890,"hex":"001032f0","label":"team pointer slot 3"},{"offset":1061616,"hex":"5245442042554c4cff","label":"team label slot 3"},{"offset":509504,"hex":"00103320","label":"driver name pointer slot 3"},{"offset":1061664,"hex":"4d2e5645525354415050454eff4e45544845524c414e4453ff","label":"driver name and country slot 3"},{"offset":19792,"hex":"0ac0068002220000","label":"car colors slot 4"},{"offset":508894,"hex":"00103c70","label":"team pointer slot 4"},{"offset":1064048,"hex":"4d45524345444553ff","label":"team label slot 4"},{"offset":509516,"hex":"00103ca0","label":"driver name pointer slot 4"},{"offset":1064096,"hex":"472e2052555353454c4cff454e474c414e44ff","label":"driver name and country slot 4"},{"offset":19800,"hex":"0e820a400c8e084a","label":"car colors slot 5"},{"offset":508898,"hex":"001045f0","label":"team pointer slot 5"},{"offset":1066480,"hex":"414c50494e4520ff","label":"team label slot 5"},{"offset":509528,"hex":"00104610","label":"driver name pointer slot 5"},{"offset":1066512,"hex":"502e204741534c59ff4652414e4345ff","label":"driver name and country slot 5"},{"offset":19808,"hex":"000e00080ccc0666","label":"car colors slot 6"},{"offset":508902,"hex":"00104f50","label":"team pointer slot 6"},{"offset":1068880,"hex":"41554449202020ff","label":"team label slot 6"},{"offset":509540,"hex":"00104f70","label":"driver name pointer slot 6"},{"offset":1068912,"hex":"472e2042305254304c455430ff4252415a494cff","label":"driver name and country slot 6"},{"offset":19816,"hex":"0eee0aaa0c420820","label":"car colors slot 7"},{"offset":508906,"hex":"001058c0","label":"team pointer slot 7"},{"offset":1071296,"hex":"524143494e472042554c4c53ff","label":"team label slot 7"},{"offset":509552,"hex":"001058f0","label":"driver name pointer slot 7"},{"offset":1071344,"hex":"4c2e204c415753304eff4e4557205a45414c414e44ff","label":"driver name and country slot 7"},{"offset":19824,"hex":"00ec00ac04600240","label":"car colors slot 8"},{"offset":508910,"hex":"00106240","label":"team pointer slot 8"},{"offset":1073728,"hex":"415354304e204d415254494eff","label":"team label slot 8"},{"offset":509564,"hex":"00106270","label":"driver name pointer slot 8"},{"offset":1073776,"hex":"462e20414c304e5330ff535041494eff","label":"driver name and country slot 8"},{"offset":19832,"hex":"0222000a0eee0ccc","label":"car colors slot 9"},{"offset":508914,"hex":"00106bb0","label":"team pointer slot 9"},{"offset":1076144,"hex":"48414153202020ff","label":"team label slot 9"},{"offset":509576,"hex":"00106bd0","label":"driver name pointer slot 9"},{"offset":1076176,"hex":"452e203043304eff4652414e4345ff","label":"driver name and country slot 9"},{"offset":19840,"hex":"044402220ccc0888","label":"car colors slot 10"},{"offset":508918,"hex":"00107510","label":"team pointer slot 10"},{"offset":1078544,"hex":"434144494c4c4143ff","label":"team label slot 10"},{"offset":509588,"hex":"00107530","label":"driver name pointer slot 10"},{"offset":1078576,"hex":"532e20504552455aff4d4558494330ff","label":"driver name and country slot 10"},{"offset":26424,"hex":"001130c0","label":"miniatures pointer"},{"offset":26430,"hex":"00110000","label":"selection art pointer"},{"offset":26500,"hex":"001127b0","label":"selection map pointer"},{"offset":26282,"hex":"4eb9001140304e71","label":"selection palette call and no-op"},{"offset":26826,"hex":"e068","label":"miniature palette attribute slot 2"},{"offset":26834,"hex":"c06a","label":"miniature palette attribute slot 3"},{"offset":26842,"hex":"e06c","label":"miniature palette attribute slot 4"},{"offset":26858,"hex":"c070","label":"miniature palette attribute slot 6"},{"offset":26874,"hex":"e074","label":"miniature palette attribute slot 8"},{"offset":26882,"hex":"c076","label":"miniature palette attribute slot 9"},{"offset":1128624,"hex":"600f000000000eee000e00080ac00ccc0aaa046000ec02220680024000ac08880000","label":"dedicated palette row 3"},{"offset":1128672,"hex":"41f9000067444eb90000c79448e7c0c041f9001138b04eb90000c7944cdf03034e75","label":"v3.1 author palette initializer retained in allocated bank"},{"offset":1130496,"hex":"400e000000000620020000ce000a0eee0aaa0ccc0666000e0008022200000000","label":"dedicated palette row 2"},{"offset":1130544,"hex":"41f9000067444eb90000c79448e7c0c041f9001138b04eb90000c79441f9001140004eb90000c7944cdf03034e75","label":"v3.2 author palette initializer"},{"offset":509472,"hex":"00102050","label":"portrait palette pointer slot 0"},{"offset":509476,"hex":"00102070","label":"portrait graphics pointer slot 0"},{"offset":509484,"hex":"001029c0","label":"portrait palette pointer slot 1"},{"offset":509488,"hex":"001029e0","label":"portrait graphics pointer slot 1"},{"offset":509496,"hex":"00100020","label":"portrait palette pointer slot 2"},{"offset":509500,"hex":"00100040","label":"portrait graphics pointer slot 2"},{"offset":509508,"hex":"00103340","label":"portrait palette pointer slot 3"},{"offset":509512,"hex":"00103360","label":"portrait graphics pointer slot 3"},{"offset":509520,"hex":"00103cc0","label":"portrait palette pointer slot 4"},{"offset":509524,"hex":"00103ce0","label":"portrait graphics pointer slot 4"},{"offset":509532,"hex":"00104620","label":"portrait palette pointer slot 5"},{"offset":509536,"hex":"00104640","label":"portrait graphics pointer slot 5"},{"offset":509544,"hex":"00104f90","label":"portrait palette pointer slot 6"},{"offset":509548,"hex":"00104fb0","label":"portrait graphics pointer slot 6"},{"offset":509556,"hex":"00105910","label":"portrait palette pointer slot 7"},{"offset":509560,"hex":"00105930","label":"portrait graphics pointer slot 7"},{"offset":509568,"hex":"00106280","label":"portrait palette pointer slot 8"},{"offset":509572,"hex":"001062a0","label":"portrait graphics pointer slot 8"},{"offset":509580,"hex":"00106be0","label":"portrait palette pointer slot 9"},{"offset":509584,"hex":"00106c00","label":"portrait graphics pointer slot 9"},{"offset":509592,"hex":"00107540","label":"portrait palette pointer slot 10"},{"offset":509596,"hex":"00107560","label":"portrait graphics pointer slot 10"}],"copies":[{"offset":1056776,"source":508950,"length":28,"label":"preserved original chassis/engine/power fields slot 0"},{"offset":1059209,"source":508987,"length":29,"label":"preserved original chassis/engine/power fields slot 1"},{"offset":1061625,"source":509060,"length":25,"label":"preserved original chassis/engine/power fields slot 3"},{"offset":1064057,"source":509094,"length":27,"label":"preserved original chassis/engine/power fields slot 4"},{"offset":1066488,"source":509130,"length":21,"label":"preserved original chassis/engine/power fields slot 5"},{"offset":1068888,"source":509160,"length":24,"label":"preserved original chassis/engine/power fields slot 6"},{"offset":1071309,"source":509192,"length":28,"label":"preserved original chassis/engine/power fields slot 7"},{"offset":1073741,"source":509228,"length":22,"label":"preserved original chassis/engine/power fields slot 8"},{"offset":1076152,"source":509258,"length":21,"label":"preserved original chassis/engine/power fields slot 9"},{"offset":1078553,"source":509288,"length":23,"label":"preserved original chassis/engine/power fields slot 10"}],"assetsSha256":"69ea76f39542eedd7499036994f0cf296fa906630c94621a24a645884015d3f9"};
  const RECIPE_SHA256 = "ef40132ce29b5274a39253ffa9f3a643d905c1a92600b6a583dda8b6a762561a";
  // END GENERATED RULES
  const utf8 = value => new TextEncoder().encode(value);
  function core(){return typeof module==='object' && module.exports ? require('./core.js') : root.RomCustomizer;}
  function assets(){return typeof module==='object' && module.exports ? require('./season-assets.js') : root.Season2026Assets;}
  function assert(value,message){if(!value) throw new Error(message);}
  function hex(value){
    assert(typeof value==='string' && /^(?:[0-9a-f]{2})*$/.test(value),'Invalid recipe hex');
    return Uint8Array.from(value.match(/../g)||[],n=>parseInt(n,16));
  }
  function word(data,offset){assert(offset>=0 && offset+2<=data.length,'Word out of bounds');return data[offset]*256+data[offset+1];}
  function encodeWords(values){const out=new Uint8Array(values.length*2);values.forEach((v,i)=>{out[i*2]=v>>>8;out[i*2+1]=v&255;});return out;}
  function join(values){const out=new Uint8Array(values.reduce((n,v)=>n+v.length,0));let p=0;for(const v of values){out.set(v,p);p+=v.length;}return out;}
  function packTile(tile){assert(tile.length===64,'Tile must contain 64 pixels');return Uint8Array.from({length:32},(_,i)=>tile[2*i]*16+tile[2*i+1]);}
  function unpackTiles(data){assert(data.length%32===0,'Incomplete tile data');const out=[];for(let i=0;i<data.length;i+=32){const tile=[];for(const b of data.subarray(i,i+32))tile.push(b>>>4,b&15);out.push(tile);}return out;}

  // Native Enigma: only V/H attribute bits are supported by this game's loader.
  // Bounded pure port of the author's enigma_rom_codec.py; no stored tilemap.
  function decodeEnigma(data,offset,base){
    assert(data instanceof Uint8Array && Number.isInteger(offset) && offset>=0 && offset+6<=data.length,'Invalid Enigma input');
    base=base||0;
    const n=data[offset],flags=data[offset+1];let inc=word(data,offset+2),common=word(data,offset+4),pos=(offset+6)*8;const out=[];
    assert(n>=1 && n<=11 && !(flags&~3),'Unsupported Enigma header');
    function bits(count){let v=0;for(let i=0;i<count;i++){assert(pos<data.length*8,'Truncated Enigma stream');v=v*2+(data[pos>>>3]>>>(7-(pos&7))&1);pos++;}return v;}
    function tile(){let value=0;for(let j=4;j>=0;j--)if(flags&(1<<j))value|=bits(1)<<(11+j);return (value|bits(n))+base;}
    function push(v){assert(out.length<20000,'Enigma output exceeds limit');out.push(v);}
    while(out.length<20000){
      if(bits(1)===0){const commonMode=bits(1),count=bits(4)+1;for(let i=0;i<count;i++)push(commonMode?common+base:inc+base+i);if(!commonMode)inc+=count;}
      else {const mode=bits(2),count=bits(4);if(mode===3){if(count===15)return {words:out,nextOffset:Math.ceil(pos/8)};for(let i=0;i<=count;i++)push(tile());}
        else {const value=tile(),step=[0,1,-1][mode];for(let i=0;i<=count;i++)push(value+step*i);}}
    }
    throw new Error('Enigma output exceeds limit');
  }
  function encodeEnigmaLiterals(words){
    assert(Array.isArray(words) && words.length<=20000,'Invalid Enigma words');const bits=[];
    function put(value,count){for(let i=count-1;i>=0;i--)bits.push(value>>>i&1);}
    for(let start=0;start<words.length;start+=15){const chunk=words.slice(start,start+15);put(7,3);put(chunk.length-1,4);
      for(const w of chunk){assert(Number.isInteger(w)&&w>=0&&w<=0x1fff,'Enigma palette/priority attributes supplied by caller');put(w>>>11&3,2);put(w&2047,11);}}
    put(127,7);while(bits.length%16)bits.push(0);const payload=new Uint8Array(bits.length/8);
    bits.forEach((b,i)=>{payload[i>>>3]|=b<<(7-(i&7));});return join([new Uint8Array([11,3,0,0,0,0]),payload]);
  }
  function render(tiles,words){
    assert(words.length===1120,'Selection map must contain 1120 words');const screen=new Uint8Array(320*224);
    words.forEach((w,i)=>{const tile=tiles[w&2047];assert(tile,'Selection tile index out of bounds');const y=Math.floor(i/40)*8,x=i%40*8;
      for(let yy=0;yy<8;yy++)for(let xx=0;xx<8;xx++)screen[(y+yy)*320+x+xx]=tile[(w&4096?7-yy:yy)*8+(w&2048?7-xx:xx)];});
    return screen;
  }
  function rebuildResources(original){
    const api=core();assert(api && typeof api.decodeKosinski==='function','RomCustomizer core.js required');
    const decode=offset=>api.decodeKosinski(original,offset,{maxOutput:65536}).data;
    const art=decode(0x7a6d6),words=decodeEnigma(original,0x7a4a4).words,font=unpackTiles(decode(0x28002));
    assert(art.length===6912,'Original selection art length mismatch');const tiles=unpackTiles(art),before=render(tiles,words),after=before.slice();
    // Widths and positions of the eleven original label rectangles, not glyph data.
    const oldWidths=[7,8,7,7,6,4,6,7,5,5,4],ys=[56,80,96,112,136,152,168,184,56,72,88];
    RULES.teams.forEach((team,i)=>{
      const y=ys[i],oldx=i<8?56:200,center=i<8?84:224;
      for(let yy=y;yy<y+8;yy++)after.fill(3,yy*320+oldx,yy*320+oldx+8*oldWidths[i]);
      let x=center-team.length*(team.length<=8?4:3);
      for(const char of team){
        if(team.length<=8){const glyph=font[(char==='O'?'0':char).charCodeAt(0)];assert(glyph,'Missing original font glyph');
          for(let yy=0;yy<8;yy++)for(let xx=0;xx<8;xx++)after[(y+yy)*320+x+xx]=glyph[yy*8+xx]===2?0:3;x+=8;}
        else {const rows=RULES.small[char];assert(rows,'Missing author small-font glyph');rows.forEach((row,yy)=>{for(let xx=0;xx<row.length;xx++)if(row[xx]==='1')after[(y+yy)*320+x+xx]=0;});x+=6;}
      }
    });
    const newTiles=[];for(let i=0;i<art.length;i+=32)newTiles.push(art.slice(i,i+32));
    const key=value=>Array.from(value).join(','),ids=new Map(newTiles.map((t,i)=>[key(t),i])),newWords=words.slice();
    words.forEach((w,i)=>{
      const y=Math.floor(i/40)*8,x=i%40*8,tile=[];let changed=false;
      for(let yy=0;yy<8;yy++)for(let xx=0;xx<8;xx++){const p=(y+yy)*320+x+xx;tile.push(after[p]);if(after[p]!==before[p])changed=true;}
      if(!changed)return;const packed=packTile(tile),k=key(packed);if(!ids.has(k)){ids.set(k,newTiles.length);newTiles.push(packed);}newWords[i]=ids.get(k)|(w&0xe000);
    });
    assert(newTiles.length===282,'Derived selection tile count mismatch');
    const rawArt=join(newTiles),artEncoded=join([encodeWords([rawArt.length/2]),api.encodeKosinskiLiterals(rawArt)]);
    const encodedMap=encodeEnigmaLiterals(newWords);assert(encodedMap.length<=2314,'Derived map exceeds allocation');const map=new Uint8Array(2314).fill(255);map.set(encodedMap);
    const rawMini=decode(0x7b11c);assert(rawMini.length===1792,'Original miniature length mismatch');const mini=unpackTiles(rawMini),shape=mini.slice(8,10).map(t=>t.slice());
    function recolor(team,values){const remap={0:0,1:1,6:values[0],14:values[1],2:values[2],12:values[3]};mini.splice(Number(team)*2,2,...shape.map(t=>t.map(p=>{assert(remap[p]!==undefined,'Unexpected original miniature index');return remap[p];})));}
    for(const [team,values] of Object.entries(RULES.mini31))recolor(team,values);
    recolor(3,[2,3,4,5]);for(const [team,values] of Object.entries(RULES.mini33))recolor(team,values);
    const miniature=join([encodeWords([rawMini.length/2]),api.encodeKosinskiLiterals(join(mini.map(packTile)))]);
    assert(artEncoded.length===10159 && miniature.length===2023,'Derived resource size mismatch');
    return [{offset:0x110000,data:artEncoded},{offset:0x1127b0,data:map},{offset:0x1130c0,data:miniature}];
  }
  function compose(original){
    const api=core(),asset=assets();assert(api && asset,'core.js and season-assets.js required');
    assert(original instanceof Uint8Array && original.length===RULES.original.size,'Original ROM size mismatch');
    const sourceSha256=api.sha256(original);assert(sourceSha256===RULES.original.sha256,'Original ROM SHA-256 mismatch');
    assert(api.checksumGenesis(original)===RULES.original.checksum && word(original,0x18e)===RULES.original.checksum,'Original checksum mismatch');
    assert(api.sha256(utf8(JSON.stringify(RULES)))===RECIPE_SHA256,'Recipe integrity mismatch');
    assert(api.sha256(utf8(JSON.stringify(asset)))===RULES.assetsSha256,'Portrait assets integrity mismatch');
    assert(asset.payloadBytes===25685 && asset.portraits.length===11,'Portrait asset contract mismatch');
    const rom=new Uint8Array(RULES.baseline.size).fill(255);rom.set(original);
    function write(offset,data){assert(Number.isInteger(offset)&&offset>=0&&offset+data.length<=rom.length,'Recipe write exceeds ROM');rom.set(data,offset);}
    for(const c of RULES.copies){assert(c.source>=0&&c.source+c.length<=original.length,'Original reference exceeds ROM');write(c.offset,original.subarray(c.source,c.source+c.length));}
    for(const item of RULES.writes)write(item.offset,hex(item.hex));
    for(const portrait of asset.portraits)for(const block of portrait.blocks){const data=hex(block.hex);assert(data.length===block.length && api.sha256(data)===block.sha256,'Portrait block integrity mismatch');write(block.offset,data);}
    for(const block of rebuildResources(original))write(block.offset,block.data);
    const checksum=api.checksumGenesis(rom);rom[0x18e]=checksum>>>8;rom[0x18f]=checksum&255;
    const sha256=api.sha256(rom);assert(checksum===RULES.baseline.checksum,'Composed Genesis checksum mismatch');
    assert(sha256===RULES.baseline.sha256,'Composed baseline SHA-256 mismatch');
    return {rom,sha256,checksum,sourceSha256,recipeSha256:RECIPE_SHA256};
  }
  return {compose,decodeEnigma,encodeEnigmaLiterals,rebuildResources,
    metadata:Object.freeze({version:1,original:RULES.original,baseline:RULES.baseline,recipeSha256:RECIPE_SHA256,assetsSha256:RULES.assetsSha256})};
});
