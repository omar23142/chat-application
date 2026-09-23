import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException, Res } from '@nestjs/common';
import { UserDto } from './dto/userDto';
import { UpdateUserDto } from './dto/updateUserDto';
import {ChangPassDto} from './dto/updatePasswordDto';
import { userType } from 'src/utils/enum';
import { UserService } from 'src/users/User.Service';
import { MailService } from 'src/mail/mail.service';
import { Repository } from 'typeorm';
import { User } from 'src/users/entity/User.entity';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtPayloadType } from 'src/utils/types';
import { JwtService } from '@nestjs/jwt';
import { Request, Response } from 'express';
import { ResetPassDtoDto } from 'src/users/dtos/RessetPassDto.dto';
import { UnionDefinitionFactory } from '@nestjs/graphql/dist/schema-builder/factories/union-definition.factory.js';

@Injectable()
export class GraphqlService {
  
  constructor(
    // private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>
  ) {}

  public async createUser(userDto: UserDto, req: Request) {
     const {
          email,
          userName,
          password,
          passwordConf,
          photo,
          nativeLanguage,
          gender,
        } = userDto;
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
        const verifecationtoken = randomBytes(32).toString('hex');
          newUser.verificationToken = verifecationtoken;
          await this.userRepo.save(newUser);
          const verificationUrl = `${req.protocol}://${req.get('host')}/api/v1/users/verify-email/${newUser.id}/${verifecationtoken}`;
        //await this.mailService.sendWelcome(newUser,uploadImageUrl);
        await this.mailService.sendValidationEmail(newUser, verificationUrl);
        await this.userRepo.save(newUser);
        newUser.password = '';
        const payload: JwtPayloadType = {
          id: newUser.id,
          role: newUser.role,
          iat: Date.now(),
          gender: newUser.gender,
        };
        const jwtToken = await this.jwtService.signAsync(payload, 
        //   {
        //   secret: this.config.get('jwt_secret_key'),
        // }
      );
        console.log('jjjjjjjjjjj', jwtToken);
    
        const uploadImageUrl = `${req.protocol}://${req.get('host')}/api/v1/users/profileImage`;
        
          
        return {
          newUser,
          //jwtToken,
          // message:
          //   'we send email to verify your acount, pleas use the url to verify your acount ',
        };
  }

  findAll() {
    return `This action returns all graphql`;
  }

  findOne(id: number) {
    return `This action returns a #${id} graphql`;
  }

  public async updateOne(body: UpdateUserDto, id: number) {
      const current_user = await this.userRepo.findOne({ where: { id: id } });
      if (!current_user)
        throw new ForbiddenException('the user is no longer exist');
      const updated_user = current_user;
      updated_user.userName = body.userName ?? current_user.userName;
      updated_user.email = body.email ?? current_user.email;
      updated_user.photo = body.photo ?? current_user.photo;
      updated_user.nativeLanguage = body.nativeLanguage ?? current_user.nativeLanguage;
      updated_user.gender = body.gender ?? current_user.gender;
      
      await this.userRepo.save(updated_user);
      return updated_user;
    }
  
    public async changePassword(body: ChangPassDto, id: number) {
      const user = await this.userRepo
        .createQueryBuilder('user')
        .where('user.id = :id', { id })
        .addSelect('user.password')
        .getOne();
  
      if (!user) throw new NotFoundException('User not found');
  
      const isMatch = await bcrypt.compare(body.currentPassword, user.password);
      if (!isMatch) {
        throw new BadRequestException('Your current password is incorrect');
      }
  
      if (body.newPassword !== body.newPasswordConfirm) {
        throw new BadRequestException('Password confirmation does not match');
      }
  
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(body.newPassword, salt);
      user.passwordUpdatedAt = new Date();
  
      await this.userRepo.save(user);
      return { statue: 200, message: 'Password updated successfully' };
    }



    public async deleteMe(id: number) {
    const current_user = await this.userRepo.findOneBy({ id });
    if (!current_user)
      throw new ForbiddenException(
        'you are not allowed to do this(user does not exist) ',
      );
    await this.userRepo.remove(current_user);
    return 'user is deleted successfuly';
  }


