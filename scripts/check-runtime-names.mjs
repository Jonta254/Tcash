import ts from 'typescript';
const program=ts.createProgram(['src/main.jsx'],{allowJs:true,checkJs:true,noEmit:true,jsx:ts.JsxEmit.ReactJSX,moduleResolution:ts.ModuleResolutionKind.Bundler,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,skipLibCheck:true});
const failures=ts.getPreEmitDiagnostics(program).filter(d=>[2304,2552].includes(d.code)&&d.file?.fileName.replaceAll('\\','/').includes('/src/'));
if(failures.length){console.error(ts.formatDiagnosticsWithColorAndContext(failures,{getCanonicalFileName:f=>f,getCurrentDirectory:()=>process.cwd(),getNewLine:()=> '\n'}));process.exitCode=1;}else console.log('Runtime name checks passed.');
