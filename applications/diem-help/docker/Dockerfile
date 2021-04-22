FROM node:15.11.0-alpine

LABEL maintainer=guy_huinen@be.ibm.com
LABEL com.ibm.service.name=etl-manager

ENV LANG=en_US.UTF-8 HOME=/home/app NODE_ENV=production

COPY package.json package-lock.json $HOME/

RUN cd $HOME && npm ci -q --production

WORKDIR $HOME
COPY public $HOME/public
COPY server $HOME/server
COPY docs $HOME/docs

RUN chmod -R 775 .

CMD [ "node", "./server/server.js" ]