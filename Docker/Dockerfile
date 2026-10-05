
FROM node:22 as base

FROM base as development
WORKDIR /app
COPY package*.json /app/
RUN npm install
COPY . .
# ENV PORT=3000
# ENV NODE_ENV=development
EXPOSE 3000
CMD [ "npm", "run", "dev" ]

FROM base as production
WORKDIR /app
COPY package.json /app/
RUN npm install --only=production
COPY .  . 
EXPOSE 3000
CMD [ "npm", "run", "start" ]
