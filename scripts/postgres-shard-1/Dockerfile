FROM postgres:17-alpine

RUN apk add --no-cache socat bash

COPY docker-entrypoint-wrapper.sh /usr/local/bin/docker-entrypoint-wrapper.sh
COPY init-scripts/ /docker-entrypoint-initdb.d/

RUN chmod +x /usr/local/bin/docker-entrypoint-wrapper.sh

ENV PGDATA=/var/lib/postgresql/data/pgdata

EXPOSE 3000 80 5432

ENTRYPOINT ["/usr/local/bin/docker-entrypoint-wrapper.sh"]
