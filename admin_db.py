import os
import json
import psycopg2
import psycopg2.extras
from typing import List, Dict, Optional, Tuple


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
                -- Core application tables (replacing JSON files)
                CREATE TABLE IF NOT EXISTS creations (
                    id SERIAL PRIMARY KEY,
                    job_id VARCHAR(255) UNIQUE NOT NULL,
                    source VARCHAR(1024),
                    original_video_title VARCHAR(512),
                    status VARCHAR(50) DEFAULT 'queued',
                    step VARCHAR(255),
                    progress_pct INTEGER DEFAULT 0,
                    steps_history JSONB DEFAULT '[]'::jsonb,
                    transcript_file VARCHAR(512),
                    prompt_file VARCHAR(512),
                    response_file VARCHAR(512),
                    metadata JSONB DEFAULT '{}'::jsonb,
                    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    niche_id INTEGER REFERENCES niches(id) ON DELETE SET NULL,
                    yt_channel_id INTEGER REFERENCES youtube_channels(id) ON DELETE SET NULL,
                    whop_channel_id INTEGER REFERENCES whop_channels(id) ON DELETE SET NULL,
                    whop_campaign_id INTEGER REFERENCES whop_campaigns(id) ON DELETE SET NULL,
                    created_at TIMESTAMP DEFAULT NOW(),
                    updated_at TIMESTAMP DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS clips (
                    id SERIAL PRIMARY KEY,
                    creation_id INTEGER NOT NULL REFERENCES creations(id) ON DELETE CASCADE,
                    clip_index INTEGER NOT NULL,
                    clip_id VARCHAR(255),
                    start_sec DOUBLE PRECISION,
                    end_sec DOUBLE PRECISION,
                    video_description_for_tiktok TEXT,
                    video_description_for_instagram TEXT,
                    video_title_for_youtube_short VARCHAR(512),
                    viral_hook_text TEXT,
                    video_url VARCHAR(1024),
                    video_deleted BOOLEAN DEFAULT FALSE,
                    derived BOOLEAN DEFAULT FALSE,
                    derived_type VARCHAR(100),
                    derived_from_clip_id INTEGER REFERENCES clips(id) ON DELETE SET NULL,
                    created_at TIMESTAMP DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS transcripts (
                    id SERIAL PRIMARY KEY,
                    creation_id INTEGER NOT NULL REFERENCES creations(id) ON DELETE CASCADE UNIQUE,
                    language VARCHAR(20),
                    text TEXT,
                    segments JSONB DEFAULT '[]'::jsonb,
                    created_at TIMESTAMP DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS cost_analyses (
                    id SERIAL PRIMARY KEY,
                    creation_id INTEGER NOT NULL REFERENCES creations(id) ON DELETE CASCADE UNIQUE,
                    total_cost DOUBLE PRECISION,
                    breakdown JSONB DEFAULT '{}'::jsonb,
                    details JSONB DEFAULT '{}'::jsonb,
                    created_at TIMESTAMP DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS remotion_jobs (
                    id SERIAL PRIMARY KEY,
                    render_id VARCHAR(255) UNIQUE NOT NULL,
                    creation_id INTEGER REFERENCES creations(id) ON DELETE CASCADE,
                    clip_id INTEGER REFERENCES clips(id) ON DELETE SET NULL,
                    status VARCHAR(50) DEFAULT 'queued',
                    output_filename VARCHAR(512),
                    props JSONB DEFAULT '{}'::jsonb,
                    result JSONB,
                    error TEXT,
                    created_at TIMESTAMP DEFAULT NOW()
                );
                CREATE TABLE IF NOT EXISTS publish_jobs (
                    id SERIAL PRIMARY KEY,
                    publish_id VARCHAR(255) UNIQUE NOT NULL,
                    creation_id INTEGER REFERENCES creations(id) ON DELETE CASCADE,
                    clip_id INTEGER REFERENCES clips(id) ON DELETE SET NULL,
                    status VARCHAR(50) DEFAULT 'uploading',
                    result JSONB,
                    error TEXT,
                    created_at TIMESTAMP DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_creations_job_id ON creations(job_id);
                CREATE INDEX IF NOT EXISTS idx_creations_status ON creations(status);
                CREATE INDEX IF NOT EXISTS idx_creations_created_at ON creations(created_at DESC);
                CREATE INDEX IF NOT EXISTS idx_clips_creation_id ON clips(creation_id);
                CREATE INDEX IF NOT EXISTS idx_remotion_render_id ON remotion_jobs(render_id);
                CREATE INDEX IF NOT EXISTS idx_publish_publish_id ON publish_jobs(publish_id);
                ALTER TABLE creations ADD COLUMN IF NOT EXISTS logs JSONB DEFAULT '[]'::jsonb;
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

def get_whop_campaign(campaign_id: int) -> Optional[Dict]:
    row = _fetchone("""
        SELECT wc.id, wc.name, wc.whop_channel_id, wc.created_at,
               wch.name AS whop_channel_name
        FROM whop_campaigns wc
        LEFT JOIN whop_channels wch ON wch.id = wc.whop_channel_id
        WHERE wc.id = %s
    """, (campaign_id,))
    if not row:
        return None
    return dict(row)


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


# ═══════════════════════════════════════════════════════════════
# Core application tables (replacing JSON file storage)
# ═══════════════════════════════════════════════════════════════

def _build_creation_row(row: Dict) -> Dict:
    return {
        "job_id": row["job_id"],
        "source": row.get("source", ""),
        "created_at": row["created_at"].isoformat() if hasattr(row.get("created_at"), "isoformat") else row.get("created_at", ""),
        "clips": [],
        "cost_analysis": {},
        "status": row.get("status", ""),
        "step": row.get("step", ""),
        "progress_pct": row.get("progress_pct", 0),
        "steps_history": row.get("steps_history") or [],
        "transcript_file": row.get("transcript_file"),
        "prompt_file": row.get("prompt_file"),
        "response_file": row.get("response_file"),
        "metadata": row.get("metadata") or {},
        "original_video_title": row.get("original_video_title", ""),
        "logs": row.get("logs") or [],
    }


def _resolve_creation_whop_campaign(creation: Dict):
    meta = creation.get("metadata") or {}
    campaign_id = meta.get("whop_campaign_id")
    if campaign_id is not None:
        campaign = get_whop_campaign(int(campaign_id))
        if campaign:
            meta["whop_campaign"] = campaign


def _resolve_creation_id(job_id: str) -> Optional[int]:
    row = _fetchone("SELECT id FROM creations WHERE job_id = %s", (job_id,))
    return row["id"] if row else None


# --- Creations ---

def create_creation(
    job_id: str,
    source: str = "",
    original_video_title: str = "",
    status: str = "queued",
    step: str = "queued",
    progress_pct: int = 0,
    transcript_file: Optional[str] = None,
    prompt_file: Optional[str] = None,
    response_file: Optional[str] = None,
    metadata: Optional[Dict] = None,
    user_id: Optional[int] = None,
    niche_id: Optional[int] = None,
    yt_channel_id: Optional[int] = None,
    whop_channel_id: Optional[int] = None,
    whop_campaign_id: Optional[int] = None,
) -> Dict:
    conn = _get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO creations
                    (job_id, source, original_video_title, status, step, progress_pct,
                     transcript_file, prompt_file, response_file, metadata,
                     user_id, niche_id, yt_channel_id, whop_channel_id, whop_campaign_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
            """, (
                job_id, source, original_video_title, status, step, progress_pct,
                transcript_file, prompt_file, response_file,
                json.dumps(metadata) if metadata else "{}",
                user_id, niche_id, yt_channel_id, whop_channel_id, whop_campaign_id,
            ))
            row = dict(cur.fetchone())
        conn.commit()
        creation = _build_creation_row(row)
        _resolve_creation_whop_campaign(creation)
        return creation
    finally:
        conn.close()


def get_creation(job_id: str) -> Optional[Dict]:
    row = _fetchone("""
        SELECT c.*, ca.total_cost, ca.breakdown, ca.details
        FROM creations c
        LEFT JOIN cost_analyses ca ON ca.creation_id = c.id
        WHERE c.job_id = %s
    """, (job_id,))
    if not row:
        return None
    creation = _build_creation_row(row)
    if row.get("total_cost") is not None:
        creation["cost_analysis"] = {
            "total_cost": row["total_cost"],
            "breakdown": row.get("breakdown") or {},
            "details": row.get("details") or {},
        }
    creation["clips"] = get_clips(row["id"])
    _resolve_creation_whop_campaign(creation)
    return creation


def get_creations(
    limit: int = 20,
    offset: int = 0,
    user_id: Optional[int] = None,
    niche_id: Optional[int] = None,
    yt_channel_id: Optional[int] = None,
    whop_channel_id: Optional[int] = None,
    whop_campaign_id: Optional[int] = None,
) -> tuple:
    conditions: List[str] = []
    params: list = []
    if user_id is not None:
        conditions.append("c.user_id = %s")
        params.append(user_id)
    if niche_id is not None:
        conditions.append("c.niche_id = %s")
        params.append(niche_id)
    if yt_channel_id is not None:
        conditions.append("c.yt_channel_id = %s")
        params.append(yt_channel_id)
    if whop_channel_id is not None:
        conditions.append("c.whop_channel_id = %s")
        params.append(whop_channel_id)
    if whop_campaign_id is not None:
        conditions.append("c.whop_campaign_id = %s")
        params.append(whop_campaign_id)

    where = ""
    if conditions:
        where = "WHERE " + " AND ".join(conditions)

    count_row = _fetchone(f"SELECT COUNT(*) AS cnt FROM creations c {where}", tuple(params))
    total = count_row["cnt"] if count_row else 0

    rows = _fetchall(f"""
        SELECT c.*, ca.total_cost, ca.breakdown, ca.details
        FROM creations c
        LEFT JOIN cost_analyses ca ON ca.creation_id = c.id
        {where}
        ORDER BY c.created_at DESC
        LIMIT %s OFFSET %s
    """, tuple(params + [limit, offset]))

    creations = []
    campaign_ids = set()
    for row in rows:
        creation = _build_creation_row(row)
        if row.get("total_cost") is not None:
            creation["cost_analysis"] = {
                "total_cost": row["total_cost"],
                "breakdown": row.get("breakdown") or {},
                "details": row.get("details") or {},
            }
        creation["clips"] = get_clips(row["id"])
        creations.append(creation)
        meta = creation.get("metadata") or {}
        if meta.get("whop_campaign_id") is not None:
            campaign_ids.add(int(meta["whop_campaign_id"]))

    if campaign_ids:
        campaigns = _fetchall("""
            SELECT wc.id, wc.name, wc.whop_channel_id, wc.created_at,
                   wch.name AS whop_channel_name
            FROM whop_campaigns wc
            LEFT JOIN whop_channels wch ON wch.id = wc.whop_channel_id
            WHERE wc.id = ANY(%s)
        """, (list(campaign_ids),))
        campaign_map = {c["id"]: dict(c) for c in campaigns}
        for creation in creations:
            cid = creation.get("metadata", {}).get("whop_campaign_id")
            if cid is not None and int(cid) in campaign_map:
                creation["metadata"]["whop_campaign"] = campaign_map[int(cid)]

    return creations, total


def update_creation(job_id: str, **updates) -> bool:
    if not updates:
        return False
    set_clauses: List[str] = []
    params: list = []
    for key, value in updates.items():
        if key in ("steps_history", "metadata") and isinstance(value, (dict, list)):
            set_clauses.append(f"{key} = %s::jsonb")
            params.append(json.dumps(value))
        else:
            set_clauses.append(f"{key} = %s")
            params.append(value)
    set_clauses.append("updated_at = NOW()")
    params.append(job_id)
    _execute(f"UPDATE creations SET {', '.join(set_clauses)} WHERE job_id = %s", tuple(params))
    return True


def update_creation_logs(job_id: str, logs: list) -> bool:
    if not logs:
        return False
    _execute("UPDATE creations SET logs = %s::jsonb, updated_at = NOW() WHERE job_id = %s", (json.dumps(logs), job_id))
    return True


def delete_creation(job_id: str) -> bool:
    cid = _resolve_creation_id(job_id)
    if not cid:
        return False
    _execute("DELETE FROM creations WHERE id = %s", (cid,))
    return True


def set_creation_progress(job_id: str, step: str, progress_pct: int, extra_step: Optional[Dict] = None) -> bool:
    step_entry = json.dumps(extra_step or {"step": step, "progress": progress_pct, "timestamp": __import__("time").time()})
    conn = _get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE creations
                SET step = %s, progress_pct = %s,
                    steps_history = COALESCE(steps_history, '[]'::jsonb) || %s::jsonb,
                    updated_at = NOW()
                WHERE job_id = %s
            """, (step, progress_pct, step_entry, job_id))
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


# --- Clips ---

def add_clip(creation_id: int, clip_data: Dict) -> Dict:
    conn = _get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO clips
                    (creation_id, clip_index, clip_id, start_sec, end_sec,
                     video_description_for_tiktok, video_description_for_instagram,
                     video_title_for_youtube_short, viral_hook_text,
                     video_url, video_deleted, derived, derived_type, derived_from_clip_id)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
            """, (
                creation_id,
                clip_data.get("clip_index", 0),
                clip_data.get("clip_id"),
                clip_data.get("start"),
                clip_data.get("end"),
                clip_data.get("video_description_for_tiktok"),
                clip_data.get("video_description_for_instagram"),
                clip_data.get("video_title_for_youtube_short"),
                clip_data.get("viral_hook_text"),
                clip_data.get("video_url"),
                clip_data.get("video_deleted", False),
                clip_data.get("derived", False),
                clip_data.get("derived_type"),
                clip_data.get("derived_from_clip_id"),
            ))
            row = dict(cur.fetchone())
        conn.commit()
        return row
    finally:
        conn.close()


def update_clip(clip_id: int, **updates) -> bool:
    if not updates:
        return False
    set_clauses: List[str] = []
    params: list = []
    for key, value in updates.items():
        set_clauses.append(f"{key} = %s")
        params.append(value)
    params.append(clip_id)
    _execute(f"UPDATE clips SET {', '.join(set_clauses)} WHERE id = %s", tuple(params))
    return True


def update_clip_by_index(creation_id: int, clip_index: int, **updates) -> bool:
    if not updates:
        return False
    set_clauses: List[str] = []
    params: list = []
    for key, value in updates.items():
        set_clauses.append(f"{key} = %s")
        params.append(value)
    params += [creation_id, clip_index]
    _execute(f"UPDATE clips SET {', '.join(set_clauses)} WHERE creation_id = %s AND clip_index = %s", tuple(params))
    return True


def delete_clip(clip_id: int) -> bool:
    _execute("DELETE FROM clips WHERE id = %s", (clip_id,))
    return True


def get_clips(creation_id: int) -> List[Dict]:
    rows = _fetchall("""
        SELECT * FROM clips WHERE creation_id = %s ORDER BY clip_index
    """, (creation_id,))
    result = []
    for r in rows:
        clip = {
            "start": r["start_sec"],
            "end": r["end_sec"],
            "video_description_for_tiktok": r.get("video_description_for_tiktok", ""),
            "video_description_for_instagram": r.get("video_description_for_instagram", ""),
            "video_title_for_youtube_short": r.get("video_title_for_youtube_short", ""),
            "viral_hook_text": r.get("viral_hook_text", ""),
            "video_url": r.get("video_url"),
            "clip_id": r.get("clip_id"),
            "derived": r.get("derived", False),
            "derived_type": r.get("derived_type"),
            "derived_from_clip_index": None,
            "video_deleted": r.get("video_deleted", False),
        }
        # Resolve derived_from_clip_index from derived_from_clip_id
        if r.get("derived_from_clip_id"):
            parent = _fetchone("SELECT clip_index FROM clips WHERE id = %s", (r["derived_from_clip_id"],))
            if parent:
                clip["derived_from_clip_index"] = parent["clip_index"]
        result.append(clip)
    return result


def get_next_clip_version(creation_id: int, base_id: int) -> str:
    rows = _fetchall(
        "SELECT clip_id FROM clips WHERE creation_id = %s AND (clip_id = %s OR clip_id LIKE %s)",
        (creation_id, str(base_id), f"{base_id}-%"),
    )
    max_version = 0
    for r in rows:
        cid = r.get("clip_id", "")
        if cid == str(base_id):
            max_version = max(max_version, 0)
        elif cid and cid.startswith(f"{base_id}-"):
            parts = cid.split("-")
            if len(parts) >= 2:
                try:
                    max_version = max(max_version, int(parts[-1]))
                except ValueError:
                    pass
    return f"{base_id}-{max_version + 1}"


def add_clip_to_creation(job_id: str, clip_data: Dict) -> Optional[Dict]:
    creation_id = _resolve_creation_id(job_id)
    if not creation_id:
        return None
    return add_clip(creation_id, clip_data)


# --- Transcripts ---

def save_transcript(creation_id: int, language: str, text: str, segments: list) -> Dict:
    conn = _get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO transcripts (creation_id, language, text, segments)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (creation_id) DO UPDATE
                    SET language = EXCLUDED.language,
                        text = EXCLUDED.text,
                        segments = EXCLUDED.segments
                RETURNING *
            """, (creation_id, language, text, json.dumps(segments)))
            row = dict(cur.fetchone())
        conn.commit()
        return row
    finally:
        conn.close()


def get_transcript(creation_id: int) -> Optional[Dict]:
    row = _fetchone("SELECT * FROM transcripts WHERE creation_id = %s", (creation_id,))
    if not row:
        return None
    return {
        "segments": row.get("segments") or [],
        "language": row.get("language", ""),
        "text": row.get("text", ""),
    }


# --- Cost Analysis ---

def save_cost_analysis(creation_id: int, total_cost: float, breakdown: Optional[Dict] = None, details: Optional[Dict] = None) -> Dict:
    conn = _get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO cost_analyses (creation_id, total_cost, breakdown, details)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (creation_id) DO UPDATE
                    SET total_cost = EXCLUDED.total_cost,
                        breakdown = EXCLUDED.breakdown,
                        details = EXCLUDED.details
                RETURNING *
            """, (creation_id, total_cost, json.dumps(breakdown or {}), json.dumps(details or {})))
            row = dict(cur.fetchone())
        conn.commit()
        return row
    finally:
        conn.close()


def get_cost_analysis(creation_id: int) -> Optional[Dict]:
    row = _fetchone("SELECT * FROM cost_analyses WHERE creation_id = %s", (creation_id,))
    if not row:
        return None
    return {
        "total_cost": row.get("total_cost"),
        "breakdown": row.get("breakdown") or {},
        "details": row.get("details") or {},
    }


# --- Remotion Jobs ---

def create_remotion_job(render_id: str, creation_id: int, clip_id: Optional[int] = None,
                        output_filename: Optional[str] = None, props: Optional[Dict] = None) -> Dict:
    conn = _get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO remotion_jobs (render_id, creation_id, clip_id, output_filename, props, status)
                VALUES (%s, %s, %s, %s, %s, 'queued')
                RETURNING *
            """, (render_id, creation_id, clip_id, output_filename, json.dumps(props or {})))
            row = dict(cur.fetchone())
        conn.commit()
        return row
    finally:
        conn.close()


def update_remotion_job(render_id: str, status: Optional[str] = None,
                        result: Optional[Dict] = None, error: Optional[str] = None) -> bool:
    set_clauses: List[str] = []
    params: list = []
    if status is not None:
        set_clauses.append("status = %s")
        params.append(status)
    if result is not None:
        set_clauses.append("result = %s::jsonb")
        params.append(json.dumps(result))
    if error is not None:
        set_clauses.append("error = %s")
        params.append(error)
    if not set_clauses:
        return False
    params.append(render_id)
    _execute(f"UPDATE remotion_jobs SET {', '.join(set_clauses)} WHERE render_id = %s", tuple(params))
    return True


def get_remotion_job(render_id: str) -> Optional[Dict]:
    row = _fetchone("SELECT * FROM remotion_jobs WHERE render_id = %s", (render_id,))
    if not row:
        return None
    return {
        "status": row.get("status"),
        "result": row.get("result"),
        "error": row.get("error"),
        "job_id": _get_creation_job_id(row["creation_id"]) if row.get("creation_id") else None,
    }


def _get_creation_job_id(creation_id: int) -> Optional[str]:
    row = _fetchone("SELECT job_id FROM creations WHERE id = %s", (creation_id,))
    return row["job_id"] if row else None


# --- Publish Jobs ---

def create_publish_job(publish_id: str, creation_job_id: Optional[str] = None,
                       clip_id: Optional[int] = None) -> Dict:
    creation_id = _resolve_creation_id(creation_job_id) if creation_job_id else None
    conn = _get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                INSERT INTO publish_jobs (publish_id, creation_id, clip_id, status)
                VALUES (%s, %s, %s, 'uploading')
                RETURNING *
            """, (publish_id, creation_id, clip_id))
            row = dict(cur.fetchone())
        conn.commit()
        return row
    finally:
        conn.close()


def update_publish_job(publish_id: str, status: Optional[str] = None,
                       result: Optional[Dict] = None, error: Optional[str] = None) -> bool:
    set_clauses: List[str] = []
    params: list = []
    if status is not None:
        set_clauses.append("status = %s")
        params.append(status)
    if result is not None:
        set_clauses.append("result = %s::jsonb")
        params.append(json.dumps(result))
    if error is not None:
        set_clauses.append("error = %s")
        params.append(error)
    if not set_clauses:
        return False
    params.append(publish_id)
    _execute(f"UPDATE publish_jobs SET {', '.join(set_clauses)} WHERE publish_id = %s", tuple(params))
    return True


def get_publish_job(publish_id: str) -> Optional[Dict]:
    row = _fetchone("SELECT * FROM publish_jobs WHERE publish_id = %s", (publish_id,))
    if not row:
        return None
    return {
        "status": row.get("status"),
        "result": row.get("result"),
        "error": row.get("error"),
    }



