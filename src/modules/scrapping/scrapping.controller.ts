import { Body, Controller, Post } from '@nestjs/common';
import { ScrappingService } from './scrapping.service';
import { GstSearchDto } from './dto/gst-search.dto';
import { GstPortalInitDto } from './dto/gst-portal-init.dto';
import { GstPortalSearchDto } from './dto/gst-portal-search.dto';
import { PincodeSearchDto } from './dto/pincode-search.dto';
import { WhoisSearchDto } from './dto/whois-search.dto';

@Controller('scrapping')
export class ScrappingController {
  constructor(private service: ScrappingService) {}

  @Post('gst-search')
  gstSearch(@Body() dto: GstSearchDto) {
    return this.service.gstSearch(dto.gstNumber);
  }

  @Post('whois-search')
  whoisSearch(@Body() dto: WhoisSearchDto) {
    return this.service.whoisSearch(dto.domain);
  }

  @Post('pincode-search')
  pincodeSearch(@Body() dto: PincodeSearchDto) {
    return this.service.pincodeLookup(dto.pincode);
  }

  @Post('gst-portal/init')
  gstPortalInit(@Body() dto: GstPortalInitDto) {
    return this.service.gstPortalInit(dto.gstNumber);
  }

  @Post('gst-portal/search')
  gstPortalSearch(@Body() dto: GstPortalSearchDto) {
    return this.service.gstPortalSearch(dto.sessionId, dto.captchaCode);
  }
}

