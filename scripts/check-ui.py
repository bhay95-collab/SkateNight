#!/usr/bin/env python3
"""Exercise the real cabinet in Chromium without changing repository files.

Start a local HTTP server, then run:
    python scripts/check-ui.py --base-url http://127.0.0.1:8080

Requires Python Playwright (pip install playwright). Uses /usr/bin/chromium
when present, otherwise Playwright's installed Chromium; --chromium overrides it.
Each run uses fresh browser storage. The completed-arrival flag skips the long
intro; music, requests and settings are exercised through their actual controls.
The diagnostic check changes one HTTP response only, never tracks.js on disk.
"""

import argparse
import json
from pathlib import Path
import re
import sys


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def state(page):
    return page.evaluate("window.__skateNight.state()")


def start(page, base_url):
    page.goto(base_url, wait_until="domcontentloaded")
    page.wait_for_function("window.__skateNight !== undefined")
    page.locator("#attract").click()
    page.wait_for_function("window.__skateNight.state().started && window.__skateNight.player !== null")
    page.wait_for_function("!document.body.classList.contains('on-attract')")


def type_code(page, code, submit=True):
    # The scroll area accepts global code entry while buttons retain native
    # Enter/Space activation. No application methods are called to request songs.
    page.locator("#queue-screen").focus()
    page.keyboard.type(code)
    if submit:
        page.keyboard.press("Enter")


def open_tools(page):
    if page.locator("#cabinet-tools").get_attribute("open") is None:
        page.locator("#cabinet-tools summary").click()


def close_tools(page):
    if page.locator("#cabinet-tools").get_attribute("open") is not None:
        page.locator("#cabinet-tools summary").click()


def keyboard_checks(page, tracks):
    phase = state(page)["phase"]
    lights = page.locator("#btn-lights")
    previous = lights.get_attribute("aria-pressed")
    lights.focus()
    page.keyboard.press("Space")
    page.wait_for_function("value => document.querySelector('#btn-lights').getAttribute('aria-pressed') !== value", arg=previous)
    require(state(page)["phase"] == phase, "Space on LIGHTS changed playback")
    page.keyboard.press("Space")  # Restore CALM for deterministic, faster swaps.

    type_code(page, tracks[1]["code"], submit=False)
    pending = page.locator("#readout-code").text_content()
    before_queue = state(page)["queue"]
    lights.focus()
    page.keyboard.press("Enter")
    require(state(page)["queue"] == before_queue, "Enter on LIGHTS submitted a pending song")
    require(page.locator("#readout-code").text_content() == pending, "Native activation discarded the pending code")
    require(state(page)["phase"] == phase, "Enter on LIGHTS changed playback")
    page.keyboard.press("Space")
    page.locator("#key-clear").click()

    volume = page.locator("#vol-music").input_value()
    for selector in ("#strips", "#queue-screen"):
        page.locator(selector).focus()
        page.keyboard.press("ArrowDown")
        require(page.locator("#vol-music").input_value() == volume, f"ArrowDown on {selector} changed volume")
    album = page.locator("#rack-letter").text_content()
    page.locator("#rack-next").focus()
    page.keyboard.press("ArrowRight")
    page.wait_for_function("letter => document.querySelector('#rack-letter').textContent !== letter", arg=album)
    require(state(page)["phase"] == phase, "Album navigation changed playback")


def queue_checks(page, tracks):
    type_code(page, tracks[0]["code"])
    page.wait_for_function("window.__skateNight.state().phase === 'playing'")
    page.locator("#btn-play").click()
    page.wait_for_function("window.__skateNight.state().phase === 'paused'")
    now = state(page)["nowId"]
    requests = [track for track in tracks if track["id"] != now][:9]
    require(len(requests) == 9, "This regression needs at least ten playable catalogue songs")
    for count, track in enumerate(requests, 1):
        type_code(page, track["code"])
        page.wait_for_function("count => window.__skateNight.state().queue.length === count", arg=count)
    page.wait_for_function("document.querySelectorAll('.q-row:not(.is-house)').length === 9")
    require(page.locator("#queue-count").text_content() == "9 REQUESTS", "Request total is wrong")
    require(page.locator("#queue-continuation").is_visible(), "Overflowing queue has no continuation cue")

    page.locator(".q-row:not(.is-house)").nth(8).locator('[data-queue-action="up"]').focus()
    before = page.evaluate("({track:document.activeElement.dataset.track,scroll:document.querySelector('#queue-screen').scrollTop})")
    page.keyboard.press("Enter")
    page.wait_for_function("id => window.__skateNight.state().queue.indexOf(id) === 7", arg=before["track"])
    page.wait_for_function("id => document.activeElement.dataset.track === id && document.activeElement.dataset.queueAction === 'up'", arg=before["track"])
    after_scroll = page.locator("#queue-screen").evaluate("node => node.scrollTop")
    require(abs(after_scroll - before["scroll"]) <= 1, "Moving a request jumped the queue scroll position")

    page.locator(".q-row:not(.is-house)").nth(7).locator('[data-queue-action="cancel"]').focus()
    page.keyboard.press("Enter")
    page.wait_for_function("id => !window.__skateNight.state().queue.includes(id)", arg=before["track"])
    page.wait_for_function("document.activeElement.dataset.queueAction === 'cancel' && document.activeElement.dataset.track === window.__skateNight.state().queue[7]")
    require(state(page)["queue"][7] == page.evaluate("document.activeElement.dataset.track"), "Cancellation lost focus on the nearest surviving request")
    return len(requests)