  public async ForgetPassword(
      req: Request,
      curentUser: User,
      email?: string,
      userName?: string,
    ) {
      let user: User | null = null ;
      if (email) user = await this.userRepo.findOne({ where: { email: email } });
      else if (userName)
        user = await this.userRepo.findOne({ where: { userName } });
      // console.log('uuuuuuuuuuuuuuu', user);
      if (!user)
        throw new BadRequestException('user with given email is not exist');
      const ResetPassToken: string = randomBytes(32).toString('hex');
      const URL = `${req.protocol}://${req.get('host')}/api/v1/users/reset-password/${ResetPassToken}`;
      console.log('rullllll', URL);
      const hashedtoken = createHash('sha256')
        .update(ResetPassToken)
        .digest('hex');
      user.ResetPassToken = hashedtoken;
      user.ResetPassTokenExpires = new Date(Date.now() + 10 * 60 * 1000);
      const resault = await this.userRepo.save(user);
      console.log('before send email');
      await this.mailService.sendResetPassword(user, URL);
      console.log('after send email');
  
      return {
        statue: 200,
        message:
          'your reset link was sent to your email, plais use the link in it to reset your password',
      };
    }

  public async resetPassword(
    token: string,
    newPassword: string,
    passwordConf: string,
  ) {
    const hashedToken = createHash('sha256')
      .update(token)
      .digest('hex');
    const user = await this.userRepo.findOne({
      where: { ResetPassToken: hashedToken },
    });
    if (!user)
      throw new BadRequestException(
        'invalid token or the token has been expired',
      );
    if (
      !user?.ResetPassTokenExpires ||
      user.ResetPassTokenExpires.getTime() < Date.now()
    ) {
      user.ResetPassToken = null;
      user.ResetPassTokenExpires = null;
      await this.userRepo.save(user);
      throw new BadRequestException(
        'invalid token or the token has been expired',
      );
    }
    if (newPassword !== passwordConf)
      throw new BadRequestException('the newPass is not equal passwordConf');
    const salt = await bcrypt.genSalt(12);
    const hashedPass = await bcrypt.hash(newPassword, salt);

    user.password = hashedPass;

    user.ResetPassToken = null;
    user.ResetPassTokenExpires = null;
    user.passwordUpdatedAt = new Date();
    const resault = await this.userRepo.save(user);
    return {
      status: 200,
      message: 'your password has changed successfully, and you can login',
    };
    }
    public async GetResetPassword(token: string, res: Response) {
      const hashedtoken = createHash('sha256').update(token).digest('hex');
      console.log(token);
      const user = await this.userRepo.findOne({
        where: { ResetPassToken: hashedtoken },
      });
      console.log(user);
      if (!user) {
        // throw new BadRequestException('invalid link pleas make shure you are use the link from the email we send to you')
        return res.redirect(`http://localhost:3001/invalid-link`);
      }
      if (
        !user?.ResetPassTokenExpires ||
        user.ResetPassTokenExpires.getTime() < Date.now()
      )
        return res.redirect(`http://localhost:3001/invalid-link`);
      return res.redirect(`http://localhost:3001/reset-password?token=${token}`);
    }
    public async PostResetPassword(dto: ResetPassDtoDto) {
      const { newPassword, passwordConf, ResetPassToken } = dto;
      const hashedToken = createHash('sha256')
        .update(ResetPassToken)
        .digest('hex');
      const user = await this.userRepo.findOne({
        where: { ResetPassToken: hashedToken },
      });
      if (!user)
        throw new BadRequestException(
          'invalid token or the token has been expired',
        );
      if (
        !user?.ResetPassTokenExpires ||
        user.ResetPassTokenExpires.getTime() < Date.now()
      ) {
        user.ResetPassToken = null;
        user.ResetPassTokenExpires = null;
        await this.userRepo.save(user);
        throw new BadRequestException(
          'invalid token or the token has been expired',
        );
      }
      if (newPassword !== passwordConf)
        throw new BadRequestException('the newPass is not equal passwordConf');
      const salt = await bcrypt.genSalt(12);
      const hashedPass = await bcrypt.hash(newPassword, salt);
  
      user.password = hashedPass;
  
      user.ResetPassToken = null;
      user.ResetPassTokenExpires = null;
      user.passwordUpdatedAt = new Date();
      const resault = await this.userRepo.save(user);
      return 'your password has changed succussfuly, and you can login';
    }
}