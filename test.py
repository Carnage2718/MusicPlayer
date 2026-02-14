from flask import Flask, render_template_string, send_from_directory
import os

app = Flask(__name__) #Flaskアプリ作成

BASE_DIR = os.path.dirname(os.path.abspath(__file__)) #Musicフォルダのパスを取得
MUSIC_FOLDER = os.path.join(BASE_DIR, 'Music')

@app.route("/")
def index():
    files =[f for f in os.listdir(MUSIC_FOLDER) if f.endswith(".m4a")]#m4aファイルのみ取得
    
    html = """
    <h1>Music Player</h1>
    <u1>
    {% for file in files %}
        <li>
            {{file}}<br>
            <audio controls>
                <source src="/music/{{file}}" type="audio/mp4">
            </audio>
        </li>
        <br>
    {% endfor %}
    </u1>
    """
    return render_template_string(html, files=files) #/music/**でファイルを返す

@app.route("/music/<path:filename>")
def music(filename):
    return send_from_directory(MUSIC_FOLDER, filename)

if __name__ == "__main__":
    app.run(debug=True)