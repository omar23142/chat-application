import {
  BadRequestException,
  Body,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ParseDatePipe,
  Request,
  RequestTimeoutException,
  forwardRef,
} from '@nestjs/common';
import { RejesterDto } from '../dtos/Rejester.dto';
import { LoginDto } from '../dtos/LoginDto.dto';
import * as bcrypt from 'bcryptjs';
import { JwtPayloadType } from '../../utils/types';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../entity/User.entity';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
//import { ConfigService } from "@nestjs/config";
import { MailerService } from '@nestjs-modules/mailer';
import { MailService } from '../../mail/mail.service';
import type { Request as ExpressRequest } from 'express';
import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
// import { Authconfig } from 'src/config/AuthClass';

@Injectable()
export class AuthProvider {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @Inject(JwtService)
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly mailerService: MailerService,
    private readonly mailService: MailService,
  ) {}
  /**
   * creat new users
   * @param RejesterDto the body that send from users
   * @returns Promise<string>
   */
  public async sigup(RejesterDto: RejesterDto, req: ExpressRequest) {
    //console.log('tessssst',RejesterDto)
    const {
      email,
      userName,
      password,
      passwordConf,
      photo,
      nativeLanguage,
      gender,
    } = RejesterDto;
    const existEmail = await this.userRepo.findOne({ where: { email } });
    if (existEmail)
      throw new BadRequestException('this email is already exist');
    const existUserName = await this.userRepo.findOne({ where: { userName } });
    if (existUserName)
      throw new BadRequestException(
        'the userName is already exist pleas chose another userName',
      );
    if (password !== passwordConf)
      throw new BadRequestException(`password don't match with passwordConf`);
    const salt = await bcrypt.genSalt(10);
    const genPass = await bcrypt.hash(password, salt);
    const verificationToken = randomBytes(32).toString('hex');
    const newUser = this.userRepo.create({
      userName: userName,
      email: email,
      password: genPass,
      photo: photo,
      verificationToken,
      nativeLanguage,
      gender,
    });

    await this.userRepo.save(newUser);
    newUser.password = '';
    const payload: JwtPayloadType = {
      id: newUser.id,
      role: newUser.role,
      iat: Date.now(),
      gender: newUser.gender,
    };
    const jwtToken = await this.jwtService.signAsync(payload, {
      secret: this.config.get('jwt_secret_key'),
    });
    // try {
    // let date = new Date();
    // const host = this.config.get<string>('SMTP_HOST');
    // const password =  this.config.get<string>('SMTP_PASSWORD');
    // const user = this.config.get<string>('SMTP_USERNAME')
    // console.log(host,password,user)
    // await this.mailerService.sendMail( {
    //     to: newUser.email,
    //     from: 'almgoshomar@gmail.com',
    //     subject:'welcome Email',
    //     html: `
    //         <div>
    //         <h1> Hi ${newUser.userName} </h1>
    //         <p> welcome to our family you are join to us in ${date.toDateString()} at ${date.toLocaleTimeString()}</p>
    //          </div>`} )
    //         } catch(err) {
    //             console.log(err);
    //             throw new RequestTimeoutException('there is a problem hapen when send email to you');
    //          }

    const uploadImageUrl = `${req.protocol}://${req.get('host')}/api/v1/users/profileImage`;
    const verificationUrl = this.generateVerifyUrl(
      newUser,
      verificationToken,
      req,
    );
    //await this.mailService.sendWelcome(newUser,uploadImageUrl);
    await this.mailService.sendValidationEmail(newUser, verificationUrl);

    return {
      newUser,
      //jwtToken,
      message:
        'we send email to verify your acount, pleas use the url to verify your acount ',
    };
  }
  /**
   *  log in the user
   * @param LoginDto body object that user give
   * @returns Promise<string>
   */
  public async login(
    LoginDto: LoginDto,
    req: ExpressRequest,
  ): Promise<
    | {
        message: string;
        accessToken?: undefined;
      }
    | {
        accessToken: string;
        message?: undefined;
      }
  > {
    console.log('in the login');
    const { userName, email, password } = LoginDto;
    // let existUser = await this.userRepo.findOne({where:{email}})
    const existUser = await this.userRepo
      .createQueryBuilder('user')
      .where('user.email = :email', { email: email })
      .addSelect('user.password')
      .getOne();

    //console.log('existUser ',existUser);
    if (!existUser) {
      console.log('no user exist');
      throw new BadRequestException('the email or password is not correct');
    }
    let passCorrect = false;
    passCorrect = await bcrypt.compare(password, existUser.password);
    if (!passCorrect) {
      console.log('password incorrect');
      throw new BadRequestException('the email or password is not correct');
    }
    if (!existUser.isVerified) {
      let verifecationToken = existUser.verificationToken;
      if (!verifecationToken) {
        verifecationToken = randomBytes(32).toString('hex');
        existUser.verificationToken = verifecationToken;
        await this.userRepo.save(existUser);
      }
      const url = this.generateVerifyUrl(existUser, verifecationToken, req);
      await this.mailService.sendValidationEmail(existUser, url);
      return {
        message:
          'the verifycation email was sent to you , pleas confirm your acount useing the url in it',
      };
    }
    const payload: JwtPayloadType = {
      id: existUser.id,
      role: existUser.role,
      gender: existUser.gender,
      iat: Date.now(),
    };
    console.log(payload);

    const jwtToken = await this.jwtService.signAsync(payload, {
      secret: this.config.get('jwt_secret_key'),
    });
    console.log('login this is token', jwtToken);
    return { accessToken: jwtToken };
  }
  private generateVerifyUrl(user: User, token: string, req: ExpressRequest) {
    //console.log('req', req)

    //const protocol = req?.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
    //console.log(protocol)
    //console.log('in the generateVerifyUrl', req.protocol, req.get('host'))

    return `${req.protocol}://${req.get('host')}/api/v1/users/verify-email/${user.id}/${token}`;
  }

   // Add this inside AuthProvider class in src/users/providers/auth.provider.ts

  public async validateOAuthUser(profile: {
    email: string;
    userName: string;
    photo?: string;
  }) {
    const { email, userName, photo } = profile;

    // 1. Check if user exists by email
    let user = await this.userRepo.findOne({ where: { email } });

    if (!user) {
      // 2. Sign-up: Create a new user (Ensure User.entity allows nullable passwords for OAuth users!)
      user = this.userRepo.create({
        email,
        userName: userName,
        photo: photo,
        isVerified: true, // Google already verified their email
      });

      user = await this.userRepo.save(user);
    }

    return user;
  }

  // Reusable method to generate token for any authenticated User (from either Local or OAuth flow)
  public async generateJwtForUser(user: User) {
    const payload: JwtPayloadType = {
      id: user.id,
      role: user.role,
      gender: user.gender,
      iat: Date.now(),
    };

    const jwtToken = await this.jwtService.signAsync(payload, {
      secret: this.config.get('jwt_secret_key'),
    });

    return { accessToken: jwtToken };
  }
}
