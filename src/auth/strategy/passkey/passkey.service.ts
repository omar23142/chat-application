import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/users/entity/User.entity';
import { Passkey } from 'src/auth/strategy/passkey/entity/passkey.entity';
import { AuthProvider } from 'src/auth/providers/auth.provider';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';

@Injectable()
export class PasskeyService {
  // Define Reliance Party details (Your App Identity)
  private readonly rpName = 'Chat Application'; // Name of your application shown to the user
  private readonly rpID = 'vagueness-abstain-vowel.ngrok-free.dev'; // The domain that is allowed to authenticate
  private readonly origin = 'https://vagueness-abstain-vowel.ngrok-free.dev'; // The exact origin of your frontend application

  constructor(
    @InjectRepository(Passkey)
    private readonly passkeyRepo: Repository<Passkey>, // Repository to interact with the Passkeys table
    @InjectRepository(User)
    private readonly userRepo: Repository<User>, // Repository to interact with the Users table
    private readonly authProvider: AuthProvider, // Your provider to generate JWTs
  ) {}

  // ==========================================
  // 1. REGISTRATION METHODS
  // ==========================================

  public async getRegistrationOptions(user: User) {
    // Generate WebAuthn options for registering a new device
    const options = await generateRegistrationOptions({
      rpName: this.rpName, // Set the application name
      rpID: this.rpID, // Set the allowed domain
      userID: new TextEncoder().encode(user.id.toString()), // Convert user ID to Uint8Array as required by WebAuthn L3
      userName: user.email, // User identity identifier
      userDisplayName: user.userName, // Display name of the user
      authenticatorSelection: {
        residentKey: 'required', // Tells the device to save the key locally (Passkey)
        userVerification: 'preferred', // Tells the device to prefer biometric validation (FaceID/Fingerprint)
        authenticatorAttachment: 'platform', // Forces the browser to use the built-in OS authenticator (PIN/Password/Fingerprint)
      },
    });

    // Save the challenge in the User table in the DB for verification in the next step
    user.passkeyChallenge = options.challenge; // Reusing passkeyChallenge column or a custom challenge column
    await this.userRepo.save(user); // Commit the saved challenge to the database

    return options; // Return options (including the challenge) to the frontend
  }

  public async verifyRegistration(body: any, user: User) {
    // Retrieve the saved challenge from the database
    const expectedChallenge = user.passkeyChallenge;

    // Check if the challenge exists in the database
    if (!expectedChallenge) {
      throw new BadRequestException('Registration challenge not found'); // Throw error if no challenge was saved
    }

    let verification; // Declare variable to store verification results
    try {
      // Validate the device credentials signature and challenge compatibility
      verification = await verifyRegistrationResponse({
        response: body, // Raw JSON response payload sent by the browser
        expectedChallenge: expectedChallenge, // Challenge we saved in the DB
        expectedOrigin: this.origin, // Verify origin matches the client's URL
        expectedRPID: this.rpID, // Verify Reliance Party ID matches
      });
    } catch (error) {
      throw new BadRequestException(
        'WebAuthn verification failed: ' + error.message,
      ); // Handle
    }

    const { verified, registrationInfo } = verification; // Destructure verification outcome

    if (verified && registrationInfo) {
      const { publicKey, id, counter } = registrationInfo.credential; // Extract key components from the device;
      console.log('credeniallllllllll', id, counter, publicKey);
      console.log('ddd', registrationInfo);

      // Clear the temporary challenge from the user object in the database
      user.passkeyChallenge = null;
      await this.userRepo.save(user); // Save the cleared field
      console.log('userid', user.id);
      
      // Map and create a new Passkey entity
      const newPasskey = this.passkeyRepo.create({
        user: user, // Link key to the authenticated user
        credentialId: id, // It is already a base64url string in SimpleWebAuthn v10
        publicKey: Buffer.from(publicKey), // Store the raw public key bytes
        counter: counter, // Set counter
      });

      await this.passkeyRepo.save(newPasskey); // Save the new passkey to the database
      return { success: true }; // Return successful response
    }

    throw new BadRequestException('Passkey validation failed'); // Throw error if verification came back false
  }

  // ==========================================
  // 2. AUTHENTICATION METHODS
  // ==========================================

  public async getAuthenticationOptions(email: string) {
    // Find the user trying to log in
    const user = await this.userRepo.findOne({ where: { email } });
    console.log('email', email);
    
    console.log('userrrrr', user);
    
    // Throw error if user email does not exist
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Find all registered passkeys for this user
    const userPasskeys = await this.passkeyRepo.find({
      where: { user: { id: user.id } },
    });
    console.log('userpasskeys', userPasskeys);
    

    // Generate WebAuthn credentials login challenge options
    const options = await generateAuthenticationOptions({
      rpID: this.rpID, // Verify Reliance Party ID
      allowCredentials: userPasskeys.map((passkey) => ({
        id: passkey.credentialId, // Use the stored base64url string directly (here return array of credentialId to frontend and frontend will chose one of them based on the private key)
        // Inform the browser that this key is stored internally (internal/hybrid/usb)
        // This stops the browser from defaulting only to USB prompts
        transports: ['internal', 'hybrid'],
      })),
      userVerification: 'preferred', // Require biometric verification if available
      
      
    });
    console.log('optionsssssssssssssssssssssssssss', options);

    // Store the generated challenge in the database
    user.passkeyChallenge = options.challenge;
    await this.userRepo.save(user); // Commit options challenge to DB

    return options; // Return options payload to frontend
  }

  public async verifyAuthentication(body: any, email: string) {
    // Find the user trying to log in
    const user = await this.userRepo.findOne({ where: { email } });

    // Throw error if user is missing
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Retrieve the saved challenge
    const expectedChallenge = user.passkeyChallenge;

    // Check if the challenge is present in the database
    if (!expectedChallenge) {
      throw new BadRequestException('Authentication challenge not found');
    }

    // Find the stored public key from the database matching the incoming credentialId
    const passkey = await this.passkeyRepo.findOne({
      where: { credentialId: body.id, user: { id: user.id } },
    });

    // If key ID is missing, throw exception
    if (!passkey) {
      throw new NotFoundException(
        'Device credential not registered to this account',
      );
    }

    let verification; // Initialize verification payload holder
    try {
      // Authenticate signature against the challenge and the stored public key
      verification = await verifyAuthenticationResponse({
        response: body, // Authenticator response from client
        expectedChallenge: expectedChallenge, // Original challenge stored in DB
        expectedOrigin: this.origin, // Match protocol/port
        expectedRPID: this.rpID, // Match domain
        credential: {
          id: passkey.credentialId, // Pass the base64url encoded credential ID string
          publicKey: new Uint8Array(passkey.publicKey), // Convert stored public key buffer to Uint8Array
          counter: passkey.counter, // Stored clone counter
        },
      });
    } catch (error) {
      throw new BadRequestException('Authentication failed: ' + error.message);
    }

    const { verified, authenticationInfo } = verification; // Destructure verify outputs

    if (verified) {
      // Clear the challenge token
      user.passkeyChallenge = null;
      await this.userRepo.save(user);

      // Update the counter to prevent replay attacks
      passkey.counter = authenticationInfo.newCounter;
      await this.passkeyRepo.save(passkey); // Save new counter value

      // Generate a JWT since authentication succeeded
      const tokens = await this.authProvider.generateJwtForUser(user);
      return { accessToken: tokens }; // Send JWT token wrapped in JSON object to client
    }

    throw new BadRequestException('Invalid signature'); // Fallback error
  }
}
