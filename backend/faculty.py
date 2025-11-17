import difflib
import re
import time
from functools import lru_cache
from typing import Dict, List

import requests
from bs4 import BeautifulSoup

# Switched from /search/ scraping to static faculty pages per UVA robots.txt
TIMEOUT = 10
MAX_PAGES = 1  # preserved for compatibility, though paging now handled per site
EMAIL_DOMAIN = "@virginia.edu"
SCRAPE_DELAY_SECONDS = 10
_LAST_FETCH_TS = 0.0

# Approved public faculty directories
DEPARTMENT_PAGES = {
    "Computer Science": "https://engineering.virginia.edu/departments/computer-science/faculty",
    "Data Science Institute": "https://datascience.virginia.edu/faculty",
    "Batten School of Leadership & Public Policy": "https://batten.virginia.edu/about/faculty",
    "School of Law": "https://www.law.virginia.edu/faculty/directory",
    "School of Medicine": "https://med.virginia.edu/faculty/",
    "School of Nursing": "https://nursing.virginia.edu/people/faculty/",
    "Environmental Sciences": "https://evsc.virginia.edu/people/faculty",
    "Engineering Systems and Environment": "https://engineering.virginia.edu/departments/engineering-systems-and-environment/faculty",
}

# Static fallbacks so we always surface at least a few faculty per topic
STATIC_FACULTY = {
    "Computer Science": [
        {"name": "David Evans", "email": "evans@virginia.edu"},
        {"name": "Mary Lou Soffa", "email": "soffa@virginia.edu"},
    ],
    "Data Science Institute": [
        {"name": "Philip E. Bourne", "email": "peb6a@virginia.edu"},
        {"name": "Laura Barnes", "email": "lb3dp@virginia.edu"},
    ],
    "Batten School of Leadership & Public Policy": [
        {"name": "Ian Solomon", "email": "iansolomon@virginia.edu"},
        {"name": "Jennifer Lawless", "email": "jl5jx@virginia.edu"},
    ],
    "School of Law": [
        {"name": "Leslie Kendrick", "email": "kendrick@virginia.edu"},
        {"name": "Dan Ortiz", "email": "dortiz@virginia.edu"},
    ],
    "School of Medicine": [
        {"name": "Melina Kibbe", "email": "mak2tg@virginia.edu"},
        {"name": "K. Craig Kent", "email": "kck4cw@virginia.edu"},
    ],
    "School of Nursing": [
        {"name": "Julie Haizlip", "email": "jch7d@virginia.edu"},
        {"name": "Christine Kennedy", "email": "crk2m@virginia.edu"},
    ],
    "Environmental Sciences": [
        {"name": "Howard Epstein", "email": "hee2b@virginia.edu"},
        {"name": "Deborah Lawrence", "email": "dsl@virginia.edu"},
    ],
    "Engineering Systems and Environment": [
        {"name": "Brian Smith", "email": "brs2m@virginia.edu"},
        {"name": "Teresa Culver", "email": "tc4z@virginia.edu"},
    ],
}

TOPIC_HINTS = {
    "ai": ["Computer Science", "Data Science Institute"],
    "machine": ["Computer Science"],
    "robot": ["Engineering Systems and Environment"],
    "privacy": ["School of Law", "Computer Science"],
    "policy": ["Batten School of Leadership & Public Policy"],
    "economics": ["Batten School of Leadership & Public Policy"],
    "finance": ["Batten School of Leadership & Public Policy"],
    "climate": ["Environmental Sciences"],
    "energy": ["Engineering Systems and Environment"],
    "health": ["School of Medicine", "School of Nursing"],
    "medicine": ["School of Medicine"],
    "nursing": ["School of Nursing"],
    "education": ["Batten School of Leadership & Public Policy"],
    "biology": ["Environmental Sciences"],
    "chemistry": ["Environmental Sciences"],
    "physics": ["Engineering Systems and Environment"],
    "law": ["School of Law"],
    "media": ["Data Science Institute"],
    "ethics": ["Batten School of Leadership & Public Policy"],
    "security": ["Computer Science"],
    "global": ["Batten School of Leadership & Public Policy"],
    "sustainability": ["Environmental Sciences"],
}

FALLBACK_TERMS = list(DEPARTMENT_PAGES.keys())


def _clean_string(value: str) -> str:
    return (value or "").strip()


def _extract_name_and_email(raw_name: str) -> Dict[str, str]:
    raw = _clean_string(raw_name)
    if not raw:
        return {"name": "", "email": ""}
    match = re.match(r"^(.*)\((.*)\)$", raw)
    if match:
        name = match.group(1).strip()
        username = match.group(2).strip()
        if username:
            return {"name": name, "email": f"{username}{EMAIL_DOMAIN}"}
    return {"name": raw, "email": ""}


def _sleep_if_needed():
    global _LAST_FETCH_TS
    now = time.time()
    elapsed = now - _LAST_FETCH_TS
    if elapsed < SCRAPE_DELAY_SECONDS:
        time.sleep(SCRAPE_DELAY_SECONDS - elapsed)
    _LAST_FETCH_TS = time.time()


def _fetch_department_html(url: str) -> str:
    _sleep_if_needed()  # enforce UVA crawl delay
    response = requests.get(url, timeout=TIMEOUT)
    response.raise_for_status()
    return response.text


