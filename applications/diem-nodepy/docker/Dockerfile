FROM nikolaik/python-nodejs:python3.8-nodejs15

RUN apt-get update && \
    apt-get install -y openjdk-11-jre-headless && \
    apt-get clean;

COPY jars/* /opt/spark/jars/

WORKDIR /app

# RUN apk add --update gcc g++ python3-dev

RUN python3 -m pip install --upgrade pip

COPY requirements.txt $HOME
RUN python3 -m pip install --prefer-binary -r requirements.txt

ENV LANG=en_US.UTF-8 HOME=/home/app NODE_ENV=production
COPY package.json package-lock.json $HOME/

RUN cd $HOME && npm ci --production

WORKDIR $HOME
COPY server $HOME/server

RUN chmod -R 775 .

CMD [ "npm", "start" ]