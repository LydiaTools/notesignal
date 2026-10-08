import random
import tempfile
import unittest
from pathlib import Path

from automation.runner import CollectionStopped, canonical_note_url, check_page, find_opened_note, load_output, mouse_path, move_and_click, read_note, save_output, visible_candidates


class AutomationHelpersTest(unittest.TestCase):
    def test_mouse_path_reaches_verified_target_without_large_detour(self):
        points = mouse_path((10, 20), (210, 220), random.Random(7))
        self.assertEqual(points[0], (10, 20))
        self.assertEqual(points[-1], (210, 220))
        self.assertEqual(len(points), 25)
        self.assertTrue(all(0 <= x <= 220 and 0 <= y <= 230 for x, y in points))

    def test_canonical_url_drops_share_query_and_rejects_other_hosts(self):
        self.assertEqual(canonical_note_url("https://www.xiaohongshu.com/explore/abc?xsec_token=private"), "https://www.xiaohongshu.com/explore/abc")
        with self.assertRaises(ValueError):
            canonical_note_url("https://example.com/explore/abc")
        with self.assertRaises(ValueError):
            canonical_note_url("https://www.xiaohongshu.com/user/profile/person")

    def test_incremental_output_roundtrip(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "research.json"
            data = load_output(path)
            data["records"].append({"url": "https://www.xiaohongshu.com/explore/abc"})
            save_output(path, data)
            self.assertEqual(load_output(path), data)

    def test_mouse_click_opens_only_the_selected_note_in_local_fixture(self):
        try:
            from playwright.sync_api import sync_playwright
        except ImportError:
            self.skipTest("optional Playwright dependency is not installed")
        with sync_playwright() as playwright:
            try:
                browser = playwright.chromium.launch(channel="chrome", headless=True)
            except Exception:
                self.skipTest("Google Chrome is not installed")
            try:
                context = browser.new_context(viewport={"width": 900, "height": 700})
                page = context.new_page()
                unrelated_clicks = []
                page.expose_function("recordUnrelatedClick", lambda: unrelated_clicks.append(True))

                def fixture(route):
                    if "/explore/abc" in route.request.url:
                        route.fulfill(body='<h1>Garden note</h1><div class="note-content">A visible idea</div>', content_type="text/html")
                    else:
                        route.fulfill(body='<button onclick="recordUnrelatedClick()">Follow</button><a href="https://www.xiaohongshu.com/explore/abc" style="display:block;width:220px;height:110px">Garden note card</a>', content_type="text/html")

                page.route("https://www.xiaohongshu.com/**", fixture)
                page.goto("https://www.xiaohongshu.com/search_result?keyword=garden")
                candidates = visible_candidates(page, set())
                self.assertEqual(len(candidates), 1)
                _, url, box = candidates[0]
                previous_pages = set(context.pages)
                move_and_click(page, box, (700, 500), random.Random(8))
                note_page = find_opened_note(context, page, previous_pages)
                record = read_note(note_page)
                self.assertEqual(record["url"], url)
                self.assertEqual(record["title"], "Garden note")
                self.assertEqual(unrelated_clicks, [])
                page.set_content("<h1>请完成安全验证</h1>")
                with self.assertRaises(CollectionStopped):
                    check_page(page)
            finally:
                browser.close()


if __name__ == "__main__":
    unittest.main()
