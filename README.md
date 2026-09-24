# ifastbet-api-contract

Канонический версионируемый контракт между `ifastbet-adminka` и `ifastbet-pocketbase`.

Репозиторий устанавливается напрямую из GitHub и намеренно не публикуется в npm registry. Поле `private: true` защищает пакет от случайной публикации.

## Что зафиксировано

- каталог разрешений по типам узлов, ролям и зависимостям;
- custom REST routes, которые использует админка;
- PocketBase collections, доступные клиентскому API-слою;
- realtime-возможности коллекций;
- поля, используемые в SDK query options (`sort`, `expand`, `getFirstListItem`).

Контракт поверхности не заменяет integration tests. Произвольные request/response payload пока проверяются тестами соответствующих репозиториев; их JSON Schema можно добавлять в контракт постепенно.

Версия 9.1.0 добавляет справочный расчёт по уже полученному авансу и снимок его условий при обычном переводе кредитов. Платёжного баланса, задолженности и постоплаты нет. Снимок доступен выдавшей стороне и её руководству через закрытый API; получатель видит только обычный перевод.

## Подключение

Потребители фиксируют Git tag и коммитят `bun.lock`:

```json
{
  "devDependencies": {
    "@ifastbet/api-contract": "git+https://github.com/iFastBet/ifastbet-api-contract.git#v9.1.0"
  }
}
```

```bash
bun install --frozen-lockfile
bun run node_modules/@ifastbet/api-contract/bin/check.mjs --adminka .
bun run node_modules/@ifastbet/api-contract/bin/check.mjs --backend .
```

Каждый репозиторий проверяет только собственный код. Кросс-repository checkout и GitHub token не нужны.

## Изменение контракта

Версия 9.0.0 удаляет `hall.tv.language.manage`. Язык TV задаёт кассир
в `lang` ссылки; язык профиля пользователя сохраняется. Согласованное изменение
PocketBase удаляет `nodes.language`, запрещает `language` в создании/изменении
зала и убирает язык из stream session. Adminka больше не показывает настройку
языка зала. Выпуск требует TV common 0.4.0 во всех шести TV-приложениях.

Версия 8.0.0 объединяет создание, изменение и удаление менеджеров зала
в `hall.users.manage`; просмотр остаётся отдельным. Старые `hall.users.create`
и `hall.users.update` удалены из runtime-каталога. Миграция заменяет любое из них
новым правом, поэтому прежние частичные назначения получают все три операции.

Версия 7.0.0 вводит типизированные разрешения и `POST /api/nodes/read`.
Модель, перенос и согласованный выпуск потребителей описаны в [docs/permissions.md](docs/permissions.md).

Версия 6.0.0 удаляет `GET /api/currencies/{id}/banknotes`
и параметр `banknotes` из PATCH валюты. Номиналы назначаются сервером из базового
справочника и доступны кассиру в `currencies.banknotes: number[]` через обычное
чтение коллекции и realtime. PATCH валюты принимает только `name` и `symbol`.

1. Изменить `contract.json` и при необходимости адаптеры проверки.
2. Локально выполнить `bun run verify`.
3. Создать неизменяемый Git tag.
4. Обновить tag и `bun.lock` в потребителях отдельными PR/коммитами.

GitHub Actions не используются: проверка выполняется на рабочей машине до публикации изменений.
