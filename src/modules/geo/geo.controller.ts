import { Controller, Get, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { GeoService } from './geo.service';

@Controller('geo')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.CLIENT_ADMIN, Role.CLIENT_USER, Role.FIELD_AGENT)
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  /**
   * GET /geo/geocode?q=address
   * Resolves an address/pincode to lat/lng for distance calculations.
   */
  @Get('geocode')
  async geocode(@Query('q') q?: string) {
    const result = await this.geoService.geocode(q ?? '');
    return {
      code: HttpStatus.OK,
      message: result ? 'Geocode resolved' : 'No geocode match',
      data: result,
    };
  }
}