def quick_pick_and_settings(page, tracks):
    before = state(page)
    target = next(track for track in tracks if track["id"] not in before["queue"] and track["id"] != before["nowId"])
    type_code(page, target["code"][0], submit=False)
    page.locator("#key-clear").click()
    open_tools(page)
    page.locator("#quick-pick").check()
    close_tools(page)
    strip = page.locator(".strip").filter(has=page.locator(".strip-code", has_text=re.compile(f"^{re.escape(target['code'])}$")))
    require(strip.count() == 1, "Quick-pick target must identify one strip")
    strip.click()
    require(state(page)["queue"] == before["queue"], "Quick pick queued a song without confirmation")
    require(page.locator("#readout-code").text_content() == target["code"], "Quick pick did not fill the selected code")
    require(page.evaluate("document.activeElement.id") == "btn-select", "Quick pick did not focus SELECT")
    require("SELECT OR ENTER" in page.locator("#readout-msg").text_content(), "New selection did not replace the previous acceptance message with confirmation guidance")
    page.keyboard.press("Enter")
    page.wait_for_function("id => window.__skateNight.state().queue.includes(id)", arg=target["id"])

    for selector, output, from_end, steps in (
        ("#vol-music", "#music-value", True, 4),
        ("#vol-sfx", "#sfx-value", False, 2),
    ):
        slider = page.locator(selector)
        slider.focus()
        slider.press("End" if from_end else "Home")
        for _ in range(steps):
            slider.press("ArrowLeft" if from_end else "ArrowRight")
        require(page.locator(output).text_content() == f"{slider.input_value()}%", f"{output} does not show the adjusted volume")
    levels = [page.locator(selector).input_value() for selector in ("#vol-music", "#vol-sfx")]
    open_tools(page)
    vinyl = page.locator("#vol-vinyl")
    vinyl.focus()
    vinyl.press("Home")
    for _ in range(3):
        vinyl.press("ArrowRight")
    require(page.locator("#vinyl-value").text_content() == "3%", "Vinyl numeric output did not update")
    require(levels == [page.locator(selector).input_value() for selector in ("#vol-music", "#vol-sfx")], "Vinyl trim changed music or effects settings")
    close_tools(page)
    return levels + ["3"]


def responsive_checks(page, tracks):
    sizes = [(1920, 1080), (1280, 720), (1024, 768), (800, 600), (768, 1024), (375, 812), (640, 360)]
    # Use the album with the most tracks, rather than assuming a fixed list size.
    letter = max({track["code"][0] for track in tracks}, key=lambda value: sum(track["code"].startswith(value) for track in tracks))
    type_code(page, letter, submit=False)
    page.locator("#key-clear").click()
    for width, height in sizes:
        page.set_viewport_size({"width": width, "height": height})
        page.wait_for_timeout(150)  # Allow ResizeObserver and artwork's next paint.
        result = page.evaluate("""() => {
          const list = document.querySelector('#strips').getBoundingClientRect();
          const rows = [...document.querySelectorAll('.strip')];
          return {horizontal:document.documentElement.scrollWidth > innerWidth + 2,
            tracks:rows.length, visible:rows.every(node => {const r=node.getBoundingClientRect();return r.top >= list.top - 2 && r.bottom <= list.bottom + 2;})};
        }""")
        require(not result["horizontal"], f"Horizontal page overflow at {width}x{height}")
        require(result["tracks"] > 0 and result["visible"], f"Album tracks clipped at {width}x{height}: {result}")
        for selector in ("#btn-select", "#btn-play", "#rack-next", "#cabinet-tools summary"):
            control = page.locator(selector)
            control.scroll_into_view_if_needed()
            box = control.bounding_box()
            require(box and box["x"] >= -1 and box["y"] >= -1 and box["x"] + box["width"] <= width + 2 and box["y"] + box["height"] <= height + 2, f"{selector} is unreachable at {width}x{height}: {box}")
    return [f"{width}x{height}" for width, height in sizes]


