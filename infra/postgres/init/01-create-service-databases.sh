#!/bin/sh
# Creates one database + one least-privilege user per microservice (database-per-service pattern).
# Runs automatically on the first start of the Postgres container (docker-entrypoint-initdb.d).
set -eu

SERVICES="${ACI_SERVICES:-auth athlete university application payment esign document notification finance}"
PASSWORD="${ACI_SERVICE_DB_PASSWORD:?ACI_SERVICE_DB_PASSWORD is required}"

for svc in $SERVICES; do
  db="aci_${svc}"
  user="aci_${svc}"
  echo "Creating database ${db} and user ${user}"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    DO \$\$ BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${user}') THEN
        -- CREATEDB lets 'prisma migrate dev' create its shadow database locally.
        CREATE ROLE ${user} LOGIN PASSWORD '${PASSWORD}' CREATEDB;
      END IF;
    END \$\$;
    SELECT 'CREATE DATABASE ${db} OWNER ${user}' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${db}')\gexec
    REVOKE ALL ON DATABASE ${db} FROM PUBLIC;
    GRANT ALL PRIVILEGES ON DATABASE ${db} TO ${user};
EOSQL
done
