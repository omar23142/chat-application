import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from './src/users/entity/User.entity';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import { Repository } from 'typeorm';
import { userType } from './src/utils/enum';

async function bootstrap() {
  console.log('Starting the seeding process...');
  // Initialize the NestJS application context (this connects to DB and loads configs)
  const app = await NestFactory.createApplicationContext(AppModule);

  const userRepository = app.get<Repository<User>>(getRepositoryToken(User));
  const jwtService = app.get(JwtService);
  const configService = app.get(ConfigService);

  const jwtSecret = configService.get('jwt_secret_key');
  if (!jwtSecret) {
    console.error('Error: jwt_secret_key is not defined in your config/env.');
    process.exit(1);
  }

  const USERS_COUNT = 1000;
  const BATCH_SIZE = 100;
  
  // We will store all generated tokens here
  const k6UsersData: { email: string; token: string }[] = [];

  const salt = await bcrypt.genSalt(10);
  const defaultPassword = await bcrypt.hash('Test1234!', salt);

  console.log(`Generating ${USERS_COUNT} users...`);

  for (let i = 0; i < USERS_COUNT; i += BATCH_SIZE) {
    const usersBatch: User[] = [];
    
    for (let j = 0; j < BATCH_SIZE && i + j < USERS_COUNT; j++) {
      const index = i + j + 1;
      const user = userRepository.create({
        userName: `testuser_k6_${index}_${Date.now()}`,
        email: `testuser_k6_${index}_${Date.now()}@example.com`,
        password: defaultPassword,
        nativeLanguage: 'en',
        gender: 'male',
        role: userType.NORMAL_USER,
        isVerified: true, // Bypass verification step
        isActive: true,
      });
      usersBatch.push(user);
    }

    // Save batch to database
    console.log(`Saving batch ${i / BATCH_SIZE + 1}...`);
    const savedUsers = await userRepository.save(usersBatch);

    // Generate JWT tokens for the saved users
    for (const savedUser of savedUsers) {
      const payload = {
        id: savedUser.id,
        role: savedUser.role,
        gender: savedUser.gender,
        iat: Date.now(),
      };
      
      const token = await jwtService.signAsync(payload, { 
        secret: jwtSecret, 
        expiresIn: '30d' 
      });
      k6UsersData.push({ email: savedUser.email, token: token });
    }
  }

  // Save the array to a JSON file for k6 to use
  fs.writeFileSync('k6-users.json', JSON.stringify(k6UsersData, null, 2));
  console.log(`Successfully saved ${USERS_COUNT} users to database and tokens to k6-users.json`);

  await app.close();
  process.exit(0);
}

bootstrap().catch((err) => {
  console.error('Error seeding users:', err);
  process.exit(1);
});
