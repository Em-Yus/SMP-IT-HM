const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, 'src', 'app');

function replaceInDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      replaceInDir(fullPath);
    } else if (fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Indigo to Dark Blue (Foreground Utama)
      content = content.replace(/#4f46e5/gi, '#2a2c87');
      content = content.replace(/#4338ca/gi, '#2a2c87'); // indigo-700
      
      // Blue to Primary Green (Aksen)
      content = content.replace(/#3b82f6/gi, '#85c226');
      
      // Dark blue gradient to darker blue
      content = content.replace(/#1d4ed8/gi, '#1a1a54');
      content = content.replace(/#2563eb/gi, '#2a2c87');
      
      // Backgrounds (gray-50, gray-100, blue-50) to Background Utama (#daffcc)
      content = content.replace(/#f9fafb/gi, '#daffcc'); 
      content = content.replace(/#f3f4f6/gi, '#daffcc');
      content = content.replace(/#eff6ff/gi, '#daffcc');
      content = content.replace(/#f8fafc/gi, '#daffcc');
      content = content.replace(/#f0fdf4/gi, '#daffcc');
      content = content.replace(/#e0e7ff/gi, '#daffcc'); // indigo-100
      
      // Write back
      fs.writeFileSync(fullPath, content, 'utf8');
      console.log(`Replaced colors in ${fullPath}`);
    }
  }
}

replaceInDir(targetDir);
console.log('Done replacing colors.');
