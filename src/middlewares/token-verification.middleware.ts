import { HttpException, HttpStatus, Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
// import { AuthService } from '../../modules/auth/auth.service';

// implement middleware for the jwt token verification
@Injectable()
export class TokenVerificationMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    // private readonly authService: AuthService
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<any> {
    const authHeaders = req.headers.authorization;

    const staticToken = req.headers['x-access-token'];

    // Static validation
    if (staticToken && staticToken === 'SBZ-SECURE-KEY-8eab41d0-51ce-4f1b-a6d2-f93f1c3e5b7f') {
      req['user'] = { id: -1, type: 'static-token' };
      return next();
    }

    if (authHeaders && (authHeaders as string)?.split(' ')[1]) {
      const token = (authHeaders as string)?.split(' ')[1];
      let decoded = null;
      decoded = this.jwtService.decode(token);
      next();
      // if (decoded) {
      //   const user = await this.authService.findById(decoded?.userId);
      //   if (!user.result) {
      //     throw new HttpException('Signature Expire', HttpStatus.NON_AUTHORITATIVE_INFORMATION);
      //   }
      //   req['user'] = user.result.id;
      //   next();
      // } else {
      //   throw new HttpException('Signature Expire', HttpStatus.NON_AUTHORITATIVE_INFORMATION);
      // }
    } else {
      throw new HttpException('Token Not Found', HttpStatus.UNAUTHORIZED);
    }
  }
}
