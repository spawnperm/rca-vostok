-- Provision the auxiliary databases used by the sidecar services.
--
-- `postgres` in docker-compose.yml only creates POSTGRES_DB (nexus_crm), so
-- without this script Directus and Dify fail to start:
--   * Directus (DB_DATABASE: directus) needs its own schema namespace. Sharing
--     nexus_crm would mix its directus_* system tables into the CRM schema that
--     Drizzle manages.
--   * Dify (DB_DATABASE: dify) expects its database to exist already.
--
-- Mounted into /docker-entrypoint-initdb.d, which the official image executes
-- once, only when the data directory is empty.
CREATE DATABASE directus OWNER nexus;
CREATE DATABASE dify OWNER nexus;
