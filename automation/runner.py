"""Optional, bounded visible-browser capture for NoteSignal.

Install Playwright separately and run this script from a terminal. It uses its own
persistent browser profile and never reads Chrome's regular profile or cookies.
"""

import argparse
import json
import math
import os
import random
import re
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote, urlparse


HOSTS = {"xiaohongshu.com", "www.xiaohongshu.com"}
NOTE_PATH = re.compile(r"^/(?:explore|discovery/item)/[^/]+/?$|^/user/profile/[^/]+/[^/]+/?$")
WARNING = re.compile(r"验证码|安全验证|账号异常|访问受限|请完成安全验证|滑动滑块完成拼图|captcha|verify your identity", re.I)
MAX_LIMIT = 5
MAX_SCROLLS = 3
MIN_INTERVAL_SECONDS = 30
DAILY_LIMIT = 12


class CollectionStopped(Exception):
    """A visible platform warning or unexpected page stopped this run."""


def canonical_note_url(value):
    parsed = urlparse(value)
    if parsed.scheme != "https" or parsed.hostname not in HOSTS or not NOTE_PATH.fullmatch(parsed.path):
        raise ValueError("not a supported note URL")
    return "https://www.xiaohongshu.com" + parsed.path.rstrip("/")


def mouse_path(start, end, rng=None, steps=24):
    """A modest curved move to a verified target, with endpoints preserved."""
    rng = rng or random.Random()
    sx, sy = start
    ex, ey = end
    distance = math.hypot(ex - sx, ey - sy)
    offset = min(32.0, distance * 0.11)
    side = rng.uniform(-offset, offset)
    dx, dy = ex - sx, ey - sy
    norm = distance or 1
    midx = (sx + ex) / 2 - dy / norm * side
    midy = (sy + ey) / 2 + dx / norm * side
    points = []
    for index in range(steps + 1):
        t = index / steps
        x = (1 - t) ** 2 * sx + 2 * (1 - t) * t * midx + t ** 2 * ex
        y = (1 - t) ** 2 * sy + 2 * (1 - t) * t * midy + t ** 2 * ey
        points.append((x, y))
    return points


def utc_now():
    return datetime.now(timezone.utc).isoformat()


def load_output(path):
    if not path.exists():
        return {"schema": 1, "records": [], "events": []}
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("schema") != 1 or not isinstance(data.get("records"), list) or not isinstance(data.get("events"), list):
        raise ValueError("unsupported output file")
    return data


def save_output(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=path.parent, prefix=".notesignal-", delete=False) as file:
        json.dump(data, file, ensure_ascii=False, indent=2)
        file.write("\n")
        temporary = Path(file.name)
    os.replace(temporary, path)


def check_page(page):
    page_text = page.evaluate("() => document.title + ' ' + (document.body?.innerText || '').slice(0, 1100)")
    if WARNING.search(page_text):
        raise CollectionStopped("verification_or_account_warning")
    login_modal = page.locator(".login-container, [class*='login-modal']")
    if "/login" in urlparse(page.url).path or any(login_modal.nth(i).is_visible() for i in range(min(login_modal.count(), 4))):
        raise CollectionStopped("login_required")


def visible_candidates(page, seen):
    links = page.locator('a[href*="/explore/"], a[href*="/discovery/item/"], a[href*="/user/profile/"]')
    candidates = []
    for index in range(min(links.count(), 80)):
        link = links.nth(index)
        href = link.get_attribute("href")
        if not href:
            continue
        try:
            absolute = page.evaluate("href => new URL(href, location.href).href", href)
            canonical = canonical_note_url(absolute)
        except (ValueError, TypeError):
            continue
        if canonical in seen:
            continue
        box = link.bounding_box()
        if not box or box["width"] < 24 or box["height"] < 24:
            continue
        viewport = page.viewport_size or {"width": 1280, "height": 800}
        if box["y"] < 0 or box["y"] + box["height"] > viewport["height"] or box["x"] < 0 or box["x"] + box["width"] > viewport["width"]:
            continue
        candidates.append((link, canonical, box))
    return candidates


def move_and_click(page, box, cursor, rng):
    inset_x = min(16, box["width"] * 0.2)
    inset_y = min(16, box["height"] * 0.2)
    target = (
        rng.uniform(box["x"] + inset_x, box["x"] + box["width"] - inset_x),
        rng.uniform(box["y"] + inset_y, box["y"] + box["height"] - inset_y),
    )
    for x, y in mouse_path(cursor, target, rng):
        page.mouse.move(x, y)
        time.sleep(rng.uniform(0.006, 0.018))
    page.mouse.down()
    time.sleep(rng.uniform(0.07, 0.16))
    page.mouse.up()
    return target


def read_note(page):
    check_page(page)
    if not NOTE_PATH.fullmatch(urlparse(page.url).path):
        raise CollectionStopped("unexpected_note_page")
    page.wait_for_timeout(3500 + random.randint(0, 1800))
    check_page(page)
    page.mouse.wheel(0, min(220, int((page.viewport_size or {"height": 800})["height"] * 0.25)))
    page.wait_for_timeout(700)
    check_page(page)
    record = page.evaluate("""() => {
      const pick = selectors => {
        for (const selector of selectors) {
          const value = document.querySelector(selector)?.innerText?.trim();
          if (value) return value;
        }
        return '';
      };
      return {
        title: (pick(['h1', '.title', '[class*="note-title"]']) || document.title).slice(0, 180),
        author: pick(['[class*="author"] [class*="name"]', '[class*="user-name"]']).slice(0, 100),
        excerpt: pick(['[class*="note-content"]', '[class*="desc"]', '[class*="content"]']).slice(0, 1800),
        visibleMetrics: pick(['[class*="engage"]', '[class*="interaction"]']).slice(0, 300)
      };
    }""")
    if not record["title"] and not record["excerpt"]:
        raise CollectionStopped("note_content_missing")
    record.update(url=canonical_note_url(page.url), capturedAt=utc_now(), source="visible-page-optional-automation")
    return record


