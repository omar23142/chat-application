# Chat Application - Development Context

## Quick Reference

### Project Type
NestJS + TypeORM + PostgreSQL + Socket.IO WebSocket chat application

### Key Directories
```
src/
├── app.module.ts          # Main app module, TypeORM config
├── main.ts                # Entry point
├── data-source.ts         # TypeORM DataSource for migrations
├── chat/
│   ├── ChatAuth.gateway.ts     # WebSocket gateway (port 3001)
│   ├── chat.gateway.ts         # Unused legacy gateway
│   ├── room-manager.service.ts # In-memory room state
│   ├── entity/
│   │   ├── PrivateChatRoom.entity.ts  # Room entity
│   │   └── PrivateMessage.entity.ts   # Message entity
├── users/
│   ├── entity/User.entity.ts  # User with auth, profile
│   ├── User.Service.ts        # User business logic
│   └── users.module.ts
├── mail/                      # Email module
└── utils/                     # Constants, enums, types
```

### Database Entities
- **User**: id, email, userName, password, role, gender, nativeLanguage, isActive, isVerified, createdAt, updatedAt
- **PrivateChatRoom**: id, user1Id, user2Id, matchedAt, createdAt, messages[]
- **PrivateMessage**: id, roomId, senderId, content, createdAt, readAt, deletedAt

### WebSocket Events
| Event | Direction | Payload |
|-------|-----------|---------|
| `connection` | Client→Server | JWT token in auth |
| `newMessage` | Client→Server | `{roomId, text}` |
| `rating` | Client→Server | `number` (1-5) |
| `roomAssigned` | Server→Client | `{roomId, partnerId}` |
| `ratingComplete` | Server→Client | `{roomId, yourRating, partnerRating}` |
| `matchFound` | Server→Client | `{partnerId, roomId}` |
| `partnerLeft` | Server→Client | `{roomId}` |

### Matching Algorithm
1. Users join gender-specific match rooms (max 5 per gender)
2. When room full (5M+5F): round-robin creates 5 private pairs
3. Each round creates pairs with offset: `m = (round + f) % 5`
4. Runs for 5 rounds with 5-second intervals

### Rating Logic
- Users rate partner 1-5 after private chat
- `handleRating()` stores rating per user in room
- When both rated → `ratingComplete` with both scores
- `handleMatchRating()` checks: `firstRating === secondRating` = match
- Match → `matchFound` event, room destroyed

## Commands
```bash
npm run start:dev     # Dev server with hot reload
npm run build         # Compile to dist/
npm run start:prod    # Production server
npm run test          # Unit tests
npm run test:e2e      # E2E tests
npm run migration:run # Run DB migrations
npm run migration:generate src/migrations/<name>  # Generate migration
```

## Common Tasks

### Add New WebSocket Event
1. Add `@SubscribeMessage('eventName')` handler in `ChatAuth.gateway.ts`
2. Implement logic in `room-manager.service.ts`
3. Emit response events via `client.emit()` or `client.to(room).emit()`

### Add Database Field
1. Add column to entity in `src/chat/entity/` or `src/users/entity/`
2. Generate migration: `npm run migration:generate src/migrations/AddFieldName`
3. Run migration: `npm run migration:run`

### Add New Entity
1. Create entity file in appropriate `entity/` directory
2. Add to `entities` array in `app.module.ts` TypeOrmModule config
3. Generate and run migration

### Modify Matching Logic
- Edit `FindmatchRoom()` in `room-manager.service.ts`
- Adjust round-robin in `handleConnection()` in `ChatAuth.gateway.ts`

## Current Issues / TODOs
- [ ] Fix `handleMatchRating` condition bug (`round === 5` never true)
- [ ] Add message persistence in `handleNewMessage()`
- [ ] Implement typing indicators, read receipts, presence
- [ ] Add online/offline status to User entity
- [ ] Create ChatModule for better organization

## Configuration Files
- `.env` - Environment variables (DB, JWT)
- `nest-cli.json` - NestJS CLI config
- `tsconfig.json` - TypeScript config
- `eslint.config.mjs` - ESLint config

## Important Patterns
- Services injected via constructor in providers array
- WebSocket decorators: `@WebSocketGateway`, `@SubscribeMessage`, `@ConnectedSocket`, `@MessageBody`
- TypeORM decorators: `@Entity`, `@Column`, `@PrimaryGeneratedColumn`, `@ManyToOne`, `@OneToMany`, `@JoinColumn`
- Guards for auth: JWT validation in `handleConnection()`
- In-memory state in RoomManger service (Map-based)