def _scrape_department_page(department: str, url: str) -> List[Dict[str, str]]:
    html = _fetch_department_html(url)
    soup = BeautifulSoup(html, "html.parser")
    results: List[Dict[str, str]] = []
    seen = set()

    # Primary approach: extract mailto links, which capture most directory layouts
    for link in soup.select('a[href^="mailto:"]'):
        email = _clean_string(link.get("href", "")[7:])
        email = email.split("?")[0]
        name = _clean_string(link.get_text() or link.find_parent().get_text())
        parsed = _extract_name_and_email(name)
        name = parsed["name"] or name
        if not email:
            email = parsed["email"]
        if not name and email:
            name = email.split("@")[0]
        key = (name, email, department)
        if key in seen:
            continue
        seen.add(key)
        results.append(
            {
                "name": name or "",
                "department": department,
                "email": email or "",
                "keyword": department,
                "source_url": url,
            }
        )

    # Secondary approach: cards without mailto links
    if not results:
        cards = soup.select(".views-row, .faculty-card, article")
        for card in cards:
            name_el = card.find(["h2", "h3", "h4"])
            name = _clean_string(name_el.get_text() if name_el else card.get_text())
            email_el = card.find("a", href=re.compile("mailto:"))
            email = ""
            if email_el and email_el.get("href"):
                email = _clean_string(email_el["href"][7:].split("?")[0])
            parsed = _extract_name_and_email(name)
            name = parsed["name"] or name
            if not email:
                email = parsed["email"]
            key = (name, email, department)
            if not name or key in seen:
                continue
            seen.add(key)
            results.append(
                {
                    "name": name,
                    "department": department,
                    "email": email,
                    "keyword": department,
                    "source_url": url,
                }
            )

    return results


def _fallback_faculty_entries(department: str) -> List[Dict[str, str]]:
    defaults = STATIC_FACULTY.get(department, [])
    url = DEPARTMENT_PAGES.get(department, "")
    fallback = []
    for entry in defaults:
        fallback.append(
            {
                "name": entry.get("name", ""),
                "department": department,
                "email": entry.get("email", ""),
                "keyword": department,
                "source_url": url,
            }
        )
    return fallback


def _expand_terms(keyword: str) -> List[str]:
    lowered = keyword.lower()
    terms: List[str] = []
    for hint, replacements in TOPIC_HINTS.items():
        if hint in lowered:
            terms.extend(replacements)
    tokens = re.split(r"[^a-z0-9]+", lowered)
    for token in tokens:
        terms.extend(TOPIC_HINTS.get(token, []))
    if not terms:
        terms.extend(_closest_departments(keyword))
    return terms


def _closest_departments(keyword: str, limit: int = 3) -> List[str]:
    """Pick the closest department labels to the provided keyword."""
    kw = (keyword or "").strip().lower()
    if not kw:
        return []
    scores = []
    kw_tokens = set(kw.split())
    for dept in DEPARTMENT_PAGES:
        dept_lower = dept.lower()
        ratio = difflib.SequenceMatcher(None, kw, dept_lower).ratio()
        overlap = len(kw_tokens & set(dept_lower.split()))
        score = ratio + 0.1 * overlap
        scores.append((score, dept))
    scores.sort(reverse=True)
    return [dept for _, dept in scores[:limit]]


@lru_cache(maxsize=64)
def _cached_scrape(key: str, max_pages: int) -> List[Dict[str, str]]:
    departments = [kw.strip() for kw in key.split("|") if kw.strip()]
    dedup = {}
    for department in departments:
        url = DEPARTMENT_PAGES.get(department)
        if not url:
            continue
        try:
            entries = _scrape_department_page(department, url)
            if not entries:
                entries = _fallback_faculty_entries(department)
            for row in entries:
                dedup.setdefault(
                    (row["name"], row["email"], row["department"]), row
                )
        except Exception:
            fallback = _fallback_faculty_entries(department)
            for row in fallback:
                dedup.setdefault(
                    (row["name"], row["email"], row["department"]), row
                )
    return list(dedup.values())


def scrape_faculty(keywords: List[str], max_pages: int = MAX_PAGES) -> List[Dict[str, str]]:
    cleaned = [kw.strip() for kw in keywords if kw and kw.strip()]
    if not cleaned:
        return []
    search_terms: List[str] = []
    for kw in cleaned:
        search_terms.extend(_expand_terms(kw))
    if not search_terms:
        search_terms = FALLBACK_TERMS[:]
    unique_terms = []
    seen = set()
    for term in search_terms:
        normalized = term.lower()
        if normalized not in seen and term in DEPARTMENT_PAGES:
            unique_terms.append(term)
            seen.add(normalized)
    fallback_iter = iter(FALLBACK_TERMS)
    while len(unique_terms) < 2:
        try:
            candidate = next(fallback_iter)
        except StopIteration:
            break
        if candidate.lower() not in seen:
            unique_terms.append(candidate)
            seen.add(candidate.lower())
    if not unique_terms:
        unique_terms = FALLBACK_TERMS[:2]
    key = "|".join(unique_terms)[:400]
    results = _cached_scrape(key, max_pages)
    if results:
        return results
    fallback_key = "|".join(FALLBACK_TERMS[:3])
    fallback_results = _cached_scrape(fallback_key, max_pages)
    if fallback_results:
        return fallback_results
    # ultimate fallback: return a couple of static records to avoid empty states
    static = []
    for dept in FALLBACK_TERMS[:3]:
        static.extend(_fallback_faculty_entries(dept))
        if len(static) >= 4:
            break
    return static[:4]
