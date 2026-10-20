#!/usr/bin/env python3
"""Prepare public recipe metadata and only the eleven authorized encoded portraits.

Inputs are read-only. No ROM, IPS, source photo, or extracted original art is emitted.
Usage: python3 prepare-season-recipe.py --original FILE --baseline FILE --source DIR
"""
import argparse, ast, hashlib, json, struct, subprocess
from pathlib import Path

ORIGINAL_SHA = 'c02206602e00dd8e9b6c38943b8a3be41e37d2d21c1768cf342900bce11ab4f0'
BASELINE_SHA = 'b840fcaa0851daf548c9c4c4dadf18d3cb78ebf9683fde897bb677b44a3ea872'
sha = lambda data: hashlib.sha256(data).hexdigest()

def constants(path, names):
    found = {}
    for node in ast.parse(path.read_text()).body:
        if isinstance(node, ast.Assign):
            for left in node.targets:
                if isinstance(left, ast.Name) and left.id in names:
                    found[left.id] = eval(compile(ast.Expression(node.value), path.name, 'eval'), {'__builtins__': {}}, {})
    assert set(found) == set(names)
    return found

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--original', type=Path, required=True)
    parser.add_argument('--baseline', type=Path, required=True)
    parser.add_argument('--source', type=Path, required=True)
    args = parser.parse_args()
    original, target = args.original.read_bytes(), args.baseline.read_bytes()
    assert len(original) == 0x100000 and sha(original) == ORIGINAL_SHA
    assert len(target) == 0x200000 and sha(target) == BASELINE_SHA
    out = Path(__file__).resolve().parent
    grid = constants(args.source/'build_v3.py', ['GRID'])['GRID']
    v31 = constants(args.source/'build_v31.py', ['TEAMS', 'SMALL', 'MINI_INDEX', 'MINI_PAL', 'COLORS'])
    v33 = constants(args.source/'build_v33.py', ['MINI_INDEX', 'MINI_PAL', 'COLORS'])
    rules = {'version': 1, 'original': {'size':len(original), 'sha256':sha(original),
             'checksum':int.from_bytes(original[0x18e:0x190], 'big')},
             'baseline':{'size':len(target), 'sha256':sha(target), 'checksum':0x86f3},
             'teams':v31['TEAMS'], 'small':v31['SMALL'], 'mini31':v31['MINI_INDEX'],
             'mini33':v33['MINI_INDEX'], 'grid':[], 'writes':[], 'copies':[]}
    def write(offset, data, label):
        assert target[offset:offset+len(data)] == data, label
        rules['writes'].append({'offset':offset, 'hex':data.hex(), 'label':label})
    def words(values): return struct.pack('>'+str(len(values))+'H', *values)
    def text(value): return value.upper().replace('O','0').encode('ascii') + b'\xff'
    def pointer(offset, value, label): write(offset, struct.pack('>I',value), label)
    write(0x1a4, struct.pack('>I',len(target)-1), 'expanded ROM end address')
    write(0x1195b, b'\x0b', 'driver name loop count for twelve characters')
    write(0x7c458, b'FERRARI', 'Ferrari team name')
    for slot, (_, team, name, country, colors) in enumerate(grid):
        team_ptr = struct.unpack_from('>I', target, 0x7c3ce+slot*4)[0]
        name_ptr = struct.unpack_from('>I', target, 0x7c61c+slot*12)[0]
        # Recreate approximate v3 hardware colors from the author's RGB rules.
        palette = []
        for color in colors:
            r,g,b = [int(int(color[i:i+2],16)/255*7+.5)*2 for i in (0,2,4)]
            palette.append(b<<8 | g<<4 | r)
        if slot in v31['COLORS']: palette = v31['COLORS'][slot]
        if slot in v33['COLORS']: palette = v33['COLORS'][slot]
        write(0x4d30+slot*8, words(palette), 'car colors slot '+str(slot))
        if slot != 2:
            pointer(0x7c3ce+slot*4, team_ptr, 'team pointer slot '+str(slot))
            write(team_ptr, text(team.ljust(7)), 'team label slot '+str(slot))
            source_ptr = struct.unpack_from('>I', original, 0x7c3ce+slot*4)[0]
            suffix_start = original.index(255,source_ptr)+1
            suffix_end = suffix_start
            for _ in range(3): suffix_end = original.index(255,suffix_end)+1
            destination = team_ptr+len(text(team.ljust(7)))
            assert target[destination:destination+suffix_end-suffix_start] == original[suffix_start:suffix_end]
            rules['copies'].append({'offset':destination,'source':suffix_start,'length':suffix_end-suffix_start,
                                    'label':'preserved original chassis/engine/power fields slot '+str(slot)})
        pointer(0x7c61c+slot*12, name_ptr, 'driver name pointer slot '+str(slot))
        write(name_ptr, text(name)+text(country), 'driver name and country slot '+str(slot))
        rules['grid'].append({'slot':slot,'team':team,'driver':name,'country':country})
    for offset, value, label in [(0x6738,0x1130c0,'miniatures pointer'),(0x673e,0x110000,'selection art pointer'),
                                  (0x6784,0x1127b0,'selection map pointer')]: pointer(offset,value,label)
    write(0x66aa,bytes.fromhex('4eb9001140304e71'),'selection palette call and no-op')
    for slot in [2,3,4,6,8,9]:
        value = (0xc064 if slot in [3,6,9] else 0xe064)+slot*2
        write(0x68ba+slot*8,words([value]),'miniature palette attribute slot '+str(slot))
    write(0x1138b0,bytes([0x60,15])+words(v31['MINI_PAL']),'dedicated palette row 3')
    write(0x1138e0,bytes.fromhex('41f9000067444eb90000c79448e7c0c041f9001138b04eb90000c7944cdf03034e75'),
          'v3.1 author palette initializer retained in allocated bank')
    write(0x114000,bytes([0x40,14])+words(v33['MINI_PAL']),'dedicated palette row 2')
    write(0x114030,bytes.fromhex('41f9000067444eb90000c79448e7c0c041f9001138b04eb90000c79441f9001140004eb90000c7944cdf03034e75'),
          'v3.2 author palette initializer')
    portraits=[]
    for slot in range(11):
        palette, graphics=struct.unpack_from('>II',target,0x7c61c+slot*12+4)
        pointer(0x7c61c+slot*12+4,palette,'portrait palette pointer slot '+str(slot))
        pointer(0x7c61c+slot*12+8,graphics,'portrait graphics pointer slot '+str(slot))
        blocks=[]
        for start,length,label in [(palette,26,'palette'),(graphics,2309,'Kosinski graphics')]:
            payload=target[start:start+length]
            blocks.append({'offset':start,'length':length,'sha256':sha(payload),'kind':label,'hex':payload.hex()})
        portraits.append({'slot':slot,'driver':grid[slot][2],'blocks':blocks})
    assets={'version':1,'authorization':'User explicitly authorized publication of all eleven prepared portraits; source photos are excluded.',
            'payloadBytes':sum(b['length'] for p in portraits for b in p['blocks']), 'portraits':portraits}
    asset_json=json.dumps(assets,separators=(',',':'),ensure_ascii=True)
    assets_sha=sha(asset_json.encode())
    rules['assetsSha256']=assets_sha
    rule_json=json.dumps(rules,separators=(',',':'),ensure_ascii=True)
    recipe_sha=sha(rule_json.encode())
    assets_js='/* Only the eleven explicitly authorized prepared portrait blocks; no source photos or original game art. */\n(function(root){\n  const data = '+asset_json+';\n  if(typeof module === "object" && module.exports) module.exports=data;\n  root.Season2026Assets=data;\n})(typeof globalThis !== "undefined" ? globalThis : this);\n'
    (out/'season-assets.js').write_text(assets_js)
    recipe_path=out/'season-recipe.js'
    source=recipe_path.read_text()
    start,end='  // BEGIN GENERATED RULES\n','  // END GENERATED RULES'
    a=source.index(start)+len(start); b=source.index(end,a)
    source=source[:a]+'  const RULES = '+rule_json+';\n  const RECIPE_SHA256 = '+json.dumps(recipe_sha)+';\n'+source[b:]
    recipe_path.write_text(source)
    # Audit every byte against semantic operations, including every byte of every IPS record.
    reconstructed=bytearray(original+b'\xff'*(len(target)-len(original)))
    owner=bytearray(len(target));owner[len(original):]=bytes([1])*(len(target)-len(original))
    for item in rules['copies']:
        a,n=item['offset'],item['length']; reconstructed[a:a+n]=original[item['source']:item['source']+n];owner[a:a+n]=bytes([2])*n
    for item in rules['writes']:
        a=item['offset'];data=bytes.fromhex(item['hex']);reconstructed[a:a+len(data)]=data;owner[a:a+len(data)]=bytes([3])*len(data)
    for p in portraits:
        for item in p['blocks']:
            a=item['offset'];data=bytes.fromhex(item['hex']);reconstructed[a:a+len(data)]=data;owner[a:a+len(data)]=bytes([4])*len(data)
    derived=[(0x110000,10159),(0x1127b0,2314),(0x1130c0,2023)]
    # These bytes are not emitted: the browser reconstructs them from the supplied original.
    for a,n in derived: reconstructed[a:a+n]=target[a:a+n];owner[a:a+n]=bytes([5])*n
    reconstructed[0x18e:0x190]=target[0x18e:0x190];owner[0x18e:0x190]=b'\x06\x06'
    bad=[i for i,(a,b) in enumerate(zip(reconstructed,target)) if a!=b]
    assert not bad, 'Unclassified or incorrect semantic writes: '+str([hex(i) for i in bad[:20]])
    ips=(args.source/'versions/v3.3/original-to-v3.3.ips').read_bytes()
    assert sha(ips)=='0fbc5cd9f26ddced20f1b7cd27a61d5869dc19d2539854d109672e0f49c20830'
    records=[];pos=5
    while ips[pos:pos+3]!=b'EOF':
        a=int.from_bytes(ips[pos:pos+3],'big');n=int.from_bytes(ips[pos+3:pos+5],'big');pos+=5
        if n: pos+=n;kind='literal'
        else: n=int.from_bytes(ips[pos:pos+2],'big');pos+=3;kind='fill'
        records.append({'offset':a,'length':n,'kind':kind,'categories':sorted(set(owner[a:a+n]))})
    # Rebuild all derived resources in the actual browser-compatible JS, then
    # compare the complete output to the read-only reference without writing ROMs.
    verification_script = r'''const fs=require('fs'),path=require('path');
const season=require(path.join(process.argv[1],'season-recipe.js'));
const original=new Uint8Array(fs.readFileSync(process.argv[2]));
const expected=fs.readFileSync(process.argv[3]);const result=season.compose(original);
if(!Buffer.from(result.rom).equals(expected))throw Error('Complete reference mismatch');
for(const block of season.rebuildResources(original))
 if(!Buffer.from(block.data).equals(expected.subarray(block.offset,block.offset+block.data.length)))throw Error('Derived resource mismatch');
process.stdout.write(JSON.stringify({completeReferenceByteExact:true,derivedResourcesByteExact:true,sha256:result.sha256,checksum:result.checksum}));'''
    verified = json.loads(subprocess.check_output(['node','-e',verification_script,str(out),
                         str(args.original.resolve()),str(args.baseline.resolve())],text=True))
    provenance={'version':1,'verification':verified,'original':rules['original'],'baseline':rules['baseline'],'recipeSha256':recipe_sha,
      'assetsSha256':assets_sha,'authorizedPortraitPayloadBytes':assets['payloadBytes'],
      'portraits':[{**p,'blocks':[{k:v for k,v in b.items() if k!='hex'} for b in p['blocks']]} for p in portraits],
      'literalWrites':[{k:v for k,v in item.items() if k!='hex'}|{'length':len(item['hex'])//2} for item in rules['writes']],
      'originalReferences':rules['copies'],'derivedOriginalResources':[{'offset':a,'length':n} for a,n in derived],
      'ipsAudit':{'sha256':sha(ips),'records':records,'categories':{'0':'unchanged original bytes','1':'FF expansion',
         '2':'original field reference','3':'author names/colors/pointers/code','4':'authorized portrait','5':'derived original art; rebuilt by rules','6':'computed checksum'},
         'allOutputBytesCovered':True,'warning':'IPS is read for audit only and is never emitted.'},
      'publicFiles':{name:{'bytes':(out/name).stat().st_size,'sha256':sha((out/name).read_bytes())} for name in ['season-recipe.js','season-assets.js']},
      'sourceRuleHashes':{name:sha((args.source/name).read_bytes()) for name in ['build_v3.py','build_v31.py','build_v32.py','build_v33.py','enigma_rom_codec.py']}}
    (out/'season-provenance.json').write_text(json.dumps(provenance,indent=2)+'\n')
    print(json.dumps({'recipeSha256':recipe_sha,'assetsSha256':assets_sha,'portraitPayloadBytes':assets['payloadBytes'],
                      'classifiedIpsRecords':len(records),'allOtherBytesExplained':True}))
if __name__=='__main__': main()
