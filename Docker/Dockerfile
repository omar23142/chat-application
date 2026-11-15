
FROM node:26-alpine as base

# limit privileges for not vurnerable the host if the container is compromised
RUN addgroup -S chatGroup && adduser -S -G chatGroup chatUser
USER chatUser

FROM base as development
WORKDIR /chat-application
COPY package*.json ./

USER root
RUN chown -R chatUser:chatGroup /chat-application
RUN npm install --legacy-peer-deps
COPY . .
RUN mkdir -p dist && chown -R chatUser:chatGroup dist
USER chatUser



# ENV PORT=3000
# ENV NODE_ENV=development
EXPOSE 3000
CMD [ "npm", "run", "dev" ]

FROM base as production
WORKDIR /chat-application

USER root
COPY package.json .

RUN chown -R chatUser:chatGroup /chat-application
RUN npm install --legacy-peer-deps
COPY .  . 
RUN npm run build

# remove the dev dependencies to reduce the image size
RUN npm prune --production --legacy-peer-deps

USER chatUser



EXPOSE 3000
CMD ["sh", "-c", "if [ \"$NODE_ENV\" = \"production\" ]; then exec node dist/src/main.js; else exec npm run dev:docker; fi"]

