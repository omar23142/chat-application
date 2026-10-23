import {
  BadRequestException,
  Body,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ParseDatePipe,
  RequestTimeoutException,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { RejesterDto } from '../../users/dtos/Rejester.dto';
import { LoginDto } from '../../users/dtos/LoginDto.dto';
import * as bcrypt from 'bcryptjs';
import { JwtPayloadType } from '../../utils/types';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../../users/entity/User.entity';
import { Repository } from 'typeorm';
import { JwtModuleOptions, JwtService, JwtSignOptions } from '@nestjs/jwt';
//import { ConfigService } from "@nestjs/config";
import { MailerService } from '@nestjs-modules/mailer';
import { MailService } from '../../mail/mail.service';
import type { Request as ExpressRequest, Request, Response } from 'express';
import { randomBytes, createHash } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { ref } from 'process';
import { UserService } from 'src/users/User.Service';
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
      iat: Date.now()/1000,
      accessTokenVersion:newUser.accessTokenVersion,
      gender: newUser.gender,
    };
    const jwtToken = await this.jwtService.signAsync(payload, {
      secret: this.config.get('JWT_SECRET_KEY'),
      
    });
    console.log('jjjjjjjjjjj', jwtToken);
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
      jwtToken,
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
      accessTokenVersion:existUser.accessTokenVersion,
      iat: Date.now()/1000,
    };
    console.log(payload);

    const jwtToken = await this.jwtService.signAsync(payload, {
      secret: this.config.get('JWT_SECRET_KEY'),
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

  public async validateOAuthUser(profile: {
    email: string;
    userName: string;
    photo?: string;
  }) {
    const { email, userName, photo } = profile;

    // 1. Check if user exists by email
    let user = await this.userRepo.findOne({ where: { email } });

    if (!user) {
      //  If it's a new user, handle Username conflicts
      let finalUserName = userName || email.split('@')[0];

      // Check if the username is already taken
      const usernameExists = await this.userRepo.findOne({
        where: { userName: finalUserName },
      });
      if (usernameExists) {
        // If taken, append a random 4-digit number (e.g., John Doe -> John Doe 4821)
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        console.log('randomsuffixxxxx', randomSuffix);
        finalUserName = `${finalUserName} ${randomSuffix}`;
      }
      // 2. Sign-up: Create a new user (Ensure User.entity allows nullable passwords for OAuth users!)
      const randomPass = randomBytes(32).toString('hex');
      const salut = await bcrypt.genSalt(10);
      const hashedPass = await bcrypt.hash(randomPass, salut);
      user = this.userRepo.create({
        email,
        userName: finalUserName,
        password: hashedPass,
        nativeLanguage: 'unknown', // to do in frontend if the profile don't complite (nativelanguage:unknown and gender: unknown) then redirect the user to the edit detailes page
        gender: 'unknown',
        photo: photo,
        isVerified: true, // Google already verified their email
      });

      user = await this.userRepo.save(user);
    }
    // const { password , ...result } = user;

    return user;
  }

  /**
   * Validate email + password for local login.
   * Returns the user if credentials are correct, null otherwise.
   * Called by LocalStrategy.validate().
   */
  public async validateLocalUser(
    email: string,
    password: string,
  ): Promise<User | null> {
    const user = await this.userRepo
      .createQueryBuilder('user')
      .where('user.email = :email', { email })
      .addSelect('user.password')
      .getOne();

    if (!user) return null;

    const passwordCorrect = await bcrypt.compare(password, user.password);
    if (!passwordCorrect) return null;

    user.password = '';
    return user;
  }

  /**
   * Handle the sign-in response after Passport validates credentials.
   * If user is verified → return JWT.
   * If user is not verified → send verification email and return message.
   */
  public async signin(user: User, req: ExpressRequest) {
    if (!user.isVerified) {
      let token = user.verificationToken;
      if (!token) {
        token = randomBytes(32).toString('hex');
        user.verificationToken = token;
        await this.userRepo.save(user);
        const verifyUrl = this.generateVerifyUrl(user, token, req);
      await this.mailService.sendValidationEmail(user, verifyUrl);
      const accessToken =  await this.generateJwtForUser(user);
      const refreshToken = await this.generateRefreshToken(user);
      return {
        accessToken, refreshToken, user,
        message:
          'Your email is not verified. A verification email has been sent.',
      };
      }
      
    }

    const accessToken =  await this.generateJwtForUser(user);
    const refreshToken = await this.generateRefreshToken(user);

    // // save the refreshToken in database for use it one time and replace it every time after use the refresh route
    // const hashedRefreshToken = await bcrypt.hash(refreshToken, 4);
    // // user.refreshToken = hashedRefreshToken;
    // await this.userRepo.update({id:user.id}, {refreshToken:hashedRefreshToken});
    return { accessToken, refreshToken, user };
  }

  public async generateRefreshToken(user:User) {
      const payload: JwtPayloadType = {
      id: user.id,
      role: user.role,
      gender: user.gender,
      accessTokenVersion:user.accessTokenVersion,
      iat: Date.now()/1000,
    };

    const RefreshToken = await this.jwtService.signAsync(payload, {
      secret: this.config.get('Refresh_JWT_SECRET_KEY'),
      expiresIn:this.config.get('Refresh_JWT_EXPIRES_IN')
    }as JwtSignOptions) ;
    // save the refreshToken in database for use it one time and replace it every time after use the refresh route
    // const hashedRefreshToken = await bcrypt.hash(RefreshToken, 4);
    
    const hashedRefreshToken = createHash('sha256').update(RefreshToken).digest('hex');
    
    console.log('newwww hasheeed1 ', hashedRefreshToken);
    // user.refreshToken = hashedRefreshToken;
    await this.userRepo.update(user.id, {refreshToken:hashedRefreshToken});
    // console.log('userrrrrrrrr', user.refreshToken);
    return RefreshToken;
  }
  
  // Reusable method to generate token for any authenticated User (from either Local or OAuth flow)
  public async generateJwtForUser(user: User) {
    const payload: JwtPayloadType = {
      id: user.id,
      role: user.role,
      accessTokenVersion:user.accessTokenVersion,
      gender: user.gender,
      iat: Date.now()/1000,
    };

    const jwtToken = await this.jwtService.signAsync(payload, {
      secret: this.config.get('JWT_SECRET_KEY'),
      expiresIn:this.config.get('JWT_EXPIRES_IN')
    }as JwtSignOptions) ;
    console.log('expiresIn', this.config.get('JWT_EXPIRES_IN'));
    return jwtToken;
  }

  public async validateHashedRefreshToken( user:User, refreshToken: string | undefined) {
    let valid = false;
    let hashedref;
    const hashedRefreshTokenFromDB = user.refreshToken;
    if(!hashedRefreshTokenFromDB)
      throw new UnauthorizedException('inValid session')
    // valid = await bcrypt.compare(refreshToken, hashedRefreshToken);
    if (refreshToken)
      hashedref =  createHash('sha256').update(refreshToken).digest('hex');
    console.log('refreshToken', refreshToken);
    console.log('hashedref', hashedref);
    console.log('refTokenfromDB', hashedRefreshTokenFromDB);
    if (hashedref !== hashedRefreshTokenFromDB)
      {
        // to do increase the counter of access jwt 
        await this.userRepo.update(user.id, {refreshToken: null});
        await this.IncrementAccessTokenVersion(user);
        throw new UnauthorizedException('unValid refreshToken!!!!!!!!');
      }
    valid = true
    return valid;
  }
  public async logOut(user: User){
    
    // const user = await this.userRepo.findBy({id: userId});
    await this.userRepo.update(user.id,{refreshToken:null});
    await this.IncrementAccessTokenVersion(user);
    return {message: 'you are logout sucessfully'}


  }
  public async IncrementAccessTokenVersion(user: User, userId?:number) {
    // let newaccessTokenVersion = user.accessTokenVersion + 1;
    // return await this.userRepo.update(user.id, {accessTokenVersion:newaccessTokenVersion});
    await this.userRepo.increment({ id: user.id}, 'accessTokenVersion', 1) // this solve the race condtion that happen from user.accessTokenVersion + 1;
  }
}
