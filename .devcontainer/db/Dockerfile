FROM postgres:13
COPY db-schema.sql /docker-entrypoint-initdb.d/
COPY db-schema-etherpad.sh /docker-entrypoint-initdb.d/