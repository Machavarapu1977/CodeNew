from database import engine
try:
    conn = engine.connect()
    print('DB_CONNECT_OK')
    conn.close()
except Exception as e:
    print('DB_CONNECT_FAILED', e)
