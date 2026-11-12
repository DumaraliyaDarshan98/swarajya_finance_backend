const fs = require('fs');
const path = require('path');

const srcRoot = path.join(__dirname, '..', 'src');

function walkTsFiles(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist'].includes(entry.name)) continue;
      walkTsFiles(full, files);
    } else if (entry.name.endsWith('.ts')) {
      files.push(full);
    }
  }
  return files;
}

function replaceInFile(filePath, replacements) {
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  for (const [from, to] of replacements) {
    if (content.includes(from)) {
      content = content.split(from).join(to);
      changed = true;
    }
  }
  if (changed) fs.writeFileSync(filePath, content, 'utf8');
}

const controllerFiles = walkTsFiles(srcRoot).filter((f) =>
  f.includes(`${path.sep}controllers${path.sep}`),
);
const serviceFiles = walkTsFiles(srcRoot).filter((f) =>
  f.includes(`${path.sep}services${path.sep}`),
);

for (const file of controllerFiles) {
  replaceInFile(file, [['from \'./services/', "from '../services/"]]);
}

const serviceNameMap = [
  'users.service',
  'mail.service',
  'field-assistance.service',
  'scrapping.service',
  'ocr.service',
  'super-admin-settings.service',
  'field-agent-wallet.service',
  'physical-verification.service',
  'physical-verification-visit.service',
];

for (const file of [...serviceFiles, ...walkTsFiles(path.join(srcRoot, 'modules'))]) {
  for (const svc of serviceNameMap) {
    replaceInFile(file, [
      [`from '../${svc.split('.')[0].replace('.service', '')}/${svc}'`, 'SKIP'],
    ]);
  }
}

// Fix cross-module service imports from services/ depth
const crossModuleServiceFixes = [
  ["from '../user/users.service'", "from '../../user/services/users.service'"],
  ["from '../mail/mail.service'", "from '../../mail/services/mail.service'"],
  ["from '../field-assistance/field-assistance.service'", "from '../../field-assistance/services/field-assistance.service'"],
  ["from '../scrapping/scrapping.service'", "from '../../scrapping/services/scrapping.service'"],
  ["from '../verification/ocr.service'", "from '../../verification/services/ocr.service'"],
  ["from '../super-admin-settings/super-admin-settings.service'", "from '../../super-admin-settings/services/super-admin-settings.service'"],
  ["from '../field-agent-wallet/field-agent-wallet.service'", "from '../../field-agent-wallet/services/field-agent-wallet.service'"],
  ["from './services/physical-verification.service'", "from './physical-verification.service'"],
  ["from './services/physical-verification-visit.service'", "from './physical-verification-visit.service'"],
];

for (const file of serviceFiles) {
  replaceInFile(file, crossModuleServiceFixes);
}

// Fix cross-module entity imports from services/
const entityFixes = [
  ["from '../user/entities/", "from '../../user/entities/"],
  ["from '../client/entities/", "from '../../client/entities/"],
  ["from '../role/entities/", "from '../../role/entities/"],
  ["from '../module/entities/", "from '../../module/entities/"],
  ["from '../field-assistance/entities/", "from '../../field-assistance/entities/"],
  ["from '../physical-verification/entities/", "from '../../physical-verification/entities/"],
];

for (const file of serviceFiles) {
  replaceInFile(file, entityFixes);
}

// Fix notification service (in services folder)
replaceInFile(
  path.join(srcRoot, 'modules/notification/services/notification.service.ts'),
  [
    ["from '../mail/mail.service'", "from '../../mail/services/mail.service'"],
    ["from '../super-admin-settings/super-admin-settings.service'", "from '../../super-admin-settings/services/super-admin-settings.service'"],
  ],
);

replaceInFile(path.join(srcRoot, 'app.service.ts'), [
  ["from './interface/response.interface'", "from './common/interfaces/response.interface'"],
]);

replaceInFile(path.join(__dirname, 'create-super-admin.ts'), [
  ["from '../src/enum/role.enum'", "from '../src/common/enums/role.enum'"],
]);

console.log('Import fixes applied.');
