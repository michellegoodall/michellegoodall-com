#!/usr/bin/env python3
"""Mirror michellegoodall.com (Webflow) into ./original-site for offline reference.
Run:  cd ~/Developer/michellegoodall-com && python3 scrape_site.py
Uses only the Python standard library."""
import os, re, sys, hashlib, urllib.request, urllib.parse, xml.etree.ElementTree as ET
from html.parser import HTMLParser

START = "https://michellegoodall.com/"
SITE_HOSTS = {"michellegoodall.com", "www.michellegoodall.com"}
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "original-site")
RAW = os.path.join(OUT, "_raw-html")      # untouched HTML exactly as served
UA = {"User-Agent": "Mozilla/5.0 (Macintosh) portfolio-backup"}

def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read(), r.headers.get("Content-Type", ""), r.geturl()

def norm(url):
    u = urllib.parse.urlsplit(url)
    return urllib.parse.urlunsplit((u.scheme or "https", u.netloc, u.path or "/", u.query, ""))

def page_path(url):
    p = urllib.parse.urlsplit(url).path.strip("/")
    return os.path.join(p, "index.html") if p else "index.html"

def asset_path(url):
    u = urllib.parse.urlsplit(url)
    path = urllib.parse.unquote(u.path).lstrip("/") or "file"
    if u.query:
        root, ext = os.path.splitext(path)
        path = f"{root}-{hashlib.md5(u.query.encode()).hexdigest()[:8]}{ext}"
    return os.path.join("assets", u.netloc, path)

class Links(HTMLParser):
    def __init__(s): super().__init__(); s.pages=set(); s.assets=set()
    def handle_starttag(s, tag, attrs):
        a = dict(attrs)
        for k in ("src", "data-src", "poster"):
            if a.get(k): s.assets.add(a[k])
        for k in ("srcset", "data-srcset"):
            if a.get(k):
                for part in a[k].split(","):
                    if part.strip(): s.assets.add(part.strip().split()[0])
        if tag == "link" and a.get("href"): s.assets.add(a["href"])
        if tag == "a" and a.get("href"): s.pages.add(a["href"])
        if tag == "meta" and a.get("content", "").startswith("http") and \
           re.search(r"\.(png|jpe?g|gif|webp|svg|ico)", a["content"], re.I): s.assets.add(a["content"])
        if a.get("style"): s.assets.update(re.findall(r"url\(['\"]?([^'\")]+)", a["style"]))

def save(rel, data):
    full = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "wb") as f: f.write(data)

def relpath(target, from_file):
    return os.path.relpath(target, os.path.dirname(from_file) or ".").replace(os.sep, "/")

def main():
    os.makedirs(RAW, exist_ok=True)
    queue = [START]
    try:
        sm, _, _ = fetch(START + "sitemap.xml")
        save("sitemap.xml", sm)
        for loc in ET.fromstring(sm).iter():
            if loc.tag.endswith("loc") and loc.text: queue.append(loc.text.strip())
    except Exception as e:
        print("no sitemap:", e)
    seen_pages, asset_map, page_files = set(), {}, {}
    while queue:
        url = norm(queue.pop(0))
        if url in seen_pages: continue
        seen_pages.add(url)
        try: body, ctype, final = fetch(url)
        except Exception as e: print("  ! page", url, e); continue
        if "html" not in ctype: continue
        rel = page_path(url); print("page ", rel)
        save(os.path.join("_raw-html", rel), body)
        html = body.decode("utf-8", "replace"); page_files[rel] = (url, html)
        p = Links(); p.feed(html)
        html_css = re.findall(r"url\(['\"]?([^'\")]+)", " ".join(re.findall(r"<style[^>]*>(.*?)</style>", html, re.S)))
        for a in p.assets | set(html_css):
            if a.startswith("data:"): continue
            asset_map.setdefault(norm(urllib.parse.urljoin(url, a)), None)
        for h in p.pages:
            full = urllib.parse.urljoin(url, h)
            u = urllib.parse.urlsplit(full)
            if u.scheme in ("http", "https") and u.netloc in SITE_HOSTS and not re.search(r"\.(pdf|jpe?g|png|zip)$", u.path, re.I):
                queue.append(full)
            elif u.netloc in SITE_HOSTS:
                asset_map.setdefault(norm(full), None)
    # download assets (+ things referenced from CSS)
    pending = list(asset_map)
    while pending:
        url = pending.pop(0)
        if asset_map.get(url): continue
        if urllib.parse.urlsplit(url).scheme not in ("http", "https"): continue
        try: data, ctype, _ = fetch(url)
        except Exception as e: print("  ! asset", url, e); asset_map[url] = "FAILED"; continue
        rel = asset_path(url); asset_map[url] = rel
        if url.endswith(".css") or "text/css" in ctype:
            css = data.decode("utf-8", "replace")
            for ref in re.findall(r"url\(['\"]?([^'\")]+)", css):
                if ref.startswith("data:"): continue
                absu = norm(urllib.parse.urljoin(url, ref))
                if absu not in asset_map: asset_map[absu] = None; pending.append(absu)
            asset_map[url] = (rel, css)
        else:
            save(rel, data)
        print("asset", rel)
    def local(u):
        v = asset_map.get(u); return v[0] if isinstance(v, tuple) else v
    # write CSS with rewritten urls
    for url, v in asset_map.items():
        if isinstance(v, tuple):
            rel, css = v
            def fix(m, base=url, rel=rel):
                l = local(norm(urllib.parse.urljoin(base, m.group(1))))
                return f"url('{relpath(l, rel)}')" if l and l != "FAILED" else m.group(0)
            save(rel, re.sub(r"url\(['\"]?([^'\")]+)['\"]?\)", fix, css).encode())
    # write HTML pages with rewritten links so they open offline
    page_urls = {norm(u): r for r, (u, _) in page_files.items()}
    for rel, (url, html) in page_files.items():
        def fix_attr(m):
            attr, q, val = m.group(1), m.group(2), m.group(3)
            def one(v):
                if v.startswith(("data:", "#", "mailto:", "tel:", "javascript:")): return v
                absu = norm(urllib.parse.urljoin(url, v))
                if absu in page_urls: return relpath(page_urls[absu], rel)
                l = local(absu)
                return relpath(l, rel) if l and l != "FAILED" else v
            if "srcset" in attr:
                val = ", ".join(" ".join([one(p.strip().split()[0])] + p.strip().split()[1:]) for p in val.split(",") if p.strip())
            else: val = one(val)
            return f'{attr}={q}{val}{q}'
        out = re.sub(r'\b(href|src|data-src|poster|srcset|data-srcset|content)=(["\'])(.*?)\2', fix_attr, html)
        def fix_url(m):
            l = local(norm(urllib.parse.urljoin(url, m.group(1))))
            return f"url('{relpath(l, rel)}')" if l and l != "FAILED" else m.group(0)
        out = re.sub(r"url\(['\"]?((?!data:)[^'\")]+)['\"]?\)", fix_url, out)
        save(rel, out.encode())
    print(f"\nDone: {len(page_files)} pages, {sum(1 for v in asset_map.values() if v and v!='FAILED')} assets -> {OUT}")
    print("Open original-site/index.html in a browser to view it offline.")

if __name__ == "__main__":
    main()
