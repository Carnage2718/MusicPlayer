# MusicPlayer ワークスペース

このフォルダは Python 開発用の仮想環境を備えたワークスペースです。
作成日時: 2026-02-14

## 目的
- このディレクトリで Python スクリプトを安全に実行・開発できるように、仮想環境 `.venv` を作成しました。
- 主要ライブラリ（numpy, pandas, matplotlib, scipy, pymeasure 等）をインストール済みです。

## 使い方（Windows PowerShell）
1. ワークスペースへ移動
```powershell
Set-Location -Path "C:\MusicPlayer"
```

2. 仮想環境を有効化
```powershell
# PowerShell 用
.\.venv\Scripts\Activate.ps1
```

3. （必要なら）pip を最新にする
```powershell
python -m pip install --upgrade pip
```

4. 既にインストールされたパッケージ一覧（requirements.txt）がルートにあります。再現したい場合は次のコマンドでインストールします。
```powershell
pip install -r .\requirements.txt
```

5. スクリプト実行例
```powershell
python .\3b_graph.py
```

## 注意点
- `pymeasure` は実機（Keithley など）を制御するためのライブラリで、測定器を接続していないと該当スクリプトは正しく動作しない可能性があります。
- 実行ポリシーにより `Activate.ps1` の実行がブロックされる場合は、管理者やセキュリティポリシーに従って `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned` を検討してください。

## 追加作業（必要なら）
- 開発用の `requirements-dev.txt` やテストスクリプトの追加
- 実行確認（代表スクリプトの動作検証）

問題があれば、どのスクリプトを実行して確認したいか教えてください。