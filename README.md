# ifastbet-api-contract

Канонический версионируемый контракт между `ifastbet-adminka` и `ifastbet-pocketbase`.

Репозиторий устанавливается напрямую из GitHub и намеренно не публикуется в npm registry. Поле `private: true` защищает пакет от случайной публикации.

## Что зафиксировано

- custom REST routes, которые использует админка;
- PocketBase collections, доступные клиентскому API-слою;
- realtime-возможности коллекций;
- поля, используемые в SDK query options (`sort`, `expand`, `getFirstListItem`).

Контракт поверхности не заменяет integration tests. Произвольные request/response payload пока проверяются тестами соответствующих репозиториев; их JSON Schema можно добавлять в контракт постепенно.

## Подключение

Потребители фиксируют Git tag и коммитят `bun.lock`:

```json
{
  "devDependencies": {
    "@ifastbet/api-contract": "git+https://github.com/iFastBet/ifastbet-api-contract.git#v0.1.0"
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

1. Изменить `contract.json` и при необходимости адаптеры проверки.
2. Локально выполнить `bun run verify`.
3. Создать неизменяемый Git tag.
4. Обновить tag и `bun.lock` в потребителях отдельными PR/коммитами.

GitHub Actions не используются: проверка выполняется на рабочей машине до публикации изменений.
