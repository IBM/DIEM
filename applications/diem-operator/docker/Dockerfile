FROM node:16.4.2-alpine3.14

LABEL   maintainer=guy_huinen@be.ibm.com \
    org.label-schema.description="Diem Core Application" \
    org.label-schema.name="core" \
    org.label-schema.version=$BUILD_VERSION

ARG BUILD_DATE
LABEL org.label-schema.build-date=$BUILD_DATE

ENV LANG=en_US.UTF-8 HOME=/home/app NODE_ENV=production

COPY package.json package-lock.json $HOME/

RUN cd $HOME && npm ci --production

WORKDIR $HOME
COPY server $HOME/server

RUN chmod -R 775 .

CMD [ "node", "./server/server.js" ]