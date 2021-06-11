FROM node:12.18.0-alpine3.9
WORKDIR /usr/src/app
COPY . /usr/src/app
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories \
    && apk --update add tzdata \
    && cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime \
    && echo "Asia/Shanghai" > /etc/timezone \
    && apk del tzdata \
    && npm i --production

CMD ["npm", "start"]
