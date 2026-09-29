#!/bin/sh
# Applies pending migrations for every service database. Fails fast on the first error.
set -eu
for svc in auth athlete university application payment esign document notification finance; do
  echo "==> migrating ${svc}"
  (cd "/migrations/${svc}" && prisma migrate deploy --schema prisma/schema.prisma)
done
echo "All migrations applied."
