const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/app/**/*.tsx');
let updated = 0;
files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  if (content.includes('ToastAndroid.show')) return;
  
  const searchStr = /console\.log\('Global refresh triggered(.*?)\);/g;
  if (searchStr.test(content)) {
    if (!content.includes('ToastAndroid')) {
      content = content.replace(/import \{([^}]+)\} from 'react-native';/, "import { $1, ToastAndroid, Platform } from 'react-native';");
    }
    content = content.replace(searchStr, "console.log('Global refresh triggered$1);\n      if (Platform.OS === 'android') { ToastAndroid.show('Memperbarui data...', ToastAndroid.SHORT); }");
    fs.writeFileSync(f, content, 'utf8');
    updated++;
  }
});
console.log('Added toast to ' + updated + ' files');
