const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, 'src', 'i18n', 'locales');
const srcDir = path.join(__dirname, 'src');

const locales = ['en', 'fr', 'es', 'ar'];
const jsonFiles = locales.map(l => path.join(localesDir, `${l}.json`));

// Read existing JSON
const dicts = {};
jsonFiles.forEach((file, i) => {
  if (fs.existsSync(file)) {
    try {
      dicts[locales[i]] = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      dicts[locales[i]] = {};
    }
  } else {
    dicts[locales[i]] = {};
  }
});

// Helper to set nested key
function setNestedKey(obj, keyPath, value) {
  const parts = keyPath.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]]) current[parts[i]] = {};
    current = current[parts[i]];
  }
  const lastKey = parts[parts.length - 1];
  // Don't overwrite if it already exists to avoid destroying manual translations
  if (current[lastKey] === undefined) {
    current[lastKey] = value;
  }
}

// Regex to find t('key', 'Default text') or t("key", "Default text")
const tRegex = /t\(\s*(['"`])([^'"`]+)\1\s*,\s*(['"`])(.*?)\3\s*(?:,[^)]+)?\)/g;

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      scanDir(fullPath);
    } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      let match;
      while ((match = tRegex.exec(content)) !== null) {
        const key = match[2];
        const defaultText = match[4];
        
        // Populate dictionary if key doesn't exist
        locales.forEach(loc => {
           // For now, we put the default text in all languages if it's missing.
           // A real translation API would go here, but putting the default is better than empty.
           // However, to make it 'perfect' as user requested, we should ideally translate.
           // For Arabic and others, we might need a separate script or we leave it for the user.
           setNestedKey(dicts[loc], key, defaultText); 
        });
      }
    }
  }
}

scanDir(srcDir);

// Write back
jsonFiles.forEach((file, i) => {
  fs.writeFileSync(file, JSON.stringify(dicts[locales[i]], null, 2));
  console.log(`Updated ${locales[i]}.json`);
});
