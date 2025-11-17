import re
from functools import lru_cache
from typing import Dict, List
from urllib.parse import quote_plus

import requests
from bs4 import BeautifulSoup


BASE_URL = (
    "https://publicsearch.people.virginia.edu/search/advanced?"
    "attribute_4=&attribute_3=&attribute_5=&attribute_7={keyword}"
    "&attribute_6=&page={page}"
)
TIMEOUT = 10
MAX_PAGES = 1
EMAIL_DOMAIN = "@virginia.edu"


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


def _parse_person(element, keyword: str) -> Dict[str, str]:
    name_el = element.find("h2")
    dept_el = element.find("div", class_="department")
    parsed_name = _extract_name_and_email(name_el.get_text(strip=True) if name_el else "")
    return {
        "name": parsed_name["name"],
        "department": dept_el.get_text(strip=True) if dept_el else "",
        "email": parsed_name["email"],
        "keyword": keyword,
    }


def _scrape_keyword(keyword: str, max_pages: int) -> List[Dict[str, str]]:
    page = 0
    rows: List[Dict[str, str]] = []
    safe_keyword = quote_plus(keyword)
    while page < max_pages:
        url = BASE_URL.format(keyword=safe_keyword, page=page)
        response = requests.get(url, timeout=TIMEOUT)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")
        people = soup.find_all(class_="person search-result")
        if not people:
            break
        for person in people:
            rows.append(_parse_person(person, keyword))
        page += 1
    return rows


@lru_cache(maxsize=64)
def _cached_scrape(key: str, max_pages: int) -> List[Dict[str, str]]:
    keywords = [kw.strip() for kw in key.split("|") if kw.strip()]
    dedup = {}
    for keyword in keywords:
        try:
            for row in _scrape_keyword(keyword, max_pages=max_pages):
                dedup.setdefault((row["name"], row["email"], row["department"]), row)
        except Exception:
            continue
    return list(dedup.values())


def scrape_faculty(keywords: List[str], max_pages: int = MAX_PAGES) -> List[Dict[str, str]]:
    cleaned = [kw.strip() for kw in keywords if kw and kw.strip()]
    if not cleaned:
        return []
    key = "|".join(sorted(cleaned))[:200]
    return _cached_scrape(key, max_pages)
