FROM postgres:15
COPY db-schema.sql /docker-entrypoint-initdb.d/
COPY db-schema-etherpad.sh /docker-entrypoint-initdb.d/
