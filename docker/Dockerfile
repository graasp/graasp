# Production Docker backend image definition
# Used in CI for creating images to push on registry

# Update the NODE_VERSION arg in docker-compose.yml to pick a Node version of Docker Image
ARG NODE_VERSION=20

# Update the ALPINE_VERSION arg in docker-compose.yml to pick a Node version of Docker Image
ARG ALPINE_VERSION=3.19

# Variable passed as a build arg. Represents the tag or git sha used for the build
ARG APP_VERSION 

##############################
### Build Application Step ###
##############################
# This step will build the application
FROM node:${NODE_VERSION} AS builder

WORKDIR /app
COPY . .
RUN yarn install

RUN yarn build-ts

############################
### Run Application Step ###
############################
# Final step that will run the application
FROM node:${NODE_VERSION}-alpine${ALPINE_VERSION} AS runner

# Set APP_VERSION as ENV variable from ARG passed at build step
ENV APP_VERSION=${APP_VERSION:-latest}

EXPOSE 3000

WORKDIR /app

# Add needed packages
RUN apk update \
    && apk upgrade \
    && apk add \
        yarn \
    # Python and GCC are necessary for mmmagic dependency.
        python3 \
        py3-pip \
        make \
        build-base \
    && apk cache clean

COPY ./package.json ./

# Husky's script are needed for postinstall script
COPY  ./.husky ./.husky

# Install the application
RUN yarn install --production
COPY --from=builder ./app/dist ./dist

USER node
CMD yarn start