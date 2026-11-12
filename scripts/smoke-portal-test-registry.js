/**
 * Smoke-test registry matching + pincode scrape validation (no Nest bootstrap).
 */
const path = require('path');

async function main() {
  // Compile-free: duplicate minimal resolve via requiring ts-node if available
  const { register } = require('ts-node');
  register({
    transpileOnly: true,
    compilerOptions: { module: 'commonjs', esModuleInterop: true },
  });

  const {
    resolvePortalScrapeDefinition,
    matchExpectedFields,
  } = require('../src/modules/portal-list/config/portal-scrape-registry.ts');

  const cases = [
    { title: 'Who.is - Domain WHOIS Lookup', url: 'https://who.is/' },
    { title: 'GST Taxpayer Search', url: 'https://services.gst.gov.in/services/searchtp' },
    { title: 'Random Portal', url: 'https://example.gov.in' },
    { title: 'KnowYourGST', url: 'https://www.knowyourgst.com/gst-number-search/' },
  ];
  for (const c of cases) {
    const d = resolvePortalScrapeDefinition(c);
    console.log(`${c.title} → ${d.strategy} (fields=${d.supportsFieldScrape})`);
  }

  const v = matchExpectedFields(
    { State: 'Gujarat', District: 'Ahmedabad', 'Post Office': 'Navrangpura', Pincode: '380009' },
    ['Post Office', 'District', 'State', 'Pincode', 'Country'],
    3,
  );
  console.log('pincode validation', v);

  const { ScrappingService } = require('../src/modules/scrapping/services/scrapping.service.ts');
  const svc = new ScrappingService();
  const pin = await svc.pincodeLookup('380001');
  const fields = pin.data.fields;
  const pinVal = matchExpectedFields(fields, [
    'Post Office',
    'District',
    'State',
    'Pincode',
    'Country',
    'Branch Type',
  ], 3);
  console.log('live pincode fields', Object.keys(fields));
  console.log('live pincode validation ok=', pinVal.ok, pinVal);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
