import {
  matchExpectedFields,
  resolvePortalScrapeDefinition,
} from '../src/modules/portal-list/config/portal-scrape-registry';
import { ScrappingService } from '../src/modules/scrapping/services/scrapping.service';

async function main() {
  const cases = [
    { title: 'Who.is - Domain WHOIS Lookup', url: 'https://who.is/' },
    {
      title: 'GST Taxpayer Search',
      url: 'https://services.gst.gov.in/services/searchtp',
    },
    { title: 'Random', url: 'https://x.gov.in' },
    {
      title: 'KnowYourGST',
      url: 'https://www.knowyourgst.com/gst-number-search/',
    },
  ];
  for (const c of cases) {
    const d = resolvePortalScrapeDefinition(c);
    console.log(`${c.title} -> ${d.strategy}`);
  }

  const svc = new ScrappingService();
  const pin = await svc.pincodeLookup('380001');
  const fields = pin.data?.fields ?? {};
  const v = matchExpectedFields(
    fields,
    ['Post Office', 'District', 'State', 'Pincode', 'Country', 'Branch Type'],
    3,
  );
  console.log('pincode fields', Object.keys(fields));
  console.log('pincode validation', v);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
