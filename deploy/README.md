# Развёртывание РЦА «Русский Восток»

Продакшен-стек из пяти контейнеров, поднимаемых `docker compose` на одном VPS.

## Состав стека

| Сервис | Образ | Роль |
|---|---|---|
| `traefik` | `traefik:v3.3` | Единая точка входа на `:80`, маршрутизация по файловому провайдеру |
| `app` | сборка из `Dockerfile` | Express + собранный Vite-бандл, домен DDD |
| `postgres` | `postgres:17-alpine` | Система хранения: аналитика, заявки, обратная связь, база Forgejo |
| `garage` | `dxflrs/garage:v1.0.1` | S3-совместимое хранилище для дампов БД |
| `forgejo` | `codeberg.org/forgejo/forgejo:9` | Self-hosted Git, смонтирован под `/git` |

Только Traefik публикует порт наружу. Дашборд Traefik слушает `127.0.0.1:8080`
и доступен через SSH-туннель. Остальные сервисы видны лишь внутри сети `rca`.

## Первичная установка

```bash
git clone https://github.com/spawnperm/rca-vostok.git
cd rca-vostok

cp .env.example .env
# Задать надёжные значения POSTGRES_PASSWORD, GARAGE_* и APP_URL.
# Сгенерировать секрет Garage: openssl rand -hex 32

# Подставить те же секреты в deploy/garage.toml (rpc_secret, admin_token).
docker compose up -d --build
```

`postgres-init` создаёт базу `forgejo` при первом запуске, поэтому Forgejo
стартует без ручных шагов.

## Инициализация Garage (один раз)

```bash
NODE=$(docker exec rca-garage /garage status | awk '/^[0-9a-f]{16}/{print $1; exit}')
docker exec rca-garage /garage layout assign -z dc1 -c 20G "$NODE"
docker exec rca-garage /garage layout apply --version 1
docker exec rca-garage /garage bucket create rca-vostok-backups
docker exec rca-garage /garage key create rca-backup-key
docker exec rca-garage /garage bucket allow --read --write --owner \
  rca-vostok-backups --key rca-backup-key
docker exec rca-garage /garage key info rca-backup-key --show-secret
```

Вывод последней команды добавить в `.env`:

```
GARAGE_S3_ACCESS_KEY=<Key ID>
GARAGE_S3_SECRET_KEY=<Secret key>
GARAGE_S3_BUCKET=rca-vostok-backups
```

## Резервное копирование

```bash
./deploy/backup.sh
```

Скрипт снимает `pg_dump`, сжимает его, выгружает в
`s3://rca-vostok-backups/postgres/` и удаляет дампы старше `RETENTION_DAYS`
(по умолчанию 14 дней). Для регулярного запуска — cron:

```cron
0 3 * * * cd /opt/rca-vostok && ./deploy/backup.sh >> /var/log/rca-backup.log 2>&1
```

Восстановление:

```bash
aws --endpoint-url http://garage:3900 s3 cp \
  s3://rca-vostok-backups/postgres/<dump>.sql.gz - | gunzip \
  | docker exec -i rca-postgres psql -U rca -d rca_vostok
```

## Эксплуатация через tmux

Долгоживущая сессия `rca-ops` на сервере: обрыв SSH больше не убивает
наблюдение за логами или выполняемую команду.

```bash
./deploy/setup-tmux.sh   # создать сессию (идемпотентно, на сервере)
./deploy/ops.sh          # подключиться из WSL
```

Раскладка сессии:

| Окно | Содержимое |
|---|---|
| `logs` | левая панель — `docker compose logs -f app`, правая — shell в `/opt/rca-vostok` |
| `status` | `watch -n 5 docker compose ps` |
| `shell` | свободный shell для разовых команд |

Горячие клавиши (префикс `Ctrl-b`): `c` — новое окно, `n`/`p` — переключение,
`1`/`2`/`3` — прямое окно, `d` — отцепиться (сессия продолжает работать),
`[` — режим прокрутки. `deploy/ops.sh` использует `ssh -t`, потому что
`tmux attach` требует терминал.

## Проверка после деплоя

```bash
curl -fsS http://<host>/api/health          # persistence.adapter == postgresql
curl -fsS http://<host>/robots.txt
curl -fsS http://<host>/sitemap.xml | head
curl -fsS -o /dev/null -w '%{http_code}\n' http://<host>/git/
```

## Обновление приложения

```bash
git pull
docker compose build app
docker compose up -d app
```

Миграции схемы выполняются автоматически при старте `app`
(`runMigrations` в `src/infrastructure/persistence/pg/PostgresPool.ts`).

## Замечания по безопасности

- TLS не настроен: на хосте нет домена и сертификата. После привязки домена
  добавить в `deploy/traefik.yml` entrypoint `websecure` и ACME-резолвер,
  затем перевести маршруты на `websecure` в `deploy/traefik-dynamic.yml`.
- `docker.sock` в Traefik **не** монтируется: маршрутизация статическая,
  это уменьшает поверхность атаки.
- Регистрация в Forgejo отключена (`DISABLE_REGISTRATION: true`).
