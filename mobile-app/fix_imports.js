const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/app/**/*.tsx');
let updated = 0;

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  
  const rnImportRegex = /import\s+\{([^}]+)\}\s+from\s+['"]react-native['"];/;
  const match = content.match(rnImportRegex);
  if (match) {
    const imports = match[1].split(',').map(s => s.trim()).filter(Boolean);
    const uniqueImports = [...new Set(imports)];
    
    if (imports.length !== uniqueImports.length) {
      const newImport = "import { " + uniqueImports.join(', ') + " } from 'react-native';";
      content = content.replace(rnImportRegex, newImport);
      fs.writeFileSync(f, content, 'utf8');
      updated++;
      console.log('Fixed imports in ' + f);
    }
  }
});
console.log('Total fixed: ' + updated);
