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
            """)
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
    return _fetchall("SELECT id, name, created_at FROM users ORDER BY id")


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
    return _fetchall("""
        SELECT yc.id, yc.name, yc.username, yc.url, yc.niche_id, yc.created_at,
               n.name AS niche_name
        FROM youtube_channels yc
        LEFT JOIN niches n ON n.id = yc.niche_id
        ORDER BY yc.id
    """)


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



