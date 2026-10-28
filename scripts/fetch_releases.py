#!/usr/bin/env python3
"""
Собирает данные о релизах всех программ NEURO через GitHub API один раз,
на этапе деплоя (в GitHub Actions, с токеном GITHUB_TOKEN, который GitHub
выдаёт автоматически — ничего отдельно заводить не нужно).

Результат сохраняется в assets/data/releases.json и попадает в
опубликованный сайт как обычный статический файл. Браузер посетителя
читает его тем же origin-запросом, что и остальной сайт, — без
обращений к api.github.com напрямую и без риска упереться в лимит
60 запросов/час на одного посетителя.

Используется только стандартная библиотека Python, чтобы не тянуть
зависимости в workflow.
"""
import json
import os
import sys
import urllib.request
import urllib.error
from datetime import datetime, timezone

REPOS = [
    "WZCasper/NeuroMicrofon",
    "WZCasper/NeuroCamera",
    "WZCasper/NeuroSpec",
    "WZCasper/NeuroOverlay",
    "WZCasper/NeuroStream",
    "WZCasper/NeuroBoost",
    "WZCasper/NeuroVox",
    "WZCasper/NeuroCasper",
]

API = "https://api.github.com"
TOKEN = os.environ.get("GITHUB_TOKEN", "")


def gh_get(path):
    req = urllib.request.Request(API + path)
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("X-GitHub-Api-Version", "2022-11-28")
    if TOKEN:
        req.add_header("Authorization", f"Bearer {TOKEN}")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8")), resp.status
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None, 404
        body = e.read().decode("utf-8", "replace")
        print(f"  ! HTTP {e.code} for {path}: {body[:200]}", file=sys.stderr)
        return None, e.code
    except Exception as e:
        print(f"  ! error for {path}: {e}", file=sys.stderr)
        return None, 0


def slim_asset(a):
    return {
        "name": a.get("name"),
        "size": a.get("size"),
        "browser_download_url": a.get("browser_download_url"),
    }


def slim_release(r):
    return {
        "tag_name": r.get("tag_name"),
        "published_at": r.get("published_at"),
        "created_at": r.get("created_at"),
        "html_url": r.get("html_url"),
        "assets": [slim_asset(a) for a in r.get("assets", [])],
    }


def main():
    out = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "repos": {},
    }
    ok = True
    for repo in REPOS:
        print(f"-> {repo}")
        latest, status_latest = gh_get(f"/repos/{repo}/releases/latest")
        recent, status_recent = gh_get(f"/repos/{repo}/releases?per_page=6")

        entry = {
            "latest": slim_release(latest) if latest else None,
            "recent": [slim_release(r) for r in recent] if isinstance(recent, list) else [],
        }
        out["repos"][repo] = entry

        if status_latest not in (200, 404) or status_recent not in (200, 404):
            ok = False

    os.makedirs("assets/data", exist_ok=True)
    with open("assets/data/releases.json", "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"Written assets/data/releases.json ({len(REPOS)} repos).")
    if not ok:
        print("WARNING: some requests failed with unexpected status codes — "
              "see stderr above. Keeping previously generated data if any "
              "exists in the deploy artifact would require extra logic; "
              "for now this just means today's data may be incomplete for "
              "the affected repo(s).", file=sys.stderr)
    # Не падаем с ошибкой из-за отдельных сбоев API — лучше опубликовать
    # сайт с частично неполными данными о релизах (клиентский код и так
    # умеет показывать запасной вариант), чем совсем остановить деплой.


if __name__ == "__main__":
    main()
