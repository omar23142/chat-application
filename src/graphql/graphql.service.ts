import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { UserDto } from './dto/userDto';
import { UpdateGraphqlInput } from './dto/update-graphql.input';
import { userType } from 'src/utils/enum';
import { UserService } from 'src/users/User.Service';
import { MailService } from 'src/mail/mail.service';
import { Repository } from 'typeorm';
import { User } from 'src/users/entity/User.entity';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtPayloadType } from 'src/utils/types';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

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

  update(id: number, updateGraphqlInput: UpdateGraphqlInput) {
    return `This action updates a #${id} graphql`;
  }

  remove(id: number) {
    return `This action removes a #${id} graphql`;
  }
}