def diagnostic_check(browser, base_url, init_script, errors):
    context = browser.new_context(viewport={"width": 1280, "height": 720}, service_workers="block")
    context.add_init_script(init_script)

    def malformed_entry(route):
        response = route.fetch()
        source = response.text()
        marker = "export const tracks = ["
        require(marker in source, "Could not inject diagnostic fixture into the catalogue response")
        route.fulfill(response=response, body=source.replace(marker, marker + "{id:'browser-check-invalid',title:'',volume:'invalid',file:''},", 1))

    context.route("**/tracks.js", malformed_entry)
    page = context.new_page()
    page.on("pageerror", lambda error: errors.append(str(error)))
    start(page, base_url)
    page.locator("#btn-problems").click()
    require(page.locator("#problems-modal").evaluate("node => node.open"), "Diagnostics did not open a native modal dialog")
    for _ in range(4):
        page.keyboard.press("Tab")
        # Native dialog navigation may briefly move focus to browser chrome
        # (reported as body), but background cabinet controls must stay inert.
        require(not page.evaluate("Boolean(document.activeElement.closest('#jukebox'))"), "Tab escaped diagnostics into the cabinet")
    page.keyboard.press("Escape")
    require(not page.locator("#problems-modal").evaluate("node => node.open"), "Escape did not close diagnostics")
    require(page.evaluate("document.activeElement.id") == "btn-problems", "Closing diagnostics did not restore warning-button focus")
    page.locator("#btn-problems").click()
    page.locator("#problems-close").focus()
    page.keyboard.press("Space")
    require(not page.locator("#problems-modal").evaluate("node => node.open"), "Space on Close failed to close diagnostics")
    context.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--base-url", default="http://127.0.0.1:8080")
    parser.add_argument("--chromium", help="Chromium executable; defaults to /usr/bin/chromium when available")
    parser.add_argument("--skip-modal", action="store_true", help="Skip the response-injected diagnostic-dialog check")
    args = parser.parse_args()
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        parser.exit(2, "Python Playwright is required: pip install playwright\n")
    executable = args.chromium or ("/usr/bin/chromium" if Path("/usr/bin/chromium").is_file() else None)
    init_script = "sessionStorage.setItem('sn_booted','1');localStorage.setItem('sn-lights','calm')"
    errors = []
    with sync_playwright() as playwright:
        options = {"headless": True}
        if executable:
            options["executable_path"] = executable
        browser = playwright.chromium.launch(**options)
        try:
            context = browser.new_context(viewport={"width": 1280, "height": 720}, service_workers="block")
            context.add_init_script(init_script)
            page = context.new_page()
            page.set_default_timeout(15000)
            page.on("pageerror", lambda error: errors.append(str(error)))
            start(page, args.base_url)
            tracks = page.evaluate("window.__skateNight.library.tracks")
            require(len(tracks) >= 10, "UI regression needs at least ten catalogue tracks")
            keyboard_checks(page, tracks)
            request_count = queue_checks(page, tracks)
            expected_levels = quick_pick_and_settings(page, tracks)
            start(page, args.base_url)
            actual_levels = [page.locator(selector).input_value() for selector in ("#vol-music", "#vol-sfx", "#vol-vinyl")]
            require(actual_levels == expected_levels, f"Volume settings were not restored: {actual_levels}")
            open_tools(page)
            require(page.locator("#quick-pick").is_checked(), "Quick-pick preference was not restored")
            close_tools(page)
            sizes = responsive_checks(page, tracks)
            if not args.skip_modal:
                diagnostic_check(browser, args.base_url, init_script, errors)
            require(not errors, f"Browser JavaScript errors: {errors}")
            print(json.dumps({"ok": True, "keyboard": "passed", "requests_managed": request_count, "quick_pick": "passed", "saved_volume_levels": actual_levels, "responsive_sizes": sizes, "diagnostics": "skipped" if args.skip_modal else "passed", "javascript_errors": errors}, separators=(",", ":")))
        finally:
            browser.close()


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({"ok": False, "error": str(error)}, separators=(",", ":")), file=sys.stderr)
        sys.exit(1)
