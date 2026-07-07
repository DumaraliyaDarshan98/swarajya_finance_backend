/**
 * One-time project restructure script.
 * Moves shared code into src/common and feature files into controllers/services folders.
 */
const fs = require('fs');
const path = require('path');

const srcRoot = path.join(__dirname, '..', 'src');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function moveFile(from, to) {
  if (!fs.existsSync(from)) return false;
  ensureDir(path.dirname(to));
  fs.renameSync(from, to);
  return true;
}

function moveDirContents(fromDir, toDir) {
  if (!fs.existsSync(fromDir)) return;
  ensureDir(toDir);
  for (const entry of fs.readdirSync(fromDir)) {
    const from = path.join(fromDir, entry);
    const to = path.join(toDir, entry);
    if (fs.existsSync(to)) continue;
    fs.renameSync(from, to);
  }
  if (fs.readdirSync(fromDir).length === 0) {
    fs.rmdirSync(fromDir);
  }
}

function walkTsFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
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
  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

// Step 1: consolidate shared folders into common/
const sharedMoves = [
  ['decorators', 'common/decorators'],
  ['enum', 'common/enums'],
  ['interface', 'common/interfaces'],
  ['interceptor', 'common/interceptors'],
  ['middlewares', 'common/middlewares'],
];

for (const [from, to] of sharedMoves) {
  moveDirContents(path.join(srcRoot, from), path.join(srcRoot, to));
}

// Step 2: reorganize each feature module
const modulesDir = path.join(srcRoot, 'modules');
if (fs.existsSync(modulesDir)) {
  for (const moduleName of fs.readdirSync(modulesDir)) {
    const modulePath = path.join(modulesDir, moduleName);
    if (!fs.statSync(modulePath).isDirectory()) continue;

    const controllersDir = path.join(modulePath, 'controllers');
    const servicesDir = path.join(modulePath, 'services');
    const repositoriesDir = path.join(modulePath, 'repositories');
    ensureDir(controllersDir);
    ensureDir(servicesDir);
    ensureDir(repositoriesDir);

    for (const file of fs.readdirSync(modulePath)) {
      const full = path.join(modulePath, file);
      if (!fs.statSync(full).isFile() || !file.endsWith('.ts')) continue;
      if (file.endsWith('.controller.ts')) {
        moveFile(full, path.join(controllersDir, file));
      } else if (file.endsWith('.service.ts')) {
        moveFile(full, path.join(servicesDir, file));
      }
    }
  }
}

// Step 3: update imports across all TypeScript files
const importReplacements = [
  ["from 'src/enum/", "from 'src/common/enums/"],
  ["from 'src/interface/", "from 'src/common/interfaces/"],
  ["from 'src/decorators/", "from 'src/common/decorators/"],
  ["from 'src/interceptor/", "from 'src/common/interceptors/"],
  ["from './interceptor/", "from './common/interceptors/"],
  ["from '../interface/", "from '../common/interfaces/"],
  ["from '../../interface/", "from '../../common/interfaces/"],
  ["from '../../../interface/", "from '../../../common/interfaces/"],
  ["from '../../../../interface/", "from '../../../../common/interfaces/"],
  ["from '../enum/", "from '../common/enums/"],
  ["from '../../enum/", "from '../../common/enums/"],
  ["from '../../../enum/", "from '../../../common/enums/"],
  ["from '../../../../enum/", "from '../../../../common/enums/"],
  ["from '../decorators/", "from '../common/decorators/"],
  ["from '../../decorators/", "from '../../common/decorators/"],
  ["from '../../../decorators/", "from '../../../common/decorators/"],
  ["from '../../../../decorators/", "from '../../../../common/decorators/"],
  ["from './auth.service'", "from './services/auth.service'"],
  ["from './auth.controller'", "from './controllers/auth.controller'"],
  ["from './users.service'", "from './services/users.service'"],
  ["from './users.controller'", "from './controllers/users.controller'"],
  ["from './user-documents.controller'", "from './controllers/user-documents.controller'"],
  ["from './clients.service'", "from './services/clients.service'"],
  ["from './clients.controller'", "from './controllers/clients.controller'"],
  ["from './roles.service'", "from './services/roles.service'"],
  ["from './roles.controller'", "from './controllers/roles.controller'"],
  ["from './verification.service'", "from './services/verification.service'"],
  ["from './verification.controller'", "from './controllers/verification.controller'"],
  ["from './ocr.service'", "from './services/ocr.service'"],
  ["from './ocr.controller'", "from './controllers/ocr.controller'"],
  ["from './mail.service'", "from './services/mail.service'"],
  ["from './notification.service'", "from './services/notification.service'"],
  ["from './scrapping.service'", "from './services/scrapping.service'"],
  ["from './scrapping.controller'", "from './controllers/scrapping.controller'"],
  ["from './digital-verification.service'", "from './services/digital-verification.service'"],
  ["from './digital-verification.controller'", "from './controllers/digital-verification.controller'"],
  ["from './ocr-verification.service'", "from './services/ocr-verification.service'"],
  ["from './ocr-verification.controller'", "from './controllers/ocr-verification.controller'"],
  ["from './physical-verification.service'", "from './services/physical-verification.service'"],
  ["from './physical-verification.controller'", "from './controllers/physical-verification.controller'"],
  ["from './physical-verification-visit.service'", "from './services/physical-verification-visit.service'"],
  ["from './field-assistance.service'", "from './services/field-assistance.service'"],
  ["from './field-assistance.controller'", "from './controllers/field-assistance.controller'"],
  ["from './field-agent-wallet.service'", "from './services/field-agent-wallet.service'"],
  ["from './field-agent-wallet.controller'", "from './controllers/field-agent-wallet.controller'"],
  ["from './super-admin-settings.service'", "from './services/super-admin-settings.service'"],
  ["from './super-admin-settings.controller'", "from './controllers/super-admin-settings.controller'"],
];

const allTsFiles = walkTsFiles(srcRoot);
for (const file of allTsFiles) {
  replaceInFile(file, importReplacements);
}

// Step 4: fix relative imports inside moved controllers/services (dto, entities, helpers, interfaces)
const depthReplacements = [
  ["from './dto/", "from '../dto/"],
  ["from './entities/", "from '../entities/"],
  ["from './helpers/", "from '../helpers/"],
  ["from './interfaces/", "from '../interfaces/"],
  ["from './constants", "from '../constants"],
];

const movedFiles = allTsFiles.filter(
  (f) =>
    f.includes(`${path.sep}controllers${path.sep}`) ||
    f.includes(`${path.sep}services${path.sep}`),
);

for (const file of movedFiles) {
  replaceInFile(file, depthReplacements);
}

// Step 5: fix common path depth for controllers/services (add one more ../)
const commonDepthFixes = [
  ["from '../../common/", "from '../../../common/"],
];
for (const file of movedFiles) {
  replaceInFile(file, commonDepthFixes);
}

console.log('Restructure complete.');
