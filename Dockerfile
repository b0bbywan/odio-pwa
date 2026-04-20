FROM nginx:alpine

ARG VERSION
ARG REPO

ADD https://github.com/${REPO}/releases/download/v${VERSION}/odio-pwa-${VERSION}.zip /tmp/app.zip

RUN apk add --no-cache unzip \
 && rm -rf /usr/share/nginx/html/* \
 && unzip /tmp/app.zip -d /usr/share/nginx/html \
 && rm /tmp/app.zip \
 && apk del unzip

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
