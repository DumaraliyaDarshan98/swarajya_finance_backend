import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { TrainingService } from '../services/training.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { AuthedUser } from '../../../common/interfaces/authed-user.interface';
import { CompleteTrainingVideoDto, SubmitTrainingExamDto } from '../dto/training.dto';

@Controller('trainings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TrainingUserController {
  constructor(private readonly trainingService: TrainingService) {}

  @Get('me/status')
  @Roles(Role.FIELD_AGENT, Role.CLIENT_ADMIN, Role.CLIENT_USER, Role.SUPER_ADMIN, Role.INTERNAL_USER)
  getStatus(@Req() req: { user: AuthedUser }) {
    return this.trainingService.getAssignedTraining(req.user.sub, req.user.role);
  }

  @Get('me/assigned')
  @Roles(Role.FIELD_AGENT, Role.CLIENT_ADMIN)
  getAssigned(@Req() req: { user: AuthedUser }) {
    return this.trainingService.getAssignedTraining(req.user.sub, req.user.role);
  }

  @Post('me/complete')
  @Roles(Role.FIELD_AGENT, Role.CLIENT_ADMIN)
  complete(
    @Req() req: { user: AuthedUser },
    @Body() dto: CompleteTrainingVideoDto,
  ) {
    return this.trainingService.completeTraining(
      req.user.sub,
      req.user.role,
      dto.trainingId,
    );
  }

  @Get('me/:trainingId/exam')
  @Roles(Role.FIELD_AGENT, Role.CLIENT_ADMIN)
  getExam(
    @Req() req: { user: AuthedUser },
    @Param('trainingId') trainingId: string,
  ) {
    return this.trainingService.getExamForUser(
      req.user.sub,
      req.user.role,
      trainingId,
    );
  }

  @Post('me/:trainingId/exam/submit')
  @Roles(Role.FIELD_AGENT, Role.CLIENT_ADMIN)
  submitExam(
    @Req() req: { user: AuthedUser },
    @Param('trainingId') trainingId: string,
    @Body() dto: SubmitTrainingExamDto,
  ) {
    return this.trainingService.submitExam(
      req.user.sub,
      req.user.role,
      trainingId,
      dto,
    );
  }

  @Post('me/generate-certificate')
  @Roles(Role.FIELD_AGENT, Role.CLIENT_ADMIN)
  generateCertificate(@Req() req: { user: AuthedUser }) {
    return this.trainingService.generateCertificate(req.user.sub, req.user.role);
  }

  @Get('me/certificates')
  @Roles(Role.FIELD_AGENT, Role.CLIENT_ADMIN, Role.CLIENT_USER, Role.SUPER_ADMIN, Role.INTERNAL_USER)
  myCertificates(@Req() req: { user: AuthedUser }) {
    return this.trainingService.getMyCertificates(req.user.sub);
  }

  @Get('me/certificates/:id')
  @Roles(Role.FIELD_AGENT, Role.CLIENT_ADMIN, Role.CLIENT_USER, Role.SUPER_ADMIN, Role.INTERNAL_USER)
  getCertificate(
    @Req() req: { user: AuthedUser },
    @Param('id') id: string,
  ) {
    return this.trainingService.getCertificateById(
      req.user.sub,
      id,
      req.user.role === Role.SUPER_ADMIN,
    );
  }
}
