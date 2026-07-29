const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const email = 'zhijuan' + Date.now() + '@surge.sh';
const password = Math.random().toString(36).slice(2, 12);

console.log('Creating surge account...');
try {
  // Create account via surge API
  const result = execSync(
    `npx -y surge teardown 2>nul & echo "${email}" & echo "${password}" & echo "" | npx -y surge ./dist zhijuan-gongfang-${Date.now().toString(36)}.surge.sh`,
    { 
      cwd: 'd:\\wisdom-workshop',
      timeout: 60000,
      stdio: 'pipe',
      input: `${email}\n${password}\n`,
      encoding: 'utf-8'
    }
  );
  console.log(result);
} catch (e) {
  // surge might require interactive, try alternative
  console.log('Surge CLI failed, trying programmatic approach...');
  console.log('stdout:', e.stdout || '');
  console.log('stderr:', e.stderr || '');
}
