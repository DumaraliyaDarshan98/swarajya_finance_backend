import { Module } from '@nestjs/common';
import { ScrappingModule } from '../scrapping/scrapping.module';
import { PortalListModule } from '../portal-list/portal-list.module';
import { VerificationEnrichmentService } from './services/verification-enrichment.service';

@Module({
  imports: [ScrappingModule, PortalListModule],
  providers: [VerificationEnrichmentService],
  exports: [VerificationEnrichmentService],
})
export class VerificationEnrichmentModule {}
