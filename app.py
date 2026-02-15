from flask import Flask
app = Flask(__name__)

@app.route("/")
def home():
    return "Music Player is running!"

if __name__ == "__main__":
    app.run()
    
import os 
import psycopg2
@app.route("/dbtest")
def dbtest():
    conn = psycopg2.connect(os.environ["DATABASE_URL"])
    cur = conn.cursor()
    cur.execute("SELECT 1;")
    result = cur.fetchone()
    cur.close()
    conn.close()
    return f"DB Connected: {result}"