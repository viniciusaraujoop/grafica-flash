const fs = require('fs');
const path = require('path');

// ORCALY_HIDE_WHATSAPP_MENU_V1

const file = path.join(process.cwd(), 'lib', 'panel-modules.ts');

if (!fs.existsSync(file)) {
  throw new Error(`Arquivo nao encontrado: ${file}`);
}

const raw = fs.readFileSync(file, 'utf8');
const eol = raw.includes('\r\n') ? '\r\n' : '\n';
const text = raw.replace(/\r\n/g, '\n');

const search = `  {
    id: 'whatsapp',
    emoji: '💬',
    label: 'WhatsApp',
    description: 'Configurações e automações de atendimento pelo WhatsApp.',
    href: '/painel/whatsapp',
    group: 'presenca_digital',
    segments: allSegments,
    status: 'active',
    requiredPlan: null,
    requiresActiveSubscription: true,
    iconName: 'whatsapp',
    isGlobal: true,
  },`;

const replacement = `  {
    id: 'whatsapp',
    emoji: '💬',
    label: 'WhatsApp',
    description: 'Configurações e automações de atendimento pelo WhatsApp.',
    href: '/painel/whatsapp',
    group: 'presenca_digital',
    segments: allSegments,
    status: 'hidden',
    requiredPlan: null,
    requiresActiveSubscription: true,
    iconName: 'whatsapp',
    isGlobal: true,
  },`;

if (!text.includes(search)) {
  if (text.includes(replacement)) {
    console.log('WHATSAPP_MENU_ALREADY_HIDDEN=1');
    process.exit(0);
  }

  throw new Error('Modulo WhatsApp esperado nao encontrado.');
}

const updated = text.replace(search, replacement);

const output =
  eol === '\r\n'
    ? updated.replace(/\n/g, '\r\n')
    : updated;

fs.writeFileSync(file, output, 'utf8');

console.log('WHATSAPP_MENU_HIDDEN=1');
console.log('ROUTE_PRESERVED=1');
