import requests
from bs4 import BeautifulSoup
import re
import pandas as pd

# Example: if your URL looks like
BASE_URL = "https://publicsearch.people.virginia.edu/search/advanced?attribute_4=&attribute_3=&attribute_5=&attribute_7={keyword}&attribute_6=&page={page}"  # <-- change this
TIMEOUT = 10
MAX_PAGES = 1

def scrape_faculty(keywords):
    """
    keywords: list of strings, e.g. ["engineering", "biology", "commerce"]
    """
    all_rows = []

    for keyword in keywords:
        page = 0
        print(f"\n=== Scraping keyword: '{keyword}' ===")

        while page < MAX_PAGES:
            url = BASE_URL.format(keyword=keyword, page=page)

            response = requests.get(url, timeout=TIMEOUT)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, "html.parser")

            # Find all person blocks on this page
            people = soup.find_all(class_="person search-result")

            # If there are no people on this page, stop the loop for this keyword
            if not people:
                break

            for person in people:
                # ----- Name (from <h2>) -----
                name_el = person.find("h2")
                raw_name = name_el.get_text(strip=True) if name_el else None

                # Strip the (#######) from the end and build email from it
                name_match = re.match(r"^(.*)\((.*)\)$", raw_name or "")
                if name_match:
                    name = name_match.group(1).strip()
                    email = name_match.group(2).strip() + "@virginia.edu"
                else:
                    name = raw_name
                    email = "N/A"

                # ----- Department (from <div class='department'>) -----
                dept_el = person.find("div", class_="department")
                department = dept_el.get_text(strip=True) if dept_el else None

                # Collect a row
                all_rows.append({
                    "name": name,
                    "department": department,
                    "email": email,
                    "keyword": keyword,
                })

            # Next page for this keyword
            page += 1

    # Build DataFrame from all collected rows
    df = pd.DataFrame(all_rows, columns=["name", "department", "email", "keyword"])

    # Drop duplicates across keywords (keep first)
    df = df.drop_duplicates(subset=["name", "email", "department"]).reset_index(drop=True)

    print(f"\nScraped {len(df)} unique people total across {len(keywords)} keyword(s)")

    return df