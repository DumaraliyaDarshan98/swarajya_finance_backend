import { Body, Controller, Post } from '@nestjs/common';
import { ScrappingService } from './scrapping.service';
import { GstSearchDto } from './dto/gst-search.dto';
import { GstPortalInitDto } from './dto/gst-portal-init.dto';
import { GstPortalSearchDto } from './dto/gst-portal-search.dto';

@Controller('scrapping')
export class ScrappingController {
  constructor(private service: ScrappingService) {}

  @Post('gst-search')
  gstSearch(@Body() dto: GstSearchDto) {
    return this.service.gstSearch(dto.gstNumber);
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