def find_opened_note(context, search_page, previous_pages, timeout_seconds=8):
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        for candidate in [search_page] + [p for p in context.pages if p not in previous_pages]:
            if not candidate.is_closed() and NOTE_PATH.fullmatch(urlparse(candidate.url).path):
                return candidate
        search_page.wait_for_timeout(200)
    raise CollectionStopped("clicked_card_did_not_open_note")


def run_collection(args):
    from playwright.sync_api import sync_playwright

    rng = random.Random()
    profile = Path(args.profile).expanduser().resolve()
    profile.mkdir(parents=True, exist_ok=True)
    output = Path(args.output).expanduser().resolve()
    data = None if args.login else load_output(output)
    seen = set() if data is None else {record.get("url") for record in data["records"]}
    if data is not None:
        today = datetime.now(timezone.utc).date().isoformat()
        captured_today = sum(event.get("event") == "captured" and str(event.get("at", "")).startswith(today) for event in data["events"])
        args.limit = min(args.limit, max(0, DAILY_LIMIT - captured_today))
        if args.limit == 0:
            print("Local UTC-day capture limit reached. No browser opened.")
            return
    search_url = "https://www.xiaohongshu.com/search_result?keyword=" + quote(args.keyword)
    with sync_playwright() as playwright:
        context = playwright.chromium.launch_persistent_context(
            str(profile), headless=False, viewport={"width": 1280, "height": 820},
            channel="chrome", accept_downloads=False, args=["--disable-notifications"],
        )
        page = context.pages[0] if context.pages else context.new_page()
        if args.login:
            page.goto("https://www.xiaohongshu.com/", wait_until="domcontentloaded")
            input("Complete login in this separate browser window, then press Enter here. ")
            context.close()
            return
        collected = 0
        scrolls = 0
        cursor = (620.0, 410.0)
        last_capture = 0.0
        try:
            page.goto(search_url, wait_until="domcontentloaded", timeout=30000)
            page.wait_for_timeout(3000)
            check_page(page)
            while collected < args.limit and scrolls <= args.max_scrolls:
                candidates = visible_candidates(page, seen)
                if not candidates:
                    if scrolls == args.max_scrolls:
                        break
                    check_page(page)
                    page.mouse.wheel(0, 500)
                    page.wait_for_timeout(1500 + rng.randint(0, 1300))
                    scrolls += 1
                    continue
                _, candidate_url, box = candidates[0]
                seen.add(candidate_url)
                check_page(page)
                pause = MIN_INTERVAL_SECONDS - (time.monotonic() - last_capture)
                if last_capture and pause > 0:
                    page.wait_for_timeout(int(pause * 1000))
                    check_page(page)
                previous_pages = set(context.pages)
                cursor = move_and_click(page, box, cursor, rng)
                note_page = find_opened_note(context, page, previous_pages)
                record = read_note(note_page)
                if record["url"] != candidate_url:
                    raise CollectionStopped("clicked_card_opened_unexpected_note")
                data["records"].append(record)
                data["events"].append({"at": utc_now(), "event": "captured", "url": record["url"]})
                save_output(output, data)
                collected += 1
                last_capture = time.monotonic()
                if collected < args.limit:
                    if note_page is page:
                        page.go_back(wait_until="domcontentloaded", timeout=15000)
                        page.wait_for_timeout(1500)
                    else:
                        note_page.close()
                    check_page(page)
                    if urlparse(page.url).path != "/search_result":
                        raise CollectionStopped("search_page_not_restored")
            print(f"Saved {collected} note(s) to {output}")
        except CollectionStopped as error:
            data["events"].append({"at": utc_now(), "event": "stopped", "reason": str(error)})
            save_output(output, data)
            print(f"Stopped: {error}. Saved {collected} note(s) to {output}")
        finally:
            context.close()


def main():
    parser = argparse.ArgumentParser(description="Bounded visible-browser NoteSignal capture")
    parser.add_argument("--login", action="store_true", help="open a separate browser profile for manual sign-in")
    parser.add_argument("--keyword", help="Xiaohongshu search phrase")
    parser.add_argument("--limit", type=int, default=3, help="notes to collect this run, 1–5")
    parser.add_argument("--max-scrolls", type=int, default=2, help="search-page scrolls, 0–3")
    parser.add_argument("--profile", default="~/.notesignal/browser-profile")
    parser.add_argument("--output", default="~/.notesignal/research.json")
    args = parser.parse_args()
    if not args.login and not args.keyword:
        parser.error("--keyword is required outside --login mode")
    if not 1 <= args.limit <= MAX_LIMIT or not 0 <= args.max_scrolls <= MAX_SCROLLS:
        parser.error("--limit must be 1–5 and --max-scrolls must be 0–3")
    run_collection(args)


if __name__ == "__main__":
    main()
