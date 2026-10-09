'use strict';

/** A deterministic rollback-prevention check. npm audit remains the authoritative vulnerability gate. */
const fs=require('node:fs');
const path=require('node:path');


// Approved source baseline: PR #31 @ b6c4ee224731d08ca2e4fbb6df536d38ebf56749.
// The values below are immutable in this verifier and independent of the lockfile
// being checked. Update only after a separately reviewed supply-chain approval.
// These SRI pins authenticate exact tarball bytes (npm audit remains mandatory).
const APPROVED_TARBALLS=Object.freeze({
  "node_modules/@img/sharp-darwin-arm64": {
    "version": "0.35.5",
    "resolved": "https://registry.npmjs.org/@img/sharp-darwin-arm64/-/sharp-darwin-arm64-0.35.5.tgz",
    "integrity": "sha512-QRUlFQ0WxvdWyqqG/WtI3iupfD5rBzmCHXSdPsY91sAtVtTo7Q4cb6zOccZ3gqEqkr0f1As1ehLqmEpDsRf+lg==",
    "optional": true,
    "os": [
      "darwin"
    ],
    "cpu": [
      "arm64"
    ],
    "optionalDependencies": {
      "@img/sharp-libvips-darwin-arm64": "1.3.4"
    }
  },
  "node_modules/@img/sharp-darwin-x64": {
    "version": "0.35.5",
    "resolved": "https://registry.npmjs.org/@img/sharp-darwin-x64/-/sharp-darwin-x64-0.35.5.tgz",
    "integrity": "sha512-+BR255RhDlpygUpOc/Jdt1nT6DQ3XG/ERo5wbcdOf5Q320dKtPCKPLR1LJs9VGXRaMa8l1uUa0tkCNOXiAxZUw==",
    "optional": true,
    "os": [
      "darwin"
    ],
    "cpu": [
      "x64"
    ],
    "optionalDependencies": {
      "@img/sharp-libvips-darwin-x64": "1.3.4"
    }
  },
  "node_modules/@img/sharp-freebsd-wasm32": {
    "version": "0.35.5",
    "resolved": "https://registry.npmjs.org/@img/sharp-freebsd-wasm32/-/sharp-freebsd-wasm32-0.35.5.tgz",
    "integrity": "sha512-Y/z91nEZ4uIBX5X3nfTovjU9lHNKFYbL2lpHCLVNmXQK03VIZvXBBt0KxbPGp2SdGSF+2mQU4e+hQaWOt86iAw==",
    "optional": true,
    "os": [
      "freebsd"
    ]
  },
  "node_modules/@img/sharp-libvips-darwin-arm64": {
    "version": "1.3.4",
    "resolved": "https://registry.npmjs.org/@img/sharp-libvips-darwin-arm64/-/sharp-libvips-darwin-arm64-1.3.4.tgz",
    "integrity": "sha512-5R89nBYiRdUlSWJxPhO+GVtaXzXSxKnRu/xqMn3KTA3L9EB9Oy/P+Nn2f2vlhPuUdy/Zusb2DarbyTpGCfEDuw==",
    "optional": true,
    "os": [
      "darwin"
    ],
    "cpu": [
      "arm64"
    ]
  },
  "node_modules/@img/sharp-libvips-darwin-x64": {
    "version": "1.3.4",
    "resolved": "https://registry.npmjs.org/@img/sharp-libvips-darwin-x64/-/sharp-libvips-darwin-x64-1.3.4.tgz",
    "integrity": "sha512-iR2OKH80yi0U+dUplyh3/xdpFvps6YkCwsXenIJxqxR1v9o+xtKTGbS9H7cps+2Vxjc8B1j96p75NmTGjIhtpQ==",
    "optional": true,
    "os": [
      "darwin"
    ],
    "cpu": [
      "x64"
    ]
  },
  "node_modules/@img/sharp-libvips-linux-arm": {
    "version": "1.3.4",
    "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linux-arm/-/sharp-libvips-linux-arm-1.3.4.tgz",
    "integrity": "sha512-LmRtTsOHuvM2+wlO2Db37dx5MiZhB0FvSunciw48YjdOkZz9KAiRbm8ujeMOA1INqmei5NapFxYEK1D1ZSidmw==",
    "optional": true,
    "os": [
      "linux"
    ],
    "cpu": [
      "arm"
    ]
  },
  "node_modules/@img/sharp-libvips-linux-arm64": {
    "version": "1.3.4",
    "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linux-arm64/-/sharp-libvips-linux-arm64-1.3.4.tgz",
    "integrity": "sha512-Y3dgX/6lE2QhQb+Gxy0WZxfg9MEm/JBjamZpS2IklP7xIQoKN4hzAm7KcMVGtaVDt3neE9OKBC7vAfonA/Lr1A==",
    "optional": true,
    "os": [
      "linux"
    ],
    "cpu": [
      "arm64"
    ]
  },
  "node_modules/@img/sharp-libvips-linux-ppc64": {
    "version": "1.3.4",
    "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linux-ppc64/-/sharp-libvips-linux-ppc64-1.3.4.tgz",
    "integrity": "sha512-Le6boB8Tai0Nis+gIxIpKx68UDVVIqdR8Tin5Yf1z2LJJQLDJvCDRqRu+jC2qCoD+eIomonmOwB4smBRxfVpYQ==",
    "optional": true,
    "os": [
      "linux"
    ],
    "cpu": [
      "ppc64"
    ]
  },
  "node_modules/@img/sharp-libvips-linux-riscv64": {
    "version": "1.3.4",
    "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linux-riscv64/-/sharp-libvips-linux-riscv64-1.3.4.tgz",
    "integrity": "sha512-aHkkIEHPRdQEegJN20MLmGtxYD9R2wQr3Cwpddnu5+YKMt6Uzax7S9h5gpZTo8wyrGuZSlfQ63OevL5mTyOC7Q==",
    "optional": true,
    "os": [
      "linux"
    ],
    "cpu": [
      "riscv64"
    ]
  },
  "node_modules/@img/sharp-libvips-linux-s390x": {
    "version": "1.3.4",
    "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linux-s390x/-/sharp-libvips-linux-s390x-1.3.4.tgz",
    "integrity": "sha512-ra/mB6MikESDUO7Yg+Mi95bFBb9GsObURuhnOv3OqknjGe9sZrG8tCe9q0xSIGrtLgvgw0gKnFWcK4blSgQOuQ==",
    "optional": true,
    "os": [
      "linux"
    ],
    "cpu": [
      "s390x"
    ]
  },
  "node_modules/@img/sharp-libvips-linux-x64": {
    "version": "1.3.4",
    "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linux-x64/-/sharp-libvips-linux-x64-1.3.4.tgz",
    "integrity": "sha512-GJ//SSXbnwSDes02umB3nDJLFcQzw8a18V8fyhqr6tV515tOEMdImjjxj1AoafMRz56F3PHgftnj1QEKSU1zkw==",
    "optional": true,
    "os": [
      "linux"
    ],
    "cpu": [
      "x64"
    ]
  },
  "node_modules/@img/sharp-libvips-linuxmusl-arm64": {
    "version": "1.3.4",
    "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linuxmusl-arm64/-/sharp-libvips-linuxmusl-arm64-1.3.4.tgz",
    "integrity": "sha512-hvulFwtjUcagsis6BBxHwGFwWoNZjgYmULGVrZcyfNbjA8hKILbRxGg15/7w5HDyXHXUos/j6baAWqnCyQ2DWA==",
    "optional": true,
    "os": [
      "linux"
    ],
    "cpu": [
      "arm64"
    ]
  },
  "node_modules/@img/sharp-libvips-linuxmusl-x64": {
    "version": "1.3.4",
    "resolved": "https://registry.npmjs.org/@img/sharp-libvips-linuxmusl-x64/-/sharp-libvips-linuxmusl-x64-1.3.4.tgz",
    "integrity": "sha512-6zXKeE/p39I1AmA3cJG35eyBGNqNddLnUXjhwBnsGjFPWqf5VKkDBEqaEkPDoTEtkxwi2vv8Tcr2mDyP4So7Fg==",
    "optional": true,
    "os": [
      "linux"
    ],
    "cpu": [
      "x64"
    ]
  },
  "node_modules/@img/sharp-linux-arm": {
    "version": "0.35.5",
    "resolved": "https://registry.npmjs.org/@img/sharp-linux-arm/-/sharp-linux-arm-0.35.5.tgz",
    "integrity": "sha512-LEaXK2WdXVK5ykcw0buWyPMsmLLL2vpHLD6yrNSW+JGEL3BZPA4tpKN6iaMc4AxTTAoaX/sU1rOL51lcIz48ZQ==",
    "optional": true,
    "os": [
      "linux"
    ],
    "cpu": [
      "arm"
    ],
    "optionalDependencies": {
      "@img/sharp-libvips-linux-arm": "1.3.4"
    }
  },
  "node_modules/@img/sharp-linux-arm64": {
    "version": "0.35.5",
    "resolved": "https://registry.npmjs.org/@img/sharp-linux-arm64/-/sharp-linux-arm64-0.35.5.tgz",
    "integrity": "sha512-LYVx5JTsOM2CBzmxreh+nl64/3H6Xb09iSLknqH47z2T2DFFxDeFLP5y4dJwe6H7uGQlHPyEEtIqyo3DYsRwdQ==",
    "optional": true,
    "os": [
      "linux"
    ],
    "cpu": [
      "arm64"
    ],
    "optionalDependencies": {
      "@img/sharp-libvips-linux-arm64": "1.3.4"
    }
  },
  "node_modules/@img/sharp-linux-ppc64": {
    "version": "0.35.5",
    "resolved": "https://registry.npmjs.org/@img/sharp-linux-ppc64/-/sharp-linux-ppc64-0.35.5.tgz",
    "integrity": "sha512-QVxAAq8evVRI9ia2vqgwrmWucn5Dfv+JdWzj75pD8omHLPSP7f8p20O8jxzjCcuCEQEOtYOZUmX1hkiZ0kdevA==",
    "optional": true,
    "os": [
      "linux"
    ],
    "cpu": [
      "ppc64"
    ],
    "optionalDependencies": {
      "@img/sharp-libvips-linux-ppc64": "1.3.4"
    }
  },
  "node_modules/@img/sharp-linux-riscv64": {
    "version": "0.35.5",
    "resolved": "https://registry.npmjs.org/@img/sharp-linux-riscv64/-/sharp-linux-riscv64-0.35.5.tgz",
    "integrity": "sha512-LtdreXguaavKODPIfzJ4kffx7UNt1omwtK0rch4EBbbSTXPnxWmYSayXdLJw0fJzQ97kHt1gL/yh4tvU+nCyRQ==",
    "optional": true,
    "os": [
      "linux"
    ],
    "cpu": [
      "riscv64"
    ],
    "optionalDependencies": {
      "@img/sharp-libvips-linux-riscv64": "1.3.4"
    }
  },
  "node_modules/@img/sharp-linux-s390x": {
    "version": "0.35.5",
    "resolved": "https://registry.npmjs.org/@img/sharp-linux-s390x/-/sharp-linux-s390x-0.35.5.tgz",
    "integrity": "sha512-UZasTOFiYzotTsGOCu42BfUzP6Tu6Do/947iRm1RsLKvlllxwGcn4RN27LibGWceix4Y+Pmw3jsnTcCQIgWjqA==",
    "optional": true,
    "os": [
      "linux"
    ],
    "cpu": [
      "s390x"
    ],
    "optionalDependencies": {
      "@img/sharp-libvips-linux-s390x": "1.3.4"
    }
  },
  "node_modules/@img/sharp-linux-x64": {
    "version": "0.35.5",
    "resolved": "https://registry.npmjs.org/@img/sharp-linux-x64/-/sharp-linux-x64-0.35.5.tgz",
    "integrity": "sha512-SxFtLTeJInhAA9Q836kux2vZNeOBQEx658qvbboZScr0wIARym3IcGmW7KpVD5sbVg0Ojy+udFQdayYIZyoNog==",
    "optional": true,
    "os": [
      "linux"
    ],
    "cpu": [
      "x64"
    ],
    "optionalDependencies": {
      "@img/sharp-libvips-linux-x64": "1.3.4"
    }
  },
  "node_modules/@img/sharp-linuxmusl-arm64": {
    "version": "0.35.5",
    "resolved": "https://registry.npmjs.org/@img/sharp-linuxmusl-arm64/-/sharp-linuxmusl-arm64-0.35.5.tgz",
    "integrity": "sha512-9HbMclmI1zlNkFRs3z9/eBtDjfD0sGlrX1z6b1qwmiFY5ElDLh4BC0LPBdVp7z1DXFiKlIcznf+ZlsuZzLxQqg==",
    "optional": true,
    "os": [
      "linux"
    ],
    "cpu": [
      "arm64"
    ],
    "optionalDependencies": {
      "@img/sharp-libvips-linuxmusl-arm64": "1.3.4"
    }
  },
  "node_modules/@img/sharp-linuxmusl-x64": {
    "version": "0.35.5",
    "resolved": "https://registry.npmjs.org/@img/sharp-linuxmusl-x64/-/sharp-linuxmusl-x64-0.35.5.tgz",
    "integrity": "sha512-4KOphqB035HrVdqLZfCgMzzERrQkkzOwRhl4OAkRO1YCldbaFjySXMaK534Mo0V+LndnlJk+sbUyLeU0ULyD1A==",
    "optional": true,
    "os": [
      "linux"
    ],
    "cpu": [
      "x64"
    ],
    "optionalDependencies": {
      "@img/sharp-libvips-linuxmusl-x64": "1.3.4"
    }
  },
  "node_modules/@img/sharp-wasm32": {
    "version": "0.35.5",
    "resolved": "https://registry.npmjs.org/@img/sharp-wasm32/-/sharp-wasm32-0.35.5.tgz",
    "integrity": "sha512-Ptsga1su4tQx+LLF1ECS9U6nz5kmrXKo6XVbtR48Ke3ZRxxgaWBu7IDtEe1quo8hiupwm6WFqxVlXaSf7IINGQ==",
    "optional": true
  },
  "node_modules/@img/sharp-webcontainers-wasm32": {
    "version": "0.35.5",
    "resolved": "https://registry.npmjs.org/@img/sharp-webcontainers-wasm32/-/sharp-webcontainers-wasm32-0.35.5.tgz",
    "integrity": "sha512-hfhF/FmoQyTUkA0bIKFOtw536BQSeBMe6BF6QyWlrPxT754+TFLaZ7sKKTfvvM0yJgKgaYTwnFCIZ/GuDw5SUA==",
    "optional": true,
    "cpu": [
      "wasm32"
    ]
  },
  "node_modules/@img/sharp-win32-arm64": {
    "version": "0.35.5",
    "resolved": "https://registry.npmjs.org/@img/sharp-win32-arm64/-/sharp-win32-arm64-0.35.5.tgz",
    "integrity": "sha512-X4t7g+7ZA5DKblCBEXGjUqqemj4vczING/5viFwAL8h4N3qYeyjwdCvRLHi4EdOUI+2Z7UFlp1VM+p/AuEtm6Q==",
    "optional": true,
    "os": [
      "win32"
    ],
    "cpu": [
      "arm64"
    ]
  },
  "node_modules/@img/sharp-win32-ia32": {
    "version": "0.35.5",
    "resolved": "https://registry.npmjs.org/@img/sharp-win32-ia32/-/sharp-win32-ia32-0.35.5.tgz",
    "integrity": "sha512-5Zm82LoBc43nhwNybZlG7Y1KO//Zhsn306fQl29ZOuStHLGTo3BWL83q3cznX0poxSAMuYL1On/BHBxkBeKr6A==",
    "optional": true,
    "os": [
      "win32"
    ],
    "cpu": [
      "ia32"
    ]
  },
  "node_modules/@img/sharp-win32-x64": {
    "version": "0.35.5",
    "resolved": "https://registry.npmjs.org/@img/sharp-win32-x64/-/sharp-win32-x64-0.35.5.tgz",
    "integrity": "sha512-x76eH0vEiHlcMQu8Y8IenntaACtddpT6W0wmXtWrnKcnKI7ME5DdgqhAD6SEWOEl1v2zDvkZDhFA9KnURwpfqg==",
    "optional": true,
    "os": [
      "win32"
    ],
    "cpu": [
      "x64"
    ]
  },
  "node_modules/sharp": {
    "version": "0.35.5",
    "resolved": "https://registry.npmjs.org/sharp/-/sharp-0.35.5.tgz",
    "integrity": "sha512-Ywn4OnzGukp7CDMrp08RQ50YKmuwG47brZgIVPTvBaaAfQlRlygrRqSrxdCiL9M+LlzLBiJ68IR1QqvzHyjC7g==",
    "optional": true,
    "optionalDependencies": {
      "@img/sharp-darwin-arm64": "0.35.5",
      "@img/sharp-darwin-x64": "0.35.5",
      "@img/sharp-freebsd-wasm32": "0.35.5",
      "@img/sharp-libvips-darwin-arm64": "1.3.4",
      "@img/sharp-libvips-darwin-x64": "1.3.4",
      "@img/sharp-libvips-linux-arm": "1.3.4",
      "@img/sharp-libvips-linux-arm64": "1.3.4",
      "@img/sharp-libvips-linux-ppc64": "1.3.4",
      "@img/sharp-libvips-linux-riscv64": "1.3.4",
      "@img/sharp-libvips-linux-s390x": "1.3.4",
      "@img/sharp-libvips-linux-x64": "1.3.4",
      "@img/sharp-libvips-linuxmusl-arm64": "1.3.4",
      "@img/sharp-libvips-linuxmusl-x64": "1.3.4",
      "@img/sharp-linux-arm": "0.35.5",
      "@img/sharp-linux-arm64": "0.35.5",
      "@img/sharp-linux-ppc64": "0.35.5",
      "@img/sharp-linux-riscv64": "0.35.5",
      "@img/sharp-linux-s390x": "0.35.5",
      "@img/sharp-linux-x64": "0.35.5",
      "@img/sharp-linuxmusl-arm64": "0.35.5",
      "@img/sharp-linuxmusl-x64": "0.35.5",
      "@img/sharp-webcontainers-wasm32": "0.35.5",
      "@img/sharp-win32-arm64": "0.35.5",
      "@img/sharp-win32-ia32": "0.35.5",
      "@img/sharp-win32-x64": "0.35.5"
    }
  },
  "node_modules/source-map-js": {
    "version": "1.2.2",
    "resolved": "https://registry.npmjs.org/source-map-js/-/source-map-js-1.2.2.tgz",
    "integrity": "sha512-KGj/8Y43x35aZVDtt+J4mK1hoLGHULMYfSkODJNQjNDC3oW1PqPoxMwo0pLUsWM/UEGzON/NxeHywEfNXNP3Vw=="
  }
});
const ATTESTED_FIELDS=Object.freeze(['optional','os','cpu','libc','optionalDependencies']);
function stableMatch(actual,expected){
  if(Array.isArray(expected)||Array.isArray(actual)){
    return Array.isArray(actual)&&Array.isArray(expected)&&
      actual.length===expected.length&&actual.every((v,i)=>v===expected[i]);
  }
  if(expected&&typeof expected==='object'||actual&&typeof actual==='object'){
    if(!actual||!expected||typeof actual!=='object'||typeof expected!=='object')return false;
    const a=Object.keys(actual).sort(),e=Object.keys(expected).sort();
    return a.length===e.length&&a.every((k,i)=>k===e[i]&&stableMatch(actual[k],expected[k]));
  }
  return Object.is(actual,expected);
}
function isProtectedTarballKey(key){
  return key==='node_modules/sharp'||key==='node_modules/source-map-js'||
    key.endsWith('/node_modules/sharp')||key.endsWith('/node_modules/source-map-js')||
    key.startsWith('node_modules/@img/sharp-')||key.includes('/node_modules/@img/sharp-');
}

