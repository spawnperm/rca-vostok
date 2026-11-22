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

## Восстановление пароля и почтовый транспорт

Эндпоинт `POST /api/auth/forgot-password` работает всегда, но письмо уходит
только при настроенном SMTP. Без него используется `LoggingMailer`: он пишет
письмо со ссылкой в лог приложения и возвращает `delivered: false` — API честно
сообщает, что письмо не отправлено, вместо тихой имитации успеха.

Чтобы включить доставку, задайте в `.env`:

```bash
SMTP_HOST=smtp.example.ru
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=robot@rca-vostok.ru
SMTP_PASSWORD=...
SMTP_FROM="РЦА «Русский Восток» <no-reply@rca-vostok.ru>"
```

Ссылка в письме ведёт на `${APP_URL}/?tab=account&reset=<token>`; токен
одноразовый, живёт 15 минут, хранится в базе только как SHA-256. После смены
пароля все сеансы аккаунта завершаются.

## Защита от перебора пароля

`POST /api/auth/login` ограничен по двум ключам: 10 попыток на IP и 5 попыток
на учётную запись за 15 минут (счётчики сбрасываются после успешного входа).
`POST /api/auth/forgot-password` — 5 запросов на IP и 3 на адрес за час.

Счётчики хранятся в памяти процесса. Это корректно для текущего развёртывания
(один контейнер `app`); при горизонтальном масштабировании их нужно перенести
в Redis или PostgreSQL, иначе каждый реплика будет считать свой бюджет.

## Эксплуатация и разработка через tmux

Две независимые сессии, чтобы прод и локальная разработка не мешали друг другу.

**Прод** (`rca-ops`, на сервере):

```bash
./deploy/setup-tmux.sh   # создать (идемпотентно, запускается на сервере)
./deploy/ops.sh          # подключиться из WSL по SSH
```

**Разработка** (`rca-dev`, внутри WSL):

```bash
wsl -d Ubuntu -u root
./deploy/setup-tmux-dev.sh   # создать сессию
./deploy/ops-dev.sh          # подключиться (без SSH)
```

Раскладка dev-сессии повторяет прод, но добавлено окно `build` с рабочим
каталогом репозитория для `pnpm run lint` / `pnpm test`:

| Окно | Содержимое |
|---|---|
| `logs` | `docker compose logs -f app` + shell в каталоге стека |
| `status` | `watch -n 5 docker compose ps` |
| `build` | репозиторий `/mnt/c/Projects/rca-vostok` для проверок |
| `shell` | свободный shell |

Пути переопределяются переменными `RCA_APP_DIR` (каталог стека),
`RCA_REPO_DIR` (рабочая копия) и `TMUX_SESSION` (имя сессии). Проверить,
что запущено: `tmux ls`, затем `tmux attach -t rca-dev`.

## Резервное копирование по расписанию

На сервере установлена запись cron (ежедневно в 03:00):

```cron
0 3 * * * cd /opt/rca-vostok && ./deploy/backup.sh >> /var/log/rca-backup.log 2>&1
```

Проверить: `crontab -l`, `tail -20 /var/log/rca-backup.log`. Скрипт проверен
на восстановление: дамп из S3 разворачивается в отдельную БД, счётчики строк
совпадают с рабочей базой.

## Тесты

- `pnpm test` — доменные и прикладные тесты. Интеграционные тесты
  пропускаются, если не задан `TEST_DATABASE_URL`, поэтому команда работает
  без базы.
- `TEST_DATABASE_URL=postgres://... node --test tests/postgres-integration.test.ts`
  — прогон против реального PostgreSQL. CI поднимает сервисный контейнер
  Postgres и запускает эти тесты отдельным job'ом.

Интеграционный набор существует потому, что адаптеры ранее проверялись только
через in-memory двойники, и два производственных дефекта (дубликаты событий
аналитики и отсутствующая колонка `status`) были найдены лишь ручным осмотром
живой базы.

## Деплой и откат

```bash
./deploy/release.sh             # собрать origin/main, пометить образом и выкатить
./deploy/release.sh --rollback  # вернуться к предыдущему образу
```

Каждый релиз получает тег с коротким SHA (`rca-vostok:<sha>`), а предыдущий
образ сохраняется — откат занимает секунды и не требует пересборки. Деплой
использует `--wait`, поэтому команда завершается ошибкой, если контейнер не
стал здоровым, вместо тихой выкатки сломанной версии.

## Наблюдаемость

- `GET /api/health` — проверяет БД (`SELECT 1`), шину событий и применённые
  миграции. Отдаёт **503**, если БД недоступна, и `200` со статусом `degraded`,
  если недоступна необязательная зависимость.
- `GET /api/metrics` — счётчики запросов, ошибки, срабатывания лимитера,
  p50/p95 задержки, разбивка по маршрутам, RSS и heap. Счётчики живут в процессе
  и обнуляются при перезапуске; гистограмм нет.

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
