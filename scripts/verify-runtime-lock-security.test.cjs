'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {checkRuntimeLock}=require('./verify-runtime-lock-security.cjs');
const root=path.resolve(__dirname,'..');
const basePkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const baseLock=JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'),'utf8'));
const mutate=(fn)=>{
  const p=structuredClone(basePkg),l=structuredClone(baseLock);
  fn(p,l);
  return ()=>checkRuntimeLock(p,l);
};
test('repaired lockfile passes without network or API keys',()=>{
  const evidence=checkRuntimeLock(basePkg,baseLock);
  assert.ok(evidence.native>=10);
});
test('old sharp package version is blocked',()=>{
  assert.throws(mutate((p,l)=>l.packages['node_modules/sharp'].version='0.35.4'),/VULNERABLE_SHARP/);
});
test('old source-map-js version is blocked',()=>{
  assert.throws(mutate((p,l)=>l.packages['node_modules/source-map-js'].version='1.2.1'),/VULNERABLE_SOURCE_MAP/);
});
test('old native sharp package version is blocked',()=>{
  assert.throws(mutate((p,l)=>l.packages['node_modules/@img/sharp-linux-x64'].version='0.35.4'),/SHARP_NATIVE_BINARY_MISMATCH/);
});
test('missing sha512 integrity is blocked',()=>{
  assert.throws(mutate((p,l)=>{delete l.packages['node_modules/source-map-js'].integrity}),/MISSING_REGISTRY_INTEGRITY/);
});
test('missing root sharp sha512 integrity is blocked',()=>{
  assert.throws(mutate((p,l)=>{delete l.packages['node_modules/sharp'].integrity}),/MISSING_REGISTRY_INTEGRITY/);
});
test('missing native sharp binary sha512 integrity is blocked',()=>{
  assert.throws(mutate((p,l)=>{delete l.packages['node_modules/@img/sharp-linux-x64'].integrity}),/MISSING_REGISTRY_INTEGRITY/);
});
test('root override bypass is blocked',()=>{
  assert.throws(mutate((p,l)=>{delete p.overrides['source-map-js']}),/PATCHED_OVERRIDES_REQUIRED/);
});
test('next major/minor changes are outside this isolated scope',()=>{
  assert.throws(mutate((p,l)=>p.dependencies.next='17.0.0'),/NEXT_VERSION_CHANGED_OUTSIDE_SCOPE/);
});
const libvipsPlatforms=["darwin-arm64","darwin-x64","linux-arm","linux-arm64","linux-ppc64","linux-riscv64","linux-s390x","linux-x64","linuxmusl-arm64","linuxmusl-x64"];
for(const platform of libvipsPlatforms){
  const key='node_modules/@img/sharp-libvips-'+platform;
  const name='@img/sharp-libvips-'+platform;
  test('libvips downgrade rejected: '+platform,()=>{
    assert.throws(mutate((p,l)=>l.packages[key].version='1.3.3'),/SHARP_LIBVIPS_VERSION_MISMATCH/);
  });
  test('libvips missing entry rejected: '+platform,()=>{
    assert.throws(mutate((p,l)=>delete l.packages[key]),/SHARP_LIBVIPS_REQUIRED_MISSING/);
  });
  test('libvips sha512 integrity rejected when missing: '+platform,()=>{
    assert.throws(mutate((p,l)=>delete l.packages[key].integrity),/SHARP_LIBVIPS_REGISTRY_INTEGRITY/);
  });
  test('libvips registry origin rejected: '+platform,()=>{
    assert.throws(mutate((p,l)=>l.packages[key].resolved='https://registry.npmjs.org.evil.test/'+name),/SHARP_LIBVIPS_REGISTRY_INTEGRITY/);
  });
  test('libvips sharp optional mismatch rejected: '+platform,()=>{
    assert.throws(mutate((p,l)=>l.packages['node_modules/sharp'].optionalDependencies[name]='1.3.3'),/SHARP_LIBVIPS_OPTIONAL_DRIFT/);
  });
  test('libvips native optional mismatch rejected: '+platform,()=>{
    assert.throws(mutate((p,l)=>l.packages['node_modules/@img/sharp-'+platform].optionalDependencies[name]='1.3.3'),/SHARP_NATIVE_LIBVIPS_DRIFT/);
  });
}
test('approved libvips platforms have canonical registry, SHA512 and optional contracts',()=>{
  const evidence=checkRuntimeLock(basePkg,baseLock);
  assert.equal(evidence.libvips,libvipsPlatforms.length);
  for(const platform of libvipsPlatforms){
    const name='@img/sharp-libvips-'+platform, entry=baseLock.packages['node_modules/'+name];
    assert.equal(entry.version,'1.3.4');
    assert.match(entry.integrity,/^sha512-[A-Za-z0-9+/]{86}==$/);
    assert.equal(entry.resolved,'https://registry.npmjs.org/'+name+'/-/sharp-libvips-'+platform+'-1.3.4.tgz');
  }
});
test('unexpected libvips platform is blocked',()=>{
  assert.throws(mutate((p,l)=>l.packages['node_modules/@img/sharp-libvips-unknown']={version:'1.3.4'}),/SHARP_LIBVIPS_UNEXPECTED_ENTRY/);
});
test('libvips cannot use sha1 or truncated SHA512',()=>{
  const key='node_modules/@img/sharp-libvips-linux-x64';
  for(const integrity of ['sha1-abc','sha512-abc','sha512-'+('A'.repeat(85))+'==']){
    assert.throws(mutate((p,l)=>l.packages[key].integrity=integrity),/SHARP_LIBVIPS_REGISTRY_INTEGRITY/);
  }
});
console.log('ORCALY_RUNTIME_LOCK_SECURITY_NEGATIVE_TESTS_DONE');
