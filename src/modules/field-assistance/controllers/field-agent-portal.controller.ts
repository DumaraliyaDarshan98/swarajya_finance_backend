import { Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { FieldAssistanceService } from '../services/field-assistance.service';

type AuthedReq = { user: { role: Role; sub?: string } };

@Controller('field-agent')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.FIELD_AGENT)
export class FieldAgentPortalController {
  constructor(private readonly fieldAssistanceService: FieldAssistanceService) {}

  @Get('me/onboarding')
  getOnboarding(@Request() req: AuthedReq) {
    return this.fieldAssistanceService.getOnboardingForUser(req.user.sub!);
  }

  @Post('me/accept-terms')
  acceptTerms(@Request() req: AuthedReq) {
    return this.fieldAssistanceService.acceptTermsByUserId(req.user.sub!);
  }
}
