import * as esbuild from 'esbuild'
const r = await esbuild.build({
  bundle: true, entryPoints: ['index.js'], format: 'iife', legalComments: 'none',
  minify: true, sourcemap: false, target: ['chrome58','firefox57','safari11','edge16'],
  write: false, metafile: true, outfile: 'dist/x.js',
})
const inputs = r.metafile.outputs['dist/x.js'].inputs
const rows = Object.entries(inputs).map(([k,v]) => [v.bytesInOutput, k]).sort((a,b)=>b[0]-a[0])
let tot = 0
for (const [b,k] of rows) { tot += b; console.log(String(b).padStart(7), k) }
console.log(String(tot).padStart(7), 'TOTAL (pre-encoding)')
