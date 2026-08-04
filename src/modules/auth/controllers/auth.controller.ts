import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { CreateSuperAdminDto } from '../dto/create-super-admin.dto';
import { LoginDto } from '../dto/login.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { AuthedUser } from '../../../common/interfaces/authed-user.interface';

@Controller('auth')
export class AuthController {
  constructor(private service: AuthService) {}

  @Post('create-super-admin')
  createSuperAdmin(@Body() dto: CreateSuperAdminDto) {
    return this.service.createSuperAdmin(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.service.login(dto);
  }

  @Post('forgot-password')
  forgot(@Body() dto: ForgotPasswordDto) {
    return this.service.forgotPassword(dto.email);
  }

  @Post('reset-password')
  reset(@Body() dto: ResetPasswordDto) {
    return this.service.resetPassword(dto);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  changePassword(@Req() req: { user: AuthedUser }, @Body() dto: ChangePasswordDto) {
    return this.service.changePassword(req.user.sub, dto);
  }
}