function checkRuntimeLock(pkg, lock){
  const fail=(msg)=>{throw new Error('ORCALY_RUNTIME_LOCK_SECURITY_FAIL '+msg)};
  if(!pkg || !lock || lock.lockfileVersion!==3)fail('INVALID_INPUT');
  if(pkg.dependencies?.next!=='16.3.8')fail('NEXT_VERSION_CHANGED_OUTSIDE_SCOPE');
  if(pkg.overrides?.sharp!=='0.35.5'||pkg.overrides?.['source-map-js']!=='1.2.2'){
    fail('PATCHED_OVERRIDES_REQUIRED');
  }
  const entries=lock.packages;
  if(!entries || !entries[''])fail('LOCK_PACKAGES_MISSING');
  if(entries[''].dependencies?.next!==pkg.dependencies.next)fail('ROOT_LOCK_MISMATCH');
  // SEC-31-01: pin the approved libvips platforms and optional dependency contracts.
  const libvipsPlatforms=["darwin-arm64","darwin-x64","linux-arm","linux-arm64","linux-ppc64","linux-riscv64","linux-s390x","linux-x64","linuxmusl-arm64","linuxmusl-x64"];
  const libvipsNames=libvipsPlatforms.map(platform=>'@img/sharp-libvips-'+platform);
  const libvipsKeys=new Set(libvipsNames.map(name=>'node_modules/'+name));
  const sharpOptional=entries['node_modules/sharp']?.optionalDependencies;
  const declared=Object.keys(sharpOptional||{}).filter(name=>name.startsWith('@img/sharp-libvips-')).sort();
  if(declared.join(',')!==[...libvipsNames].sort().join(',') ||
    libvipsNames.some(name=>sharpOptional[name]!=='1.3.4'))fail('SHARP_LIBVIPS_OPTIONAL_DRIFT');
  for(const name of libvipsNames){
    const key='node_modules/'+name, dep=entries[key];
    if(!dep)fail('SHARP_LIBVIPS_REQUIRED_MISSING '+key);
    if(dep.version!=='1.3.4')fail('SHARP_LIBVIPS_VERSION_MISMATCH '+key);
    const archive=name.slice('@img/'.length);
    if(dep.resolved!=='https://registry.npmjs.org/'+name+'/-/'+archive+'-1.3.4.tgz' ||
      !/^sha512-[A-Za-z0-9+/]{86}==$/.test(String(dep.integrity||'')))fail('SHARP_LIBVIPS_REGISTRY_INTEGRITY '+key);
    const platform=name.slice('@img/sharp-libvips-'.length);
    if(entries['node_modules/@img/sharp-'+platform]?.optionalDependencies?.[name]!=='1.3.4'){
      fail('SHARP_NATIVE_LIBVIPS_DRIFT '+key);
    }
  }
  if(Object.keys(entries).some(key=>key.startsWith('node_modules/@img/sharp-libvips-')&&!libvipsKeys.has(key))){
    fail('SHARP_LIBVIPS_UNEXPECTED_ENTRY');
  }
  let sharpFound=0,mapFound=0,binFound=0;
  for(const [key,dep] of Object.entries(entries)){
    if(key==='node_modules/sharp' || key.endsWith('/node_modules/sharp')){
      sharpFound++;
      if(dep.version!=='0.35.5')fail('VULNERABLE_SHARP '+key);
      if(dep.optionalDependencies &&
        Object.entries(dep.optionalDependencies).some(([k,v])=>k.startsWith('@img/sharp-')&&!k.includes('libvips')&&v!=='0.35.5')){
        fail('SHARP_OPTIONAL_VERSION_DRIFT '+key);
      }
    }
    if(key==='node_modules/source-map-js'||key.endsWith('/node_modules/source-map-js')){
      mapFound++;
      if(dep.version!=='1.2.2')fail('VULNERABLE_SOURCE_MAP '+key);
    }
    if(key.startsWith('node_modules/@img/sharp-')&&!key.includes('libvips')){
      binFound++;
      if(dep.version!=='0.35.5')fail('SHARP_NATIVE_BINARY_MISMATCH '+key);
    }
    if((key==='node_modules/sharp' || key.endsWith('/node_modules/sharp') ||
      key.startsWith('node_modules/@img/sharp-') && !key.includes('libvips') ||
      key==='node_modules/source-map-js' || key.endsWith('/node_modules/source-map-js')) &&
      (!/^sha512-[A-Za-z0-9+/=]+$/.test(String(dep.integrity||'')) ||
        !String(dep.resolved||'').startsWith('https://registry.npmjs.org/'))){
      fail('MISSING_REGISTRY_INTEGRITY '+key);
    }
  }
  if(sharpFound<1||mapFound<1||binFound<10)fail('REQUIRED_PACKAGES_MISSING');

  // Fail closed on extra or missing platform entries, even if the runner OS skips them.
  for(const key of Object.keys(entries)){
    if(isProtectedTarballKey(key)&&!Object.hasOwn(APPROVED_TARBALLS,key)){
      fail('APPROVED_ENTRY_EXTRA '+key);
    }
  }
  for(const [key,approved] of Object.entries(APPROVED_TARBALLS)){
    const entry=entries[key];
    if(!entry)fail('APPROVED_ENTRY_MISSING '+key);
    if(entry.version!==approved.version)fail('APPROVED_VERSION_DRIFT '+key);
    if(entry.resolved!==approved.resolved)fail('APPROVED_ORIGIN_DRIFT '+key);
    if(entry.integrity!==approved.integrity)fail('APPROVED_INTEGRITY_DRIFT '+key);
    for(const field of ATTESTED_FIELDS){
      if(!stableMatch(entry[field],approved[field])){
        fail((field==='optionalDependencies'?'APPROVED_OPTIONAL_DRIFT ':'APPROVED_PLATFORM_DRIFT ')+key+' '+field);
      }
    }
  }
  return {sharp:sharpFound,source_map:mapFound,native:binFound,libvips:libvipsNames.length};
}

if(require.main===module){
  const root=path.resolve(__dirname,'..');
  const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
  const lock=JSON.parse(fs.readFileSync(path.join(root,'package-lock.json'),'utf8'));
  const result=checkRuntimeLock(pkg,lock);
  console.log('ORCALY_RUNTIME_LOCK_SECURITY_PASS',JSON.stringify(result));
}
module.exports={checkRuntimeLock};
