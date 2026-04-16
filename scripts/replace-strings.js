const fs = require('fs');
const path = require('path');

const patterns = [
  /\"to_do\"|\'to_do\'|\`to_do\`/g,
  /\"in_progress\"|\'in_progress\'|\`in_progress\`/g,
  /\"review\"|\'review\'|\`review\`/g,
  /\"done\"|\'done\'|\`done\`/g,
  /\"unpaid\"|\'unpaid\'|\`unpaid\`/g,
  /\"paid\"|\'paid\'|\`paid\`/g,
  /\"dp\"|\'dp\'|\`dp\`/g,
  /\"full_payment\"|\'full_payment\'|\`full_payment\`/g,
  /\"recurring\"|\'recurring\'|\`recurring\`/g,
  /\"pending\"|\'pending\'|\`pending\`/g,
  /\"sent\"|\'sent\'|\`sent\`/g,
  /\"failed\"|\'failed\'|\`failed\`/g,
  /\"monthly\"|\'monthly\'|\`monthly\`/g,
  /\"weekly\"|\'weekly\'|\`weekly\`/g,
  /\"yearly\"|\'yearly\'|\`yearly\`/g,
  /\"admin\"|\'admin\'|\`admin\`/g,
  /\"staff\"|\'staff\'|\`staff\`/g,
  /\"active\"|\'active\'|\`active\`/g,
  /\"trialing\"|\'trialing\'|\`trialing\`/g,
  /\"cancelled\"|\'cancelled\'|\`cancelled\`/g,
  /\"past_due\"|\'past_due\'|\`past_due\`/g
];

function readDirRecursive(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(readDirRecursive(filePath));
    } else {
      if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
        results.push(filePath);
      }
    }
  }
  return results;
}

const files = readDirRecursive(path.join(__dirname, '..', 'src'));
console.log(`Scanning ${files.length} files...`);

let replacedCount = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;
  
  for (const pattern of patterns) {
    if (content.match(pattern)) {
      content = content.replace(pattern, (match) => {
        const quote = match[0];
        const inner = match.slice(1, -1);
        if (inner.toUpperCase() !== inner) {
            changed = true;
            return quote + inner.toUpperCase() + quote;
        }
        return match;
      });
    }
  }
  
  if (changed) {
    fs.writeFileSync(file, content);
    console.log('Updated', file);
    replacedCount++;
  }
}

console.log(`Done. Modified ${replacedCount} files.`);
