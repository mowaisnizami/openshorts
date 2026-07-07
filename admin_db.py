import os
import psycopg2
import psycopg2.extras
from typing import List, Dict, Optional


def _get_conn():
    return psycopg2.connect(
        host=os.environ["DB_HOST"],
        port=int(os.environ.get("DB_PORT", "5432")),
        dbname=os.environ["DB_NAME"],
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
    )


def init_db():
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS niches (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL UNIQUE,
                    created_at TIMESTAMP DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS youtube_channels (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    username VARCHAR(255) NOT NULL UNIQUE,
                    url VARCHAR(512) NOT NULL,
                    niche_id INTEGER REFERENCES niches(id) ON DELETE SET NULL,
                    created_at TIMESTAMP DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS fb_pages (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    page_name VARCHAR(255) NOT NULL,
                    url VARCHAR(512) NOT NULL,
                    niche_id INTEGER REFERENCES niches(id) ON DELETE SET NULL,
                    created_at TIMESTAMP DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS user_niches (
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    niche_id INTEGER REFERENCES niches(id) ON DELETE CASCADE,
                    PRIMARY KEY (user_id, niche_id)
                );
                CREATE TABLE IF NOT EXISTS user_youtube_channels (
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    youtube_channel_id INTEGER REFERENCES youtube_channels(id) ON DELETE CASCADE,
                    PRIMARY KEY (user_id, youtube_channel_id)
                );
                ALTER TABLE fb_pages ADD COLUMN IF NOT EXISTS niche_id INTEGER REFERENCES niches(id) ON DELETE SET NULL;
                CREATE TABLE IF NOT EXISTS whop_channels (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS whop_campaigns (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    whop_channel_id INTEGER REFERENCES whop_channels(id) ON DELETE SET NULL,
                    created_at TIMESTAMP DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS whop_campaign_niches (
                    campaign_id INTEGER REFERENCES whop_campaigns(id) ON DELETE CASCADE,
                    niche_id INTEGER REFERENCES niches(id) ON DELETE CASCADE,
                    PRIMARY KEY (campaign_id, niche_id)
                );
                CREATE TABLE IF NOT EXISTS whop_campaign_youtube_channels (
                    campaign_id INTEGER REFERENCES whop_campaigns(id) ON DELETE CASCADE,
                    youtube_channel_id INTEGER REFERENCES youtube_channels(id) ON DELETE CASCADE,
                    PRIMARY KEY (campaign_id, youtube_channel_id)
                );
            """)
            conn.commit()
    finally:
        conn.close()


# --- Whop Channels ---

def list_whop_channels() -> List[Dict]:
    return _fetchall("SELECT id, name, created_at FROM whop_channels ORDER BY id")


def create_whop_channel(name: str) -> Dict:
    new_id = _execute_returning(
        "INSERT INTO whop_channels (name) VALUES (%s) RETURNING id", (name,)
    )
    return {"id": new_id, "name": name}


def update_whop_channel(channel_id: int, name: str) -> bool:
    _execute("UPDATE whop_channels SET name = %s WHERE id = %s", (name, channel_id))
    return True


def delete_whop_channel(channel_id: int) -> bool:
    _execute("DELETE FROM whop_channels WHERE id = %s", (channel_id,))
    return True


# --- Whop Campaigns ---

def list_whop_campaigns() -> List[Dict]:
    campaigns = _fetchall("""
        SELECT wc.id, wc.name, wc.whop_channel_id, wc.created_at,
               wch.name AS whop_channel_name
        FROM whop_campaigns wc
        LEFT JOIN whop_channels wch ON wch.id = wc.whop_channel_id
        ORDER BY wc.id
    """)
    niche_rows = _fetchall("""
        SELECT wcn.campaign_id, n.id AS niche_id, n.name AS niche_name
        FROM whop_campaign_niches wcn
        JOIN niches n ON n.id = wcn.niche_id
        ORDER BY n.name
    """)
    yt_rows = _fetchall("""
        SELECT wcy.campaign_id, yc.id AS channel_id, yc.name AS channel_name
        FROM whop_campaign_youtube_channels wcy
        JOIN youtube_channels yc ON yc.id = wcy.youtube_channel_id
        ORDER BY yc.name
    """)
    niche_map: Dict[int, List[Dict]] = {}
    for r in niche_rows:
        niche_map.setdefault(r["campaign_id"], []).append({"id": r["niche_id"], "name": r["niche_name"]})
    yt_map: Dict[int, List[Dict]] = {}
    for r in yt_rows:
        yt_map.setdefault(r["campaign_id"], []).append({"id": r["channel_id"], "name": r["channel_name"]})
    for c in campaigns:
        c["niches"] = niche_map.get(c["id"], [])
        c["youtube_channels"] = yt_map.get(c["id"], [])
    return campaigns


def create_whop_campaign(name: str, whop_channel_id: Optional[int] = None) -> Dict:
    new_id = _execute_returning(
        "INSERT INTO whop_campaigns (name, whop_channel_id) VALUES (%s, %s) RETURNING id",
        (name, whop_channel_id),
    )
    return {"id": new_id, "name": name, "whop_channel_id": whop_channel_id}


def update_whop_campaign(campaign_id: int, name: str, whop_channel_id: Optional[int] = None) -> bool:
    _execute(
        "UPDATE whop_campaigns SET name = %s, whop_channel_id = %s WHERE id = %s",
        (name, whop_channel_id, campaign_id),
    )
    return True


def delete_whop_campaign(campaign_id: int) -> bool:
    _execute("DELETE FROM whop_campaigns WHERE id = %s", (campaign_id,))
    return True


# --- Linkage: Whop Campaign ↔ Niches ---

def get_whop_campaign_niches(campaign_id: int) -> List[int]:
    rows = _fetchall("SELECT niche_id FROM whop_campaign_niches WHERE campaign_id = %s", (campaign_id,))
    return [r["niche_id"] for r in rows]


def set_whop_campaign_niches(campaign_id: int, niche_ids: List[int]):
    _execute("DELETE FROM whop_campaign_niches WHERE campaign_id = %s", (campaign_id,))
    if niche_ids:
        conn = _get_conn()
        try:
            with conn.cursor() as cur:
                for nid in niche_ids:
                    cur.execute("INSERT INTO whop_campaign_niches (campaign_id, niche_id) VALUES (%s, %s) ON CONFLICT DO NOTHING", (campaign_id, nid))
            conn.commit()
        finally:
            conn.close()


# --- Linkage: Whop Campaign ↔ YouTube Channels ---

def get_whop_campaign_youtube_channels(campaign_id: int) -> List[int]:
    rows = _fetchall("SELECT youtube_channel_id FROM whop_campaign_youtube_channels WHERE campaign_id = %s", (campaign_id,))
    return [r["youtube_channel_id"] for r in rows]


def set_whop_campaign_youtube_channels(campaign_id: int, channel_ids: List[int]):
    _execute("DELETE FROM whop_campaign_youtube_channels WHERE campaign_id = %s", (campaign_id,))
    if channel_ids:
        conn = _get_conn()
        try:
            with conn.cursor() as cur:
                for cid in channel_ids:
                    cur.execute("INSERT INTO whop_campaign_youtube_channels (campaign_id, youtube_channel_id) VALUES (%s, %s) ON CONFLICT DO NOTHING", (campaign_id, cid))
            conn.commit()
        finally:
            conn.close()


def get_youtube_channel_whop_campaigns(channel_id: int) -> List[int]:
    rows = _fetchall("SELECT campaign_id FROM whop_campaign_youtube_channels WHERE youtube_channel_id = %s", (channel_id,))
    return [r["campaign_id"] for r in rows]


def set_youtube_channel_whop_campaigns(channel_id: int, campaign_ids: List[int]):
    _execute("DELETE FROM whop_campaign_youtube_channels WHERE youtube_channel_id = %s", (channel_id,))
    if campaign_ids:
        conn = _get_conn()
        try:
            with conn.cursor() as cur:
                for cid in campaign_ids:
                    cur.execute("INSERT INTO whop_campaign_youtube_channels (campaign_id, youtube_channel_id) VALUES (%s, %s) ON CONFLICT DO NOTHING", (cid, channel_id))
            conn.commit()
        finally:
            conn.close()


# --- Linkage: User ↔ YouTube Channels ---

def get_user_youtube_channels(user_id: int) -> List[int]:
    rows = _fetchall("SELECT youtube_channel_id FROM user_youtube_channels WHERE user_id = %s", (user_id,))
    return [r["youtube_channel_id"] for r in rows]


def set_user_youtube_channels(user_id: int, channel_ids: List[int]):
    _execute("DELETE FROM user_youtube_channels WHERE user_id = %s", (user_id,))
    if channel_ids:
        conn = _get_conn()
        try:
            with conn.cursor() as cur:
                for cid in channel_ids:
                    cur.execute("INSERT INTO user_youtube_channels (user_id, youtube_channel_id) VALUES (%s, %s) ON CONFLICT DO NOTHING", (user_id, cid))
            conn.commit()
        finally:
            conn.close()


def _fetchall(query: str, params: tuple = ()) -> List[Dict]:
    try:
        conn = _get_conn()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(query, params)
                return [dict(r) for r in cur.fetchall()]
        finally:
            conn.close()
    except psycopg2.errors.UndefinedTable:
        init_db()
        conn = _get_conn()
        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(query, params)
                return [dict(r) for r in cur.fetchall()]
        finally:
            conn.close()


def _fetchone(query: str, params: tuple = ()) -> Optional[Dict]:
    rows = _fetchall(query, params)
    return rows[0] if rows else None


def _execute(query: str, params: tuple = ()) -> None:
    try:
        conn = _get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(query, params)
            conn.commit()
        finally:
            conn.close()
    except psycopg2.errors.UndefinedTable:
        init_db()
        conn = _get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(query, params)
            conn.commit()
        finally:
            conn.close()


def _execute_returning(query: str, params: tuple = ()) -> int:
    try:
        conn = _get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(query, params)
                row = cur.fetchone()
            conn.commit()
            return row[0] if row else None
        finally:
            conn.close()
    except psycopg2.errors.UndefinedTable:
        init_db()
        conn = _get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(query, params)
                row = cur.fetchone()
            conn.commit()
            return row[0] if row else None
        finally:
            conn.close()


# --- Users ---

def list_users() -> List[Dict]:
    users = _fetchall("SELECT id, name, created_at FROM users ORDER BY id")
    rows = _fetchall("""
        SELECT
            uyc.user_id,
            yc.id AS channel_id, yc.name AS channel_name, yc.niche_id,
            n.name AS niche_name,
            wcy.campaign_id, wc.name AS campaign_name,
            wch.id AS whop_channel_id, wch.name AS whop_channel_name
        FROM user_youtube_channels uyc
        JOIN youtube_channels yc ON yc.id = uyc.youtube_channel_id
        LEFT JOIN niches n ON n.id = yc.niche_id
        LEFT JOIN whop_campaign_youtube_channels wcy ON wcy.youtube_channel_id = yc.id
        LEFT JOIN whop_campaigns wc ON wc.id = wcy.campaign_id
        LEFT JOIN whop_channels wch ON wch.id = wc.whop_channel_id
        ORDER BY yc.name, wc.name
    """)
    channel_map: Dict[int, Dict[int, Dict]] = {}
    for r in rows:
        uid = r["user_id"]
        cid = r["channel_id"]
        if uid not in channel_map:
            channel_map[uid] = {}
        if cid not in channel_map[uid]:
            channel_map[uid][cid] = {
                "id": cid,
                "name": r["channel_name"],
                "niche_id": r["niche_id"],
                "niche_name": r["niche_name"],
                "campaigns": [],
            }
        camp = channel_map[uid][cid]["campaigns"]
        if r["campaign_id"] is not None:
            camp.append({
                "id": r["campaign_id"],
                "name": r["campaign_name"],
                "whop_channel_id": r["whop_channel_id"],
                "whop_channel_name": r["whop_channel_name"],
            })
    for u in users:
        u["youtube_channels"] = list(channel_map.get(u["id"], {}).values())
    return users


def create_user(name: str) -> Dict:
    new_id = _execute_returning(
        "INSERT INTO users (name) VALUES (%s) RETURNING id", (name,)
    )
    return {"id": new_id, "name": name}


def update_user(user_id: int, name: str) -> bool:
    _execute("UPDATE users SET name = %s WHERE id = %s", (name, user_id))
    return True


def delete_user(user_id: int) -> bool:
    _execute("DELETE FROM users WHERE id = %s", (user_id,))
    return True


# --- Niches ---

def list_niches() -> List[Dict]:
    return _fetchall("SELECT id, name, created_at FROM niches ORDER BY id")


def create_niche(name: str) -> Dict:
    new_id = _execute_returning(
        "INSERT INTO niches (name) VALUES (%s) RETURNING id", (name,)
    )
    return {"id": new_id, "name": name}


def update_niche(niche_id: int, name: str) -> bool:
    _execute("UPDATE niches SET name = %s WHERE id = %s", (name, niche_id))
    return True


def delete_niche(niche_id: int) -> bool:
    _execute("DELETE FROM niches WHERE id = %s", (niche_id,))
    return True


# --- YouTube Channels ---

def list_youtube_channels() -> List[Dict]:
    channels = _fetchall("""
        SELECT yc.id, yc.name, yc.username, yc.url, yc.niche_id, yc.created_at,
               n.name AS niche_name
        FROM youtube_channels yc
        LEFT JOIN niches n ON n.id = yc.niche_id
        ORDER BY yc.id
    """)
    campaign_rows = _fetchall("""
        SELECT wcy.youtube_channel_id, wc.id AS campaign_id, wc.name AS campaign_name
        FROM whop_campaign_youtube_channels wcy
        JOIN whop_campaigns wc ON wc.id = wcy.campaign_id
        ORDER BY wc.name
    """)
    campaign_map: Dict[int, List[Dict]] = {}
    for r in campaign_rows:
        campaign_map.setdefault(r["youtube_channel_id"], []).append({"id": r["campaign_id"], "name": r["campaign_name"]})
    for ch in channels:
        ch["campaigns"] = campaign_map.get(ch["id"], [])
    return channels


def create_youtube_channel(name: str, username: str, url: str, niche_id: Optional[int] = None) -> Dict:
    new_id = _execute_returning(
        "INSERT INTO youtube_channels (name, username, url, niche_id) VALUES (%s, %s, %s, %s) RETURNING id",
        (name, username, url, niche_id),
    )
    return {"id": new_id, "name": name, "username": username, "url": url, "niche_id": niche_id}


def update_youtube_channel(channel_id: int, name: str, username: str, url: str, niche_id: Optional[int] = None) -> bool:
    _execute(
        "UPDATE youtube_channels SET name = %s, username = %s, url = %s, niche_id = %s WHERE id = %s",
        (name, username, url, niche_id, channel_id),
    )
    return True


def delete_youtube_channel(channel_id: int) -> bool:
    _execute("DELETE FROM youtube_channels WHERE id = %s", (channel_id,))
    return True


# --- FB Pages ---

def list_fb_pages() -> List[Dict]:
    return _fetchall("""
        SELECT fp.id, fp.name, fp.page_name, fp.url, fp.niche_id, fp.created_at,
               n.name AS niche_name
        FROM fb_pages fp
        LEFT JOIN niches n ON n.id = fp.niche_id
        ORDER BY fp.id
    """)


def create_fb_page(name: str, page_name: str, url: str, niche_id: Optional[int] = None) -> Dict:
    new_id = _execute_returning(
        "INSERT INTO fb_pages (name, page_name, url, niche_id) VALUES (%s, %s, %s, %s) RETURNING id",
        (name, page_name, url, niche_id),
    )
    return {"id": new_id, "name": name, "page_name": page_name, "url": url, "niche_id": niche_id}


def update_fb_page(page_id: int, name: str, page_name: str, url: str, niche_id: Optional[int] = None) -> bool:
    _execute(
        "UPDATE fb_pages SET name = %s, page_name = %s, url = %s, niche_id = %s WHERE id = %s",
        (name, page_name, url, niche_id, page_id),
    )
    return True


def delete_fb_page(page_id: int) -> bool:
    _execute("DELETE FROM fb_pages WHERE id = %s", (page_id,))
    return True


# --- Linkage: User ↔ Niches ---

def get_user_niches(user_id: int) -> List[int]:
    rows = _fetchall("SELECT niche_id FROM user_niches WHERE user_id = %s", (user_id,))
    return [r["niche_id"] for r in rows]


def set_user_niches(user_id: int, niche_ids: List[int]):
    _execute("DELETE FROM user_niches WHERE user_id = %s", (user_id,))
    if niche_ids:
        conn = _get_conn()
        try:
            with conn.cursor() as cur:
                for nid in niche_ids:
                    cur.execute("INSERT INTO user_niches (user_id, niche_id) VALUES (%s, %s) ON CONFLICT DO NOTHING", (user_id, nid))
            conn.commit()
        finally:
            conn.close()


def list_user_campaigns(user_id: int) -> List[Dict]:
    return _fetchall("""
        SELECT DISTINCT wc.id, wc.name, wc.whop_channel_id, wc.created_at,
               wch.name AS whop_channel_name
        FROM whop_campaigns wc
        JOIN whop_campaign_niches wcn ON wcn.campaign_id = wc.id
        LEFT JOIN whop_channels wch ON wch.id = wc.whop_channel_id
        WHERE wcn.niche_id IN (
            SELECT un.niche_id FROM user_niches un WHERE un.user_id = %s
        )
        ORDER BY wc.name
    """, (user_id,))



