# Agent Instructions for Chat Application

## Project Overview
This is a NestJS-based real-time chat application with WebSocket support for:
- Private 1-on-1 chat rooms with matching system
- User authentication with JWT
- Rating system for matched users
- Message persistence with TypeORM/PostgreSQL

## Architecture

### Core Modules
1. **Users Module** (`src/users/`) - User management, authentication, profiles
2. **Chat Module** (`src/chat/`) - WebSocket gateway, room management, messaging
3. **Mail Module** (`src/mail/`) - Email notifications

### Key Components

#### Chat Gateway (`src/chat/ChatAuth.gateway.ts`)
- WebSocket server on port 3001
- Implements `OnGatewayInit`, `OnGatewayConnection`, `OnGatewayDisconnect`
- Handles user connection, matching, private room creation
- Event handlers: `newMessage`, `rating`, `matchFound`

#### Room Manager Service (`src/chat/room-manager.service.ts`)
- In-memory room state management
- `privateRoom: Map<string, PrivateRoomData>` - roomName → {members, ratings}
- `PrivateRoomFromSocket: Map<Socket, string>` - socket → roomName
- Match rooms for gender-based matching (5 males + 5 females = full)
- Methods: `CreatePrivateChatRoom`, `handleRating`, `handleMatchRating`, `FindmatchRoom`, `DestroyPrivateRoom`

#### Entities
- **User** (`src/users/entity/User.entity.ts`) - Authentication, profile, role, gender, language
- **PrivateChatRoom** (`src/chat/entity/PrivateChatRoom.entity.ts`) - 1-on-1 room with user1Id, user2Id, messages
- **PrivateMessage** (`src/chat/entity/PrivateMessage.entity.ts`) - Messages with content, sender, readAt, deletedAt

## Database
- PostgreSQL with TypeORM
- DataSource in `src/data-source.ts`
- Entities auto-discovered via `**/*.entity{.ts,.js}`
- Synchronize: false (migrations used)
- Migrations in `src/migrations/`

## Key Flows

### User Connection & Matching
1. Client connects with JWT token → `handleConnection()`
2. User joins personal room (`client.join(userId)`)
3. Added to match room via `FindmatchRoom()` by gender
4. When match room full (5M+5F) → creates 5 private rooms per round
5. Private rooms emit `roomAssigned` with partnerId

### Rating & Matching
1. Users submit rating (1-5) via `rating` event → `handleRating()`
2. When both rated → `ratingComplete` emitted with both ratings
3. `handleMatchRating()` checks if ratings equal (match)
4. If match → `matchFound` emitted to both users

### Messaging
- `newMessage` event with `{roomId, text}` → broadcasts to room
- Messages persisted to `PrivateMessage` entity

## Environment Variables (.env)
```
DB_USERNAME, DB_PASSWORD, DB_DATABASE, DB_TYPE, DB_PORT
JWT_SECRET_KEY, JWT_EXPIRES_IN
```

## Running the Project
```bash
npm run start:dev  # Development with hot reload
npm run build      # Build for production
npm run start:prod # Production
```

## Testing
```bash
npm run test       # Unit tests
npm run test:e2e   # E2E tests
```

## Important Notes for Agents
- WebSocket events use `@SubscribeMessage`, `@ConnectedSocket`, `@MessageBody` decorators
- Room naming convention: `private{userId1}_{userId2}`
- Match rooms use round-robin pairing algorithm
- Rating system: both users must rate, equal ratings = match
- Rooms destroyed after rating completion (current behavior)
- User entities have `gender` field (male/female) for matching