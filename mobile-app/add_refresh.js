const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/app/**/*.tsx');
let updatedCount = 0;

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  
  if (content.includes('DeviceEventEmitter.addListener(\'globalRefresh\'')) return;

  const useEffectRegex = /useEffect\(\(\) => \{([\s\S]*?)\}, \[\]\);/;
  const match = content.match(useEffectRegex);
  
  if (match) {
    const insideUseEffect = match[1];
    
    if (!content.includes('DeviceEventEmitter')) {
      content = content.replace(/import \{([^}]+)\} from 'react-native';/, "import { $1, DeviceEventEmitter } from 'react-native';");
    }

    const newUseEffect = `useEffect(() => {${insideUseEffect}
    const listener = DeviceEventEmitter.addListener('globalRefresh', () => {
      console.log('Global refresh triggered in ' + '${f}');${insideUseEffect}
    });

    return () => listener.remove();
  }, []);`;

    content = content.replace(useEffectRegex, newUseEffect);
    fs.writeFileSync(f, content, 'utf8');
    console.log('Updated ' + f);
    updatedCount++;
  }
});
console.log('Total updated: ' + updatedCount);
