import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';

const googleClient = new OAuth2Client();

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async login(username: string, password: string) {
    const adminUsername = process.env.ADMIN_USERNAME || 'giaovien';
    const adminPassword = process.env.ADMIN_PASSWORD || 'cqp22admin';

    if (username !== adminUsername || password !== adminPassword) {
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng');
    }

    const payload = { username, role: 'admin' };
    return {
      access_token: this.jwtService.sign(payload),
      username,
    };
  }

  async loginWithGoogle(idToken: string) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new UnauthorizedException('Google OAuth chưa được cấu hình');
    }

    let ticket: any;
    try {
      ticket = await googleClient.verifyIdToken({
        idToken,
        audience: clientId,
      });
    } catch {
      throw new UnauthorizedException('Google token không hợp lệ');
    }

    const payload = ticket.getPayload();
    if (!payload) {
      throw new UnauthorizedException('Không lấy được thông tin từ Google');
    }

    // Kiểm tra email được phép (tùy chọn)
    const allowedEmail = process.env.GOOGLE_ALLOWED_EMAIL;
    if (allowedEmail && payload.email !== allowedEmail) {
      throw new UnauthorizedException('Email Google này không có quyền truy cập');
    }

    const username = payload.email || payload.name || 'google-user';
    const jwtPayload = { username, role: 'admin', provider: 'google' };
    return {
      access_token: this.jwtService.sign(jwtPayload),
      username,
      name: payload.name,
      picture: payload.picture,
    };
  }
}
