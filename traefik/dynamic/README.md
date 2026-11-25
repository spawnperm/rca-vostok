# Traefik dynamic configuration

The `traefik` service in `docker-compose.yml` mounts this directory read-only
at `/etc/traefik/dynamic` and watches it (`providers.file.directory`), so rules
for wildcard tenant subdomains can be hot-reloaded without restarting Traefik.

Add \*.yml / \*.toml files here for routers, middlewares and services that are
not derived from Docker labels. An empty directory is valid — Traefik simply
has nothing to merge.
