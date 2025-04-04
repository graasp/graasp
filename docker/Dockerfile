# Production Docker backend image definition
# Used in CI for creating images to push on registry

# Update the NODE_VERSION arg in docker-compose.yml to pick a Node version of Docker Image
ARG NODE_VERSION=22.14.0

# Variable passed as a build arg. Represents the tag or git sha used for the build
ARG APP_VERSION

##############################
### Build Application Step ###
##############################
# This step will build the application
FROM node:${NODE_VERSION} AS build

# update packages and install the minimal init system "dumb-init"
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init

WORKDIR /app
COPY . .
RUN yarn set version berry && yarn install

RUN yarn build-ts

ENV NODE_ENV=production

# Delete old node_modules and re-install only production dependencies
RUN rm -rf node_modules && yarn workspaces focus --all --production

############################
### Run Application Step ###
############################
# Final step that will run the application
FROM node:${NODE_VERSION}-bookworm-slim AS runner

# Set APP_VERSION as ENV variable from ARG passed at build step
ENV APP_VERSION=${APP_VERSION:-latest}
# Set NODE_ENV to production so we don't trigger .husky/install.mjs
ENV NODE_ENV=production

EXPOSE 3000

WORKDIR /app

COPY --from=build /usr/bin/dumb-init /usr/bin/dumb-init

# Add needed packages
# RUN apk update \
#     && apk upgrade \
#     && apk add \
#         yarn \
#     # Python and GCC are necessary for mmmagic dependency.
#         python3 \
#         py3-pip \
#         make \
#         build-base \
#     # Ghostscript and GraphicsMagick are necessary for pdf2pic library
#         ghostscript \
#         graphicsmagick \
#     && apk cache clean

# COPY ./package.json ./
# COPY ./.yarnrc.yml ./
# COPY ./.yarn/ ./.yarn/
# COPY ./yarn.lock ./


# # Husky's script are needed for postinstall script
# COPY  ./.husky ./.husky

# # Install the application
# RUN yarn set version berry
# RUN yarn workspaces focus --all --production
COPY --chown=node:node --from=build ./app/node_modules ./node_modules
COPY --chown=node:node --from=build ./app/dist ./dist

# Set user to be non-root node
USER node

CMD ["dumb-init", "node", "dist/server.js"]
