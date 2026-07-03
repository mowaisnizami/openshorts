Start these in separate terminals, in order:

1. Backend (port 8000)
   uvicorn app:app --host 0.0.0.0 --port 8000
2. Render-service (port 3100)
   cd render-service
   OUTPUT_DIR="/mnt/data/Development/mOwaisNizami/openshorts/output" npm run dev
3. Frontend Vite dev server (port 5173)
   cd dashboard
   npm run dev
