import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TrainingService } from '../services/training.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import {
  CreateTrainingDto,
  CreateTrainingQuestionDto,
  UpdateTrainingDto,
  UpdateTrainingQuestionDto,
  UpdateTrainingResetConfigDto,
  UpdateTrainingStatusDto,
} from '../dto/training.dto';

@Controller('admin/trainings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class TrainingAdminController {
  constructor(private readonly trainingService: TrainingService) {}

  @Post()
  create(@Body() dto: CreateTrainingDto) {
    return this.trainingService.create(dto);
  }

  @Get()
  list(@Query('role') role?: string) {
    return this.trainingService.list(role);
  }

  @Get('reset-config')
  getResetConfig() {
    return this.trainingService.getResetDuration();
  }

  @Put('reset-config')
  updateResetConfig(@Body() dto: UpdateTrainingResetConfigDto) {
    return this.trainingService.updateResetDuration(Number(dto.durationDays));
  }

  @Get('certificates/by-client/:clientId')
  certificatesByClient(@Param('clientId') clientId: string) {
    return this.trainingService.getCertificatesByClient(clientId);
  }

  @Get('certificates/by-field-agent/:fieldAssistantId')
  certificatesByFieldAgent(@Param('fieldAssistantId') fieldAssistantId: string) {
    return this.trainingService.getCertificatesByFieldAssistant(fieldAssistantId);
  }

  @Get(':id/questions')
  listQuestions(@Param('id') id: string) {
    return this.trainingService.listQuestions(id);
  }

  @Post(':id/questions')
  createQuestion(@Param('id') id: string, @Body() dto: CreateTrainingQuestionDto) {
    return this.trainingService.createQuestion(id, dto);
  }

  @Put(':id/questions/:questionId')
  updateQuestion(
    @Param('id') id: string,
    @Param('questionId') questionId: string,
    @Body() dto: UpdateTrainingQuestionDto,
  ) {
    return this.trainingService.updateQuestion(id, questionId, dto);
  }

  @Delete(':id/questions/:questionId')
  deleteQuestion(
    @Param('id') id: string,
    @Param('questionId') questionId: string,
  ) {
    return this.trainingService.deleteQuestion(id, questionId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.trainingService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTrainingDto) {
    return this.trainingService.update(id, dto);
  }

  @Patch(':id/status')
  changeStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTrainingStatusDto,
  ) {
    return this.trainingService.changeStatus(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.trainingService.remove(id);
  }
}
