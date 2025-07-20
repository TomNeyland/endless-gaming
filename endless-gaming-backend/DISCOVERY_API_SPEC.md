**Spec #2 — `discovery` Flask Blueprint (Backend support for the Max‑Diff Game‑Picker)**

---

## 1 · Purpose & context

This blueprint gives the minimal server‑side surface required by the Angular “Game‑Picker” described in **Spec #1**.  The client performs all recommendation logic; the backend only (a) exposes a cached JSON dump of all active games + their tags and (b) records user pick events for analytics.

All schemas and code snippets below are **conceptual**.  The implementer should adapt names, types and signatures to match the existing codebase and keep the implementation pragmatic and elegant.

---

## 2 · Blueprint summary

| Item                                                             | Value        |
| ---------------------------------------------------------------- | ------------ |
| **Blueprint name**                                               | `discovery`  |
| **URL prefix**                                                   | `/discovery` |
| **Registration**                                                 | \`\`\`python |
| from app.discovery import bp as discovery\_bp                    |              |
| app.register\_blueprint(discovery\_bp, url\_prefix="/discovery") |              |

````|
| **Recommended libs** | *Flask‑Caching* (server‑side TTL cache), *marshmallow or pydantic* (schema validation) |

---

## 3 · API endpoints

### 3.1 GET `/games/master.json`
| Aspect | Specification |
|--------|---------------|
| **Purpose** | Deliver a full list of every active game and its metadata (including raw tag vote counts) in one payload. |
| **Response body** | JSON **array** of *Game Record* objects (schema §4). |
| **Implementation** |
```python
@bp.route("/games/master.json")
@cache.cached(timeout=86400, key_prefix="master_json_v1")
def get_master_json():
    # 1 – query DB
    games = (
        db.session.query(Game)
        .filter(Game.is_active.is_(True))
        .options(joinedload(Game.metadata))
        .all()
    )

    # 2 – build Python dicts (see schema)
    payload = [to_record(g) for g in games]

    # 3 – jsonify; Flask‑Caching stores the rendered bytes
    return jsonify(payload)
````

|
\| **Headers** | `Cache‑Control: public, max-age=86400` (24 h); `ETag` auto‑set by Flask‑Caching or compute SHA‑256 manually. |
\| **Error behaviour** | On DB error: return `503` and log; cache keeps last good payload until TTL expires. |
\| **Cache invalidation** | Optional admin route: `DELETE /discovery/cache/master` → `cache.delete("master_json_v1")`. |

### 3.2 POST `/choices`

| Aspect                    | Specification                                                                                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Purpose**               | Record one or more user pick events for offline analytics.                                                                                                  |
| **Request body**          | Either a single *Choice Event* object or a JSON **array** of them (schema §4).                                                                              |
| **Cookie / UID**          | Read `request.cookies['uid']`. If absent, generate UUID‑v4 and reply with `Set‑Cookie: uid=<uuid>; SameSite=Lax; Path=/; Max‑Age=31536000`.                 |
| **Validation**            | Use marshmallow/pydantic to enforce required fields and value ranges (`pick ∈ {left,right,skip}`). Reject invalid payloads with `400`.                      |
| **Persistence (concept)** | Table `choice_events`: `id PK`, `user_uid`, `left_id`, `right_id`, `pick` ENUM, `ts_utc` (bigint), `user_agent`, `ip_hash`. Insert rows; ignore duplicates. |
| **Response**              | `204 No Content` on success.                                                                                                                                |

---

## 4 · JSON schemas (conceptual)

### 4.1 Game Record (element of `/games/master.json`)

```jsonc
{
  "appId": 730,
  "name": "Counter‑Strike: Global Offensive",
  "coverUrl": "https://cdn.example.com/covers/730.jpg",
  "price": "0",
  "developer": "Valve",
  "publisher": "Valve",
  "tags": {
    "FPS": 91172,
    "Shooter": 65634
  },
  "genres": ["Action", "Free To Play"],
  "reviewPos": 7642084,
  "reviewNeg": 1173003
}
```

*Rules*

* Include every `Game` where `is_active` is `True`.
* `tags` mirrors `GameMetadata.tags_json` (raw counts, **not** normalised).
* Field names are camelCase to align with the Angular DTOs.

\### 4.2 Choice Event (body of `POST /choices`)

```jsonc
{
  "leftId": 730,
  "rightId": 570,
  "pick": "left",        // 'left' | 'right' | 'skip'
  "ts": 1753023478123      // epoch ms UTC
}
```

---

## 5 · Cross‑cutting concerns

| Concern         | Specification                                                                                               |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| **Compression** | Enable gzip at the web‑server or via `flask-compress`; `master.json` ≈ 500 kB gzip.                         |
| **CORS**        | If SPA served on same origin → nothing. Else set `Access‑Control‑Allow‑Origin` to SPA host for both routes. |
| **CSRF**        | Exempt `POST /choices` if using CSRF‑protect extension (anonymous JSON write).                              |
| **Rate‑limit**  | Simple global IP limit (e.g., 100 req/min) via Flask‑Limiter or upstream proxy.                             |
| **Logging**     | Log path, status, duration. Obfuscate IP to SHA‑1 when writing `choice_events`.                             |

---

## 6 · Deliverables & tasks

1. **`discovery/blueprint.py`** — contains both routes and (optional) cache invalidation route.
2. **Cache integration** — ensure `cache = Cache(app, config={...})` is initialised in `app/__init__.py`.
3. **Alembic migration** — create `choice_events` table.
4. **Unit tests**

   * Success + validation failure for `/choices`.
   * Ensure second hit to `/games/master.json` within TTL does not hit DB (mock/spy `Session.query`).
5. **README** in `app/discovery/` summarising endpoint contracts, cache TTL, and invalidation procedure.

---

## 7 · Recommended libraries (backend)

| Library                        | Why                                                                                    |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| **Flask‑Caching**              | One‑liner `@cache.cached` decoration; supports Redis, Memcached, filesystem back‑ends. |
| **marshmallow / pydantic**     | Declarative request/response validation without manual `if` ladders.                   |
| **Flask‑Limiter** *(optional)* | IP‑based rate limiting in <10 lines.                                                   |

---

*End of spec.*
